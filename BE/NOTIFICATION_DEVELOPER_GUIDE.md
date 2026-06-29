# Notification System - Developer Guide

## Overview

This guide is for developers maintaining or extending the due-soon task notification system. It covers architecture, extending the system, debugging, and best practices.

## System Architecture

### Three-Layer Design

```
┌─────────────────────────────────────────────────────────────┐
│ PRESENTATION LAYER                                          │
│ - Admin API endpoints (/admin/notifications/*)             │
│ - Express handlers with RBAC checks                         │
│ - Zod validation schemas                                    │
└─────────────────────────────────────────────────────────────┘
              ↓↑ (calls service logic)
┌─────────────────────────────────────────────────────────────┐
│ BUSINESS LOGIC LAYER (notificationPipeline.service.ts)     │
│ - processDueSoonNotifications: Main entry point            │
│ - processSingleTaskNotification: Per-task logic            │
│ - processPendingEmailJobs: Email sending orchestration     │
│ - getNotificationStats: Analytics                          │
└─────────────────────────────────────────────────────────────┘
              ↓↑ (queries and mutates db)
┌─────────────────────────────────────────────────────────────┐
│ DATA ACCESS LAYER (notifications.repository.ts)            │
│ - queryTasksDueSoon: Efficient task scanning               │
│ - createNotificationWithIdempotency: Upsert-safe           │
│ - claimNotificationJob: Concurrent-safe status update      │
│ - getFailedJobs: Retry management                          │
└─────────────────────────────────────────────────────────────┘
              ↓↑ (raw SQL + Drizzle ORM)
┌─────────────────────────────────────────────────────────────┐
│ DATABASE LAYER                                              │
│ - PostgreSQL 15.8                                           │
│ - 4 core tables + indexes                                  │
│ - Unique constraints for idempotency                       │
└─────────────────────────────────────────────────────────────┘
```

### Why This Design?

- **Repository**: Isolates DB access, making it testable and reusable
- **Service**: Contains business logic, independent of how it's called (API, CLI, tests)
- **Handler**: Express middleware, allows multiple entry points without code duplication

## Extending the System

### Use Case 1: Add New Notification Type

Example: "Task overdue" notifications (in addition to "due soon")

**Steps:**

1. **Update schema type enum** (src/schema.ts):
```typescript
export const notificationType = pgEnum('notification_type', [
  'due_soon',
  'overdue',    // NEW
  'custom'
]);
```

2. **Add repository query function** (notifications.repository.ts):
```typescript
export async function queryTasksOverdue(
  workspaceId: string,
  batchSize: number
): Promise<ITask[]> {
  return db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.workspace_id, workspaceId),
        lt(tasks.due_date, sql`CURRENT_DATE`),
        ne(tasks.status, 'completed'),
        isNull(tasks.deleted_at)
      )
    )
    .limit(batchSize)
    .limit(batchSize);
}
```

3. **Add service function** (notificationPipeline.service.ts):
```typescript
export async function processOverdueNotifications(
  context: NotificationPipelineContext
): Promise<NotificationJobResult[]> {
  const overdueJobs = await processOverdueImpl(context);
  return overdueJobs;
}
```

4. **Add admin endpoint** (handlers/admin/resources/notifications/):
```typescript
export const triggerOverdueNotificationsAdmin = asyncHandler(
  async (req: Request, res: Response) => {
    const results = await processOverdueNotifications(context);
    res.json({ code: 200, data: { results } });
  }
);
```

5. **Register route** (routes/admin/notifications.ts):
```typescript
app.post('/admin/notifications/trigger-overdue', 
  adminGuards, 
  triggerOverdueNotificationsAdmin);
```

### Use Case 2: Add New Notification Channel (Slack, SMS, etc.)

**Current Flow:** Task → In-app notification → Email job queue → SMTP

**Extend To:** Add Slack notifications

**Steps:**

1. **Add notification_jobs columns** (new migration or schema update):
```sql
ALTER TABLE notification_jobs ADD COLUMN slack_channel_id VARCHAR;
ALTER TABLE notification_jobs ADD COLUMN slack_ts VARCHAR; -- Thread timestamp
```

2. **Update repository** (notifications.repository.ts):
```typescript
export async function createSlackNotificationJob(
  taskId: string,
  channelId: string,
  workspaceId: string
): Promise<void> {
  await db.insert(notificationJobs).values({
    id: generateId(),
    task_id: taskId,
    notification_type: 'slack',
    slack_channel_id: channelId,
    scheduled_at: new Date(),
    status: 'pending',
    workspace_id: workspaceId,
  });
}

export async function getPendingSlackJobs(
  workspaceId: string,
  batchSize: number
): Promise<INotificationJob[]> {
  return db
    .select()
    .from(notificationJobs)
    .where(
      and(
        eq(notificationJobs.workspace_id, workspaceId),
        eq(notificationJobs.status, 'pending'),
        eq(notificationJobs.notification_type, 'slack')
      )
    )
    .limit(batchSize);
}
```

3. **Add service** (notificationPipeline.service.ts):
```typescript
export async function processSlackJobs(
  workspaceId: string,
  dryRun: boolean = false
): Promise<void> {
  const jobs = await getPendingSlackJobs(workspaceId, 50);
  
  for (const job of jobs) {
    try {
      if (!dryRun) {
        await claimNotificationJob(job.id);
        const result = await sendSlackMessage(job);
        await markJobProcessed(job.id, 1); // 1 recipient (channel)
      }
    } catch (error) {
      await markJobFailed(job.id, error.message);
    }
  }
}
```

### Use Case 3: Add Custom Notification Delivery Rule

Example: Only notify High-priority tasks to managers

**Steps:**

1. **Query with metadata filter** (notifications.repository.ts):
```typescript
export async function queryHighPriorityTasksForManagers(
  workspaceId: string,
  batchSize: number
): Promise<ITask[]> {
  return db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.workspace_id, workspaceId),
        gte(tasks.due_date, sql`CURRENT_DATE`),
        lte(tasks.due_date, sql`CURRENT_DATE + ${10} days`),
        like(tasks.metadata, '%"priority":"high"%'), // JSONB search
        ne(tasks.status, 'completed')
      )
    )
    .limit(batchSize);
}
```

2. **Filter assignees by role** (notificationPipeline.service.ts):
```typescript
const allAssignees = await getTaskAssignees(task.uuid);

// Only notify managers
const managerAssignees = allAssignees.filter(
  (user) => user.role === 'MANAGER' || user.role === 'ADMIN'
);
```

## Debugging

### Enable Verbose Logging

```bash
# Set DEBUG env var to enable detailed logs
DEBUG=notification:* pnpm run worker:notifications --workspace-id=<WS_UUID>

# Or use pino pretty for readable output
pnpm run worker:notifications --workspace-id=<WS_UUID> 2>&1 | pino-pretty
```

### Check Job Status in DB

```sql
-- View all notification jobs for a workspace
SELECT id, task_id, notification_type, status, retry_count, error, scheduled_at 
FROM notification_jobs 
WHERE workspace_id = '<WORKSPACE_UUID>'
ORDER BY created_at DESC
LIMIT 20;

-- Find jobs with errors
SELECT * FROM notification_jobs 
WHERE workspace_id = '<WORKSPACE_UUID>' AND status = 'failed'
ORDER BY updated_at DESC;

-- Find stuck jobs (processing for > 1 hour)
SELECT * FROM notification_jobs 
WHERE workspace_id = '<WORKSPACE_UUID>' 
  AND status = 'processing' 
  AND updated_at < now() - interval '1 hour';

-- View notification delivery stats
SELECT 
  notification_type,
  status,
  COUNT(*) as count,
  AVG(retry_count) as avg_retries
FROM notification_jobs
WHERE workspace_id = '<WORKSPACE_UUID>'
GROUP BY notification_type, status;
```

### Check User Notification State

```sql
-- View all notifications for a user
SELECT n.id, n.title, n.type, n.status, un.is_read, un.read_at
FROM user_notifications un
JOIN notifications n ON un.notification_id = n.id
WHERE un.user_id = '<USER_UUID>' AND un.workspace_id = '<WORKSPACE_UUID>'
ORDER BY n.created_at DESC;

-- Count unread notifications per user in workspace
SELECT user_id, COUNT(*) as unread_count
FROM user_notifications
WHERE workspace_id = '<WORKSPACE_UUID>' AND is_read = false
GROUP BY user_id;
```

### Trace Email Sending Issue

1. **Check email config:**
```sql
SELECT email FROM system_configs 
WHERE workspace_id = '<WORKSPACE_UUID>';
```

2. **Check SMTP connectivity** (from API):
```bash
curl -X POST http://localhost:4000/admin/system-config/test-email \
  -H "x-workspace-id: <WORKSPACE_UUID>" \
  -H "Authorization: Bearer <TOKEN>"
```

3. **Check email job details:**
```sql
SELECT * FROM notification_jobs 
WHERE workspace_id = '<WORKSPACE_UUID>' 
  AND notification_type = 'email'
  AND status = 'failed'
LIMIT 5;
```

4. **Run worker in dry-run mode** (to see what would be sent):
```bash
DRY_RUN=true pnpm run worker:notifications --workspace-id=<WS_UUID>
```

### Test Specific Job Manually

```typescript
// scripts/debug-job.ts - Manually process a specific job

import { db } from '../src/services/db/drizzle';
import { processPendingEmailJobs, getNotificationStats } from '../src/services/notificationPipeline.service';

async function debugJob(workspaceId: string, jobId: string) {
  console.log('Processing job:', jobId);
  
  // Get job details
  const job = await db.query.notificationJobs.findFirst({
    where: (jobs) => eq(jobs.id, jobId)
  });
  
  console.log('Job:', job);
  
  // Process it
  try {
    await processPendingEmailJobs(workspaceId, false); // dryRun=false
    console.log('✓ Job processed successfully');
  } catch (error) {
    console.error('✗ Job processing failed:', error);
  }
  
  // Check updated status
  const updated = await db.query.notificationJobs.findFirst({
    where: (jobs) => eq(jobs.id, jobId)
  });
  
  console.log('Updated job:', updated);
}

// Usage: tsx scripts/debug-job.ts <WORKSPACE_UUID> <JOB_UUID>
```

Run:
```bash
npx tsx scripts/debug-job.ts <WORKSPACE_UUID> <JOB_UUID>
```

## Testing

### Unit Testing (Coming Soon)

Test the repository functions:
```typescript
describe('NotificationRepository', () => {
  describe('queryTasksDueSoon', () => {
    it('should return tasks due in warning window', async () => {
      // Create test task with due date 5 days from now
      const task = await db.insert(tasks).values({
        // ...
      });
      
      const result = await queryTasksDueSoon(workspaceId, 50);
      expect(result).toContainEqual(
        expect.objectContaining({ uuid: task.uuid })
      );
    });
  });
});
```

### Integration Testing

```bash
# Run complete pipeline test
pnpm run test:notifications

# Expected output:
# ✓ Created test workspace
# ✓ Created test accounts
# ✓ Created test task (due in 5 days)
# ✓ Assigned all users to task
# ✓ Ran dry-run processing
# ✓ Ran live processing
# ✓ Verified notification counts
# ✓ Verified job queue
```

### Manual Testing Checklist

Before releasing changes:

- [ ] Create task with due date in warning window
- [ ] Run admin trigger endpoint
- [ ] Verify notification created in DB
- [ ] Run worker in dry-run mode - verify email composition
- [ ] Run worker in live mode - verify email sent
- [ ] Check job status changed to 'completed'
- [ ] Verify retry logic (stop worker mid-job, restart)
- [ ] Verify idempotency (run twice, should not duplicate)

## Performance Considerations

### Query Optimization

**Problem:** Large number of tasks causes slow queries

**Solution:** Add appropriate indexes in schema.ts:
```typescript
// Existing:
.index('idx_task_due_dates', [tasks.due_date, tasks.status]) // Already there

// May need to add:
.index('idx_tasks_warning_window', [
  tasks.workspace_id,
  tasks.due_date,
  tasks.status,
]) // For WHERE workspace_id = ? AND due_date BETWEEN ? AND ?
```

### Worker Tuning

| Config | Dev | Staging | Production |
|--------|-----|---------|-----------|
| POLL_INTERVAL | 60s | 30s | 15s |
| BATCH_SIZE | 50 | 100 | 200 |
| MAX_RETRIES | 3 | 3 | 5 |

### Email Sending Bottleneck

**Problem:** Sending emails is slow, blocks job processing

**Solution:** Already implemented via job queue:
1. Fast: Create notification + queue job
2. Slow: Email sent async by worker process

**Further optimization:**
- Add rate limiter to prevent SMTP throttling
- Use connection pooling for SMTP
- Batch emails if applicable

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| No notifications created | Task not in warning window | Check warning_deadline_days, task due_date |
| Duplicate notifications | Race condition in repo | Check unique constraints in DB |
| Jobs stuck in 'processing' | Worker crashed | Manually reset: UPDATE notification_jobs SET status='pending' WHERE status='processing' AND updated_at < now() - interval '1 hour' |
| Email not sent | SMTP config missing/wrong | Run test-email endpoint to verify |
| Worker not starting | Node version or module issue | Check Node.js version, run pnpm install |
| Retries not working | May need to manually retry database | Check retry_count < MAX_RETRIES; manually reset status='pending' to retry |

## Code Style & Best Practices

### Naming Conventions

- **Repository functions**: `query*`, `get*`, `create*`, `mark*`, `claim*`
- **Service functions**: `process*`, `get*`
- **DB entities**: snake_case (due_date, task_id)
- **Variables**: camelCase (dueDate, taskId)

### Error Handling

Good:
```typescript
try {
  await sendEmail();
} catch (error) {
  logger.error('Failed to send email', error);
  await markJobFailed(job.id, error.message);
}
```

Bad:
```typescript
await sendEmail(); // No error handling
```

### Logging

Good:
```typescript
logger.info({ taskId, workspaceId }, 'Processing task');
// Later querying: log | grep taskId=<id>
```

Bad:
```typescript
console.log('Processing task ' + taskId);
```

### Idempotency

Good:
```typescript
// Will not error on duplicate
await db.insert(userNotifications).values({...}).onConflictDoNothing();
```

Bad:
```typescript
// Will error if already exists
await db.insert(userNotifications).values({...});
```

## Deployment Checklist

Before deploying to production:

- [ ] Run `npx tsc --noEmit` (zero errors)
- [ ] Run `pnpm run test:notifications` (all steps pass)
- [ ] Review change log / commit messages
- [ ] Verify email config in staging systemConfigs
- [ ] Run worker in dry-run mode on production data (via staging DB)
- [ ] Update NOTIFICATION_SYSTEM.md if needed
- [ ] Brief the ops team on how to monitor/debug
- [ ] Schedule worker process in production (cron or systemd service)

## Release Notes Template

When releasing a new version:

```markdown
## v1.1.0 - [Date]

### New Features
- [ ] Describe new notification type or feature

### Bug Fixes
- [ ] Fixed duplicate notifications on worker restart
- [ ] Fixed email config not loading from systemConfigs

### Performance
- [ ] Optimized queryTasksDueSoon with new index
- [ ] Reduced memory usage in job claiming logic

### Configuration Changes
- [ ] New env variable: WORKER_POOL_SIZE
- [ ] Updated systemConfigs.email schema

### Migration Steps
1. Run database migrations
2. Redeploy API server
3. Restart background worker process
4. Monitor logs for first 30 minutes
```

## Support & Questions

- Check existing logs with: `grep "notification" logs/*.log`
- Review test output with: `pnpm run test:notifications 2>&1 | tail -100`
- Check DB state manually with psql queries above
- Review code in: `src/services/notifications*`, `src/handlers/admin/resources/notifications`

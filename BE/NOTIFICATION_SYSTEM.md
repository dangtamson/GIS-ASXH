# Notification Due-Soon Alerting System

Hệ thống tự động gửi cảnh báo khi Task sắp đến hạn, cung cấp cơ chế lưu trữ In-app notification, gửi email, retry tự động, und idempotency để tối ưu hiệu năng hệ thống.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     API Server (Express)                        │
│  - Admin endpoints: /admin/notifications/*                      │
│  - In-app notification endpoints: /content/notifications        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  PostgreSQL Database                            │
│  - notifications: In-app notification history                   │
│  - task_notifications: Task ↔ Notification mapping              │
│  - user_notifications: User ↔ Notification with read state      │
│  - notification_jobs: Email queue with retry logic              │
│  - tasks: Task data with due_date & warning_deadline_days       │
│  - taskAssignments: User ↔ Task assignments                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│          Background Worker Process (Separate Node)              │
│  - Polls notification_jobs for due tasks                        │
│  - Sends emails via SMTP (from systemConfigs)                   │
│  - Handles retries with exponential backoff                     │
│  - Updates job status in DB                                     │
└─────────────────────────────────────────────────────────────────┘
```

## Database Schema

### notifications
- `uuid` (PK): Unique notification ID
- `workspace_id`: workspace reference
- `title`: Notification title
- `message`: Notification message/body
- `type`: Type of notification (e.g., 'due_soon', 'overdue', 'custom')
- `status`: 'pending', 'sent', 'failed'
- `metadata`: JSONB - arbitrary metadata (taskId, priority, etc.)
- `created_at`: Timestamp

### task_notifications
- `uuid` (PK): Link ID
- `task_id` (FK → tasks): Which task triggered this
- `notification_id` (FK → notifications): Reference to notification
- `status`: 'pending', 'sent'
- `sent_at`: When email was sent
- `workspace_id`: workspace ref
- **UNIQUE constraint**: (task_id, notification_id) prevents duplicates

### user_notifications
- `uuid` (PK): Link ID
- `user_id` (FK → accounts): Who receives this
- `notification_id` (FK → notifications): Reference to notification
- `is_read`: Boolean, read state
- `read_at`: When user marked as read
- `workspace_id`: workspace ref
- **UNIQUE constraint**: (user_id, notification_id)

### notification_jobs
- `uuid` (PK): Job ID
- `task_id` (FK → tasks): Associated task
- `notification_type`: Type of job ('due_soon', 'email', etc.)
- `scheduled_at`: When to process this job
- `processed_at`: When actually processed (success/failure)
- `status`: 'pending', 'processing', 'completed', 'failed'
- `retry_count`: Number of retry attempts (starts at 0)
- `error`: Error message if failed
- `workspace_id`: workspace ref
- **Indexes**: (status, scheduled_at) for efficient polling

## Setup & Installation

### 1. Verify Database Tables

```bash
cd BE

# Verify all 4 tables exist with correct schema
npm run test:notifications
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Start API Server

```bash
# Development with hot-reload
pnpm run dev

# Or production build
pnpm run build
npm run start
```

### 4. Start Background Worker (Separate Process)

```bash
# Long-running worker process (polls every 60 seconds by default)
pnpm run worker:notifications --workspace-id=<WORKSPACE_UUID>

# Or single execution for testing
pnpm run worker:notifications:once --workspace-id=<WORKSPACE_UUID>

# Or dry-run (no email sending)
pnpm run worker:notifications:dry-run --workspace-id=<WORKSPACE_UUID>
```

## API Endpoints

### Admin Operations

All admin endpoints require SuperAdmin role and workspace header.

#### 1. **Trigger Due-Soon Notifications Manually**

```http
POST /admin/notifications/trigger-due-soon
x-workspace-id: <WORKSPACE_UUID>
Authorization: Bearer <TOKEN>

{
  "workspaceId": "<WORKSPACE_UUID>",  // optional, uses header if omitted
  "dryRun": false,                     // true = no persistence
  "batchSize": 50                      // tasks per batch
}
```

**Response:**
```json
{
  "code": 200,
  "data": {
    "mode": "live",
    "workspaceId": "...",
    "totalProcessed": 2,
    "successCount": 2,
    "failureCount": 0,
    "results": [
      {
        "success": true,
        "jobId": "job-uuid",
        "taskId": "task-uuid",
        "recipientCount": 3,
        "emailsSent": 3
      }
    ]
  }
}
```

#### 2. **Get Notification Statistics**

```http
GET /admin/notifications/stats
x-workspace-id: <WORKSPACE_UUID>
Authorization: Bearer <TOKEN>
```

**Response:**
```json
{
  "code": 200,
  "data": {
    "workspaceId": "...",
    "stats": {
      "pendingJobs": 5,
      "failedJobs": 2,
      "unreadNotifications": 42
    },
    "timestamp": "2026-03-25T12:00:00.000Z"
  }
}
```

#### 3. **Mark User Notifications as Read**

```http
POST /admin/notifications/mark-read
x-workspace-id: <WORKSPACE_UUID>
Authorization: Bearer <TOKEN>
```

**Response:**
```json
{
  "code": 200,
  "data": {
    "workspaceId": "...",
    "userId": "...",
    "markedRead": 15
  }
}
```

### User Notification Endpoints

#### 4. **List My Notifications**

```http
GET /content/notifications
x-workspace-id: <WORKSPACE_UUID>
Authorization: Bearer <TOKEN>

Query params:
  - page: 1 (default)
  - limit: 20 (default, max 100)
  - type: (filter by type)
  - status: (filter by status)
  - search: (search title/message)
  - sortBy: created_at|title (default: created_at)
  - sortOrder: asc|desc (default: desc)
```

#### 5. **Get Single Notification**

```http
GET /content/notifications/:id
x-workspace-id: <WORKSPACE_UUID>
Authorization: Bearer <TOKEN>
```

## Configuration

### Environment Variables

```bash
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=postgres

# Worker polling
WORKER_POLL_INTERVAL_MS=60000        # Poll every 1 minute
WORKER_BATCH_SIZE=50                 # Process 50 tasks per cycle
WORKER_MAX_RETRIES=3                 # Retry up to 3 times

# Logging
NODE_ENV=development|production
```

### Email Configuration (per workspace)

Email settings are stored in `systemConfigs` table under `email` section:

```json
{
  "senderName": "Your App Notifications",
  "senderEmail": "noreply@your-app.com",
  "replyTo": "support@your-app.com",
  "smtpHost": "smtp.example.com",
  "smtpPort": 587,
  "username": "smtp-user",
  "password": "smtp-password",
  "useTls": true,
  "useSsl": false,
  "allowInvalidCert": false
}
```

Configure via:
- [API] `PUT /admin/system-config`
- [UI] Admin System Settings
- [Test] `POST /admin/system-config/test-email`

## How It Works

### Flow: Due-Soon Detection & Notification

1. **Query Due-Soon Tasks**
   ```sql
   SELECT tasks WHERE
     workspace_id = ?
     AND due_date >= today
     AND due_date <= today + warning_deadline_days
     AND status != 'completed'
     AND deleted_at IS NULL
   ```

2. **For Each Task:**
   - Get assigned users from `task_assignments`
   - Create notification record (idempotent by title + message + type)
   - Link task → notification in `task_notifications` (unique constraint prevents duplicates)
   - Link each user → notification in `user_notifications` (unique constraint prevents duplicates)
   - Create job in `notification_jobs` with status='pending'

3. **Retry & Error Handling:**
   - Exponential backoff: 1m → 2m → 4m → fail after 3 retries
   - Max 3 retries, then job status becomes 'failed'
   - Failed jobs can be manually retried via admin API

### Flow: Email Sending (Worker Process)

1. **Poll for Due Jobs:**
   ```sql
   SELECT notification_jobs WHERE
     status = 'pending'
     AND scheduled_at <= NOW()
   LIMIT 50
   ```

2. **For Each Job:**
   - Load task and recipient list
   - Get SMTP config for workspace
   - Send email
   - Mark job as 'completed' if success
   - Mark job as 'failed' with retry backoff if error

3. **Concurrency:**
   - Multiple workers can run safely (claim job atomically)
   - Job status transitions prevent duplicate sends
   - Unique constraints prevent duplicate records

## Testing & Verification

### 1. Run Complete Pipeline Test

```bash
pnpm run test:notifications
```

This will:
- Create test workspace & accounts
- Create test task due in 5 days
- Assign users to task
- Run dry-run notification processing
- Run live notification processing
- Verify database state
- Display statistics

### 2. Manual Testing Steps

```bash
# 1. Create test workspace and task (using API or manually in DB)

# 2. Trigger notifications manually
curl -X POST http://localhost:4000/admin/notifications/trigger-due-soon \
  -H "x-workspace-id: <WORKSPACE_UUID>" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{ "dryRun": true }'  # Try dry-run first

# 3. Check stats
curl http://localhost:4000/admin/notifications/stats \
  -H "x-workspace-id: <WORKSPACE_UUID>" \
  -H "Authorization: Bearer <TOKEN>"

# 4. Run worker once to process jobs
pnpm run worker:notifications:once --workspace-id=<WORKSPACE_UUID>

# 5. Verify in DB
psql -h localhost -U postgres -d postgres -c \
  "SELECT COUNT(*) FROM notification_jobs WHERE workspace_id = '<WORKSPACE_UUID>';"
```

### 3. Idempotency Verification

```bash
# Run same workspace twice - should not create duplicates

# First run
pnpm run worker:notifications:once --workspace-id=<WORKSPACE_UUID>

# Second run - should be fast and create no new notifications
pnpm run worker:notifications:once --workspace-id=<WORKSPACE_UUID>

# Verify counts didn't increase in user_notifications
```

## Performance Tuning

### Database Indexes

Key indexes for efficient querying:

```sql
-- Already present in schema:
CREATE INDEX idx_notification_jobs_status ON notification_jobs(status);
CREATE INDEX idx_notification_jobs_scheduled_at ON notification_jobs(scheduled_at);
CREATE INDEX idx_user_notifications_unread ON user_notifications(user_id, is_read);
```

### Worker Configuration Recommendations

| Scenario | POLL_INTERVAL | BATCH_SIZE | Details |
|----------|---------------|-----------|---------|
| Development | 60s | 50 | Low volume testing |
| Staging | 30s | 100 | Medium volume (~1000 tasks) |
| Production | 15s | 200 | High volume, multiple workers |

### Scaling the Worker

For high-volume production:

```bash
# Run 2-3 worker instances with different BATCH_SIZES on different machines
# They won't conflict due to job claiming in DB

# Worker 1
WORKER_POLL_INTERVAL_MS=10000 WORKER_BATCH_SIZE=100 pnpm run worker:notifications --workspace-id=<WS1>

# Worker 2
WORKER_POLL_INTERVAL_MS=10000 WORKER_BATCH_SIZE=100 pnpm run worker:notifications --workspace-id=<WS2>

# Worker 3
WORKER_POLL_INTERVAL_MS=10000 WORKER_BATCH_SIZE=100 pnpm run worker:notifications --workspace-id=<WS3>
```

## Troubleshooting

### Issue: "No assignees found for task"

**Cause:** Task has no task assignments.

**Solution:** Add assignees via `taskAssignments` table or API before notification processing.

### Issue: "No email transporter configured for workspace"

**Cause:** Email config not saved in `systemConfigs`.

**Solution:** 
1. Configure email settings via `/admin/system-config` API
2. Test with `/admin/system-config/test-email`
3. Check email config in DB: `SELECT email FROM system_configs WHERE workspace_id = '<WS_UUID>'`

### Issue: "Job stuck in 'processing' status"

**Cause:** Worker crashed or was killed while processing.

**Solution:** Manually update in DB or wait for timeout:
```sql
UPDATE notification_jobs SET status = 'pending' 
WHERE status = 'processing' AND updated_at < now() - interval '1 hour'
```

### Issue: Duplicate notifications created

**Cause:** UNIQUE constraints on task_notifications or user_notifications not respected.

**Solution:** Should not happen due to schema constraints. If it does:
1. Check schema: `\d task_notifications` in psql
2. Verify migration ran: check `drizzle/` folder
3. Manually delete duplicates if needed

## Files Overview

```
BE/
├── src/
│   ├── schema.ts                          ← 4 notification tables defined
│   ├── services/
│   │   ├── notifications.repository.ts    ← Low-level DB queries
│   │   └── notificationPipeline.service.ts ← Business logic pipeline
│   ├── handlers/admin/resources/
│   │   └── notifications/
│   │       └── notificationsAdmin.handlers.ts ← Admin API handlers
│   └── routes/admin/
│       ├── admin.ts                      ← Main admin routes
│       └── notifications.ts              ← Notification routes setup
├── scripts/
│   ├── notification-worker.ts            ← Background worker process
│   └── test-notification-pipeline.ts     ← Integration test script
└── package.json                          ← New pnpm scripts
```

## Roadmap / Future Enhancements

- [ ] User timezone support (currently uses server timezone)
- [ ] Push notifications (Firebase, etc.)
- [ ] Notification preferences (per-user opt-in/out)
- [ ] HTML email templates
- [ ] Webhook integration for external systems
- [ ] Notification read/unread syncing with frontend

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review logs: `pnpm run worker:notifications 2>&1 | pino-pretty`
3. Run test script to verify setup: `pnpm run test:notifications`
4. Check database state manually using psql

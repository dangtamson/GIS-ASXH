# Notification System Implementation - Complete

## 📋 What's New

A complete **due-soon task notification system** has been implemented with the following features:

- ✅ **Automatic Alerts**: Notifies users when tasks are approaching their deadline
- ✅ **Multi-Channel**: Supports In-app notifications + Email delivery
- ✅ **Background Worker**: Separate service for processing without blocking API
- ✅ **Reliable Delivery**: Automatic retry with exponential backoff
- ✅ **Concurrent-Safe**: Multiple workers can run simultaneously without conflicts
- ✅ **Idempotent**: Won't create duplicates on restart or retry
- ✅ **Production-Ready**: Full error handling, logging, and monitoring

## 🎯 Quick Start

```bash
cd BE

# 1. Verify setup
npx tsc --noEmit

# 2. Run integration test (creates test data and validates system)
pnpm run test:notifications

# 3. Start background worker
pnpm run worker:notifications --workspace-id=<WORKSPACE_UUID>

# (Or dry-run for testing)
pnpm run worker:notifications:dry-run --workspace-id=<WORKSPACE_UUID>
```

## 📚 Documentation

Read in this order:

1. **[NOTIFICATION_SYSTEM.md](BE/NOTIFICATION_SYSTEM.md)** ← Start here
   - Architecture overview
   - Database schema
   - API endpoints
   - Configuration & setup
   - Performance tuning

2. **[NOTIFICATION_DEVELOPER_GUIDE.md](BE/NOTIFICATION_DEVELOPER_GUIDE.md)**
   - How to extend the system
   - Debugging techniques
   - Best practices
   - Production deployment

3. **[NOTIFICATION_QUICK_START.sh](BE/NOTIFICATION_QUICK_START.sh)**
   - Copy-paste commands for common tasks

4. **[src/types/notifications.ts](BE/src/types/notifications.ts)**
   - TypeScript type definitions with JSDoc

## 🏗️ Architecture

```
API Server (Express)
    ↓
Admin Endpoints: POST /admin/notifications/trigger-due-soon
    ↓
Service Layer (notificationPipeline.service.ts)
    ↓
Repository Layer (notifications.repository.ts)
    ↓
PostgreSQL Database (4 core tables)
    ↓
Background Worker (script/notification-worker.ts)
    ↓
Email Integration (SMTP via systemConfigs)
```

## 🗄️ Database

4 new tables (already exist, no migrations needed):

- `notifications`: In-app notification records
- `task_notifications`: Task ↔ Notification mapping
- `user_notifications`: User ↔ Notification mapping with read state
- `notification_jobs`: Email queue with retry tracking

## 📡 API Endpoints

**Admin Operations** (require SuperAdmin + x-workspace-id header):

- `POST /admin/notifications/trigger-due-soon` - Manually trigger processing
- `GET /admin/notifications/stats` - View pending/failed jobs and unread counts
- `POST /admin/notifications/mark-read` - Mark notifications as read

**User Endpoints**:

- `GET /content/notifications` - List my notifications
- `GET /content/notifications/:id` - Get single notification

## 🔧 Configuration

Via environment variables (in docker-compose or .env):

```bash
WORKER_POLL_INTERVAL_MS=60000    # How often worker checks for jobs
WORKER_BATCH_SIZE=50             # How many tasks to process per cycle
WORKER_MAX_RETRIES=3             # How many times to retry failed jobs
```

Email config stored in database (systemConfigs table).

## 📊 How It Works

### Detection Phase
1. Worker polls for tasks approaching deadline (due_date - warning_deadline_days)
2. For each task, creates In-app notification record
3. Creates email job for each assigned user
4. Marks job as "pending" for email sending

### Delivery Phase
1. Worker polls for pending email jobs
2. Sends email via SMTP (config from systemConfigs)
3. Records delivery status in database
4. On failure: schedules retry with exponential backoff (1m → 2m → 4m)
5. After 3 failed attempts: marks job as "failed"

## ✅ Testing

```bash
# Complete integration test (creates test workspace/task, runs pipeline)
pnpm run test:notifications

# Dry-run to see what would happen without actually sending
pnpm run worker:notifications:dry-run --workspace-id=<ID>

# Single execution for testing
pnpm run worker:notifications:once --workspace-id=<ID>

# Continuous production mode (polling every 60s)
pnpm run worker:notifications --workspace-id=<ID>
```

## 🚀 Deployment

```bash
# Verify TypeScript compilation
npx tsc --noEmit

# Run integration test
pnpm run test:notifications

# Deploy API server as usual
pnpm run build
npm start

# Start worker in separate process (systemd, docker, pm2, etc.)
pnpm run worker:notifications --workspace-id=<WORKSPACE_UUID> &
```

## 🔍 Monitoring

View pending jobs:
```sql
SELECT COUNT(*) FROM notification_jobs 
WHERE workspace_id = '<ID>' AND status = 'pending';
```

View failed jobs:
```sql
SELECT id, error FROM notification_jobs 
WHERE workspace_id = '<ID>' AND status = 'failed' LIMIT 5;
```

Check statistics:
```bash
curl http://localhost:4000/admin/notifications/stats \
  -H "x-workspace-id: <WORKSPACE_UUID>" \
  -H "Authorization: Bearer <TOKEN>"
```

## 📝 Files Changed

**New Files**:
- `BE/src/services/notifications.repository.ts` - DB access layer
- `BE/src/services/notificationPipeline.service.ts` - Business logic
- `BE/src/handlers/admin/resources/notifications/` - Admin endpoints
- `BE/src/routes/admin/notifications.ts` - Route setup
- `BE/src/types/notifications.ts` - Type definitions
- `BE/src/helpers/notificationJobLogger.ts` - Logging utility
- `BE/scripts/notification-worker.ts` - Background worker
- `BE/scripts/test-notification-pipeline.ts` - Integration test
- `BE/NOTIFICATION_SYSTEM.md` - Main documentation
- `BE/NOTIFICATION_DEVELOPER_GUIDE.md` - Developer guide
- `BE/NOTIFICATION_QUICK_START.sh` - Quick reference

**Modified Files**:
- `BE/src/schema.ts` - Added 4 notification table definitions
- `BE/src/handlers/admin/resources/content/notifications.handlers.ts` - Updated schema fields
- `BE/src/routes/admin.ts` - Registered notification routes
- `BE/package.json` - Added 4 npm scripts

## 🎓 Learning Resources

- **System Design**: See NOTIFICATION_SYSTEM.md → "How It Works" section
- **Code Organization**: See NOTIFICATION_DEVELOPER_GUIDE.md → "System Architecture"
- **Extending**: See NOTIFICATION_DEVELOPER_GUIDE.md → "Extending the System"
- **Debugging**: See NOTIFICATION_DEVELOPER_GUIDE.md → "Debugging" section
- **Examples**: See test-notification-pipeline.ts for full pipeline example

## 🤝 Support

For questions or issues:

1. Check troubleshooting section in NOTIFICATION_SYSTEM.md
2. Review developer guide for debugging techniques
3. Run integration test to verify setup
4. Check database state manually with provided SQL queries

## ✨ Next Steps

1. **Read** NOTIFICATION_SYSTEM.md (15 min)
2. **Run** integration test (5 min)
3. **Configure** email settings in admin panel
4. **Deploy** worker process to production
5. **Monitor** logs and stats

---

**Status**: ✅ Complete and ready for production

**Last Updated**: 2026-03-25

**Documentation**: See `/BE/` folder for all guides and code

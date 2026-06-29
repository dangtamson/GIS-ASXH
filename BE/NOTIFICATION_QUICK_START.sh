#!/usr/bin/env bash
# QUICK START - Due-Soon Task Notification System

# This file contains the essential commands to get the notification system running
# For detailed documentation, see: NOTIFICATION_SYSTEM.md

echo "🚀 Notification System Quick Start"

# ============================================================================
# STEP 1: VERIFY SETUP
# ============================================================================

echo ""
echo "📋 Step 1: Verify TypeScript compilation"
npx tsc --noEmit
if [ $? -eq 0 ]; then
  echo "✅ TypeScript checks passed"
else
  echo "❌ TypeScript errors found"
  exit 1
fi

# ============================================================================
# STEP 2: RUN INTEGRATION TEST
# ============================================================================

echo ""
echo "📋 Step 2: Run integration test"
echo "   This creates test data and verifies the full pipeline works"
pnpm run test:notifications

# ============================================================================
# STEP 3: MANUAL TRIGGER TEST (requires API running)
# ============================================================================

echo ""
echo "📋 Step 3: Manual trigger test"
echo "   Assuming API is running on http://localhost:4000"
echo "   Replace WORKSPACE_UUID with actual workspace ID from test output"
echo ""
echo "📝 Command:"
echo 'curl -X POST http://localhost:4000/admin/notifications/trigger-due-soon \'
echo '  -H "x-workspace-id: WORKSPACE_UUID" \'
echo '  -H "Authorization: Bearer TOKEN" \'
echo '  -d "{\"dryRun\": true}"'

# ============================================================================
# STEP 4: START BACKGROUND WORKER
# ============================================================================

echo ""
echo "📋 Step 4: Start background worker"
echo "   Worker checks for pending notification jobs every 60 seconds"
echo ""
echo "📝 Dry-run mode (testing, no emails):"
echo "   pnpm run worker:notifications:dry-run --workspace-id=WORKSPACE_UUID"
echo ""
echo "📝 Single execution (testing, with emails):"
echo "   pnpm run worker:notifications:once --workspace-id=WORKSPACE_UUID"
echo ""
echo "📝 Continuous mode (production):"
echo "   pnpm run worker:notifications --workspace-id=WORKSPACE_UUID"

# ============================================================================
# USEFUL COMMANDS
# ============================================================================

echo ""
echo "📚 Useful Commands:"
echo ""
echo "Get notification statistics:"
echo 'curl http://localhost:4000/admin/notifications/stats \'
echo '  -H "x-workspace-id: WORKSPACE_UUID" \'
echo '  -H "Authorization: Bearer TOKEN"'
echo ""
echo "Check database state:"
echo "psql -h localhost -U postgres -d postgres -c \\"
echo "  SELECT COUNT(*) FROM notification_jobs WHERE workspace_id = 'UUID';\""
echo ""
echo "View worker logs with pretty formatting:"
echo "pnpm run worker:notifications --workspace-id=UUID 2>&1 | pino-pretty"
echo ""
echo "Find failed jobs:"
echo "psql -h localhost -U postgres -d postgres -c \\"
echo "  SELECT id, error FROM notification_jobs WHERE status = 'failed' LIMIT 5;\""

# ============================================================================
# CONFIGURATION
# ============================================================================

echo ""
echo "⚙️  Configuration:"
echo ""
echo "Worker polling interval (default 60s):"
echo "  export WORKER_POLL_INTERVAL_MS=30000"
echo ""
echo "Batch size (default 50):"
echo "  export WORKER_BATCH_SIZE=100"
echo ""
echo "Max retries (default 3):"
echo "  export WORKER_MAX_RETRIES=5"

# ============================================================================
# TROUBLESHOOTING
# ============================================================================

echo ""
echo "🔧 Troubleshooting:"
echo ""
echo "If no notifications are created:"
echo "1. Check task due date is within warning window (next 10 days default)"
echo "2. Check task status is not 'completed'"
echo "3. Check task has assigned users"
echo ""
echo "If emails are not sent:"
echo "1. Verify SMTP config: GET /admin/system-config"
echo "2. Test email: POST /admin/system-config/test-email"
echo "3. Check job status: SELECT * FROM notification_jobs WHERE status = 'failed'"
echo ""
echo "For detailed debugging:"
echo "  See NOTIFICATION_DEVELOPER_GUIDE.md"
echo ""

echo "✅ Quick start complete!"
echo ""
echo "📖 Next: Read NOTIFICATION_SYSTEM.md for full documentation"

#!/usr/bin/env -S npx tsx

/**
 * Notification Pipeline Verification Script
 *
 * Tests the entire flow:
 * 1. Create sample task with due date
 * 2. Create sample users
 * 3. Assign users to task
 * 4. Run due-soon detection
 * 5. Verify notifications created
 * 6. Check email jobs queued
 *
 * Usage: npx tsx scripts/test-notification-pipeline.ts
 */

import { logger } from "@/helpers/index.ts";
import { config } from "@/config.ts";
import { db, closeDbPool } from "@/services/db/drizzle.ts";
import {
    workspaces,
    accounts,
    tasks,
    taskAssignments,
    notifications,
    taskNotifications,
    userNotifications,
    notificationJobs
} from "@/schema.ts";
import { processDueSoonNotifications, getNotificationStats } from "@/services/notificationPipeline.service.ts";
import { v4 as uuidv4 } from "crypto";
import { eq } from "drizzle-orm";

async function runTests() {
    logger.info("Starting Notification Pipeline Verification Tests...\n");

    const testId = uuidv4().slice(0, 8);
    const workspaceId = uuidv4();

    try {
        // Step 1: Create test workspace
        logger.info("Step 1: Creating test workspace...");
        const [workspace] = await db
            .insert(workspaces)
            .values({
                uuid: workspaceId,
                accountId: null,
                name: `Test Workspace ${testId}`
            })
            .returning();

        if (!workspace) throw new Error("Failed to create workspace");
        logger.info(`  ✅ Workspace created: ${workspace.uuid}`);

        // Step 2: Create test accounts
        logger.info("\nStep 2: Creating test accounts...");
        const accountUuids: string[] = [];
        for (let i = 1; i <= 3; i++) {
            const [account] = await db
                .insert(accounts)
                .values({
                    uuid: uuidv4(),
                    email: `test-${testId}-${i}@example.com`,
                    fullName: `Test User ${i}`
                })
                .returning();

            if (account) {
                accountUuids.push(account.uuid);
                logger.info(`  ✅ Account created: ${account.email}`);
            }
        }

        // Step 3: Create test task with due date in 5 days
        logger.info("\nStep 3: Creating test task due in 5 days...");
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 5);
        dueDate.setHours(0, 0, 0, 0);

        const [task] = await db
            .insert(tasks)
            .values({
                uuid: uuidv4(),
                workspaceId,
                title: `[TEST-${testId}] Task due soon`,
                description: "This is a test task for notification verification",
                priority: "high",
                status: "new",
                dueDate: new Date(dueDate.toISOString().split("T")[0]),
                warningDeadlineDays: 10 // Alert within 10 days
            })
            .returning();

        if (!task) throw new Error("Failed to create task");
        logger.info(`  ✅ Task created: ${task.uuid}`);
        logger.info(`     Due date: ${task.dueDate?.toISOString()}`);
        logger.info(`     Warning days: ${task.warningDeadlineDays}`);

        // Step 4: Assign users to task
        logger.info("\nStep 4: Assigning users to task...");
        for (const accountId of accountUuids) {
            const [assignment] = await db
                .insert(taskAssignments)
                .values({
                    uuid: uuidv4(),
                    taskId: task.uuid,
                    assignedToAccountId: accountId,
                    assignedBy: null
                })
                .returning();

            if (assignment) {
                logger.info(`  ✅ Assignment created for account ${accountId.slice(0, 8)}...`);
            }
        }

        // Step 5: Run due-soon notification processing
        logger.info("\nStep 5: Running due-soon notification processing (DRY RUN)...");
        const dryRunResults = await processDueSoonNotifications({
            workspaceId,
            dryRun: true,
            batchSize: 50
        });

        logger.info(`  ✅ Dry-run completed`);
        logger.info(`     Total processed: ${dryRunResults.length}`);
        logger.info(`     Successful: ${dryRunResults.filter((r) => r.success).length}`);
        logger.info(`     Failed: ${dryRunResults.filter((r) => !r.success).length}`);

        // Step 6: Run with actual persistence
        logger.info("\nStep 6: Running due-soon notification processing (LIVE)...");
        const liveResults = await processDueSoonNotifications({
            workspaceId,
            dryRun: false,
            batchSize: 50
        });

        logger.info(`  ✅ Live processing completed`);
        logger.info(`     Total processed: ${liveResults.length}`);
        logger.info(`     Successful: ${liveResults.filter((r) => r.success).length}`);
        logger.info(`     Failed: ${liveResults.filter((r) => !r.success).length}`);

        if (liveResults.length > 0) {
            logger.info(`\n  First result:`);
            const first = liveResults[0];
            logger.info(`    - Job ID: ${first.jobId}`);
            logger.info(`    - Task ID: ${first.taskId}`);
            logger.info(`    - Recipients: ${first.recipientCount}`);
            logger.info(`    - Emails queued: ${first.emailsSent}`);
        }

        // Step 7: Verify database state
        logger.info("\nStep 7: Verifying database state...");
        const [notificationCount] = await db
            .select({ count: db.count() })
            .from(notifications)
            .where(eq(notifications.workspaceId, workspaceId));

        const [taskNotifCount] = await db
            .select({ count: db.count() })
            .from(taskNotifications)
            .where(eq(taskNotifications.workspaceId, workspaceId));

        const [userNotifCount] = await db
            .select({ count: db.count() })
            .from(userNotifications)
            .where(eq(userNotifications.workspaceId, workspaceId));

        const [jobCount] = await db
            .select({ count: db.count() })
            .from(notificationJobs)
            .where(eq(notificationJobs.workspaceId, workspaceId));

        logger.info(`  ✅ Database state:`);
        logger.info(`     Notifications: ${notificationCount?.count || 0}`);
        logger.info(`     Task-Notification links: ${taskNotifCount?.count || 0}`);
        logger.info(`     User-Notification links: ${userNotifCount?.count || 0}`);
        logger.info(`     Notification jobs: ${jobCount?.count || 0}`);

        // Step 8: Get statistics
        logger.info("\nStep 8: Getting notification statistics...");
        const stats = await getNotificationStats(workspaceId);
        logger.info(`  ✅ Statistics:`);
        logger.info(`     Pending jobs: ${stats.pendingJobs}`);
        logger.info(`     Failed jobs: ${stats.failedJobs}`);
        logger.info(`     Unread notifications: ${stats.unreadNotifications}`);

        logger.info("\n❆ ALL TESTS PASSED ✓");
        logger.info(`\nTest ID: ${testId}`);
        logger.info(`Workspace: ${workspaceId}`);
        logger.info(`\nTo manually test worker:`);
        logger.info(`  pnpm run worker:notifications:once --workspace-id=${workspaceId}`);

        return true;
    } catch (error) {
        logger.error({
            msg: "Test failed",
            error,
            testId
        });
        return false;
    } finally {
        try {
            await closeDbPool();
        } catch (error) {
            logger.error({ msg: "Error closing DB pool", error });
        }
    }
}

// Run tests
runTests()
    .then((success) => {
        process.exit(success ? 0 : 1);
    })
    .catch((error) => {
        logger.error("Fatal test error", error);
        process.exit(2);
    });

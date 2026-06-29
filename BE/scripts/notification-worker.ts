#!/usr/bin/env -S npx tsx

/**
 * Notification Worker Process
 *
 * Runs as a separate background process to handle:
 * 1. Scan for tasks due soon
 * 2. Create in-app notifications
 * 3. Send emails to assignees
 * 4. Handle retries on failure
 *
 * Usage:
 *   pnpm run worker:notifications [--workspace-id <id>] [--dry-run] [--once]
 *
 * Environment:
 *   NODE_ENV=development|production
 *   WORKER_POLL_INTERVAL_MS=60000 (default)
 *   WORKER_BATCH_SIZE=50 (default)
 *   WORKER_MAX_RETRIES=3 (default)
 */

import { logger } from "@/helpers/index.ts";
import { config } from "@/config.ts";
import { processDueSoonNotifications, processPendingEmailJobs } from "@/services/notificationPipeline.service.ts";
import { db, closeDbPool } from "@/services/db/drizzle.ts";
import nodemailer from "nodemailer";
import { systemConfigs } from "@/schema.ts";
import { eq } from "drizzle-orm";

// Worker configuration
const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS) || 60000; // 1 minute
const BATCH_SIZE = Number(process.env.WORKER_BATCH_SIZE) || 50;
const MAX_RETRIES = Number(process.env.WORKER_MAX_RETRIES) || 3;
const DRY_RUN = process.env.DRY_RUN === "true" || process.argv.includes("--dry-run");
const RUN_ONCE = process.argv.includes("--once");

let isRunning = false;
let stopRequested = false;

/**
 * Get email transporter for a workspace
 */
async function getEmailTransporter(workspaceId: string) {
    try {
        const [config] = await db
            .select()
            .from(systemConfigs)
            .where(eq(systemConfigs.workspaceId, workspaceId))
            .limit(1);

        if (!config?.email || typeof config.email !== "object") {
            logger.warn({
                msg: "No email config found for workspace",
                workspaceId
            });
            return null;
        }

        const emailConfig = config.email as Record<string, unknown>;
        const senderName = (emailConfig.senderName as string) || "Notifications";
        const senderEmail = (emailConfig.senderEmail as string) || "noreply@example.com";
        const smtpHost = emailConfig.smtpHost as string;
        const smtpPort = emailConfig.smtpPort as number;
        const username = emailConfig.username as string | undefined;
        const password = emailConfig.password as string | undefined;
        const useTls = (emailConfig.useTls as boolean) ?? true;
        const useSsl = emailConfig.useSsl as boolean | undefined;
        const allowInvalidCert = emailConfig.allowInvalidCert as boolean | undefined;

        if (!smtpHost || !smtpPort) {
            logger.warn({
                msg: "Incomplete email config",
                workspaceId
            });
            return null;
        }

        const secure = useSsl ?? smtpPort === 465;

        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure,
            auth:
                username && password
                    ? {
                        user: username,
                        pass: password
                    }
                    : undefined,
            requireTLS: useTls,
            tls: {
                rejectUnauthorized: !(allowInvalidCert ?? false)
            }
        });

        // Verify connection
        await transporter.verify();

        return transporter;
    } catch (error) {
        logger.error({
            msg: "Error getting email transporter",
            workspaceId,
            error
        });
        return null;
    }
}

/**
 * Exponential backoff with jitter
 */
function getBackoffDelay(attempt: number): number {
    const baseDelay = POLL_INTERVAL_MS;
    const exponentialDelay = baseDelay * Math.pow(2, Math.min(attempt, 5)); // Cap at 2^5
    const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
    return exponentialDelay + jitter;
}

/**
 * Process notifications for all workspaces
 */
async function processNotifications() {
    if (isRunning) {
        logger.warn("Notification processing already in progress, skipping this cycle");
        return;
    }

    isRunning = true;
    const startTime = Date.now();

    try {
        logger.info("Starting notification processing cycle");

        // Get all active workspaces
        // For now, we'll process a specific workspace passed via env or process all
        const targetWorkspaceId = process.argv
            .slice(2)
            .find((arg) => arg.startsWith("--workspace-id="))
            ?.split("=")[1];

        const workspaces = targetWorkspaceId
            ? [{ id: targetWorkspaceId }]
            : await getActiveWorkspaces();

        for (const workspace of workspaces) {
            try {
                logger.info({
                    msg: "Processing workspace",
                    workspaceId: workspace.id,
                    dryRun: DRY_RUN
                });

                // 1. Process due-soon notifications
                const dueResults = await processDueSoonNotifications({
                    workspaceId: workspace.id,
                    dryRun: DRY_RUN,
                    batchSize: BATCH_SIZE
                });

                logger.info({
                    msg: "Due-soon processing completed",
                    workspaceId: workspace.id,
                    results: dueResults.length
                });

                // 2. Process pending email jobs
                if (!DRY_RUN) {
                    const emailResults = await processPendingEmailJobs(
                        workspace.id,
                        getEmailTransporter,
                        BATCH_SIZE
                    );

                    logger.info({
                        msg: "Email processing completed",
                        workspaceId: workspace.id,
                        results: emailResults.length
                    });
                }
            } catch (error) {
                logger.error({
                    msg: "Error processing workspace",
                    workspaceId: workspace.id,
                    error
                });
            }
        }

        const duration = Date.now() - startTime;
        logger.info({
            msg: "Notification processing cycle completed",
            durationMs: duration,
            workspaces: workspaces.length
        });
    } catch (error) {
        logger.error({
            msg: "Fatal error in notification processing",
            error
        });
    } finally {
        isRunning = false;
    }
}

/**
 * Get all active workspaces (for now, return empty - you'd query your workspaces table)
 */
async function getActiveWorkspaces(): Promise<{ id: string }[]> {
    // TODO: Query workspace table to get all active workspaces
    // For now, log a warning and return empty
    logger.warn("getActiveWorkspaces not yet implemented - process specific workspace with --workspace-id");
    return [];
}

/**
 * Main worker loop
 */
async function runWorker() {
    logger.info({
        msg: "Starting Notification Worker",
        pollIntervalMs: POLL_INTERVAL_MS,
        batchSize: BATCH_SIZE,
        dryRun: DRY_RUN,
        runOnce: RUN_ONCE,
        nodeEnv: config.env
    });

    let cycle = 0;
    let failureCount = 0;

    while (!stopRequested) {
        cycle++;
        const cycleStartTime = Date.now();

        try {
            await processNotifications();
            failureCount = 0; // Reset on success
        } catch (error) {
            failureCount++;
            logger.error({
                msg: "Cycle error",
                cycle,
                failureCount,
                error
            });

            if (failureCount >= 5) {
                logger.error({
                    msg: "Too many failures, shutting down",
                    failureCount
                });
                stopRequested = true;
            }
        }

        if (RUN_ONCE || stopRequested) {
            break;
        }

        const cycleTime = Date.now() - cycleStartTime;
        const waitTime = Math.max(0, POLL_INTERVAL_MS - cycleTime);

        logger.debug({
            msg: "Cycle completed, waiting before next",
            cycle,
            cycleTimeMs: cycleTime,
            waitTimeMs: waitTime
        });

        // Sleep before next cycle
        await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    logger.info({
        msg: "Notification Worker shutting down",
        totalCycles: cycle
    });
}

/**
 * Graceful shutdown
 */
async function shutdown(signal: string) {
    logger.info({
        msg: "Shutdown signal received",
        signal
    });

    stopRequested = true;

    // Wait for current cycle to complete (max 30 seconds)
    let waitTime = 0;
    while (isRunning && waitTime < 30000) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        waitTime += 100;
    }

    if (isRunning) {
        logger.warn("Shutdown timeout: worker still running");
    }

    try {
        await closeDbPool();
        logger.info("Database pool closed");
    } catch (error) {
        logger.error({
            msg: "Error closing database pool",
            error
        });
    }

    process.exit(0);
}

// Set up signal handlers
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Start worker
if (require.main === module || import.meta.url === `file://${process.argv[1]}`) {
    runWorker().catch((error) => {
        logger.error({
            msg: "Fatal worker error",
            error
        });
        process.exit(1);
    });
}

export { runWorker, shutdown };

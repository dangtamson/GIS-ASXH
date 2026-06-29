import {
    queryTasksDueSoon,
    getTaskAssignees,
    createNotificationWithIdempotency,
    linkTaskNotification,
    linkUserNotification,
    createNotificationJob,
    getPendingJobsDue,
    markJobProcessed,
    markJobFailed,
    getNotificationStats as getNotificationStatsFromRepo
} from "./notifications.repository.ts";
import { logger } from "../helpers/index.ts";

export interface NotificationPipelineContext {
    workspaceId: string;
    dryRun?: boolean;
    batchSize?: number;
}

export interface NotificationJobResult {
    success: boolean;
    jobId: string;
    taskId?: string;
    error?: string;
    recipientCount?: number;
    emailsSent?: number;
}

/**
 * Process all tasks due soon and create notifications
 */
export async function processDueSoonNotifications(
    context: NotificationPipelineContext
): Promise<NotificationJobResult[]> {
    const { workspaceId, dryRun = false, batchSize = 50 } = context;
    const results: NotificationJobResult[] = [];

    logger.info({
        msg: "Starting due-soon notification processing",
        workspaceId,
        dryRun,
        batchSize
    });

    try {
        let offset = 0;
        let totalProcessed = 0;

        for (; ;) {
            // Fetch tasks in batches
            const tasks = await queryTasksDueSoon(workspaceId, batchSize, offset);

            if (tasks.length === 0) {
                logger.info({
                    msg: "All due-soon tasks processed",
                    workspaceId,
                    totalProcessed
                });
                break;
            }

            for (const task of tasks) {
                try {
                    const result = await processSingleTaskNotification(task, context);
                    results.push(result);
                    totalProcessed++;
                } catch (error) {
                    logger.error({
                        msg: "Error processing task notification",
                        taskId: task.uuid,
                        error
                    });
                    results.push({
                        success: false,
                        jobId: "",
                        taskId: task.uuid,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }

            offset += batchSize;
        }

        logger.info({
            msg: "Due-soon notification processing completed",
            workspaceId,
            totalProcessed,
            successful: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length
        });

        return results;
    } catch (error) {
        logger.error({
            msg: "Fatal error in due-soon notification processing",
            workspaceId,
            error
        });
        throw error;
    }
}

/**
 * Process a single task and create notifications for all assignees
 */
async function processSingleTaskNotification(
    task: {
        uuid: string;
        title?: string;
        dueDate?: Date | string | null;
        warningDeadlineDays?: number | null;
        priority?: string;
    },
    context: NotificationPipelineContext
): Promise<NotificationJobResult> {
    const { workspaceId, dryRun = false } = context;

    try {
        // Get assignees
        const assignees = await getTaskAssignees(task.uuid);

        if (assignees.length === 0) {
            logger.warn({
                msg: "No assignees found for task",
                taskId: task.uuid,
                workspaceId
            });
            return {
                success: true,
                jobId: "",
                taskId: task.uuid,
                recipientCount: 0
            };
        }

        // Create notification (idempotent)
        const title = `Task "${task.title}" is due soon`;
        const dueDateObj = task.dueDate ? new Date(task.dueDate) : undefined;
        const dueDateText = dueDateObj && !Number.isNaN(dueDateObj.getTime())
            ? dueDateObj.toDateString()
            : "unknown date";
        const message = `This task is due on ${dueDateText}. Priority: ${task.priority || "normal"}`;
        const notificationType = "due_soon";

        const notification = await createNotificationWithIdempotency({
            workspaceId,
            title,
            message,
            type: notificationType,
            status: "pending",
            metadata: {
                taskId: task.uuid,
                type: "due_soon",
                dueDate: dueDateObj?.toISOString(),
                priority: task.priority,
                warningDays: task.warningDeadlineDays
            }
        });

        if (!notification) {
            return {
                success: false,
                jobId: "",
                taskId: task.uuid,
                error: "Failed to create notification"
            };
        }

        if (dryRun) {
            logger.info({
                msg: "[DRY RUN] Would create notification for task",
                taskId: task.uuid,
                recipientCount: assignees.length
            });
            return {
                success: true,
                jobId: notification.uuid,
                taskId: task.uuid,
                recipientCount: assignees.length
            };
        }

        // Link task to notification
        const taskLink = await linkTaskNotification(
            task.uuid,
            notification.uuid,
            workspaceId
        );

        if (!taskLink) {
            logger.warn({
                msg: "Failed to link task notification",
                taskId: task.uuid,
                notificationId: notification.uuid
            });
        }

        // Link all assignees to notification
        let emailCount = 0;
        for (const assignee of assignees) {
            const userLink = await linkUserNotification(
                assignee.uuid,
                notification.uuid,
                workspaceId
            );

            if (userLink) {
                emailCount++;
            }
        }

        // Create job for email sending
        const scheduledAt = new Date(); // Immediate scheduling for processor
        const job = await createNotificationJob({
            taskId: task.uuid,
            notificationType: "due_soon",
            scheduledAt,
            workspaceId
        });

        logger.info({
            msg: "Notification created and queued for sending",
            taskId: task.uuid,
            notificationId: notification.uuid,
            jobId: job?.uuid,
            recipientCount: assignees.length,
            emailQueued: emailCount
        });

        return {
            success: true,
            jobId: job?.uuid || notification.uuid,
            taskId: task.uuid,
            recipientCount: assignees.length,
            emailsSent: emailCount
        };
    } catch (error) {
        logger.error({
            msg: "Error processing single task notification",
            taskId: task.uuid,
            error
        });
        throw error;
    }
}

/**
 * Process email sending for pending jobs
 * This would be called by worker process
 */
export async function processPendingEmailJobs(
    workspaceId: string,
    getEmailTransporter: (workspaceId: string) => Promise<unknown>,
    batchSize: number = 20
): Promise<NotificationJobResult[]> {
    const results: NotificationJobResult[] = [];

    logger.info({
        msg: "Processing pending email jobs",
        workspaceId,
        batchSize
    });

    try {
        const jobs = await getPendingJobsDue(workspaceId, batchSize);

        logger.info({
            msg: "Found pending jobs",
            workspaceId,
            jobCount: jobs.length
        });

        for (const job of jobs) {
            try {
                // Get transporter for this workspace
                const transporter = await getEmailTransporter(workspaceId);

                if (!transporter) {
                    logger.warn({
                        msg: "No email transporter configured for workspace",
                        workspaceId,
                        jobId: job.uuid
                    });
                    await markJobFailed(
                        job.uuid,
                        "No email transporter configured",
                        job.retryCount || 0
                    );
                    results.push({
                        success: false,
                        jobId: job.uuid,
                        taskId: job.taskId || undefined,
                        error: "No email transporter configured"
                    });
                    continue;
                }

                // TODO: implement actual email sending logic using transporter
                // For now, just mark as processed to demonstrate flow
                await markJobProcessed(job.uuid);

                logger.info({
                    msg: "Email job processed",
                    workspaceId,
                    jobId: job.uuid
                });

                results.push({
                    success: true,
                    jobId: job.uuid,
                    taskId: job.taskId || undefined,
                    emailsSent: 1
                });
            } catch (error) {
                logger.error({
                    msg: "Error processing email job",
                    jobId: job.uuid,
                    error
                });

                await markJobFailed(
                    job.uuid,
                    error instanceof Error ? error.message : String(error),
                    job.retryCount || 0
                );

                results.push({
                    success: false,
                    jobId: job.uuid,
                    taskId: job.taskId || undefined,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        logger.info({
            msg: "Email job processing completed",
            workspaceId,
            total: results.length,
            successful: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length
        });

        return results;
    } catch (error) {
        logger.error({
            msg: "Fatal error in email job processing",
            workspaceId,
            error
        });
        throw error;
    }
}

/**
 * Get statistics about notification processing
 */
export async function getNotificationStats(
    workspaceId: string
): Promise<{
    workspaceId: string;
    pendingJobs: number;
    failedJobs: number;
    unreadNotifications: number;
}> {
    return getNotificationStatsFromRepo(workspaceId);
}

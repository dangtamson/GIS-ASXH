import { db } from "./db/drizzle.ts";
import {
    notifications,
    taskNotifications,
    userNotifications,
    notificationJobs,
    tasks,
    taskAssignments,
    accounts
} from "@/schema.ts";
import { and, eq, gte, lte, sql, ne, isNull } from "drizzle-orm";
import { logger } from "@/helpers/index.ts";

/**
 * Find tasks that are due soon (within warning_deadline_days)
 * Logic: due_date >= today AND due_date <= today + warning_deadline_days
 */
export async function queryTasksDueSoon(
    workspaceId: string,
    limit: number = 100,
    offset: number = 0
) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayDateString = today.toISOString().split("T")[0];

  const result = await db
    .select({
      uuid: tasks.uuid,
      title: tasks.title,
      description: tasks.description,
      dueDate: tasks.dueDate,
      priority: tasks.priority,
      status: tasks.status,
      warningDeadlineDays: tasks.warningDeadlineDays,
      createdBy: tasks.createdBy,
      workspaceId: tasks.workspaceId
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.workspaceId, workspaceId),
        sql`${tasks.dueDate} >= current_date`,
        sql`${tasks.dueDate} <= current_date + (COALESCE(${tasks.warningDeadlineDays}, 0) * interval '1 day')`,
        ne(tasks.status, "completed"),
        isNull(tasks.deletedAt)
      )
    )
    .limit(limit)
    .offset(offset)
    .orderBy(tasks.dueDate);

    return result;
}

/**
 * Get all users assigned to a task
 */
export async function getTaskAssignees(taskId: string) {
    const assignees = await db
        .select({
            uuid: accounts.uuid,
            email: accounts.email,
            fullName: accounts.fullName
        })
        .from(taskAssignments)
        .innerJoin(accounts, eq(taskAssignments.assignedToAccountId, accounts.uuid))
        .where(eq(taskAssignments.taskId, taskId));

    return assignees;
}

/**
 * Create or get notification using upsert (idempotent)
 */
export async function createNotificationWithIdempotency(payload: {
    workspaceId: string;
    title?: string;
    message?: string;
    type?: string;
    status?: string;
    metadata?: Record<string, unknown>;
}) {
    const [notification] = await db
        .insert(notifications)
        .values({
            workspaceId: payload.workspaceId,
            title: payload.title,
            message: payload.message,
            type: payload.type,
            status: payload.status || "pending",
            metadata: payload.metadata || {}
        })
        .onConflictDoNothing()
        .returning();

    if (!notification) {
        const existing = await db
            .select()
            .from(notifications)
            .where(
                and(
                    eq(notifications.workspaceId, payload.workspaceId),
                    eq(notifications.title, payload.title || ""),
                    eq(notifications.message, payload.message || ""),
                    eq(notifications.type, payload.type || "")
                )
            )
            .limit(1);

        return existing[0] || null;
    }

    return notification;
}

/**
 * Link task to notification
 */
export async function linkTaskNotification(
    taskId: string,
    notificationId: string,
    workspaceId: string
) {
    try {
        const [link] = await db
            .insert(taskNotifications)
            .values({
                taskId,
                notificationId,
                workspaceId,
                status: "pending"
            })
            .onConflictDoNothing()
            .returning();

        return link;
    } catch (error) {
        logger.warn({
            msg: "Failed to link task notification",
            taskId,
            notificationId,
            error
        });
        return null;
    }
}

/**
 * Link user to notification
 */
export async function linkUserNotification(
    userId: string,
    notificationId: string,
    workspaceId: string
) {
    try {
        const [link] = await db
            .insert(userNotifications)
            .values({
                userId,
                notificationId,
                workspaceId,
                isRead: false
            })
            .onConflictDoNothing()
            .returning();

        return link;
    } catch (error) {
        logger.warn({
            msg: "Failed to link user notification",
            userId,
            notificationId,
            error
        });
        return null;
    }
}

/**
 * Claim a pending job for processing
 */
export async function claimNotificationJob(workspaceId: string) {
    const now = new Date();

    const [claimed] = await db
        .select()
        .from(notificationJobs)
        .where(
            and(
                eq(notificationJobs.workspaceId, workspaceId),
                eq(notificationJobs.status, "pending"),
                lte(notificationJobs.scheduledAt, now)
            )
        )
        .limit(1)
        .orderBy(notificationJobs.scheduledAt);

    if (!claimed) {
        return null;
    }

    const [updated] = await db
        .update(notificationJobs)
        .set({ status: "processing" })
        .where(eq(notificationJobs.uuid, claimed.uuid))
        .returning();

    return updated;
}

/**
 * Mark job as completed
 */
export async function markJobProcessed(jobId: string, sentAt?: Date) {
    const [updated] = await db
        .update(notificationJobs)
        .set({
            status: "completed",
            processedAt: sentAt || new Date()
        })
        .where(eq(notificationJobs.uuid, jobId))
        .returning();

    return updated;
}

/**
 * Mark job as failed and schedule retry if allowed
 */
export async function markJobFailed(
    jobId: string,
    error: string,
    retryCount: number,
    maxRetries: number = 3
) {
    const nextStatus = retryCount >= maxRetries ? "failed" : "pending";
    const nextScheduledAt =
        nextStatus === "pending"
            ? new Date(Date.now() + Math.pow(2, retryCount) * 60000)
            : undefined;

    const [updated] = await db
        .update(notificationJobs)
        .set({
            status: nextStatus,
            retryCount: retryCount + 1,
            error,
            scheduledAt: nextScheduledAt || notificationJobs.scheduledAt
        })
        .where(eq(notificationJobs.uuid, jobId))
        .returning();

    return updated;
}

/**
 * Get failed jobs
 */
export async function getFailedJobs(
    workspaceId: string,
    limit: number = 50,
    offset: number = 0
) {
    const failed = await db
        .select()
        .from(notificationJobs)
        .where(
            and(
                eq(notificationJobs.workspaceId, workspaceId),
                eq(notificationJobs.status, "failed")
            )
        )
        .limit(limit)
        .offset(offset)
        .orderBy(notificationJobs.createdAt);

    return failed;
}

/**
 * Create notification job
 */
export async function createNotificationJob(payload: {
    taskId: string;
    notificationType: "due_soon" | "overdue" | "custom";
    scheduledAt: Date;
    workspaceId: string;
}) {
    const [job] = await db
        .insert(notificationJobs)
        .values({
            taskId: payload.taskId,
            notificationType: payload.notificationType,
            scheduledAt: payload.scheduledAt,
            workspaceId: payload.workspaceId,
            status: "pending",
            retryCount: 0
        })
        .onConflictDoNothing()
        .returning();

    return job;
}

/**
 * Get pending jobs due for processing
 */
export async function getPendingJobsDue(
    workspaceId: string,
    limit: number = 50
) {
    const now = new Date();

    const jobs = await db
        .select()
        .from(notificationJobs)
        .where(
            and(
                eq(notificationJobs.workspaceId, workspaceId),
                eq(notificationJobs.status, "pending"),
                lte(notificationJobs.scheduledAt, now)
            )
        )
        .limit(limit)
        .orderBy(notificationJobs.scheduledAt);

    return jobs;
}

/**
 * Mark task notification as sent
 */
export async function markTaskNotificationSent(
    taskNotificationId: string,
    sentAt: Date = new Date()
) {
    const [updated] = await db
        .update(taskNotifications)
        .set({
            status: "sent",
            sentAt
        })
        .where(eq(taskNotifications.uuid, taskNotificationId))
        .returning();

    return updated;
}

/**
 * Mark user notification as read
 */
export async function markUserNotificationRead(
    userNotificationId: string,
    readAt: Date = new Date()
) {
    const [updated] = await db
        .update(userNotifications)
        .set({
            isRead: true,
            readAt
        })
        .where(eq(userNotifications.uuid, userNotificationId))
        .returning();

    return updated;
}

/**
 * Get notification statistics for a workspace
 */
export async function getNotificationStats(workspaceId: string) {
    const pendingJobs = await db
        .select({ count: sql`count(*)` })
        .from(notificationJobs)
        .where(
            and(
                eq(notificationJobs.workspaceId, workspaceId),
                eq(notificationJobs.status, "pending")
            )
        );

    const failedJobs = await db
        .select({ count: sql`count(*)` })
        .from(notificationJobs)
        .where(
            and(
                eq(notificationJobs.workspaceId, workspaceId),
                eq(notificationJobs.status, "failed")
            )
        );

    const unreadNotifications = await db
        .select({ count: sql`count(*)` })
        .from(userNotifications)
        .where(
            and(
                eq(userNotifications.workspaceId, workspaceId),
                eq(userNotifications.isRead, false)
            )
        );

    return {
        workspaceId,
        pendingJobs: parseInt(String(pendingJobs[0]?.count ?? "0"), 10),
        failedJobs: parseInt(String(failedJobs[0]?.count ?? "0"), 10),
        unreadNotifications: parseInt(String(unreadNotifications[0]?.count ?? "0"), 10)
    };
}

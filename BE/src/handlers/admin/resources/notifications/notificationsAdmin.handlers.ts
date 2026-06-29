import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import { userNotifications } from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import { processDueSoonNotifications, getNotificationStats } from "@/services/notificationPipeline.service.ts";
import { and, eq } from "drizzle-orm";
import type { Request, Response } from "express";
import { z } from "zod";

const triggerSchema = z.object({
    workspaceId: z.uuid().optional(),
    dryRun: z.boolean().optional().default(false),
    batchSize: z.number().int().min(1).max(500).optional().default(50)
});

const markReadSchema = z.object({
    userNotificationId: z.uuid().optional(),
    notificationId: z.uuid().optional()
});

/**
 * Trigger due-soon notification processing manually
 * Useful for testing, immediate execution, or on-demand processing
 */
export const triggerDueSoonNotificationsAdmin = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
        const reqWorkspaceId = req.workspaceId?.trim();
        if (!reqWorkspaceId) {
            const response = apiResponse.error(
                HttpErrors.MissingParameter("x-workspace-id header")
            );
            res.status(response.code).send(response);
            return;
        }

        const parsed = triggerSchema.safeParse(req.body);
        if (!parsed.success) {
            const response = apiResponse.error(
                HttpErrors.ValidationFailed(parsed.error.message)
            );
            res.status(response.code).send(response);
            return;
        }

        const targetWorkspaceId = parsed.data.workspaceId || reqWorkspaceId;
        const { dryRun, batchSize } = parsed.data;

        try {
            const results = await processDueSoonNotifications({
                workspaceId: targetWorkspaceId,
                dryRun,
                batchSize
            });

            const successCount = results.filter((r) => r.success).length;
            const failureCount = results.filter((r) => !r.success).length;

            const response = apiResponse.success(
                HttpStatusCode.OK,
                {
                    mode: dryRun ? "dry-run" : "live",
                    workspaceId: targetWorkspaceId,
                    totalProcessed: results.length,
                    successCount,
                    failureCount,
                    results
                },
                dryRun
                    ? "Due-soon notifications dry-run completed"
                    : "Due-soon notifications triggered successfully"
            );

            res.status(response.code).send(response);
        } catch (error) {
            const response = apiResponse.error(
                HttpErrors.InternalError(
                    `Failed to trigger notifications: ${error instanceof Error ? error.message : String(error)}`
                )
            );
            res.status(response.code).send(response);
        }
    }
);

/**
 * Get notification processing statistics
 */
export const getNotificationStatsAdmin = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
        const workspaceId = req.workspaceId?.trim();
        if (!workspaceId) {
            const response = apiResponse.error(
                HttpErrors.MissingParameter("x-workspace-id header")
            );
            res.status(response.code).send(response);
            return;
        }

        try {
            const stats = await getNotificationStats(workspaceId);

            const response = apiResponse.success(
                HttpStatusCode.OK,
                {
                    workspaceId,
                    stats,
                    timestamp: new Date().toISOString()
                },
                "Notification statistics retrieved successfully"
            );

            res.status(response.code).send(response);
        } catch (error) {
            const response = apiResponse.error(
                HttpErrors.InternalError(
                    `Failed to get notification stats: ${error instanceof Error ? error.message : String(error)}`
                )
            );
            res.status(response.code).send(response);
        }
    }
);

/**
 * Mark unread notifications as read for current user
 */
export const markUserNotificationsReadAdmin = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
        const workspaceId = req.workspaceId?.trim();
        if (!workspaceId) {
            const response = apiResponse.error(
                HttpErrors.MissingParameter("x-workspace-id header")
            );
            res.status(response.code).send(response);
            return;
        }

        const userId = req.accountId;
        if (!userId) {
            const response = apiResponse.error(HttpErrors.Unauthorized("User not authenticated"));
            res.status(response.code).send(response);
            return;
        }

        const parsed = markReadSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            const response = apiResponse.error(
                HttpErrors.ValidationFailed(parsed.error.message)
            );
            res.status(response.code).send(response);
            return;
        }

        try {
            const { userNotificationId, notificationId } = parsed.data;
            const conditions = [
                eq(userNotifications.workspaceId, workspaceId),
                eq(userNotifications.userId, userId),
                eq(userNotifications.isRead, false)
            ];

            if (userNotificationId) {
                conditions.push(eq(userNotifications.uuid, userNotificationId));
            }

            if (notificationId) {
                conditions.push(eq(userNotifications.notificationId, notificationId));
            }

            const unreadRows = await db
                .update(userNotifications)
                .set({
                    isRead: true,
                    readAt: new Date()
                })
                .where(and(...conditions))
                .returning({ id: userNotifications.uuid });

            const response = apiResponse.success(
                HttpStatusCode.OK,
                {
                    workspaceId,
                    userId,
                    markedRead: unreadRows.length
                },
                "Notifications marked as read"
            );

            res.status(response.code).send(response);
        } catch (error) {
            const response = apiResponse.error(
                HttpErrors.InternalError(
                    `Failed to mark notifications as read: ${error instanceof Error ? error.message : String(error)}`
                )
            );
            res.status(response.code).send(response);
        }
    }
);

export default {
    triggerDueSoonNotificationsAdmin,
    getNotificationStatsAdmin,
    markUserNotificationsReadAdmin
};

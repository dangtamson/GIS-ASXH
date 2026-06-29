import {
    triggerDueSoonNotificationsAdmin,
    getNotificationStatsAdmin,
    markUserNotificationsReadAdmin
} from "@/handlers/admin/resources/notifications/index.ts";
import type { Application, RequestHandler } from "express";

export function setupNotificationAdminRoutes(
    app: Application,
    guards?: readonly RequestHandler[]
) {
    const adminGuards = guards || [];

    /**
     * POST /admin/notifications/trigger-due-soon
     * Manually trigger due-soon notification processing
     * Requires: notification.create permission
     */
    app.post(
        "/admin/notifications/trigger-due-soon",
        ...adminGuards,
        triggerDueSoonNotificationsAdmin
    );

    /**
     * GET /admin/notifications/stats
     * Get notification processing statistics
     * Requires: notification.view permission
     */
    app.get(
        "/admin/notifications/stats",
        ...adminGuards,
        getNotificationStatsAdmin
    );

    /**
     * POST /admin/notifications/mark-read
     * Mark all unread notifications as read for current user
     * Requires: notification.update permission
     */
    app.post(
        "/admin/notifications/mark-read",
        ...adminGuards,
        markUserNotificationsReadAdmin
    );
}

import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";

export type NotificationItem = {
    uuid: string;
    workspaceId?: string | null;
    title?: string | null;
    message?: string | null;
    type?: string | null;
    status?: string | null;
    metadata?: Record<string, unknown> | null;
    created_at?: string | Date | null;
    userNotificationId?: string;
    isRead?: boolean;
    readAt?: string | Date | null;
    deliveredAt?: string | Date | null;
};

export type NotificationListResult = {
    items: NotificationItem[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
};

type NotificationListResponse = {
    items?: NotificationItem[];
    pagination?: {
        page?: number;
        limit?: number;
        total?: number;
        pages?: number;
    };
};

function toQuery(params: Record<string, string | number | boolean | undefined>): string {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined) {
            return;
        }

        query.set(key, String(value));
    });

    const asString = query.toString();
    return asString ? `?${asString}` : "";
}

export async function fetchMyNotifications(params?: {
    page?: number;
    limit?: number;
    isRead?: boolean;
}): Promise<NotificationListResult> {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 10;

    const query = toQuery({
        onlyMine: true,
        page,
        limit,
        sortBy: "created_at",
        sortOrder: "desc",
        isRead: params?.isRead
    });

    const raw = await api.get<NotificationListResponse>(`${endpoints.admin.notifications}${query}`);
    const items = Array.isArray(raw?.items) ? raw.items : [];

    return {
        items,
        pagination: {
            page: Number(raw?.pagination?.page ?? page),
            limit: Number(raw?.pagination?.limit ?? limit),
            total: Number(raw?.pagination?.total ?? items.length),
            pages: Number(raw?.pagination?.pages ?? 1)
        }
    };
}

export async function markAllMyNotificationsRead(): Promise<number> {
    const payload = await api.post<{ markedRead?: number }>(endpoints.admin.notificationMarkRead);
    return Number(payload?.markedRead ?? 0);
}

export async function markMyNotificationRead(input: {
    userNotificationId?: string;
    notificationId?: string;
}): Promise<number> {
    const payload = await api.post<{ markedRead?: number }>(
        endpoints.admin.notificationMarkRead,
        {
            userNotificationId: input.userNotificationId,
            notificationId: input.notificationId
        }
    );

    return Number(payload?.markedRead ?? 0);
}

export function formatNotificationRelativeTime(value?: string | Date | null): string {
    if (!value) {
        return "Vừa xong";
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "Vừa xong";
    }

    const diffSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

    if (diffSeconds < 60) {
        return "Vừa xong";
    }

    if (diffSeconds < 3600) {
        const minutes = Math.floor(diffSeconds / 60);
        return `${minutes} phút trước`;
    }

    if (diffSeconds < 86400) {
        const hours = Math.floor(diffSeconds / 3600);
        return `${hours} giờ trước`;
    }

    if (diffSeconds < 604800) {
        const days = Math.floor(diffSeconds / 86400);
        return `${days} ngày trước`;
    }

    return date.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}

export function getNotificationTitle(item: NotificationItem): string {
    return (item.title || "Thông báo").trim();
}

export function getNotificationMessage(item: NotificationItem): string {
    return (item.message || "Không có nội dung").trim();
}

function readStringValue(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const normalized = value.trim();
    return normalized ? normalized : null;
}

export function getNotificationTaskId(item: NotificationItem): string | null {
    const metadata = item.metadata;

    if (!metadata || typeof metadata !== "object") {
        return null;
    }

    const candidates: unknown[] = [
        metadata.taskId,
        metadata.task_id,
        metadata.taskUuid,
        metadata.taskUUID,
        (metadata.task as Record<string, unknown> | undefined)?.id,
        (metadata.task as Record<string, unknown> | undefined)?.uuid,
        (metadata.payload as Record<string, unknown> | undefined)?.taskId,
        (metadata.payload as Record<string, unknown> | undefined)?.task_id,
        (metadata.data as Record<string, unknown> | undefined)?.taskId,
        (metadata.data as Record<string, unknown> | undefined)?.task_id
    ];

    for (const candidate of candidates) {
        const taskId = readStringValue(candidate);
        if (taskId) {
            return taskId;
        }
    }

    return null;
}

export function getNotificationTaskHref(item: NotificationItem): string | null {
    const taskId = getNotificationTaskId(item);
    if (!taskId) {
        return null;
    }

    return `/nhiem-vu-da-giao/${taskId}`;
}

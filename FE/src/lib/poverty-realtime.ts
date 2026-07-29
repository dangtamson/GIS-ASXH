import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const POVERTY_COORDINATE_UPDATE_EVENT = "poverty_coordinate_updated" as const;

export type PovertyCoordinateUpdateEvent = {
    householdId: string;
    householdHeadName: string;
    actorName: string;
    updatedAt: string;
};

export const buildPovertyCoordinateChannel = (workspaceId: string): string =>
    `poverty-household-coordinate-updates:${workspaceId}`;

let realtimeClient: SupabaseClient | null = null;

export function getPovertyRealtimeClient(): SupabaseClient | null {
    if (typeof window === "undefined") return null;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
    if (!url || !key) return null;

    realtimeClient ??= createClient(url, key, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
    return realtimeClient;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}

export function parsePovertyCoordinateUpdate(payload: unknown): PovertyCoordinateUpdateEvent | null {
    const record = asRecord(payload);
    if (
        typeof record?.householdId !== "string"
        || typeof record.householdHeadName !== "string"
        || typeof record.actorName !== "string"
        || typeof record.updatedAt !== "string"
    ) {
        return null;
    }

    return {
        householdId: record.householdId,
        householdHeadName: record.householdHeadName,
        actorName: record.actorName,
        updatedAt: record.updatedAt,
    };
}

export function formatPovertyCoordinateNotification(event: PovertyCoordinateUpdateEvent): string {
    const date = new Date(event.updatedAt);
    const time = Number.isNaN(date.getTime())
        ? event.updatedAt
        : new Intl.DateTimeFormat("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
            timeZone: "Asia/Ho_Chi_Minh",
        }).format(date).replace(", ", " ");

    return `${event.actorName} đã thu thập cập nhật hộ: ${event.householdHeadName} lúc ${time}`;
}

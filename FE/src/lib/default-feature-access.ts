import type { AccessibleFeature } from "./default-feature.ts";

type AccountWithRoles = {
    memberships?: unknown[];
    workspaces?: unknown[];
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;

const positiveRoleId = (value: unknown): number | null => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

function getWorkspaceEntryId(value: unknown): string {
    const record = asRecord(value);
    if (!record) return "";

    const workspace = asRecord(record.workspace);
    return String(record.workspaceId ?? record.id ?? record.uuid ?? workspace?.id ?? workspace?.uuid ?? "");
}

function getRoleId(value: unknown): number | null {
    const record = asRecord(value);
    if (!record) return null;

    const role = asRecord(record.role);
    const membership = asRecord(record.membership);
    const membershipRole = asRecord(membership?.role);

    return positiveRoleId(record.roleId)
        ?? positiveRoleId(role?.id)
        ?? positiveRoleId(membership?.roleId)
        ?? positiveRoleId(membershipRole?.id);
}

export function getCurrentRoleId(
    account: AccountWithRoles | null,
    workspaceId?: string | null
): number | null {
    if (!account) return null;

    for (const membership of account.memberships ?? []) {
        if (workspaceId && getWorkspaceEntryId(membership) !== workspaceId) continue;
        const roleId = getRoleId(membership);
        if (roleId) return roleId;
    }

    for (const workspace of account.workspaces ?? []) {
        if (workspaceId && getWorkspaceEntryId(workspace) !== workspaceId) continue;
        const roleId = getRoleId(workspace);
        if (roleId) return roleId;
    }

    return null;
}

function normalizeFeature(value: unknown): AccessibleFeature | null {
    const feature = asRecord(value);
    if (!feature) return null;

    const uuid = String(feature.uuid ?? "");
    const name = String(feature.name ?? "");
    const path = String(feature.path ?? "");
    if (!uuid || !name || !path) return null;

    return {
        uuid,
        name,
        path,
        enabled: feature.enabled === true,
        orderIndex: typeof feature.orderIndex === "number" ? feature.orderIndex : undefined,
    };
}

export const normalizeAdminFeatures = (items: unknown[]): AccessibleFeature[] =>
    items
        .map(normalizeFeature)
        .filter((feature): feature is AccessibleFeature => Boolean(feature?.enabled));

export const normalizeRoleFeatures = (items: unknown[]): AccessibleFeature[] =>
    items
        .map((item) => normalizeFeature(asRecord(item)?.feature))
        .filter((feature): feature is AccessibleFeature => Boolean(feature?.enabled));

import { and, eq } from "drizzle-orm";
import { permissions, rolePermissions, roles, workspaceMemberships } from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";

/**
 * One-query RBAC fetch:
 * workspace_memberships -> roles -> role_permissions -> permissions
 */
export async function getUserPermissionsFromDB(userId: string, workspaceId: string): Promise<string[]> {
  const rows = await db
    .select({ code: permissions.code })
    .from(workspaceMemberships)
    .innerJoin(roles, eq(workspaceMemberships.roleId, roles.id))
    .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(
      and(
        eq(workspaceMemberships.accountId, userId),
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.status, true)
      )
    );

  return [
    ...new Set(rows.map((row) => row.code).filter((code): code is string => typeof code === "string" && code.length > 0))
  ];
}


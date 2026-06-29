import { logger } from "@/helpers/index.ts";
import { roles, workspaceMemberships, type WorkspaceMembershipInsertType } from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import { type DbTransaction } from "@/types/database.ts";
import { and, eq } from "drizzle-orm";

export type RoleInput = string | number;

type ResolvedRole = {
  id: number;
  code: string | null;
  name: string | null;
};

export function isValidRole(role: unknown): role is RoleInput {
  if (typeof role === "number") {
    return Number.isInteger(role) && role > 0;
  }

  if (typeof role !== "string") {
    return false;
  }

  return role.trim().length > 0;
}

const coerceRoleInput = (roleInput: RoleInput): { roleId?: number; roleCode?: string } => {
  if (typeof roleInput === "number") {
    return { roleId: roleInput };
  }

  const trimmed = roleInput.trim();
  if (/^\d+$/.test(trimmed)) {
    return { roleId: Number(trimmed) };
  }

  return { roleCode: trimmed };
};

export async function resolveRoleByInput(roleInput: RoleInput, tx?: DbTransaction): Promise<ResolvedRole> {
  const database = tx || db;
  const { roleId, roleCode } = coerceRoleInput(roleInput);

  const [role] = roleId
    ? await database
      .select({ id: roles.id, code: roles.code, name: roles.name })
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1)
    : await database
      .select({ id: roles.id, code: roles.code, name: roles.name })
      .from(roles)
      .where(eq(roles.code, roleCode || ""))
      .limit(1);

  if (!role) {
    const roleLabel = roleId ? `id=${roleId}` : `code='${roleCode}'`;
    throw new Error(`Role not found: ${roleLabel}`);
  }

  return role;
}

export async function createMembership(
  workspaceId: string,
  accountId: string,
  role: RoleInput,
  isAdmin: boolean,
  tx?: DbTransaction,
  options?: {
    organizationId?: string;
  }
): Promise<WorkspaceMembershipInsertType> {
  if (!isValidRole(role)) {
    logger.warn({ msg: `Invalid role provided: ${role}` });
    throw new Error("Invalid role");
  }

  logger.info(`Creating membership for account: ${accountId} in workspace: ${workspaceId} as role: ${role}`);

  const database = tx || db;
  const resolvedRole = await resolveRoleByInput(role, tx);
  const [membership] = await database
    .insert(workspaceMemberships)
    .values({
      roleId: resolvedRole.id,
      workspaceId,
      accountId,
      organizationId: options?.organizationId,
      isAdmin: isAdmin
    })
    .returning();

  if (!membership) {
    throw new Error("Unable to create membership");
  }

  logger.info({
    msg: `Created membership for account: ${accountId} in workspace: ${workspaceId} as role: ${resolvedRole.code || resolvedRole.id}`
  });

  return membership;
}

/**
 * Check if the account is a member of the workspace.
 */
export async function checkMembership(accountId: string, workspaceId: string): Promise<[boolean, string]> {
  logger.info(`Checking membership for account: ${accountId} in workspace: ${workspaceId}`);

  if (!accountId || !workspaceId) {
    return [false, ""];
  }

  const [result] = await db
    .select({
      accountId: workspaceMemberships.accountId,
      workspaceId: workspaceMemberships.workspaceId,
      roleCode: roles.code
    })
    .from(workspaceMemberships)
    .innerJoin(roles, eq(workspaceMemberships.roleId, roles.id))
    .where(and(eq(workspaceMemberships.accountId, accountId), eq(workspaceMemberships.workspaceId, workspaceId)))
    .execute();

  const isMember = (result?.accountId === accountId && result?.workspaceId === workspaceId) || false;

  logger.info(`Checked membership for ${accountId} in ${workspaceId}. User is [${isMember}, ${result?.roleCode ?? ""}]`);

  return [isMember, result?.roleCode ?? ""];
}

import { MemberCreateSchema, MemberRoleUpdateSchema } from "@/docs/openapi-schemas.ts";
import { createDbProfile } from "@/handlers/profiles/profiles.methods.ts";
import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { permissions as routePermissions } from "@/helpers/index.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import { validateRequiredUuid } from "@/helpers/validation.ts";
import { accounts, organizations, permissions, profiles, rolePermissions, roles, workspaceMemberships } from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import { and, count, eq } from "drizzle-orm";
import type { Request, Response } from "express";
import { checkMembership, createMembership, isValidRole, resolveRoleByInput } from "./memberships.methods.ts";

async function validateOrganizationInWorkspace(
  organizationId: string | undefined,
  workspaceId: string
): Promise<{ uuid: string; name: string; code: string | null } | null> {
  if (!organizationId) {
    return null;
  }

  const [organization] = await db
    .select({
      uuid: organizations.uuid,
      name: organizations.name,
      code: organizations.code,
      workspaceId: organizations.workspaceId
    })
    .from(organizations)
    .where(and(eq(organizations.uuid, organizationId), eq(organizations.workspaceId, workspaceId)))
    .limit(1);

  return organization ?? null;
}
/**
 * GET /workspaces/:id/effective-permissions
 * Debug endpoint to inspect current user's effective permissions in a workspace.
 */
export const getEffectivePermissionsByWorkspace = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceIdValidation = validateRequiredUuid(req.params.id, "Workspace ID");
  const { accountId } = req;

  if (!workspaceIdValidation.success) {
    const response = apiResponse.error(workspaceIdValidation.error);
    res.status(response.code).send(response);
    return;
  }

  const workspaceId = workspaceIdValidation.value;

  if (!accountId) {
    const response = apiResponse.error(HttpErrors.Unauthorized("Account ID is required"));
    res.status(response.code).send(response);
    return;
  }

  const membershipPermissionRows = await db
    .select({
      role: {
        id: roles.id,
        code: roles.code,
        name: roles.name
      },
      permissionCode: permissions.code,
      permissionName: permissions.name
    })
    .from(workspaceMemberships)
    .innerJoin(roles, eq(workspaceMemberships.roleId, roles.id))
    .leftJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
    .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(and(eq(workspaceMemberships.workspaceId, workspaceId), eq(workspaceMemberships.accountId, accountId)));

  if (membershipPermissionRows.length === 0) {
    const response = apiResponse.error(HttpErrors.NotFound("Workspace membership"));
    res.status(response.code).send(response);
    return;
  }

  const role = membershipPermissionRows[0]?.role;
  const permissionCodes = [
    ...new Set(membershipPermissionRows.map((row) => row.permissionCode).filter((code): code is string => Boolean(code)))
  ].sort();

  const permissionNames = [
    ...new Set(membershipPermissionRows.map((row) => row.permissionName).filter((name): name is string => Boolean(name)))
  ].sort();

  const workspaceRouteChecks = [...routePermissions.permissions.entries()]
    .filter(([, metadata]) => metadata.workspaceScoped)
    .flatMap(([route, metadata]) =>
      Object.entries(metadata.permissions).map(([method, permissionCode]) => ({
        route,
        method,
        permissionCode,
        granted: permissionCode === "" || permissionCodes.includes(permissionCode)
      }))
    );

  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      accountId,
      workspaceId,
      role,
      permissionCodes,
      permissionNames,
      routeChecks: workspaceRouteChecks
    },
    "Effective permissions retrieved successfully"
  );

  res.status(response.code).send(response);
});

/**
 * GET /workspaces/:id/members
 * Get all members of a workspace
 * Requires: User or Admin role in the workspace
 */
export const getWorkspaceMembers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceIdValidation = validateRequiredUuid(req.params.id, "Workspace ID");
  if (!workspaceIdValidation.success) {
    const response = apiResponse.error(workspaceIdValidation.error);
    res.status(response.code).send(response);
    return;
  }

  const workspaceId = workspaceIdValidation.value;

  // Get all members with their roles and account info
  const members = await db
    .select({
      membership: {
        uuid: workspaceMemberships.uuid,
        roleId: workspaceMemberships.roleId,
        organizationId: workspaceMemberships.organizationId,
        isAdmin: workspaceMemberships.isAdmin
      },
      role: {
        code: roles.code,
        name: roles.name
      },
      organization: {
        uuid: organizations.uuid,
        name: organizations.name,
        code: organizations.code
      },
      profile: {
        uuid: profiles.uuid,
        name: profiles.name,
        createdAt: profiles.createdAt
      },
      account: {
        uuid: accounts.uuid,
        fullName: accounts.fullName,
        email: accounts.email
      }
    })
    .from(workspaceMemberships)
    .innerJoin(roles, eq(workspaceMemberships.roleId, roles.id))
    .innerJoin(accounts, eq(workspaceMemberships.accountId, accounts.uuid))
    .leftJoin(organizations, eq(workspaceMemberships.organizationId, organizations.uuid))
    .leftJoin(
      profiles,
      and(
        eq(workspaceMemberships.accountId, profiles.accountId),
        eq(workspaceMemberships.workspaceId, profiles.workspaceId)
      )
    )
    .where(eq(workspaceMemberships.workspaceId, workspaceId));

  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      members,
      memberCount: members.length
    },
    "Workspace members retrieved successfully"
  );

  res.status(response.code).send(response);
});

/**
 * POST /workspaces/:id/members
 * Add a member to workspace (must be existing account)
 * Requires: Admin role in the workspace
 * Body: { email: string, role: roleId|roleCode, organizationId?: string, profileName?: string }
 */
export const addWorkspaceMember = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceIdValidation = validateRequiredUuid(req.params.id, "Workspace ID");

  const validation = MemberCreateSchema.safeParse(req.body);
  if (!validation.success) {
    const response = apiResponse.error(
      HttpErrors.ValidationFailed(`Invalid request data: ${validation.error.message}`)
    );
    res.status(response.code).send(response);
    return;
  }

  const { email, role, profileName, organizationId, isAdmin } = validation.data;

  if (!workspaceIdValidation.success) {
    const response = apiResponse.error(workspaceIdValidation.error);
    res.status(response.code).send(response);
    return;
  }

  const workspaceId = workspaceIdValidation.value;

  if (!email || !role) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Email and role are required"));
    res.status(response.code).send(response);
    return;
  }

  if (!isValidRole(role)) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid role. Must be a role id or role code"));
    res.status(response.code).send(response);
    return;
  }

  let resolvedRole;
  try {
    resolvedRole = await resolveRoleByInput(role);
  } catch {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Role not found"));
    res.status(response.code).send(response);
    return;
  }

  const organization = await validateOrganizationInWorkspace(organizationId, workspaceId);
  if (organizationId && !organization) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Organization is invalid for this workspace"));
    res.status(response.code).send(response);
    return;
  }

  const [account] = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);

  if (!account) {
    const response = apiResponse.error(HttpErrors.NotFound("Account"));
    res.status(response.code).send(response);
    return;
  }

  const [isMember] = await checkMembership(account.uuid, workspaceId);

  if (isMember) {
    const response = apiResponse.error(HttpErrors.Conflict("User is already a member of this workspace"));
    res.status(response.code).send(response);
    return;
  }

  // Create membership and profile in a transaction
  const result = await db.transaction(async (tx) => {
    const membership = await createMembership(workspaceId, account.uuid, role, isAdmin ?? false, tx, {
      organizationId
    });
    const profile = await createDbProfile(
      {
        name: profileName || account.fullName || "New Member",
        accountId: account.uuid,
        workspaceId: workspaceId
      },
      tx
    );

    return { membership, profile };
  });

  const response = apiResponse.success(
    HttpStatusCode.CREATED,
    {
      membership: result.membership,
      profile: result.profile,
      account: {
        uuid: account.uuid,
        fullName: account.fullName,
        email: account.email
      },
      role: {
        id: resolvedRole.id,
        code: resolvedRole.code,
        name: resolvedRole.name
      },
      organization
    },
    `Added ${email} to workspace as ${resolvedRole.name || resolvedRole.code || resolvedRole.id}`
  );

  res.status(response.code).send(response);
});

/**
 * PUT /workspaces/:id/members/:memberId/role
 * Update a member's role in the workspace
 * Requires: Admin role in the workspace
 * Body: { role: roleId|roleCode, organizationId?: string }
 */
export const updateMemberRole = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceIdValidation = validateRequiredUuid(req.params.id, "Workspace ID");
  const memberIdValidation = validateRequiredUuid(req.params.memberId, "Member ID");

  const validation = MemberRoleUpdateSchema.safeParse(req.body);
  if (!validation.success) {
    const response = apiResponse.error(
      HttpErrors.ValidationFailed(`Invalid request data: ${validation.error.message}`)
    );
    res.status(response.code).send(response);
    return;
  }

  const { role, organizationId, isAdmin } = validation.data;

  if (!workspaceIdValidation.success) {
    const response = apiResponse.error(workspaceIdValidation.error);
    res.status(response.code).send(response);
    return;
  }

  if (!memberIdValidation.success) {
    const response = apiResponse.error(memberIdValidation.error);
    res.status(response.code).send(response);
    return;
  }

  const workspaceId = workspaceIdValidation.value;
  const memberId = memberIdValidation.value;

  if (!role || !isValidRole(role)) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid role. Must be a role id or role code"));
    res.status(response.code).send(response);
    return;
  }

  let nextRole;
  try {
    nextRole = await resolveRoleByInput(role);
  } catch {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Role not found"));
    res.status(response.code).send(response);
    return;
  }

  const organization = await validateOrganizationInWorkspace(organizationId, workspaceId);
  if (organizationId && !organization) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Organization is invalid for this workspace"));
    res.status(response.code).send(response);
    return;
  }

  // Find the membership
  const [existingMembership] = await db
    .select({
      uuid: workspaceMemberships.uuid,
      accountId: workspaceMemberships.accountId,
      currentRole: roles.code
    })
    .from(workspaceMemberships)
    .innerJoin(roles, eq(workspaceMemberships.roleId, roles.id))
    .where(and(eq(workspaceMemberships.uuid, memberId), eq(workspaceMemberships.workspaceId, workspaceId)))
    .limit(1);

  if (!existingMembership) {
    const response = apiResponse.error(HttpErrors.NotFound("Membership"));
    res.status(response.code).send(response);
    return;
  }

  // Prevent removing the last admin membership in a workspace.
  if (existingMembership.currentRole === "admin" && nextRole.code !== "admin") {
    const adminCount = await db
      .select({ count: count() })
      .from(workspaceMemberships)
      .innerJoin(roles, eq(workspaceMemberships.roleId, roles.id))
      .where(and(eq(workspaceMemberships.workspaceId, workspaceId), eq(roles.code, "admin")));

    if ((adminCount[0]?.count ?? 0) <= 1) {
      const response = apiResponse.error(HttpErrors.BadRequest("Cannot remove the last admin from the workspace"));
      res.status(response.code).send(response);
      return;
    }
  }

  // Update the role
  const [updatedMembership] = await db
    .update(workspaceMemberships)
    .set({ roleId: nextRole.id, organizationId, isAdmin: isAdmin, workspaceId: workspaceId })
    .where(eq(workspaceMemberships.uuid, memberId))
    .returning();

  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      membership: updatedMembership,
      role: {
        id: nextRole.id,
        code: nextRole.code,
        name: nextRole.name
      },
      organization
    },
    `Updated member role to ${nextRole.name || nextRole.code || nextRole.id}`
  );

  res.status(response.code).send(response);
});

/**
 * GET /workspaces/:id/access-report
 * Return RBAC access report for current workspace.
 */
export const getWorkspaceAccessReport = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceIdValidation = validateRequiredUuid(req.params.id, "Workspace ID");
  if (!workspaceIdValidation.success) {
    const response = apiResponse.error(workspaceIdValidation.error);
    res.status(response.code).send(response);
    return;
  }

  const workspaceId = workspaceIdValidation.value;

  const members = await db
    .select({
      membershipUuid: workspaceMemberships.uuid,
      accountId: accounts.uuid,
      accountName: accounts.fullName,
      accountEmail: accounts.email,
      organizationId: workspaceMemberships.organizationId,
      organizationName: organizations.name,
      roleId: roles.id,
      roleCode: roles.code,
      roleName: roles.name
    })
    .from(workspaceMemberships)
    .innerJoin(accounts, eq(workspaceMemberships.accountId, accounts.uuid))
    .innerJoin(roles, eq(workspaceMemberships.roleId, roles.id))
    .leftJoin(organizations, eq(workspaceMemberships.organizationId, organizations.uuid))
    .where(eq(workspaceMemberships.workspaceId, workspaceId));

  const rolePermissionRows = await db
    .select({
      roleId: roles.id,
      roleCode: roles.code,
      roleName: roles.name,
      permissionId: permissions.id,
      permissionCode: permissions.code,
      permissionName: permissions.name
    })
    .from(roles)
    .leftJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
    .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id));

  const permissionsByRoleId = new Map<
    number,
    Array<{
      id: number;
      code: string | null;
      name: string | null;
    }>
  >();

  rolePermissionRows.forEach((row) => {
    if (!row.permissionId) {
      return;
    }

    const list = permissionsByRoleId.get(row.roleId) || [];
    if (!list.some((item) => item.id === row.permissionId)) {
      list.push({
        id: row.permissionId,
        code: row.permissionCode,
        name: row.permissionName
      });
      permissionsByRoleId.set(row.roleId, list);
    }
  });

  const roleSummaries = new Map<
    number,
    {
      id: number;
      code: string | null;
      name: string | null;
      memberCount: number;
      permissionCount: number;
      permissionCodes: string[];
    }
  >();

  members.forEach((member) => {
    const existing = roleSummaries.get(member.roleId);
    const rolePermissionsList = permissionsByRoleId.get(member.roleId) || [];
    const permissionCodes = rolePermissionsList
      .map((permission) => permission.code)
      .filter((code): code is string => Boolean(code))
      .sort();

    if (existing) {
      existing.memberCount += 1;
      return;
    }

    roleSummaries.set(member.roleId, {
      id: member.roleId,
      code: member.roleCode,
      name: member.roleName,
      memberCount: 1,
      permissionCount: rolePermissionsList.length,
      permissionCodes
    });
  });

  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      workspaceId,
      summary: {
        totalMembers: members.length,
        totalRolesUsed: roleSummaries.size
      },
      roles: Array.from(roleSummaries.values()).sort((a, b) => a.memberCount - b.memberCount),
      members: members.map((member) => ({
        membershipUuid: member.membershipUuid,
        account: {
          id: member.accountId,
          fullName: member.accountName,
          email: member.accountEmail
        },
        organization: member.organizationId
          ? {
            id: member.organizationId,
            name: member.organizationName
          }
          : null,
        role: {
          id: member.roleId,
          code: member.roleCode,
          name: member.roleName,
          permissions: permissionsByRoleId.get(member.roleId) || []
        }
      }))
    },
    "Workspace access report generated successfully"
  );

  res.status(response.code).send(response);
});

/**
 * DELETE /workspaces/:id/members/:memberId
 * Remove a member from the workspace
 * Requires: Admin role in the workspace
 */
export const removeMember = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceIdValidation = validateRequiredUuid(req.params.id, "Workspace ID");
  const memberIdValidation = validateRequiredUuid(req.params.memberId, "Member ID");

  if (!workspaceIdValidation.success) {
    const response = apiResponse.error(workspaceIdValidation.error);
    res.status(response.code).send(response);
    return;
  }

  if (!memberIdValidation.success) {
    const response = apiResponse.error(memberIdValidation.error);
    res.status(response.code).send(response);
    return;
  }

  const workspaceId = workspaceIdValidation.value;
  const memberId = memberIdValidation.value;

  // Find the membership to remove
  const [membershipToRemove] = await db
    .select({
      uuid: workspaceMemberships.uuid,
      accountId: workspaceMemberships.accountId,
      role: roles.code
    })
    .from(workspaceMemberships)
    .innerJoin(roles, eq(workspaceMemberships.roleId, roles.id))
    .where(and(eq(workspaceMemberships.uuid, memberId), eq(workspaceMemberships.workspaceId, workspaceId)))
    .limit(1);

  if (!membershipToRemove) {
    const response = apiResponse.error(HttpErrors.NotFound("Membership"));
    res.status(response.code).send(response);
    return;
  }

  // Prevent removing the last admin
  if (membershipToRemove.role === "admin") {
    const adminCount = await db
      .select({ count: count() })
      .from(workspaceMemberships)
      .innerJoin(roles, eq(workspaceMemberships.roleId, roles.id))
      .where(and(eq(workspaceMemberships.workspaceId, workspaceId), eq(roles.code, "admin")));

    if ((adminCount[0]?.count ?? 0) <= 1) {
      const response = apiResponse.error(HttpErrors.BadRequest("Cannot remove the last admin from the workspace"));
      res.status(response.code).send(response);
      return;
    }
  }

  // Remove the profile and membership in transaction
  await db.transaction(async (tx) => {
    // Remove profile
    await tx
      .delete(profiles)
      .where(and(eq(profiles.accountId, membershipToRemove.accountId), eq(profiles.workspaceId, workspaceId)));

    // Remove membership
    await tx.delete(workspaceMemberships).where(eq(workspaceMemberships.uuid, memberId));
  });

  const response = apiResponse.success(
    HttpStatusCode.OK,
    { removedMemberId: memberId },
    "Member removed from workspace"
  );

  res.status(response.code).send(response);
});

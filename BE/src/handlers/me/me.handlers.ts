import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import { accounts, organizations, profiles, roles, workspaceMemberships, workspaces } from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import { and, eq } from "drizzle-orm";
import type { Request, Response } from "express";

/**
 * GET /me - Returns everything the frontend needs after login:
 * - Account details (email, name, etc.)
 * - All workspaces user belongs to
 * - Full profile info for each workspace
 * - Membership role for each workspace
 *
 * This replaces the need for frontend to call /workspaces separately
 */
export const getCurrentUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { accountId } = req;

  if (!accountId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Account ID"));
    res.status(response.code).send(response);
    return;
  }

  // Get account details
  const [account] = await db
    .select({
      uuid: accounts.uuid,
      fullName: accounts.fullName,
      email: accounts.email,
      phone: accounts.phone,
      isSuperAdmin: accounts.isSuperAdmin,
      status: accounts.status,
      createdAt: accounts.createdAt
    })
    .from(accounts)
    .where(eq(accounts.uuid, accountId))
    .limit(1);

  if (!account) {
    const response = apiResponse.error(HttpErrors.NotFound("Account"));
    res.status(response.code).send(response);
    return;
  }

  // Super admin can see all workspaces; other users only see their memberships.
  const userWorkspaces = account.isSuperAdmin
    ? await db
      .select({
        workspace: {
          uuid: workspaces.uuid,
          name: workspaces.name,
          description: workspaces.description,
          createdAt: workspaces.createdAt,
          ownerId: workspaces.accountId
        },
        // profile: {
        //   uuid: profiles.uuid,
        //   name: profiles.name,
        //   createdAt: profiles.createdAt
        // },
        membership: {
          uuid: workspaceMemberships.uuid,
          workspaceId: workspaceMemberships.workspaceId,
          accountId: workspaceMemberships.accountId,
          organizationId: workspaceMemberships.organizationId,
          positionId: workspaceMemberships.positionId,
        },
        organization: {
          uuid: organizations.uuid,
          name: organizations.name,
          code: organizations.code
        },
        role: {
          id: roles.id,
          code: roles.code,
          name: roles.name
        }
      })
      .from(workspaces)
      .leftJoin(
        workspaceMemberships,
        and(eq(workspaceMemberships.workspaceId, workspaces.uuid), eq(workspaceMemberships.accountId, accountId))
      )
      .leftJoin(roles, eq(workspaceMemberships.roleId, roles.id))
      .leftJoin(organizations, eq(workspaceMemberships.organizationId, organizations.uuid))
      // .leftJoin(
      //   profiles,
      //   and(eq(profiles.workspaceId, workspaces.uuid), eq(profiles.accountId, accountId))
      // )
      .orderBy(workspaces.createdAt)
    : await db
      .select({
        workspace: {
          uuid: workspaces.uuid,
          name: workspaces.name,
          description: workspaces.description,
          createdAt: workspaces.createdAt,
          ownerId: workspaces.accountId
        },
        // profile: {
        //   uuid: profiles.uuid,
        //   name: profiles.name,
        //   createdAt: profiles.createdAt
        // },
        membership: {
          uuid: workspaceMemberships.uuid,
          workspaceId: workspaceMemberships.workspaceId,
          accountId: workspaceMemberships.accountId,
          organizationId: workspaceMemberships.organizationId
        },
        organization: {
          uuid: organizations.uuid,
          name: organizations.name,
          code: organizations.code
        },
        role: {
          id: roles.id,
          code: roles.code,
          name: roles.name
        }
      })
      .from(workspaceMemberships)
      .innerJoin(workspaces, eq(workspaceMemberships.workspaceId, workspaces.uuid))
      // .innerJoin(profiles, and(eq(profiles.workspaceId, workspaces.uuid), eq(profiles.accountId, accountId)))
      .innerJoin(roles, eq(workspaceMemberships.roleId, roles.id))
      .leftJoin(organizations, eq(workspaceMemberships.organizationId, organizations.uuid))
      .where(eq(workspaceMemberships.accountId, accountId));

  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      account,
      workspaces: userWorkspaces,
      workspaceCount: userWorkspaces.length
    },
    "Current user profile retrieved"
  );

  res.status(response.code).send(response);
});

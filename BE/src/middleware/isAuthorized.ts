import { checkMembership } from "@/handlers/memberships/memberships.methods.ts";
import { getProfileById } from "@/handlers/profiles/profiles.methods.ts";
import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import type { Route } from "@/helpers/index.ts";
import { logger, permissions } from "@/helpers/index.ts";
import { PERMISSION_CODES, type Method } from "@/helpers/permissions.ts";
import { apiResponse } from "@/helpers/response.ts";
import { accounts, permissions as permissionRecords, rolePermissions, roles, workspaceMemberships } from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import { and, eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

const ResourceType = {
  ACCOUNT: "account",
  PROFILE: "profile"
} as const;

const workspaceIdRouteParams = new Set([
  "/workspaces/:id",
  "/workspaces/:id/profile",
  "/workspaces/:id/effective-permissions",
  "/workspaces/:id/access-report",
  "/workspaces/:id/members",
  "/workspaces/:id/members/:memberId/role",
  "/workspaces/:id/members/:memberId"
]);

export function determineResourceType(route: Route): "" | (typeof ResourceType)[keyof typeof ResourceType] {
  const keys = Object.values(ResourceType);
  const resourceType = keys.find((key) => route.includes(key));
  return resourceType ?? "";
}

/**
 * Check if the user is the owner of a resource.
 */
const isOwner = async (id: string, resourceId: string, resourceType: string): Promise<boolean> => {
  switch (resourceType) {
    case ResourceType.ACCOUNT:
      return id === resourceId;
    // Needs to verify the accountId associated with the profile.
    case ResourceType.PROFILE: {
      const [profile] = await getProfileById(resourceId);

      if (profile) {
        logger.debug({ msg: "isOwner: profile", id, resourceId, accountId: profile.accountId });

        return profile.accountId === id;
      }

      return false;
    }

    default:
      return false;
  }
};

const hasWorkspacePermission = async (
  accountId: string,
  workspaceId: string,
  permissionCode: string
): Promise<boolean> => {
  const [result] = await db
    .select({ roleId: workspaceMemberships.roleId })
    .from(workspaceMemberships)
    .innerJoin(rolePermissions, eq(workspaceMemberships.roleId, rolePermissions.roleId))
    .innerJoin(permissionRecords, eq(rolePermissions.permissionId, permissionRecords.id))
    .where(
      and(
        eq(workspaceMemberships.accountId, accountId),
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(permissionRecords.code, permissionCode)
      )
    )
    .limit(1)
    .execute();

  return Boolean(result);
};

async function hasGlobalAdminPermission(permissionCode: string): Promise<boolean> {
  const [result] = await db
    .select({ permissionId: permissionRecords.id })
    .from(rolePermissions)
    .innerJoin(roles, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissionRecords, eq(rolePermissions.permissionId, permissionRecords.id))
    .where(and(eq(roles.code, "admin"), eq(permissionRecords.code, permissionCode)))
    .limit(1)
    .execute();

  return Boolean(result);
}

export const isAuthorized = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { accountId } = req;
    const workspaceId = req.workspaceId?.trim();

    const routeMethod = req.method as Method;
    const routeKey = (req.baseUrl + req.route.path) as Route;

    logger.debug(`Authorizing for workspace id: ${workspaceId}`);
    logger.debug(req, "isAuthorized: req");

    const resourcePermissions = permissions.permissions.get(routeKey);
    const requiredPermissionCode = resourcePermissions?.permissions[routeMethod];
    const requiresAuth = (resourcePermissions && resourcePermissions.authenticated) || false;

    logger.debug({ cookies: req.cookies }, "isAuthorized: cookies");

    logger.debug(
      {
        routeKey,
        routeMethod,
        workspaceId,
        resourcePermissions,
        requiredPermissionCode
      },
      "isAuthorized: middleware"
    );

    if (requiresAuth && !accountId) {
      logger.error({ accountId, routeKey, requiredPermissionCode, routeMethod, workspaceId }, "Unauthorized user");

      res.status(401).send("Unauthorized");
      return;
    }

    let currentAccount: { uuid: string; isSuperAdmin: boolean } | null = null;
    if (accountId) {
      const [account] = await db
        .select({ uuid: accounts.uuid, isSuperAdmin: accounts.isSuperAdmin })
        .from(accounts)
        .where(eq(accounts.uuid, accountId))
        .limit(1);

      currentAccount = account
        ? {
          uuid: account.uuid,
          isSuperAdmin: Boolean(account.isSuperAdmin)
        }
        : null;
    }

    // Super admins have unrestricted access to all authenticated routes
    if (currentAccount?.isSuperAdmin && requiresAuth) {
      logger.debug({ routeKey, accountId }, "isAuthorized: Super admin granted access to all authenticated routes");
      return next();
    }

    // Super admin only has access to routes that have super admin permissions enabled.
    if (resourcePermissions?.super && accountId) {
      const account = currentAccount;

      if (!account) {
        throw new Error("DB User not found");
      }

      const { isSuperAdmin } = account;

      if (!isSuperAdmin) {
        logger.error({ routeKey, accountId, workspaceId }, "isAuthorized: Not a super admin");

        throw new Error(`Forbidden: account id: ${accountId} is not a super admin`);
      }

      logger.debug({ routeKey, workspaceId, isSuperAdmin }, `isAuthorized: Super admin for account id: ${accountId}`);

      // For super routes without a permission code, super-admin check is sufficient.
      // For super routes with a permission code configured, continue to DB permission checks below.
      if (!requiredPermissionCode) {
        return next();
      }

      if (!workspaceId) {
        const hasGlobalPermission = await hasGlobalAdminPermission(requiredPermissionCode);
        if (hasGlobalPermission) {
          return next();
        }

        res.status(403).json({
          success: false,
          message: "Super admin role missing required permission"
        });
        return;
      }
    }

    // Super admins can access workspace-scoped and regular routes if their global admin role includes the permission.
    if (currentAccount?.isSuperAdmin && requiredPermissionCode) {
      const hasGlobalPermission = await hasGlobalAdminPermission(requiredPermissionCode);
      if (hasGlobalPermission) {
        logger.debug(
          { routeKey, requiredPermissionCode, workspaceId },
          "isAuthorized: super admin granted by global role permission"
        );
        return next();
      }
    }

    if (resourcePermissions?.workspaceScoped) {
      // Super admin can access any workspace, so prefer workspace id from route param when available.
      let effectiveWorkspaceId = workspaceId;

      if (workspaceIdRouteParams.has(routeKey)) {
        const routeWorkspaceId = req.params?.id;

        if (currentAccount?.isSuperAdmin) {
          if (routeWorkspaceId) {
            effectiveWorkspaceId = routeWorkspaceId;
          }
        } else if (!routeWorkspaceId || routeWorkspaceId !== workspaceId) {
          throw new Error("Forbidden: x-workspace-id must match workspace id in URL path");
        }
      }

      if (!effectiveWorkspaceId) {
        throw new Error("Forbidden: x-workspace-id header is required for workspace-scoped routes");
      }

      if (!z.uuid().safeParse(effectiveWorkspaceId).success) {
        throw new Error("Forbidden: x-workspace-id header must be a valid UUID");
      }

      req.workspaceId = effectiveWorkspaceId;
    }

    if(resourcePermissions?.admin && accountId && req.workspaceId) {

      const [memberShip] = await db
        .select()
        .from(workspaceMemberships)
        .where(
          and(
            eq(workspaceMemberships.accountId, accountId),
            eq(workspaceMemberships.workspaceId, req.workspaceId!),
            eq(workspaceMemberships.isAdmin, true)
          )
        )
        .limit(1);
      
      if(!memberShip) {
        throw new Error(`Forbidden: account id: ${accountId} is not a admin`);
      }
    }

    if (!requiredPermissionCode) {
      logger.debug({ routeKey, workspaceId }, "isAuthorized: No permissions required");

      return next();
    }

    // An owner has access to all resources they own regardless of the workspace.
    if (requiredPermissionCode === PERMISSION_CODES.OwnerOnly && accountId) {
      // Check if the user is the owner of the resource
      const resourceId = req.params?.id || "";
      const resourceType = determineResourceType(routeKey);

      // Some resources require a db call to check if the user is the owner.
      const isUserOwner = await isOwner(accountId, resourceId, resourceType);

      logger.debug({ routeKey, accountId, workspaceId, isUserOwner }, "isAuthorized: Owner");

      if (isUserOwner) {
        return next();
      }

      logger.error({ accountId, resourceId, routeKey, workspaceId }, "isAuthorized: Not the owner of the resource");

      throw new Error(`Forbidden: Not the owner of the resource with id: ${req.params?.id}`);
    }

    // Ensure the user is a member of the workspace and has the required permission code via role_permissions.
    if (workspaceId && accountId) {
      if (currentAccount?.isSuperAdmin) {
        logger.debug(
          { routeKey, accountId, workspaceId, requiredPermissionCode },
          "isAuthorized: super admin bypasses workspace membership check"
        );
        return next();
      }

      const [isMember, role] = await checkMembership(accountId, workspaceId);

      logger.debug({ isMember, role }, "isAuthorized: checkMembership");

      if (!isMember) {
        throw new Error(`Forbidden: Not a member of the workspace with id: ${workspaceId}`);
      }

      const hasPermission = await hasWorkspacePermission(accountId, workspaceId, requiredPermissionCode);

      logger.debug({ routeKey, role, requiredPermissionCode, hasPermission }, "isAuthorized: DB permission check");

      if (hasPermission) {
        return next();
      }

      throw new Error(
        `Forbidden: Missing permission '${requiredPermissionCode}' for account id '${accountId}' in workspace '${workspaceId}'`
      );
    }

    const response = apiResponse.error(HttpErrors.Forbidden());
    res.status(response.code).json(response);
    return;
  } catch (err) {
    const response = apiResponse.error(err as Error, HttpStatusCode.FORBIDDEN);

    res.status(response.code).json(response);
    return;
  }
};

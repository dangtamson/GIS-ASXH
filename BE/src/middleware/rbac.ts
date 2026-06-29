import { verifyToken } from "@/handlers/auth/auth.methods.ts";
import { HttpStatusCode } from "@/helpers/Http.ts";
import { apiResponse } from "@/helpers/response.ts";
import { accounts, workspaceMemberships } from "@/schema.ts";
import { checkPermission, type AuthUser } from "@/services/rbac.service.ts";
import { db } from "@/services/db/drizzle.ts";
import { and, eq } from "drizzle-orm";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { z } from "zod";

const uuidSchema = z.uuid();

function resolveWorkspaceId(req: Request): string | null {
  const routeWorkspaceId = req.params.workspaceId || req.params.id;
  const headerWorkspaceId = req.headers["x-workspace-id"];
  const normalizedHeader = Array.isArray(headerWorkspaceId) ? headerWorkspaceId[0] : headerWorkspaceId;

  const raw = routeWorkspaceId || normalizedHeader;
  if (!raw || !raw.trim()) {
    return null;
  }

  return raw.trim();
}

export const authenticate: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      const response = apiResponse.error(new Error("Missing Bearer token"), HttpStatusCode.UNAUTHORIZED);
      res.status(response.code).json(response);
      return;
    }

    const verified = await verifyToken(token);
    if (!verified?.sub) {
      const response = apiResponse.error(new Error("Invalid token"), HttpStatusCode.UNAUTHORIZED);
      res.status(response.code).json(response);
      return;
    }

    const [account] = await db
      .select({
        id: accounts.uuid,
        isSuperAdmin: accounts.isSuperAdmin
      })
      .from(accounts)
      .where(eq(accounts.uuid, verified.sub))
      .limit(1);

    if (!account) {
      const response = apiResponse.error(new Error("Account not found"), HttpStatusCode.UNAUTHORIZED);
      res.status(response.code).json(response);
      return;
    }

    const user: AuthUser = {
      id: account.id,
      isSuperAdmin: Boolean(account.isSuperAdmin)
    };

    req.user = user;
    req.accountId = user.id;

    const workspaceId = resolveWorkspaceId(req);
    if (workspaceId) {
      req.workspaceId = workspaceId;
    }

    next();
  } catch (error) {
    const response = apiResponse.error(error as Error, HttpStatusCode.UNAUTHORIZED);
    res.status(response.code).json(response);
  }
};

export const requireWorkspace: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      const response = apiResponse.error(new Error("Unauthenticated"), HttpStatusCode.UNAUTHORIZED);
      res.status(response.code).json(response);
      return;
    }

    const workspaceId = resolveWorkspaceId(req);
    if (!workspaceId) {
      const response = apiResponse.error(new Error("workspaceId is required"), HttpStatusCode.BAD_REQUEST);
      res.status(response.code).json(response);
      return;
    }

    if (!uuidSchema.safeParse(workspaceId).success) {
      const response = apiResponse.error(new Error("workspaceId must be UUID"), HttpStatusCode.BAD_REQUEST);
      res.status(response.code).json(response);
      return;
    }

    req.workspaceId = workspaceId;

    if (req.user.isSuperAdmin) {
      next();
      return;
    }

    const [membership] = await db
      .select({ uuid: workspaceMemberships.uuid })
      .from(workspaceMemberships)
      .where(
        and(
          eq(workspaceMemberships.accountId, req.user.id),
          eq(workspaceMemberships.workspaceId, workspaceId),
          eq(workspaceMemberships.status, true)
        )
      )
      .limit(1);

    if (!membership) {
      const response = apiResponse.error(new Error("Forbidden: not a workspace member"), HttpStatusCode.FORBIDDEN);
      res.status(response.code).json(response);
      return;
    }

    next();
  } catch (error) {
    const response = apiResponse.error(error as Error, HttpStatusCode.FORBIDDEN);
    res.status(response.code).json(response);
  }
};

export function requirePermission(permission: string): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        const response = apiResponse.error(new Error("Unauthenticated"), HttpStatusCode.UNAUTHORIZED);
        res.status(response.code).json(response);
        return;
      }

      if (req.user.isSuperAdmin) {
        next();
        return;
      }

      const workspaceId = req.workspaceId || resolveWorkspaceId(req);
      if (!workspaceId) {
        const response = apiResponse.error(new Error("workspaceId is required"), HttpStatusCode.BAD_REQUEST);
        res.status(response.code).json(response);
        return;
      }

      const granted = await checkPermission(req.user, workspaceId, permission);
      if (!granted) {
        const response = apiResponse.error(
          new Error(`Forbidden: missing permission '${permission}'`),
          HttpStatusCode.FORBIDDEN
        );
        res.status(response.code).json(response);
        return;
      }

      next();
    } catch (error) {
      const response = apiResponse.error(error as Error, HttpStatusCode.FORBIDDEN);
      res.status(response.code).json(response);
    }
  };
}


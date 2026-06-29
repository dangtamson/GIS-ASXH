import "express";
import type { AuthUser } from "@/services/rbac.service.ts";

declare module "express" {
  interface Request {
    accountId?: string;
    workspaceId?: string;
    user?: AuthUser;
  }
}

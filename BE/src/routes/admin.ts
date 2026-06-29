import {
  createAdminWorkspace,
  createAccountForUser,
  deleteAdminWorkspace,
  listAllAccounts,
  listAllMemberships,
  listAllWorkspaces,
  updateAdminWorkspace,
  updateAccountForUser,
  updateAccountRole,
  updateAccountStatus
} from "@/handlers/admin/admin.handlers.ts";
import { getAuditLogs, getAuditLogStats } from "@/handlers/admin/auditLogs.handlers.ts";
import { getAvailableFeatures, getRoleFeatures, updateRoleFeatures } from "@/handlers/admin/roleFeatures.handlers.ts";
import { checkAccountStatus } from "@/middleware/checkAccountStatus.ts";
import { isAuthenticated } from "@/middleware/isAuthenticated.ts";
import { isAuthorized } from "@/middleware/isAuthorized.ts";
import { adminRateLimit } from "@/middleware/rateLimiter.ts";
import type { Application, RequestHandler } from "express";
import { registerContentAdminRoutes } from "./admin/content.ts";
import { registerMasterDataAdminRoutes } from "./admin/masterData.ts";
import { registerSystemAdminRoutes } from "./admin/system.ts";
import { registerWorkflowAdminRoutes } from "./admin/workflow.ts";
import { setupNotificationAdminRoutes } from "./admin/notifications.ts";
import { registerPovertyAdminRoutes } from "./admin/poverty.ts";
import { registerImportAdminRoutes } from "./admin/imports.ts";

const adminGuards: readonly RequestHandler[] = [adminRateLimit, isAuthenticated, checkAccountStatus, isAuthorized];

export function adminRoutes(app: Application): void {
  // All admin routes require authentication, account status check, and SuperAdmin role
  // Apply stricter rate limiting for admin operations

  // Account management
  app.get("/admin/accounts", ...adminGuards, listAllAccounts);
  app.post("/admin/accounts", ...adminGuards, createAccountForUser);
  app.patch("/admin/accounts/:id", ...adminGuards, updateAccountForUser);
  app.put("/admin/accounts/:id/role", ...adminGuards, updateAccountRole);
  app.put("/admin/accounts/:id/status", ...adminGuards, updateAccountStatus);

  // Workspace management
  app.get("/admin/workspaces", ...adminGuards, listAllWorkspaces);
  app.post("/admin/workspaces", ...adminGuards, createAdminWorkspace);
  app.patch("/admin/workspaces/:id", ...adminGuards, updateAdminWorkspace);
  app.delete("/admin/workspaces/:id", ...adminGuards, deleteAdminWorkspace);

  // Membership management
  app.get("/admin/memberships", ...adminGuards, listAllMemberships);

  // Role features management
  app.get("/admin/roles/:roleId/features", ...adminGuards, getRoleFeatures);
  app.put("/admin/roles/:roleId/features", ...adminGuards, updateRoleFeatures);
  app.get("/admin/features/available", ...adminGuards, getAvailableFeatures);

  registerMasterDataAdminRoutes(app, adminGuards);
  registerSystemAdminRoutes(app, adminGuards);
  registerContentAdminRoutes(app, adminGuards);
  registerWorkflowAdminRoutes(app, adminGuards);
  setupNotificationAdminRoutes(app, adminGuards);
  registerImportAdminRoutes(app, adminGuards);
  registerPovertyAdminRoutes(app, adminGuards);

  // Audit log management
  app.get("/admin/audit-logs", ...adminGuards, getAuditLogs);
  app.get("/admin/audit-logs/stats", ...adminGuards, getAuditLogStats);
}

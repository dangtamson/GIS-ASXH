import { createAccount, getAccount, getAccounts, updateAccount } from "@/handlers/accounts/accounts.handlers.ts";
import {
  createFeature,
  deleteFeature,
  getFeature,
  listFeatures,
  listFeaturesByGroup,
  reorderFeatures,
  toggleFeature,
  updateFeature
} from "@/handlers/admin/features.handlers.ts";
import { changePassword, getSsoEnabledStatus, getSsoLoginUrl, signInWithPassword, signInWithSsoCode, signUp } from "@/handlers/auth/auth.handlers.js";
import { getCurrentUser } from "@/handlers/me/me.handlers.ts";
import {
  addWorkspaceMember,
  getWorkspaceAccessReport,
  getEffectivePermissionsByWorkspace,
  getWorkspaceMembers,
  removeMember,
  updateMemberRole
} from "@/handlers/memberships/memberships.handlers.ts";
import {
  createWorkspace,
  deleteWorkspace,
  fetchWorkspace,
  fetchWorkspacesByAccountId,
  updateWorkspace,
  updateWorkspaceProfile
} from "@/handlers/workspaces/workspaces.handlers.ts";
import {
  getPublicPovertyAreaBySlugAndAreaSlug,
  getPublicPovertyHouseholdBySlugAndHouseholdId,
  getPublicPovertyWardBySlug
} from "@/handlers/admin/resources/poverty/index.ts";
import { permissions, test } from "@/helpers/index.ts";
import { checkAccountStatus } from "@/middleware/checkAccountStatus.ts";
import { isAuthenticated } from "@/middleware/isAuthenticated.ts";
import { isAuthorized } from "@/middleware/isAuthorized.ts";
import { authRateLimit } from "@/middleware/rateLimiter.ts";
import type { Application } from "express";

const { API_ROUTES } = permissions;

export function routes(app: Application): void {
  app.get(API_ROUTES.root, isAuthenticated, checkAccountStatus, isAuthorized, (_req, res) => {
    res.send(`Routes are active! route: ${API_ROUTES.root} with test ${test}`);
  });

  // Authentication routes with stricter rate limiting (no account status check - users need to login to get status updated)
  app.post(API_ROUTES.login, authRateLimit, isAuthenticated, isAuthorized, signInWithPassword);
  app.post(API_ROUTES.signUp, authRateLimit, isAuthenticated, isAuthorized, signUp);
  app.get(API_ROUTES.ssoEnabled, authRateLimit, isAuthenticated, isAuthorized, getSsoEnabledStatus);
  app.get(API_ROUTES.ssoLoginUrl, authRateLimit, isAuthenticated, isAuthorized, getSsoLoginUrl);
  app.post(API_ROUTES.ssoExchange, authRateLimit, isAuthenticated, isAuthorized, signInWithSsoCode);
  app.post(API_ROUTES.changePassword, authRateLimit, isAuthenticated, isAuthorized, changePassword);
  app.get(API_ROUTES.publicPovertyWardBySlug, isAuthenticated, isAuthorized, getPublicPovertyWardBySlug);
  app.get(API_ROUTES.publicPovertyAreaBySlug, isAuthenticated, isAuthorized, getPublicPovertyAreaBySlugAndAreaSlug);
  app.get(API_ROUTES.publicPovertyHouseholdBySlug, isAuthenticated, isAuthorized, getPublicPovertyHouseholdBySlugAndHouseholdId);

  // User profile route - critical to check status here
  app.get(API_ROUTES.me, isAuthenticated, checkAccountStatus, isAuthorized, getCurrentUser);

  // Account management routes
  app.get(API_ROUTES.accounts, isAuthenticated, checkAccountStatus, isAuthorized, getAccounts);
  app.post(API_ROUTES.accounts, isAuthenticated, checkAccountStatus, isAuthorized, createAccount);

  app.get(API_ROUTES.accountById, isAuthenticated, checkAccountStatus, isAuthorized, getAccount);
  app.patch(API_ROUTES.accountById, isAuthenticated, checkAccountStatus, isAuthorized, updateAccount);

  // Profile endpoints removed - access profiles through workspace context (/me, /workspaces/:id, /workspaces/:id/members)

  // Workspace management routes - all require active account status
  app.get(API_ROUTES.workspaces, isAuthenticated, checkAccountStatus, isAuthorized, fetchWorkspacesByAccountId);
  app.post(API_ROUTES.workspaces, isAuthenticated, checkAccountStatus, isAuthorized, createWorkspace);

  app.get(API_ROUTES.workspaceById, isAuthenticated, checkAccountStatus, isAuthorized, fetchWorkspace);
  app.patch(API_ROUTES.workspaceById, isAuthenticated, checkAccountStatus, isAuthorized, updateWorkspace);
  app.patch(API_ROUTES.workspaceProfile, isAuthenticated, checkAccountStatus, isAuthorized, updateWorkspaceProfile);
  app.delete(API_ROUTES.workspaceById, isAuthenticated, checkAccountStatus, isAuthorized, deleteWorkspace);

  // Member management routes - all require active account status
  app.get(API_ROUTES.workspaceMembers, isAuthenticated, checkAccountStatus, isAuthorized, getWorkspaceMembers);
  app.get(
    API_ROUTES.workspaceEffectivePermissions,
    isAuthenticated,
    checkAccountStatus,
    isAuthorized,
    getEffectivePermissionsByWorkspace
  );
  app.get(API_ROUTES.workspaceAccessReport, isAuthenticated, checkAccountStatus, isAuthorized, getWorkspaceAccessReport);
  app.post(API_ROUTES.workspaceMembers, isAuthenticated, checkAccountStatus, isAuthorized, addWorkspaceMember);
  app.put(API_ROUTES.workspaceMemberRole, isAuthenticated, checkAccountStatus, isAuthorized, updateMemberRole);
  app.delete(API_ROUTES.workspaceMemberRemove, isAuthenticated, checkAccountStatus, isAuthorized, removeMember);

  // Feature management routes - admin only, super admin required
  app.get(API_ROUTES.adminFeatures, isAuthenticated, checkAccountStatus, isAuthorized, listFeatures);
  app.post(API_ROUTES.adminFeatures, isAuthenticated, checkAccountStatus, isAuthorized, createFeature);
  app.get(API_ROUTES.adminFeaturesByGroup, isAuthenticated, checkAccountStatus, isAuthorized, listFeaturesByGroup);
  app.get(API_ROUTES.adminFeaturesById, isAuthenticated, checkAccountStatus, isAuthorized, getFeature);
  app.put(API_ROUTES.adminFeaturesById, isAuthenticated, checkAccountStatus, isAuthorized, updateFeature);
  app.patch(API_ROUTES.adminFeaturesToggle, isAuthenticated, checkAccountStatus, isAuthorized, toggleFeature);
  app.post(API_ROUTES.adminFeaturesReorder, isAuthenticated, checkAccountStatus, isAuthorized, reorderFeatures);
  app.delete(API_ROUTES.adminFeaturesById, isAuthenticated, checkAccountStatus, isAuthorized, deleteFeature);
}

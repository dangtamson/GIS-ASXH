import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { accountEmailInputSchema } from "@/helpers/accountEmail.ts";
import { apiResponse } from "@/helpers/response.ts";
import { mapSupabaseCreateUserError } from "@/helpers/supabaseAuth.ts";
import { validateRequiredUuid } from "@/helpers/validation.ts";
import { resolveRoleByInput } from "@/handlers/memberships/memberships.methods.ts";
import {
  accounts,
  auditLogs,
  categories,
  categoryItems,
  documents,
  features,
  notifications,
  organizations,
  permissions,
  profiles,
  rolePermissions,
  roles,
  systemConfigs,
  taskAssignments,
  taskComments,
  taskProgress,
  tasks,
  workspaceFeatures,
  workspaceMemberships,
  workspaces
} from "@/schema.ts";
import { AUDIT_ACTIONS, ENTITY_TYPES, auditHelpers, createAuditLog } from "@/services/auditLog.ts";
import { db } from "@/services/db/drizzle.ts";
import { getSecurityPolicy } from "@/services/securityPolicy.ts";
import type { SQL } from "drizzle-orm";
import { getSupabaseAdmin } from "@/services/supabase.ts";
import { and, desc, eq, inArray, ilike, or, sql } from "drizzle-orm";
import type { Request, Response } from "express";
import { z } from "zod";

const accountStatusSchema = z.enum(["active", "inactive", "suspended"]);

const createAdminAccountRequestSchema = z.object({
  email: accountEmailInputSchema,
  fullName: z.string().trim().min(1),
  phone: z.string().trim().optional(),
  password: z.string().min(6),
  passwordChangeRequired: z.boolean().optional(),
  isSuperAdmin: z.boolean().optional(),
  isAdmin: z.boolean().optional(),
  workspaceId: z.uuid().optional(),
  organizationId: z.uuid().optional(),
  role: z.union([z.number().int().positive(), z.string().trim().min(1)]).optional()
});

const updateAdminAccountRequestSchema = z
  .object({
    email: accountEmailInputSchema.optional(),
    fullName: z.string().trim().min(1).optional(),
    phone: z.string().trim().optional(),
    password: z.string().min(6).optional(),
    status: accountStatusSchema.optional(),
    isAdmin: z.boolean().optional(),
    workspaceId: z.uuid().optional(),
    organizationId: z.uuid().nullable().optional(),
    role: z.union([z.number().int().positive(), z.string().trim().min(1)]).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required"
  });

const adminWorkspaceCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(1000).optional()
});

type ActorContext = {
  accountId: string;
  isSuperAdmin: boolean;
};

function validatePasswordAgainstPolicy(
  password: string,
  policy: {
    minPasswordLength?: number;
    maxPasswordLength?: number;
    requireLowercase?: boolean;
    requireUppercase?: boolean;
    requireNumber?: boolean;
    requireSpecialChar?: boolean;
    forceChangePasswordOnFirstLogin?: boolean;
  }
): string[] {
  const errors: string[] = [];

  const minLength = policy.minPasswordLength;
  const maxLength = policy.maxPasswordLength;

  if (typeof minLength === "number" && password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }

  if (typeof maxLength === "number" && password.length > maxLength) {
    errors.push(`Password must be at most ${maxLength} characters long`);
  }

  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (policy.requireNumber && !/\d/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  if (policy.requireSpecialChar && !/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  return errors;
}

async function getActorContext(accountId: string): Promise<ActorContext> {
  const [actor] = await db
    .select({ uuid: accounts.uuid, isSuperAdmin: accounts.isSuperAdmin })
    .from(accounts)
    .where(eq(accounts.uuid, accountId))
    .limit(1);

  if (!actor) {
    throw HttpErrors.Unauthorized();
  }

  return {
    accountId: actor.uuid,
    isSuperAdmin: Boolean(actor.isSuperAdmin)
  };
}

async function resolveActorWorkspaceId(accountId: string, requestedWorkspaceId?: string): Promise<string | null> {
  if (requestedWorkspaceId?.trim()) {
    return requestedWorkspaceId.trim();
  }

  const [membership] = await db
    .select({ workspaceId: workspaceMemberships.workspaceId })
    .from(workspaceMemberships)
    .where(eq(workspaceMemberships.accountId, accountId))
    .limit(1);

  return membership?.workspaceId ?? null;
}

async function resolveWorkspaceForAccountMutation(params: {
  actor: ActorContext;
  requestedWorkspaceId?: string;
  workspaceHeaderId?: string;
}): Promise<string | null> {
  const workspaceFromHeader = params.workspaceHeaderId?.trim();
  const requestedWorkspaceId = params.requestedWorkspaceId?.trim();

  if (params.actor.isSuperAdmin) {
    return requestedWorkspaceId || workspaceFromHeader || null;
  }

  return resolveActorWorkspaceId(params.actor.accountId, workspaceFromHeader);
}

async function resolveDefaultRoleId(): Promise<number | null> {
  const [defaultRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.code, "user"))
    .limit(1);

  if (defaultRole?.id) {
    return defaultRole.id;
  }

  const [fallbackRole] = await db.select({ id: roles.id }).from(roles).limit(1);
  return fallbackRole?.id ?? null;
}

async function validateWorkspaceAndOrganization(workspaceId: string, organizationId?: string): Promise<void> {
  const [workspace] = await db.select({ uuid: workspaces.uuid }).from(workspaces).where(eq(workspaces.uuid, workspaceId)).limit(1);
  if (!workspace) {
    throw HttpErrors.NotFound("Workspace");
  }

  if (!organizationId) {
    return;
  }

  const [organization] = await db
    .select({ uuid: organizations.uuid })
    .from(organizations)
    .where(and(eq(organizations.uuid, organizationId), eq(organizations.workspaceId, workspaceId)))
    .limit(1);

  if (!organization) {
    throw HttpErrors.BadRequest("Organization does not belong to selected workspace");
  }
}

const adminWorkspaceUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(1000).optional()
  })
  .refine((value) => value.name !== undefined || value.description !== undefined, {
    message: "At least one field (name or description) is required"
  });

const workspaceDeletePolicySchema = z.enum(["restrict", "cascade"]).default("restrict");

type WorkspaceDependencySummary = {
  organizations: number;
  categories: number;
  categoryItems: number;
  documents: number;
  tasks: number;
  notifications: number;
  taskAssignments: number;
  taskProgress: number;
  taskComments: number;
  auditLogs: number;
};

async function getWorkspaceDependencySummary(workspaceId: string): Promise<WorkspaceDependencySummary> {
  const [organizationsCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(organizations)
    .where(eq(organizations.workspaceId, workspaceId));

  const [categoriesCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(categories)
    .where(eq(categories.workspaceId, workspaceId));

  const [categoryItemsCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(categoryItems)
    .innerJoin(categories, eq(categoryItems.categoryId, categories.uuid))
    .where(eq(categories.workspaceId, workspaceId));

  const [documentsCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(documents)
    .where(eq(documents.workspaceId, workspaceId));

  const [tasksCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tasks)
    .where(eq(tasks.workspaceId, workspaceId));

  const [notificationsCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(eq(notifications.workspaceId, workspaceId));

  const [taskAssignmentsCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(taskAssignments)
    .innerJoin(tasks, eq(taskAssignments.taskId, tasks.uuid))
    .where(eq(tasks.workspaceId, workspaceId));

  const [taskProgressCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(taskProgress)
    .innerJoin(tasks, eq(taskProgress.taskId, tasks.uuid))
    .where(eq(tasks.workspaceId, workspaceId));

  const [taskCommentsCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(taskComments)
    .innerJoin(tasks, eq(taskComments.taskId, tasks.uuid))
    .where(eq(tasks.workspaceId, workspaceId));

  const [auditLogsCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(eq(auditLogs.workspaceId, workspaceId));

  return {
    organizations: organizationsCount?.count || 0,
    categories: categoriesCount?.count || 0,
    categoryItems: categoryItemsCount?.count || 0,
    documents: documentsCount?.count || 0,
    tasks: tasksCount?.count || 0,
    notifications: notificationsCount?.count || 0,
    taskAssignments: taskAssignmentsCount?.count || 0,
    taskProgress: taskProgressCount?.count || 0,
    taskComments: taskCommentsCount?.count || 0,
    auditLogs: auditLogsCount?.count || 0
  };
}

/**
 * GET /admin/accounts
 * List all accounts with pagination (SuperAdmin only)
 */
export const listAllAccounts = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const search = (req.query.search as string) || undefined;
  const status = (req.query.status as string) || undefined;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;
  const actorAccountId = req.accountId;

  if (!actorAccountId) {
    const response = apiResponse.error(HttpErrors.Unauthorized());
    res.status(response.code).send(response);
    return;
  }

  const actor = await getActorContext(actorAccountId);

  const scopedWorkspaceId = actor.isSuperAdmin
    ? req.workspaceId?.trim() || null
    : await resolveActorWorkspaceId(actor.accountId, req.workspaceId);

  if (!scopedWorkspaceId) {
    const response = apiResponse.error(HttpErrors.Forbidden("Workspace context is required"));
    res.status(response.code).send(response);
    return;
  }

  if (!actor.isSuperAdmin) {
    const [actorMembership] = await db
      .select({
        isAdmin: workspaceMemberships.isAdmin
      })
      .from(workspaceMemberships)
      .where(
        and(
          eq(workspaceMemberships.accountId, actor.accountId),
          eq(workspaceMemberships.workspaceId, scopedWorkspaceId),
          eq(workspaceMemberships.status, true)
        )
      )
      .limit(1);

    if (!actorMembership?.isAdmin) {
      const response = apiResponse.error(
        HttpErrors.Forbidden("Only super admin or workspace admin can view account list")
      );
      res.status(response.code).send(response);
      return;
    }
  }

  const accountConditions: SQL[] = [];

  if (search) {
    accountConditions.push(or(ilike(accounts.email, `%${search}%`), ilike(accounts.fullName, `%${search}%`))!);
  }

  if (status) {
    accountConditions.push(eq(accounts.status, status as typeof accounts.$inferSelect.status));
  }

  const accountSelection = {
    uuid: accounts.uuid,
    fullName: accounts.fullName,
    email: accounts.email,
    phone: accounts.phone,
    isSuperAdmin: accounts.isSuperAdmin,
    status: accounts.status,
    createdAt: accounts.createdAt,
    totalCount: sql<number>`count(*) over()`
  };

  const rows = await db
    .select(accountSelection)
    .from(workspaceMemberships)
    .innerJoin(accounts, eq(workspaceMemberships.accountId, accounts.uuid))
    .where(
      and(
        eq(workspaceMemberships.workspaceId, scopedWorkspaceId),
        eq(workspaceMemberships.status, true),
        ...(accountConditions.length ? accountConditions : [])
      )
    )
    .orderBy(desc(accounts.createdAt))
    .limit(limit)
    .offset(offset);

  const total = rows[0]?.totalCount || 0;
  const accountRows = rows.map(({ totalCount: _totalCount, ...rest }) => rest);
  const accountIds = accountRows.map((a) => a.uuid);
  const membershipMap = new Map<
    string,
    {
      workspaceId: string | null;
      organizationId: string | null;
      isAdmin: boolean | null;
      workspaceName: string | null;
      organizationName: string | null;
    }
  >();

  if (accountIds.length) {
    const membershipConditions: SQL[] = [
      inArray(workspaceMemberships.accountId, accountIds),
      eq(workspaceMemberships.status, true)
    ];

    if (scopedWorkspaceId) {
      membershipConditions.push(eq(workspaceMemberships.workspaceId, scopedWorkspaceId));
    }

    const memberships = await db
      .select({
        accountId: workspaceMemberships.accountId,
        workspaceId: workspaceMemberships.workspaceId,
        organizationId: workspaceMemberships.organizationId,
        isAdmin: workspaceMemberships.isAdmin,
        workspaceName: workspaces.name,
        organizationName: organizations.name,
        joinedAt: workspaceMemberships.joinedAt
      })
      .from(workspaceMemberships)
      .leftJoin(workspaces, eq(workspaceMemberships.workspaceId, workspaces.uuid))
      .leftJoin(organizations, eq(workspaceMemberships.organizationId, organizations.uuid))
      .where(and(...membershipConditions))
      .orderBy(desc(workspaceMemberships.joinedAt));

    for (const m of memberships) {
      if (!membershipMap.has(m.accountId)) {
        membershipMap.set(m.accountId, m);
      }
    }
  }

  const accountsList = accountRows.map((acc) => {
    const m = membershipMap.get(acc.uuid);
    return {
      ...acc,
      workspaceId: m?.workspaceId ?? null,
      organizationId: m?.organizationId ?? null,
      isAdmin: m?.isAdmin ?? false,
      workspaceName: m?.workspaceName ?? null,
      organizationName: m?.organizationName ?? null
    };
  });

  res.status(200).send(
    apiResponse.success(
      HttpStatusCode.OK,
      {
        accounts: accountsList,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      },
      "Accounts retrieved successfully"
    )
  );
});

/**
 * POST /admin/accounts
 * Create account for any user (SuperAdmin only)
 */
export const createAccountForUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = createAdminAccountRequestSchema.safeParse(req.body);
  const headerWorkspaceId = req.workspaceId?.trim();
  if (!headerWorkspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const {
    email,
    fullName,
    phone,
    password,
    passwordChangeRequired,
    isSuperAdmin,
    isAdmin,
    workspaceId: requestedWorkspaceId,
    organizationId,
    role
  } = parsed.data;
  const { accountId } = req;

  if (!accountId) {
    const response = apiResponse.error(HttpErrors.Unauthorized());
    res.status(response.code).send(response);
    return;
  }

  const actor = await getActorContext(accountId);
  const resolvedWorkspaceId = await resolveWorkspaceForAccountMutation({
    actor,
    requestedWorkspaceId,
    workspaceHeaderId: req.workspaceId
  });

  if (!resolvedWorkspaceId) {
    const response = apiResponse.error(
      HttpErrors.ValidationFailed("Workspace context is required to create user membership")
    );
    res.status(response.code).send(response);
    return;
  }

  await validateWorkspaceAndOrganization(resolvedWorkspaceId, organizationId);

  const passwordPolicy = await getSecurityPolicy(resolvedWorkspaceId);
  const passwordValidationErrors = validatePasswordAgainstPolicy(password, passwordPolicy);

  if (passwordValidationErrors.length > 0) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(passwordValidationErrors.join(". ")));
    res.status(response.code).send(response);
    return;
  }

  const shouldRequirePasswordChange =
    passwordChangeRequired ?? Boolean(passwordPolicy.forceChangePasswordOnFirstLogin);

  // Check if account already exists
  const [existingAccount] = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);

  if (existingAccount) {
    const response = apiResponse.error(HttpErrors.BadRequest("Unable to create account with provided information"));
    res.status(response.code).send(response);
    return;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: supabaseAuthData, error: supabaseAuthError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      fullName,
      phone
    }
  });

  if (supabaseAuthError || !supabaseAuthData?.user?.id) {
    const response = apiResponse.error(mapSupabaseCreateUserError(supabaseAuthError));
    res.status(response.code).send(response);
    return;
  }

  const supabaseAuthUserId = supabaseAuthData.user.id;

  // Create account, membership and audit log in transaction.
  let newAccount;
  try {
    newAccount = await db.transaction(async (tx) => {
      const [account] = await tx
        .insert(accounts)
        .values({
          uuid: supabaseAuthUserId,
          email,
          fullName,
          phone,
          passwordChangeRequired: shouldRequirePasswordChange,
          isSuperAdmin: actor.isSuperAdmin ? isSuperAdmin || false : false
        })
        .returning();

      if (!account) {
        throw new Error("Failed to create account");
      }

      const resolvedRoleId = role ? (await resolveRoleByInput(role, tx)).id : await resolveDefaultRoleId();
      if (!resolvedRoleId) {
        throw new Error("Role not found for membership assignment");
      }

      await tx
        .insert(workspaceMemberships)
        .values({
          accountId: account.uuid,
          workspaceId: resolvedWorkspaceId,
          organizationId,
          roleId: resolvedRoleId,
          isAdmin: actor.isSuperAdmin ? Boolean(isAdmin) : false
        })
        .onConflictDoUpdate({
          target: [workspaceMemberships.workspaceId, workspaceMemberships.accountId],
          set: {
            organizationId,
            roleId: resolvedRoleId,
            isAdmin: actor.isSuperAdmin ? Boolean(isAdmin) : false,
            status: true
          }
        });

      // Audit log the account creation
      await createAuditLog(
        {
          action: AUDIT_ACTIONS.ACCOUNT_CREATED,
          entityType: ENTITY_TYPES.ACCOUNT,
          entityId: account.uuid,
          actorId: accountId,
          targetId: account.uuid,
          details: {
            email: account.email,
            fullName: account.fullName,
            isSuperAdmin: account.isSuperAdmin,
            passwordChangeRequired: shouldRequirePasswordChange,
            workspaceId: resolvedWorkspaceId,
            organizationId: organizationId || null,
            createdBy: "admin",
            syncedAuthProvider: "supabase"
          }
        },
        req,
        undefined,
        tx
      );

      return account;
    });
  } catch (dbErr) {
    // Best-effort compensation to avoid orphaned auth users when DB insert fails.
    await supabaseAdmin.auth.admin.deleteUser(supabaseAuthUserId);
    throw dbErr;
  }

  if (!newAccount) {
    const response = apiResponse.error(HttpErrors.DatabaseError("Failed to create account"));
    res.status(response.code).send(response);
    return;
  }

  const response = apiResponse.success(HttpStatusCode.CREATED, { account: newAccount }, "Account created successfully");

  res.status(response.code).send(response);
});

/**
 * PATCH /admin/accounts/:id
 * Update account profile and sync workspace membership assignment.
 */
export const updateAccountForUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const targetAccountIdResult = validateRequiredUuid(req.params.id, "Account ID");
  if (!targetAccountIdResult.success) {
    const response = apiResponse.error(targetAccountIdResult.error);
    res.status(response.code).send(response);
    return;
  }

  const targetAccountId = targetAccountIdResult.value;
  const parsed = updateAdminAccountRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const actorAccountId = req.accountId;
  if (!actorAccountId) {
    const response = apiResponse.error(HttpErrors.Unauthorized());
    res.status(response.code).send(response);
    return;
  }

  const actor = await getActorContext(actorAccountId);
  const { email, fullName, phone, password, status, isAdmin, workspaceId, organizationId, role } = parsed.data;

  const resolvedWorkspaceId = await resolveWorkspaceForAccountMutation({
    actor,
    requestedWorkspaceId: workspaceId,
    workspaceHeaderId: req.workspaceId
  });

  if (!resolvedWorkspaceId) {
    const response = apiResponse.error(
      HttpErrors.ValidationFailed("Workspace context is required to update user membership")
    );
    res.status(response.code).send(response);
    return;
  }

  await validateWorkspaceAndOrganization(resolvedWorkspaceId, organizationId ?? undefined);

  const [targetAccount] = await db
    .select({ uuid: accounts.uuid, email: accounts.email, fullName: accounts.fullName, phone: accounts.phone, status: accounts.status })
    .from(accounts)
    .where(eq(accounts.uuid, targetAccountId))
    .limit(1);

  if (!targetAccount) {
    const response = apiResponse.error(HttpErrors.NotFound("Account"));
    res.status(response.code).send(response);
    return;
  }

  if (email && email !== targetAccount.email) {
    const [existingByEmail] = await db.select({ uuid: accounts.uuid }).from(accounts).where(eq(accounts.email, email)).limit(1);
    if (existingByEmail && existingByEmail.uuid !== targetAccountId) {
      const response = apiResponse.error(HttpErrors.BadRequest("Email already in use"));
      res.status(response.code).send(response);
      return;
    }
  }

  const accountUpdatePayload: Partial<typeof accounts.$inferInsert> = {};
  if (email !== undefined) accountUpdatePayload.email = email;
  if (fullName !== undefined) accountUpdatePayload.fullName = fullName;
  if (phone !== undefined) accountUpdatePayload.phone = phone;
  if (status !== undefined) accountUpdatePayload.status = status;

  const supabaseAdmin = getSupabaseAdmin();
  const nextMetadata = {
    fullName: fullName ?? targetAccount.fullName ?? undefined,
    phone: phone ?? targetAccount.phone ?? undefined
  };

  if (email !== undefined || password !== undefined || fullName !== undefined || phone !== undefined) {
    const { error: supabaseUpdateError } = await supabaseAdmin.auth.admin.updateUserById(targetAccountId, {
      ...(email !== undefined ? { email } : {}),
      ...(password !== undefined ? { password } : {}),
      user_metadata: nextMetadata
    });

    if (supabaseUpdateError) {
      const response = apiResponse.error(HttpErrors.BadRequest(supabaseUpdateError.message || "Unable to update auth user"));
      res.status(response.code).send(response);
      return;
    }
  }

  const updatedAccount = await db.transaction(async (tx) => {
    const [account] = Object.keys(accountUpdatePayload).length
      ? await tx.update(accounts).set(accountUpdatePayload).where(eq(accounts.uuid, targetAccountId)).returning()
      : await tx.select().from(accounts).where(eq(accounts.uuid, targetAccountId)).limit(1);

    if (!account) {
      throw new Error("Account not found");
    }

    const resolvedRoleId = role ? (await resolveRoleByInput(role, tx)).id : await resolveDefaultRoleId();
    if (!resolvedRoleId) {
      throw new Error("Role not found for membership assignment");
    }

    await tx
      .insert(workspaceMemberships)
      .values({
        accountId: targetAccountId,
        workspaceId: resolvedWorkspaceId,
        organizationId: organizationId ?? null,
        roleId: resolvedRoleId,
        isAdmin: actor.isSuperAdmin ? Boolean(isAdmin) : false
      })
      .onConflictDoUpdate({
        target: [workspaceMemberships.workspaceId, workspaceMemberships.accountId],
        set: {
          organizationId: organizationId ?? null,
          roleId: resolvedRoleId,
          isAdmin: actor.isSuperAdmin ? Boolean(isAdmin) : false,
          status: true
        }
      });

    return account;
  });

  const response = apiResponse.success(HttpStatusCode.OK, { account: updatedAccount }, "Account updated successfully");
  res.status(response.code).send(response);
});

/**
 * PUT /admin/accounts/:id/role
 * Promote/demote admin status (SuperAdmin only)
 */
export const updateAccountRole = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const targetAccountId = req.params.id;
  const { accountId } = req;

  if (!targetAccountId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Account ID"));
    res.status(response.code).send(response);
    return;
  }

  if (!accountId) {
    const response = apiResponse.error(HttpErrors.Unauthorized());
    res.status(response.code).send(response);
    return;
  }

  const { isSuperAdmin } = req.body;

  if (typeof isSuperAdmin !== "boolean") {
    const response = apiResponse.error(HttpErrors.ValidationFailed("isSuperAdmin must be a boolean value"));
    res.status(response.code).send(response);
    return;
  }

  // Get current account to track the change (outside transaction)
  const [currentAccount] = await db
    .select({ isSuperAdmin: accounts.isSuperAdmin })
    .from(accounts)
    .where(eq(accounts.uuid, targetAccountId))
    .limit(1);

  if (!currentAccount) {
    const response = apiResponse.error(HttpErrors.NotFound("Account"));
    res.status(response.code).send(response);
    return;
  }

  // Update account and audit log in transaction
  const updatedAccount = await db.transaction(async (tx) => {
    const [account] = await tx
      .update(accounts)
      .set({ isSuperAdmin })
      .where(eq(accounts.uuid, targetAccountId))
      .returning();

    if (!account) {
      throw new Error("Account not found");
    }

    // Audit log the role change
    await auditHelpers.roleChanged(
      accountId,
      targetAccountId,
      currentAccount.isSuperAdmin || false,
      isSuperAdmin,
      req,
      tx
    );

    return account;
  });

  if (!updatedAccount) {
    const response = apiResponse.error(HttpErrors.NotFound("Account"));
    res.status(response.code).send(response);
    return;
  }

  const response = apiResponse.success(
    HttpStatusCode.OK,
    { account: updatedAccount },
    `Account role updated to SuperAdmin: ${isSuperAdmin}`
  );

  res.status(response.code).send(response);
});

/**
 * PUT /admin/accounts/:id/status
 * Update account status - activate/deactivate/suspend (SuperAdmin only)
 */
export const updateAccountStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const targetAccountId = req.params.id;
  const { accountId } = req;

  if (!targetAccountId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Account ID"));
    res.status(response.code).send(response);
    return;
  }

  if (!accountId) {
    const response = apiResponse.error(HttpErrors.Unauthorized());
    res.status(response.code).send(response);
    return;
  }

  const { status } = req.body;
  const validStatuses = ["active", "inactive", "suspended"];

  if (!status || !validStatuses.includes(status)) {
    const response = apiResponse.error(
      HttpErrors.ValidationFailed(`Status must be one of: ${validStatuses.join(", ")}`)
    );
    res.status(response.code).send(response);
    return;
  }

  // Get current account to track the change (outside transaction)
  const [currentAccount] = await db
    .select({ status: accounts.status })
    .from(accounts)
    .where(eq(accounts.uuid, targetAccountId))
    .limit(1);

  if (!currentAccount) {
    const response = apiResponse.error(HttpErrors.NotFound("Account"));
    res.status(response.code).send(response);
    return;
  }

  // Update account status and audit log in transaction
  const updatedAccount = await db.transaction(async (tx) => {
    const [account] = await tx.update(accounts).set({ status }).where(eq(accounts.uuid, targetAccountId)).returning();

    if (!account) {
      throw new Error("Account not found");
    }

    // Audit log the status change
    await auditHelpers.accountStatusChanged(accountId, targetAccountId, currentAccount.status, status, req, tx);

    return account;
  });

  if (!updatedAccount) {
    const response = apiResponse.error(HttpErrors.NotFound("Account"));
    res.status(response.code).send(response);
    return;
  }

  const response = apiResponse.success(
    HttpStatusCode.OK,
    { account: updatedAccount },
    `Account status updated to: ${status}`
  );

  res.status(response.code).send(response);
});

/**
 * GET /admin/workspaces
 * List ALL workspaces across all accounts (SuperAdmin only)
 */
export const listAllWorkspaces = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  // Get paginated workspaces with owner info, member counts, and total count in single query
  const workspacesWithCount = await db
    .select({
      workspace: {
        uuid: workspaces.uuid,
        name: workspaces.name,
        description: workspaces.description,
        createdAt: workspaces.createdAt,
        accountId: workspaces.accountId
      },
      owner: {
        uuid: accounts.uuid,
        fullName: accounts.fullName,
        email: accounts.email
      },
      memberCount: sql<number>`(
        SELECT COUNT(*)
        FROM workspace_memberships
        WHERE workspace_memberships.workspace_id = ${workspaces.uuid}
      )`,
      totalCount: sql<number>`count(*) over()`
    })
    .from(workspaces)
    .leftJoin(accounts, eq(workspaces.accountId, accounts.uuid))
    .orderBy(workspaces.createdAt)
    .limit(limit)
    .offset(offset);

  const count = workspacesWithCount[0]?.totalCount || 0;
  // Clean data by removing totalCount from individual records
  const workspacesList = workspacesWithCount.map(({ totalCount: _, ...workspace }) => workspace);

  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      workspaces: workspacesList,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit)
      }
    },
    "Workspaces retrieved successfully"
  );

  res.status(response.code).send(response);
});

/**
 * POST /admin/workspaces
 * Create workspace (SuperAdmin only)
 */
export const createAdminWorkspace = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = adminWorkspaceCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const { accountId } = req;
  if (!accountId) {
    const response = apiResponse.error(HttpErrors.Unauthorized());
    res.status(response.code).send(response);
    return;
  }

  const [workspace] = await db
    .insert(workspaces)
    .values({
      name: parsed.data.name,
      description: parsed.data.description,
      accountId
    })
    .returning();

  if(workspace) {
    await db
      .insert(categories)
      .values([
        { workspaceId: workspace.uuid, name: "Lĩnh vực", code: "FIELD" },
        { workspaceId: workspace.uuid, name: "Chức vụ", code: "POSITION" },
        { workspaceId: workspace.uuid, name: "Loại văn bản", code: "DOCUMENT_TYPE" }
      ])
      .onConflictDoNothing();

    const [adminRole] = await db
      .insert(roles)
      .values({
        workspaceId: workspace.uuid,
        name: "admin",
        code: "ADMIN"
      })
      .returning();

    const permits = await db.select().from(permissions);

    if (permits.length > 0 && adminRole) {
      await db
        .insert(rolePermissions)
        .values(
          permits.map(({ id }) => ({
            roleId: adminRole.id,
            permissionId: id
          }))
        )
        .onConflictDoNothing();
    }

    const featuresData = await db.select().from(features).where(eq(features.enabled, true));

    if (featuresData.length > 0) {
      await db
        .insert(workspaceFeatures)
        .values(
          featuresData.map((f) => ({
            workspaceId: workspace.uuid,
            featureId: f.uuid
          }))
        )
        .onConflictDoNothing();
    }
  }

  const response = apiResponse.success(HttpStatusCode.CREATED, { workspace }, "Workspace created successfully");
  res.status(response.code).send(response);
});

/**
 * PATCH /admin/workspaces/:id
 * Update workspace (SuperAdmin only)
 */
export const updateAdminWorkspace = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceIdValidation = validateRequiredUuid(req.params.id, "Workspace ID");
  if (!workspaceIdValidation.success) {
    const response = apiResponse.error(workspaceIdValidation.error);
    res.status(response.code).send(response);
    return;
  }

  const parsed = adminWorkspaceUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const updatePayload: Partial<{ name: string; description: string | undefined }> = {};
  if (parsed.data.name !== undefined) {
    updatePayload.name = parsed.data.name;
  }
  if (parsed.data.description !== undefined) {
    updatePayload.description = parsed.data.description;
  }

  const [updated] = await db
    .update(workspaces)
    .set(updatePayload)
    .where(eq(workspaces.uuid, workspaceIdValidation.value))
    .returning();

  if (!updated) {
    const response = apiResponse.error(HttpErrors.NotFound("Workspace"));
    res.status(response.code).send(response);
    return;
  }

  const response = apiResponse.success(HttpStatusCode.OK, { workspace: updated }, "Workspace updated successfully");
  res.status(response.code).send(response);
});

/**
 * DELETE /admin/workspaces/:id
 * Delete workspace (SuperAdmin only)
 */
export const deleteAdminWorkspace = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceIdValidation = validateRequiredUuid(req.params.id, "Workspace ID");
  if (!workspaceIdValidation.success) {
    const response = apiResponse.error(workspaceIdValidation.error);
    res.status(response.code).send(response);
    return;
  }

  const workspaceId = workspaceIdValidation.value;
  const deletePolicy = workspaceDeletePolicySchema.parse(req.query.policy ?? "restrict");

  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.uuid, workspaceId)).limit(1);
  if (!workspace) {
    const response = apiResponse.error(HttpErrors.NotFound("Workspace"));
    res.status(response.code).send(response);
    return;
  }

  const dependencies = await getWorkspaceDependencySummary(workspaceId);
  const blockers = Object.entries(dependencies).filter(([, count]) => count > 0);

  if (deletePolicy === "restrict" && blockers.length > 0) {
    const blockerMessage = blockers.map(([name, count]) => `${name}: ${count}`).join(", ");
    const response = apiResponse.error(
      HttpErrors.Conflict(
        `Workspace has dependent data and cannot be deleted in restrict mode. Resolve dependencies first (${blockerMessage})`
      )
    );
    res.status(response.code).send({
      ...response,
      data: {
        workspaceId,
        policy: deletePolicy,
        dependencies
      }
    });
    return;
  }

  try {
    await db.transaction(async (tx) => {
      if (deletePolicy === "cascade") {
        await tx
          .delete(taskComments)
          .where(sql`${taskComments.taskId} in (select ${tasks.uuid} from ${tasks} where ${tasks.workspaceId} = ${workspaceId})`);
        await tx
          .delete(taskProgress)
          .where(sql`${taskProgress.taskId} in (select ${tasks.uuid} from ${tasks} where ${tasks.workspaceId} = ${workspaceId})`);
        await tx
          .delete(taskAssignments)
          .where(
            sql`${taskAssignments.taskId} in (select ${tasks.uuid} from ${tasks} where ${tasks.workspaceId} = ${workspaceId})`
          );
        await tx.delete(notifications).where(eq(notifications.workspaceId, workspaceId));
        await tx.delete(tasks).where(eq(tasks.workspaceId, workspaceId));
        await tx.delete(documents).where(eq(documents.workspaceId, workspaceId));
        await tx
          .delete(categoryItems)
          .where(sql`${categoryItems.categoryId} in (select ${categories.uuid} from ${categories} where ${categories.workspaceId} = ${workspaceId})`);
        await tx.delete(categories).where(eq(categories.workspaceId, workspaceId));
        await tx.delete(organizations).where(eq(organizations.workspaceId, workspaceId));
        await tx.delete(auditLogs).where(eq(auditLogs.workspaceId, workspaceId));
      }

      await tx.delete(profiles).where(eq(profiles.workspaceId, workspaceId));
      await tx.delete(workspaceMemberships).where(eq(workspaceMemberships.workspaceId, workspaceId));
      await tx.delete(workspaces).where(eq(workspaces.uuid, workspaceId));
    });
  } catch {
    const response = apiResponse.error(
      HttpErrors.ValidationFailed("Workspace has related data. Remove dependent records before deleting.")
    );
    res.status(response.code).send(response);
    return;
  }

  const response = apiResponse.success(
    HttpStatusCode.OK,
    { deletedWorkspaceId: workspaceId, workspaceName: workspace.name, policy: deletePolicy },
    deletePolicy === "cascade" ? "Workspace deleted successfully (cascade policy)" : "Workspace deleted successfully"
  );
  res.status(response.code).send(response);
});

/**
 * GET /admin/memberships
 * List all memberships with filtering (SuperAdmin only)
 */
export const listAllMemberships = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;
  const workspaceId = req.query.workspaceId as string;
  const accountId = req.query.accountId as string;

  // Build conditions for filtering
  const conditions = [];
  if (workspaceId) {
    conditions.push(eq(workspaceMemberships.workspaceId, workspaceId));
  }
  if (accountId) {
    conditions.push(eq(workspaceMemberships.accountId, accountId));
  }

  // Build base query
  const baseQuery = db
    .select({
      membership: {
        uuid: workspaceMemberships.uuid,
        roleId: workspaceMemberships.roleId,
        isAdmin: workspaceMemberships.isAdmin,
        workspaceId: workspaceMemberships.workspaceId,
        accountId: workspaceMemberships.accountId
      },
      role: {
        code: roles.code,
        name: roles.name
      },
      workspace: {
        uuid: workspaces.uuid,
        name: workspaces.name
      },
      account: {
        uuid: accounts.uuid,
        fullName: accounts.fullName,
        email: accounts.email
      }
    })
    .from(workspaceMemberships)
    .innerJoin(roles, eq(workspaceMemberships.roleId, roles.id))
    .innerJoin(workspaces, eq(workspaceMemberships.workspaceId, workspaces.uuid))
    .innerJoin(accounts, eq(workspaceMemberships.accountId, accounts.uuid));

  // Apply filters if any exist
  const query =
    conditions.length > 0 ? baseQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions)) : baseQuery;

  const membershipsList = await query.limit(limit).offset(offset);

  // Get total count for pagination (using same filter conditions)
  const countQuery =
    conditions.length > 0
      ? db
        .select({ count: sql<number>`count(*)` })
        .from(workspaceMemberships)
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      : db.select({ count: sql<number>`count(*)` }).from(workspaceMemberships);

  const [countResult] = await countQuery;
  const count = countResult?.count || 0;

  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      memberships: membershipsList,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit)
      }
    },
    "Memberships retrieved successfully"
  );

  res.status(response.code).send(response);
});

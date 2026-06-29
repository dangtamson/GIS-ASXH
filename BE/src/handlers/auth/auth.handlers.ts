import { LoginRequestSchema, SignupRequestSchema } from "@/docs/openapi-schemas.ts";
import { createDbAccount } from "@/handlers/accounts/accounts.methods.ts";
import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { logger } from "@/helpers/logger.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import { accounts, organizations, roles, systemConfigs, workspaceMemberships, workspaces } from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import {
  checkAccountLockStatus,
  getDefaultSecurityPolicy,
  getSecurityPolicy,
  isPasswordChangeRequired,
  markPasswordAsChanged,
  recordFailedLogin,
  recordSuccessfulLogin
} from "@/services/securityPolicy.ts";
import { getSupabaseAdmin, supabase } from "@/services/supabase.ts";
import type { User } from "@supabase/supabase-js";
import { createHmac } from "crypto";
import { eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

const APP_TOKEN_SECRET = process.env.APP_JWT_SECRET || "local-dev-app-jwt-secret";
const APP_TOKEN_EXPIRES_IN_SECONDS = Number(process.env.APP_JWT_EXPIRES_IN_SECONDS) || 60 * 60 * 12;

const ssoConfigSchema = z.object({
  enabled: z.boolean().default(true),
  loginUrl: z.url(),
  loginParams: z.string().trim().min(1),
  redirectUri: z.url(),
  accessTokenUrl: z.url(),
  accessTokenParams: z.string().trim().min(1),
  userInfoUrl: z.url().optional(),
  emailExtension: z.string().trim().optional()
});

const ssoExchangeSchema = z.object({
  code: z.string().trim().min(1),
  state: z.string().trim().optional(),
  workspaceId: z.uuid().optional()
});

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function issueAppToken(accountId: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: accountId,
    iss: "app",
    iat: now,
    exp: now + APP_TOKEN_EXPIRES_IN_SECONDS
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", APP_TOKEN_SECRET).update(signingInput).digest("base64url");

  return `${signingInput}.${signature}`;
}

function applyTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((result, [key, value]) => {
    return result.replaceAll(`{${key}}`, value);
  }, template);
}

function buildUrlWithQuery(baseUrl: string, queryString: string): string {
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}${queryString}`;
}

function parseState(state?: string): { workspaceId?: string } {
  if (!state) {
    return {};
  }

  try {
    const decoded = base64UrlDecode(state);
    const parsed = JSON.parse(decoded) as { workspaceId?: string };
    return parsed;
  } catch {
    return {};
  }
}

function readSsoEnabled(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return record.enabled === true;
}

async function resolveSsoConfig(workspaceId?: string): Promise<{ workspaceId: string; config: z.infer<typeof ssoConfigSchema> } | null> {
  if (workspaceId) {
    const [row] = await db
      .select({ workspaceId: systemConfigs.workspaceId, sso: systemConfigs.sso })
      .from(systemConfigs)
      .where(eq(systemConfigs.workspaceId, workspaceId))
      .limit(1);

    if (!row) {
      return null;
    }

    const parsed = ssoConfigSchema.safeParse(row.sso || {});
    if (!parsed.success || !parsed.data.enabled) {
      return null;
    }

    return { workspaceId: row.workspaceId, config: parsed.data };
  }

  const rows = await db.select({ workspaceId: systemConfigs.workspaceId, sso: systemConfigs.sso }).from(systemConfigs);
  for (const row of rows) {
    const parsed = ssoConfigSchema.safeParse(row.sso || {});
    if (parsed.success && parsed.data.enabled) {
      return { workspaceId: row.workspaceId, config: parsed.data };
    }
  }

  return null;
}

function extractEmailFromJwt(jwtToken?: string): string | null {
  if (!jwtToken) {
    return null;
  }

  try {
    const [, payload] = jwtToken.split(".");
    if (!payload) {
      return null;
    }
    const payloadText = base64UrlDecode(payload);
    const parsed = JSON.parse(payloadText) as Record<string, unknown>;
    const candidates = [parsed.email, parsed.preferred_username, parsed.upn, parsed.sub];

    const emailCandidate = candidates.find((value) => typeof value === "string" && value.trim()) as string | undefined;
    return emailCandidate?.trim().toLowerCase() || null;
  } catch {
    return null;
  }
}

function normalizeEmail(raw: string, extension?: string): string {
  const email = raw.trim().toLowerCase();
  if (email.includes("@") || !extension?.trim()) {
    return email;
  }
  const normalizedExtension = extension.startsWith("@") ? extension : `@${extension}`;
  return `${email}${normalizedExtension.toLowerCase()}`;
}

async function buildLoginResponseData(accountId: string, token: string): Promise<Record<string, unknown>> {
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
    throw HttpErrors.NotFound("Account");
  }

  const userWorkspaces = await db
    .select({
      workspace: {
        uuid: workspaces.uuid,
        name: workspaces.name,
        description: workspaces.description,
        createdAt: workspaces.createdAt,
        ownerId: workspaces.accountId
      },
      membership: {
        uuid: workspaceMemberships.uuid,
        workspaceId: workspaceMemberships.workspaceId,
        accountId: workspaceMemberships.accountId,
        organizationId: workspaceMemberships.organizationId,
        isAdmin: workspaceMemberships.isAdmin
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
    .innerJoin(roles, eq(workspaceMemberships.roleId, roles.id))
    .leftJoin(organizations, eq(workspaceMemberships.organizationId, organizations.uuid))
    .where(eq(workspaceMemberships.accountId, accountId));

  return {
    token,
    account,
    workspaces: userWorkspaces,
    workspaceCount: userWorkspaces.length
  };
}

export const signUpWithSupabase = async (email: string, password: string): Promise<User | Error> => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error || !data?.user) {
    logger.error({ error }, "Unable to sign up with Supabase");
    return new Error("Unable to sign up", {
      cause: error
    });
  }

  return data.user;
};

export const signUp = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const validation = SignupRequestSchema.safeParse(req.body);

  if (!validation.success) {
    const response = apiResponse.error(
      HttpErrors.ValidationFailed(`Invalid request data: ${validation.error.message}`)
    );
    res.status(response.code).send(response);
    return;
  }

  const { email, password, fullName, phone } = validation.data;

  const user = await signUpWithSupabase(email, password);

  if (!user || user instanceof Error) {
    // Don't expose the original error to the client. This is a security risk.
    // eg "code": "user_already_exists"
    // We also don't want to throw errors in the handler, because they will be caught by the asyncHandler and reported to Sentry.
    const response = apiResponse.error(HttpErrors.Unauthorized("Unable to sign up"));
    res.status(response.code).send(response);
    return;
  }

  // Let Supabase provide us the UUID for the account.
  const dbAccountId = await createDbAccount({ email, fullName, phone, uuid: user.id });

  const response = apiResponse.success<string>(
    HttpStatusCode.OK,
    `Account created in DB with id: ${dbAccountId}`,
    "Signup successful"
  );

  res.status(response.code).send(response);
});

export const signInWithPassword = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validation = LoginRequestSchema.safeParse(req.body);
      if (!validation.success) {
        const response = apiResponse.error(
          HttpErrors.ValidationFailed(`Invalid request data: ${validation.error.message}`)
        );
        res.status(response.code).send(response);
        return;
      }

      const { email, password } = validation.data;
      const ipAddress = req.ip || undefined;
      const userAgent = req.get("User-Agent") || undefined;

      // Find account by email
      const [dbAccount] = await db
        .select({
          uuid: accounts.uuid,
          isLocked: accounts.isLocked,
          lockedUntil: accounts.lockedUntil,
          passwordChangeRequired: accounts.passwordChangeRequired
        })
        .from(accounts)
        .where(eq(accounts.email, email))
        .limit(1);

      // Check account lock status BEFORE attempting login
      if (dbAccount) {
        const lockStatus = await checkAccountLockStatus(dbAccount.uuid);
        if (lockStatus.isLocked) {
          logger.warn({ email, lockReason: lockStatus.reason }, "Login attempt on locked account");
          const response = apiResponse.error(
            HttpErrors.Unauthorized("Account is locked. Please try again later or contact support.")
          );
          res.status(response.code).send(response);
          return;
        }
      }

      // Attempt Supabase authentication
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error || !data.user?.id) {
        // Invalid credentials
        logger.error({ error, email }, "Failed Supabase authentication");

        // Record failed attempt if account exists
        if (dbAccount) {
          // Get first workspace for this account
          const [userFirstWorkspace] = await db
            .select({ uuid: workspaces.uuid })
            .from(workspaceMemberships)
            .innerJoin(workspaces, eq(workspaceMemberships.workspaceId, workspaces.uuid))
            .where(eq(workspaceMemberships.accountId, dbAccount.uuid))
            .limit(1);

          const workspaceId = userFirstWorkspace?.uuid || "default-workspace";
          const failedLoginResult = await recordFailedLogin(
            dbAccount.uuid,
            email,
            workspaceId,
            ipAddress,
            userAgent
          );

          if (failedLoginResult.shouldLock) {
            const response = apiResponse.error(
              HttpErrors.Unauthorized(
                `Too many failed login attempts. Account locked for security. Attempts remaining: 0`
              )
            );
            res.status(response.code).send(response);
            return;
          }

          if (failedLoginResult.attemptsRemaining <= 2) {
            const response = apiResponse.error(
              HttpErrors.Unauthorized(
                `Invalid credentials. ${failedLoginResult.attemptsRemaining} attempts remaining before account lockout.`
              )
            );
            res.status(response.code).send(response);
            return;
          }
        }

        const response = apiResponse.error(HttpErrors.Unauthorized("Invalid email or password"));
        res.status(response.code).send(response);
        return;
      }

      const accountId = data.user.id;

      // Fetch full account details
      const [account] = await db
        .select({
          uuid: accounts.uuid,
          fullName: accounts.fullName,
          email: accounts.email,
          phone: accounts.phone,
          isSuperAdmin: accounts.isSuperAdmin,
          status: accounts.status,
          createdAt: accounts.createdAt,
          passwordChangeRequired: accounts.passwordChangeRequired
        })
        .from(accounts)
        .where(eq(accounts.uuid, accountId))
        .limit(1);

      if (!account) {
        const response = apiResponse.error(HttpErrors.NotFound("Account"));
        res.status(response.code).send(response);
        return;
      }

      // Record successful login
      await recordSuccessfulLogin(accountId, email, ipAddress, userAgent);

      // Get user workspaces and security policy
      const userWorkspaces = await db
        .select({
          workspace: {
            uuid: workspaces.uuid,
            name: workspaces.name,
            description: workspaces.description,
            createdAt: workspaces.createdAt,
            ownerId: workspaces.accountId
          },
          membership: {
            uuid: workspaceMemberships.uuid,
            workspaceId: workspaceMemberships.workspaceId,
            accountId: workspaceMemberships.accountId,
            organizationId: workspaceMemberships.organizationId,
            isAdmin: workspaceMemberships.isAdmin
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
        .innerJoin(roles, eq(workspaceMemberships.roleId, roles.id))
        .leftJoin(organizations, eq(workspaceMemberships.organizationId, organizations.uuid))
        .where(eq(workspaceMemberships.accountId, accountId));

      // Get security policy from first workspace
      let securityPolicy = getDefaultSecurityPolicy();
      if (userWorkspaces.length > 0) {
        const firstWorkspaceId = userWorkspaces[0]?.workspace?.uuid;
        if (firstWorkspaceId) {
          securityPolicy = await getSecurityPolicy(firstWorkspaceId);
        }
      }

      const responseData = {
        ...data,
        account,
        workspaces: userWorkspaces,
        workspaceCount: userWorkspaces.length,
        // Security policy info for FE
        securityFlags: {
          passwordChangeRequired: account.passwordChangeRequired,
          sessionTimeoutMinutes: securityPolicy.sessionTimeoutMinutes || 30,
          sessionMaxTimeoutMinutes: securityPolicy.sessionMaxTimeoutMinutes || 480
        }
      };

      const response = apiResponse.success(HttpStatusCode.OK, responseData, "Sign in successful");
      res.status(response.code).send(response);
    } catch (err) {
      next(err);
    }
  }
);

export const getSsoLoginUrl = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined;
  const resolved = await resolveSsoConfig(workspaceId);

  if (!resolved) {
    const response = apiResponse.error(HttpErrors.NotFound("SSO configuration"));
    res.status(response.code).send(response);
    return;
  }

  const state = base64UrlEncode(JSON.stringify({ workspaceId: resolved.workspaceId }));
  const loginQuery = applyTemplate(resolved.config.loginParams, {
    redirect_uri: resolved.config.redirectUri,
    state
  });
  const loginUrl = buildUrlWithQuery(resolved.config.loginUrl, loginQuery);

  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      url: loginUrl,
      workspaceId: resolved.workspaceId,
      redirectUri: resolved.config.redirectUri,
      state
    },
    "SSO login URL generated"
  );

  res.status(response.code).send(response);
});

export const getSsoEnabledStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined;

  if (workspaceId) {
    const [row] = await db
      .select({ workspaceId: systemConfigs.workspaceId, sso: systemConfigs.sso })
      .from(systemConfigs)
      .where(eq(systemConfigs.workspaceId, workspaceId))
      .limit(1);

    const enabled = readSsoEnabled(row?.sso);
    const response = apiResponse.success(HttpStatusCode.OK, { enabled, workspaceId }, "SSO enabled status");
    res.status(response.code).send(response);
    return;
  }

  const rows = await db.select({ workspaceId: systemConfigs.workspaceId, sso: systemConfigs.sso }).from(systemConfigs);
  const enabledRow = rows.find((row) => readSsoEnabled(row.sso));

  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      enabled: Boolean(enabledRow),
      workspaceId: enabledRow?.workspaceId || null
    },
    "SSO enabled status"
  );

  res.status(response.code).send(response);
});

export const signInWithSsoCode = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = ssoExchangeSchema.safeParse(req.body);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const stateData = parseState(parsed.data.state);
  const workspaceId = parsed.data.workspaceId || stateData.workspaceId;
  const resolved = await resolveSsoConfig(workspaceId);

  if (!resolved) {
    const response = apiResponse.error(HttpErrors.NotFound("SSO configuration"));
    res.status(response.code).send(response);
    return;
  }

  const tokenParams = applyTemplate(resolved.config.accessTokenParams, {
    code: parsed.data.code,
    redirect_uri: resolved.config.redirectUri
  });

  const tokenResponse = await fetch(resolved.config.accessTokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body: tokenParams
  });

  if (!tokenResponse.ok) {
    const response = apiResponse.error(HttpErrors.Unauthorized("Unable to exchange SSO code"));
    res.status(response.code).send(response);
    return;
  }

  const tokenData = (await tokenResponse.json()) as Record<string, unknown>;
  const accessToken = typeof tokenData.access_token === "string" ? tokenData.access_token : "";
  const idToken = typeof tokenData.id_token === "string" ? tokenData.id_token : "";

  let email = extractEmailFromJwt(idToken);

  if (!email && resolved.config.userInfoUrl && accessToken) {
    const userInfoResponse = await fetch(resolved.config.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      }
    });

    if (userInfoResponse.ok) {
      const userInfo = (await userInfoResponse.json()) as Record<string, unknown>;
      const rawEmail =
        (typeof userInfo.email === "string" && userInfo.email) ||
        (typeof userInfo.mail === "string" && userInfo.mail) ||
        (typeof userInfo.upn === "string" && userInfo.upn) ||
        (typeof userInfo.preferred_username === "string" && userInfo.preferred_username) ||
        "";
      if (rawEmail) {
        email = rawEmail.trim().toLowerCase();
      }
    }
  }

  if (!email && typeof tokenData.email === "string") {
    email = tokenData.email.trim().toLowerCase();
  }

  if (!email) {
    const response = apiResponse.error(HttpErrors.Unauthorized("Unable to resolve email from SSO response"));
    res.status(response.code).send(response);
    return;
  }

  const normalizedEmail = normalizeEmail(email, resolved.config.emailExtension);

  const [account] = await db
    .select({ uuid: accounts.uuid })
    .from(accounts)
    .where(eq(accounts.email, normalizedEmail))
    .limit(1);

  if (!account) {
    const response = apiResponse.error(HttpErrors.Unauthorized("No application account mapped for this SSO user"));
    res.status(response.code).send(response);
    return;
  }

  const token = issueAppToken(account.uuid);
  const responseData = await buildLoginResponseData(account.uuid, token);

  const response = apiResponse.success(HttpStatusCode.OK, responseData, "SSO sign in successful");
  res.status(response.code).send(response);
});

/**
 * Change password endpoint
 * Requires authenticated user (bearer token)
 */
export const changePassword = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Get current user from authenticated request
      const accountId = req.accountId;
      if (!accountId) {
        const response = apiResponse.error(HttpErrors.Unauthorized("Unable to resolve account from authentication"));
        res.status(response.code).send(response);
        return;
      }

      // Validate request body
      const schema = z.object({
        currentPassword: z.string().trim().min(1),
        newPassword: z.string().trim().min(8, "New password must be at least 8 characters")
      });

      const validation = schema.safeParse(req.body);
      if (!validation.success) {
        const response = apiResponse.error(
          HttpErrors.ValidationFailed(`Invalid request data: ${validation.error.message}`)
        );
        res.status(response.code).send(response);
        return;
      }

      const { currentPassword, newPassword } = validation.data;

      // Get account email
      const [account] = await db
        .select({ email: accounts.email })
        .from(accounts)
        .where(eq(accounts.uuid, accountId))
        .limit(1);

      if (!account) {
        const response = apiResponse.error(HttpErrors.NotFound("Account not found"));
        res.status(response.code).send(response);
        return;
      }

      // Verify current password with Supabase
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: account.email,
        password: currentPassword
      });

      if (authError) {
        logger.warn({ email: account.email }, "Invalid current password during password change");
        const response = apiResponse.error(
          HttpErrors.ValidationFailed("Current password is incorrect")
        );
        res.status(response.code).send(response);
        return;
      }

      // Update password in Supabase
      const supabaseAdmin = getSupabaseAdmin();
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        accountId,
        { password: newPassword }
      );

      if (updateError) {
        logger.error({ error: updateError, accountId }, "Failed to update password in Supabase");
        const response = apiResponse.error(
          HttpErrors.InternalError("Failed to update password")
        );
        res.status(response.code).send(response);
        return;
      }

      // Mark password change as completed in DB
      await markPasswordAsChanged(accountId);

      logger.info({ accountId, email: account.email }, "Password changed successfully");
      const response = apiResponse.success(
        HttpStatusCode.OK,
        { message: "Password changed successfully" },
        "Password updated"
      );
      res.status(response.code).send(response);
    } catch (err) {
      next(err);
    }
  }
);

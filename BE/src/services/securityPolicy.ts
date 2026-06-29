import { logger } from "@/helpers/logger.ts";
import { accounts, loginAttempts, systemConfigs } from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import { and, desc, eq, gt, gte } from "drizzle-orm";
import type { z } from "zod";

type SecurityPolicy = Record<string, unknown>;

interface SecurityPolicyConfig {
    minPasswordLength?: number;
    maxPasswordLength?: number;
    passwordChangeDays?: number;
    passwordValidityDays?: number;
    enableSecurityMode?: boolean;
    allowLoginAttempts?: number;
    warningLoginAttempts?: number;
    lockoutOnViolation?: boolean;
    sessionTimeoutMinutes?: number;
    sessionMaxTimeoutMinutes?: number;
    forceChangePasswordOnFirstLogin?: boolean;
    requireLowercase?: boolean;
    requireUppercase?: boolean;
    requireNumber?: boolean;
    requireSpecialChar?: boolean;
    preventReuseOldPassword?: boolean;
}

function parseSecurityPolicy(policy: unknown): SecurityPolicyConfig {
    if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
        return {};
    }
    return (policy as Record<string, unknown>) as SecurityPolicyConfig;
}

/**
 * Load security policy for a workspace
 */
export async function getSecurityPolicy(workspaceId: string): Promise<SecurityPolicyConfig> {
    try {
        const [config] = await db
            .select({ securityPolicy: systemConfigs.securityPolicy })
            .from(systemConfigs)
            .where(eq(systemConfigs.workspaceId, workspaceId))
            .limit(1);

        if (!config) {
            return {};
        }

        return parseSecurityPolicy(config.securityPolicy);
    } catch (err) {
        logger.error({ err, workspaceId }, "Failed to load security policy");
        return {};
    }
}

/**
 * Get default security policy
 */
export function getDefaultSecurityPolicy(): SecurityPolicyConfig {
    return {
        minPasswordLength: 8,
        maxPasswordLength: 128,
        passwordChangeDays: 90,
        passwordValidityDays: 365,
        enableSecurityMode: false,
        allowLoginAttempts: 5,
        warningLoginAttempts: 3,
        lockoutOnViolation: false,
        sessionTimeoutMinutes: 30,
        sessionMaxTimeoutMinutes: 480,
        forceChangePasswordOnFirstLogin: true,
        requireLowercase: true,
        requireUppercase: true,
        requireNumber: true,
        requireSpecialChar: false,
        preventReuseOldPassword: false
    };
}

/**
 * Check if account is locked and if the lock has expired
 */
export async function checkAccountLockStatus(
    accountId: string
): Promise<{ isLocked: boolean; reason: string | null }> {
    try {
        const [account] = await db
            .select({ isLocked: accounts.isLocked, lockedUntil: accounts.lockedUntil })
            .from(accounts)
            .where(eq(accounts.uuid, accountId))
            .limit(1);

        if (!account) {
            return { isLocked: false, reason: null };
        }

        if (!account.isLocked) {
            return { isLocked: false, reason: null };
        }

        // Check if lock has expired
        if (account.lockedUntil && new Date(account.lockedUntil) < new Date()) {
            // Unlock the account
            await db
                .update(accounts)
                .set({
                    isLocked: false,
                    lockedUntil: null,
                    failedLoginAttempts: 0
                })
                .where(eq(accounts.uuid, accountId));

            return { isLocked: false, reason: null };
        }

        return {
            isLocked: true,
            reason: `Account locked until ${account.lockedUntil?.toISOString()}`
        };
    } catch (err) {
        logger.error({ err, accountId }, "Failed to check account lock status");
        return { isLocked: false, reason: null };
    }
}

/**
 * Record failed login attempt and check if account should be locked
 */
export async function recordFailedLogin(
    accountId: string,
    email: string,
    workspaceId: string,
    ipAddress?: string,
    userAgent?: string
): Promise<{ shouldLock: boolean; attemptsRemaining: number; policy: SecurityPolicyConfig }> {
    try {
        const policy = await getSecurityPolicy(workspaceId);
        const mergedPolicy = { ...getDefaultSecurityPolicy(), ...policy };

        // Record the failed attempt
        await db.insert(loginAttempts).values({
            accountId,
            email,
            success: false,
            ipAddress,
            userAgent,
            reasonCode: "invalid_credentials"
        });

        // Increment failed attempts counter
        const [account] = await db
            .select({
                failedLoginAttempts: accounts.failedLoginAttempts
            })
            .from(accounts)
            .where(eq(accounts.uuid, accountId))
            .limit(1);

        const newAttempts = (account?.failedLoginAttempts ?? 0) + 1;
        const allowedAttempts = mergedPolicy.allowLoginAttempts ?? 5;
        const shouldLock: boolean =
            (mergedPolicy.lockoutOnViolation ?? false) && newAttempts >= allowedAttempts;

        if (shouldLock) {
            // Lock the account for a reasonable time (e.g., 30 minutes)
            const lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
            await db
                .update(accounts)
                .set({
                    failedLoginAttempts: newAttempts,
                    lastFailedLoginAt: new Date(),
                    isLocked: true,
                    lockedUntil
                })
                .where(eq(accounts.uuid, accountId));
        } else {
            await db
                .update(accounts)
                .set({
                    failedLoginAttempts: newAttempts,
                    lastFailedLoginAt: new Date()
                })
                .where(eq(accounts.uuid, accountId));
        }

        const attemptsRemaining = Math.max(0, allowedAttempts - newAttempts);

        return { shouldLock, attemptsRemaining, policy: mergedPolicy };
    } catch (err) {
        logger.error({ err, accountId }, "Failed to record failed login attempt");
        return { shouldLock: false, attemptsRemaining: 0, policy: getDefaultSecurityPolicy() };
    }
}

/**
 * Record successful login and reset failed attempts
 */
export async function recordSuccessfulLogin(
    accountId: string,
    email: string,
    ipAddress?: string,
    userAgent?: string
): Promise<void> {
    try {
        // Record successful login
        await db.insert(loginAttempts).values({
            accountId,
            email,
            success: true,
            ipAddress,
            userAgent
        });

        // Reset failed attempts
        await db
            .update(accounts)
            .set({
                failedLoginAttempts: 0,
                lastFailedLoginAt: null
            })
            .where(eq(accounts.uuid, accountId));
    } catch (err) {
        logger.error({ err, accountId }, "Failed to record successful login");
    }
}

/**
 * Check if password change is required for account
 */
export async function isPasswordChangeRequired(accountId: string): Promise<boolean> {
    try {
        const [account] = await db
            .select({ passwordChangeRequired: accounts.passwordChangeRequired })
            .from(accounts)
            .where(eq(accounts.uuid, accountId))
            .limit(1);

        return account?.passwordChangeRequired ?? false;
    } catch (err) {
        logger.error({ err, accountId }, "Failed to check password change requirement");
        return false;
    }
}

/**
 * Mark password as changed
 */
export async function markPasswordAsChanged(accountId: string): Promise<void> {
    try {
        await db
            .update(accounts)
            .set({
                passwordChangeRequired: false,
                lastPasswordChangedAt: new Date()
            })
            .where(eq(accounts.uuid, accountId));
    } catch (err) {
        logger.error({ err, accountId }, "Failed to mark password as changed");
    }
}

/**
 * Check login attempts in the last N minutes
 */
export async function getRecentFailedAttempts(
    accountId: string,
    minutesWindow: number = 5
): Promise<number> {
    try {
        const since = new Date(Date.now() - minutesWindow * 60 * 1000);

        const results = await db
            .select()
            .from(loginAttempts)
            .where(
                and(
                    eq(loginAttempts.accountId, accountId),
                    eq(loginAttempts.success, false),
                    gte(loginAttempts.createdAt, since)
                )
            );

        return results.length;
    } catch (err) {
        logger.error({ err, accountId }, "Failed to get recent failed attempts");
        return 0;
    }
}

/**
 * Get last login attempt info
 */
export async function getLastLoginAttempt(
    accountId: string
): Promise<{
    success: boolean;
    timestamp: Date | null;
    ipAddress?: string;
} | null> {
    try {
        const [attempt] = await db
            .select()
            .from(loginAttempts)
            .where(eq(loginAttempts.accountId, accountId))
            .orderBy(desc(loginAttempts.createdAt))
            .limit(1);

        if (!attempt) {
            return null;
        }

        return {
            success: attempt.success,
            timestamp: attempt.createdAt,
            ipAddress: attempt.ipAddress ?? undefined
        };
    } catch (err) {
        logger.error({ err, accountId }, "Failed to get last login attempt");
        return null;
    }
}

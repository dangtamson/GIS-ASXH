import { and, eq, inArray } from "drizzle-orm";
import {
    features,
    permissions,
    roleFeatures,
    rolePermissions,
    roles,
    workspaceFeatures,
    workspaces
} from "../src/schema.ts";
import { closeDbPool, db } from "../src/services/db/drizzle.ts";
import { SOCIAL_ASSISTANCE_FEATURES, SOCIAL_ASSISTANCE_PERMISSIONS } from "../src/social-assistance/features.ts";

const ADMIN_ROLE_CODES = ["ADMIN", "SUPER_ADMIN", "admin"] as const;

async function seedSocialAssistanceFeatures(): Promise<void> {
    const workspaceRows = await db.select({ uuid: workspaces.uuid }).from(workspaces);
    if (workspaceRows.length === 0) {
        throw new Error("No workspaces found; cannot seed social assistance features");
    }

    const permissionValues = SOCIAL_ASSISTANCE_PERMISSIONS.map(([code, name]) => ({
        code,
        name,
        description: name
    }));

    await db.transaction(async (tx) => {
        await tx.insert(permissions).values(permissionValues).onConflictDoNothing({ target: permissions.code });

        const storedPermissions = await tx
            .select({ id: permissions.id, code: permissions.code })
            .from(permissions)
            .where(inArray(permissions.code, SOCIAL_ASSISTANCE_PERMISSIONS.map(([code]) => code)));

        for (const workspace of workspaceRows) {
            await tx
                .insert(features)
                .values(SOCIAL_ASSISTANCE_FEATURES.map((feature) => ({
                    workspaceId: workspace.uuid,
                    ...feature,
                    enabled: true,
                    requiresSuperAdmin: false,
                    requiresWorkspaceAdmin: false
                })))
                .onConflictDoNothing({ target: [features.workspaceId, features.code] });

            const storedFeatures = await tx
                .select({ uuid: features.uuid, code: features.code })
                .from(features)
                .where(and(
                    eq(features.workspaceId, workspace.uuid),
                    inArray(features.code, SOCIAL_ASSISTANCE_FEATURES.map((feature) => feature.code))
                ));
            if (storedFeatures.length !== SOCIAL_ASSISTANCE_FEATURES.length) {
                throw new Error(`Could not resolve every social assistance feature for workspace ${workspace.uuid}`);
            }

            const existingWorkspaceLinks = await tx
                .select({ featureId: workspaceFeatures.featureId })
                .from(workspaceFeatures)
                .where(eq(workspaceFeatures.workspaceId, workspace.uuid));
            const linkedFeatureIds = new Set(existingWorkspaceLinks.map((link) => link.featureId));
            const newWorkspaceLinks = storedFeatures
                .filter((feature) => !linkedFeatureIds.has(feature.uuid))
                .map((feature) => ({ workspaceId: workspace.uuid, featureId: feature.uuid }));
            if (newWorkspaceLinks.length > 0) {
                await tx.insert(workspaceFeatures).values(newWorkspaceLinks);
            }

            const adminRoles = await tx
                .select({ id: roles.id })
                .from(roles)
                .where(and(eq(roles.workspaceId, workspace.uuid), inArray(roles.code, [...ADMIN_ROLE_CODES])));
            if (adminRoles.length === 0) continue;

            const roleFeatureRows = adminRoles.flatMap((role) => storedFeatures.map((feature) => ({
                roleId: role.id,
                featureId: feature.uuid
            })));
            await tx.insert(roleFeatures).values(roleFeatureRows).onConflictDoNothing();

            const rolePermissionRows = adminRoles.flatMap((role) => storedPermissions.flatMap((permission) =>
                permission.id == null ? [] : [{ roleId: role.id, permissionId: permission.id }]
            ));
            if (rolePermissionRows.length > 0) {
                await tx.insert(rolePermissions).values(rolePermissionRows).onConflictDoNothing();
            }
        }
    });

    console.info(`Seeded ${SOCIAL_ASSISTANCE_FEATURES.length} social assistance menu features for ${workspaceRows.length} workspaces`);
}

void seedSocialAssistanceFeatures()
    .catch((error: unknown) => {
        console.error("Failed to seed social assistance features", error);
        process.exitCode = 1;
    })
    .finally(async () => closeDbPool());

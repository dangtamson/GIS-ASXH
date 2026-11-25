import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getWardPublicLinkBySlug } from "@/handlers/admin/resources/poverty/poverty.repository.ts";
import { socialAssistancePublicPortals, workspaces } from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import { buildSocialAssistancePortalAliases } from "./portal.alias.ts";

export { createSocialAssistancePortalAlias } from "./portal.alias.ts";

const getWorkspaceAlias = async (workspaceId: string): Promise<string | null> => {
    const portalWorkspaces = await db
        .select({ workspaceId: socialAssistancePublicPortals.workspaceId, workspaceName: workspaces.name })
        .from(socialAssistancePublicPortals)
        .innerJoin(workspaces, eq(socialAssistancePublicPortals.workspaceId, workspaces.uuid));
    return buildSocialAssistancePortalAliases(portalWorkspaces).get(workspaceId) ?? null;
};

const withPublicAlias = async <TPortal extends { workspaceId: string }>(portal: TPortal) => ({
    ...portal,
    publicAlias: await getWorkspaceAlias(portal.workspaceId)
});

export const getOrCreateSocialAssistancePortal = async (workspaceId: string, actorId: string) => {
    const [existing] = await db
        .select()
        .from(socialAssistancePublicPortals)
        .where(eq(socialAssistancePublicPortals.workspaceId, workspaceId))
        .limit(1);
    if (existing) return withPublicAlias(existing);

    const publicSlug = `sa-${randomUUID().replaceAll("-", "")}`;
    const [created] = await db
        .insert(socialAssistancePublicPortals)
        .values({
            workspaceId,
            publicSlug,
            intakeEnabled: false,
            programsEnabled: false,
            resultsEnabled: false,
            allocationsEnabled: false,
            createdBy: actorId,
            updatedBy: actorId
        })
        .onConflictDoNothing({ target: socialAssistancePublicPortals.workspaceId })
        .returning();
    if (created) return withPublicAlias(created);

    const [concurrent] = await db
        .select()
        .from(socialAssistancePublicPortals)
        .where(eq(socialAssistancePublicPortals.workspaceId, workspaceId))
        .limit(1);
    return concurrent ? withPublicAlias(concurrent) : null;
};

export type SocialAssistancePortalUpdate = {
    intakeEnabled?: boolean;
    programsEnabled?: boolean;
    resultsEnabled?: boolean;
    allocationsEnabled?: boolean;
};

export const updateSocialAssistancePortal = async (
    workspaceId: string,
    actorId: string,
    settings: SocialAssistancePortalUpdate
) => {
    const [updated] = await db
        .update(socialAssistancePublicPortals)
        .set({ ...settings, updatedBy: actorId, updatedAt: new Date() })
        .where(eq(socialAssistancePublicPortals.workspaceId, workspaceId))
        .returning();

    return updated ? withPublicAlias(updated) : null;
};

export const resolveSocialAssistancePortalFromWardSlug = async (wardSlug: string) => {
    const wardShare = await getWardPublicLinkBySlug(wardSlug);
    if (!wardShare?.isPublic) return null;

    const [portal] = await db
        .select({ workspaceId: socialAssistancePublicPortals.workspaceId, publicSlug: socialAssistancePublicPortals.publicSlug, intakeEnabled: socialAssistancePublicPortals.intakeEnabled })
        .from(socialAssistancePublicPortals)
        .where(eq(socialAssistancePublicPortals.workspaceId, wardShare.workspaceId))
        .limit(1);

    if (!portal?.intakeEnabled) return null;
    return { publicSlug: await getWorkspaceAlias(portal.workspaceId) ?? portal.publicSlug };
};
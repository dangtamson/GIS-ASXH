import { and, asc, eq } from "drizzle-orm";
import { db } from "@/services/db/drizzle.ts";
import { socialAssistancePrograms } from "@/schema.ts";
import { getPublicPortalBySlug } from "./requests.repository.ts";
import type {
    SocialAssistanceProgramCreateInput,
    SocialAssistanceProgramUpdateInput
} from "./programs.schemas.ts";

export const createSocialAssistanceProgram = async (
    workspaceId: string,
    actorId: string,
    payload: SocialAssistanceProgramCreateInput
) => {
    const [created] = await db
        .insert(socialAssistancePrograms)
        .values({ workspaceId, ...payload, createdBy: actorId, updatedBy: actorId })
        .returning();
    return created ?? null;
};

export const listSocialAssistancePrograms = async (workspaceId: string, status?: string) => {
    const query = db
        .select()
        .from(socialAssistancePrograms)
        .where(
            status
                ? and(eq(socialAssistancePrograms.workspaceId, workspaceId), eq(socialAssistancePrograms.status, status))
                : eq(socialAssistancePrograms.workspaceId, workspaceId)
        )
        .orderBy(asc(socialAssistancePrograms.startDate));
    return query;
};

export const updateSocialAssistanceProgram = async (
    id: string,
    workspaceId: string,
    actorId: string,
    payload: SocialAssistanceProgramUpdateInput
) => {
    const [updated] = await db
        .update(socialAssistancePrograms)
        .set({ ...payload, updatedBy: actorId, updatedAt: new Date() })
        .where(and(eq(socialAssistancePrograms.id, id), eq(socialAssistancePrograms.workspaceId, workspaceId)))
        .returning();
    return updated ?? null;
};

export const listPublicSocialAssistancePrograms = async (slug: string) => {
    const portal = await getPublicPortalBySlug(slug, "programsEnabled");
    if (!portal) return null;

    return db
        .select({
            id: socialAssistancePrograms.id,
            title: socialAssistancePrograms.title,
            publicDescription: socialAssistancePrograms.publicDescription,
            category: socialAssistancePrograms.category,
            eligibilitySummary: socialAssistancePrograms.eligibilitySummary,
            startDate: socialAssistancePrograms.startDate,
            endDate: socialAssistancePrograms.endDate,
            status: socialAssistancePrograms.status
        })
        .from(socialAssistancePrograms)
        .where(and(eq(socialAssistancePrograms.workspaceId, portal.workspaceId), eq(socialAssistancePrograms.status, "PUBLISHED")))
        .orderBy(asc(socialAssistancePrograms.startDate));
};
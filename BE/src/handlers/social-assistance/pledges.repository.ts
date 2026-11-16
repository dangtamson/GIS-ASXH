import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/services/db/drizzle.ts";
import { socialAssistancePledges, socialAssistancePrograms } from "@/schema.ts";
import { getPublicPortalBySlug } from "./requests.repository.ts";
import {
    canTransitionSocialAssistancePledge,
    isPledgeReceiptComplete,
    type PublicSocialAssistancePledgeInput,
    type SocialAssistancePledgeReconciliationInput
} from "./pledges.schemas.ts";

export const createPublicSocialAssistancePledge = async (
    slug: string,
    input: PublicSocialAssistancePledgeInput,
    idempotencyKey: string
): Promise<{ pledgeId: string } | null> => {
    if (!idempotencyKey.trim()) throw new Error("Idempotency key is required");

    const portal = await getPublicPortalBySlug(slug, "programsEnabled");
    if (!portal) return null;

    const [program] = await db
        .select({ id: socialAssistancePrograms.id, status: socialAssistancePrograms.status })
        .from(socialAssistancePrograms)
        .where(
            and(
                eq(socialAssistancePrograms.id, input.programId),
                eq(socialAssistancePrograms.workspaceId, portal.workspaceId),
                eq(socialAssistancePrograms.status, "PUBLISHED")
            )
        )
        .limit(1);
    if (!program || program.status !== "PUBLISHED") return null;

    const idempotencyKeyHash = createHash("sha256").update(idempotencyKey).digest("hex");
    const [existing] = await db
        .select({ id: socialAssistancePledges.id })
        .from(socialAssistancePledges)
        .where(
            and(
                eq(socialAssistancePledges.portalId, portal.id),
                eq(socialAssistancePledges.idempotencyKeyHash, idempotencyKeyHash)
            )
        )
        .limit(1);
    if (existing) return { pledgeId: existing.id };

    const [created] = await db
        .insert(socialAssistancePledges)
        .values({
            workspaceId: portal.workspaceId,
            portalId: portal.id,
            programId: program.id,
            idempotencyKeyHash,
            donorType: input.donorType,
            donorName: input.donorName,
            contactPhone: input.contactPhone,
            contactEmail: input.contactEmail,
            pledgeType: input.pledgeType,
            pledgedAmount: input.pledgeType === "CASH" ? input.pledgedAmount : null,
            itemDescription: input.pledgeType === "IN_KIND" ? input.itemDescription : null,
            status: "PENDING_REVIEW",
            consentAt: new Date()
        })
        .onConflictDoNothing({
            target: [socialAssistancePledges.portalId, socialAssistancePledges.idempotencyKeyHash]
        })
        .returning({ id: socialAssistancePledges.id });

    if (created) return { pledgeId: created.id };

    const [concurrent] = await db
        .select({ id: socialAssistancePledges.id })
        .from(socialAssistancePledges)
        .where(
            and(
                eq(socialAssistancePledges.portalId, portal.id),
                eq(socialAssistancePledges.idempotencyKeyHash, idempotencyKeyHash)
            )
        )
        .limit(1);
    return concurrent ? { pledgeId: concurrent.id } : null;
};

export const listSocialAssistancePledges = async (workspaceId: string, status?: string) => {
    return db
        .select()
        .from(socialAssistancePledges)
        .where(
            status
                ? and(eq(socialAssistancePledges.workspaceId, workspaceId), eq(socialAssistancePledges.status, status))
                : eq(socialAssistancePledges.workspaceId, workspaceId)
        )
        .orderBy(desc(socialAssistancePledges.createdAt));
};

export const updateSocialAssistancePledgeReconciliation = async (
    id: string,
    workspaceId: string,
    actorId: string,
    payload: SocialAssistancePledgeReconciliationInput
) => {
    const [existing] = await db
        .select()
        .from(socialAssistancePledges)
        .where(and(eq(socialAssistancePledges.id, id), eq(socialAssistancePledges.workspaceId, workspaceId)))
        .limit(1);
    if (!existing) return null;
    if (!canTransitionSocialAssistancePledge(existing.status, payload.status)) return null;
    if (!isPledgeReceiptComplete(existing.pledgeType as "CASH" | "IN_KIND", payload)) return null;

    const [updated] = await db
        .update(socialAssistancePledges)
        .set({
            status: payload.status,
            receivedAmount: payload.receivedAmount ?? null,
            receivedDescription: payload.receivedDescription ?? null,
            reviewedBy: actorId,
            reviewedAt: new Date(),
            internalNote: payload.internalNote ?? null,
            updatedAt: new Date()
        })
        .where(and(eq(socialAssistancePledges.id, id), eq(socialAssistancePledges.workspaceId, workspaceId)))
        .returning();
    return updated ?? null;
};
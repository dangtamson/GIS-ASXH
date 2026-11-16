import {
    canTransitionSocialAssistanceAllocation,
    type SocialAssistanceAllocationCreateInput,
    type SocialAssistanceAllocationUpdateInput
} from "./allocations.schemas.ts";

import { and, desc, eq, inArray, or, type SQL } from "drizzle-orm";
import { getSocialAssistanceRequestById } from "./requests.repository.ts";
import { db } from "@/services/db/drizzle.ts";
import { householdSupports, socialAssistanceAllocations, socialAssistancePrograms, socialAssistanceRequests } from "@/schema.ts";
import type { PovertyAccessScope } from "@/handlers/admin/resources/poverty/poverty.scope.ts";

export const createSocialAssistanceAllocation = async (
    workspaceId: string,
    actorId: string,
    scope: PovertyAccessScope,
    payload: SocialAssistanceAllocationCreateInput
) => {
    const request = await getSocialAssistanceRequestById(payload.requestId, workspaceId, scope);
    if (!request || request.status !== "VERIFIED") return null;

    const [program] = await db
        .select({ id: socialAssistancePrograms.id, status: socialAssistancePrograms.status })
        .from(socialAssistancePrograms)
        .where(eq(socialAssistancePrograms.id, payload.programId))
        .limit(1);
    if (!program || program.status !== "PUBLISHED") return null;

    const priorSupports = request.matchedHouseholdId
        ? await db
            .select({ id: householdSupports.id })
            .from(householdSupports)
            .where(eq(householdSupports.householdId, request.matchedHouseholdId))
            .limit(100)
        : [];
    const priorAllocations = await db
        .select({ id: socialAssistanceAllocations.id })
        .from(socialAssistanceAllocations)
        .where(eq(socialAssistanceAllocations.requestId, request.id))
        .limit(100);

    const [item] = await db
        .insert(socialAssistanceAllocations)
        .values({
            workspaceId,
            programId: program.id,
            requestId: request.id,
            plannedCashAmount: payload.plannedCashAmount ?? null,
            plannedItemDescription: payload.plannedItemDescription ?? null,
            status: "PLANNED",
            createdBy: actorId,
            updatedBy: actorId,
            internalNote: payload.internalNote ?? null
        })
        .returning();

    return item ? { item, priorSupportCount: priorSupports.length + priorAllocations.length } : null;
};

export const updateSocialAssistanceAllocation = async (
    id: string,
    workspaceId: string,
    actorId: string,
    payload: SocialAssistanceAllocationUpdateInput
) => {
    const [existing] = await db
        .select()
        .from(socialAssistanceAllocations)
        .where(and(eq(socialAssistanceAllocations.id, id), eq(socialAssistanceAllocations.workspaceId, workspaceId)))
        .limit(1);
    if (!existing || !canTransitionSocialAssistanceAllocation(existing.status, payload.status)) return null;

    if (payload.status === "DELIVERED") {
        if (!payload.deliveryDate) return null;
        if (existing.plannedCashAmount !== null) {
            if (payload.deliveredCashAmount === undefined || payload.deliveredCashAmount > existing.plannedCashAmount) {
                return null;
            }
        } else if (!payload.deliveredItemDescription) {
            return null;
        }
    }

    const [updated] = await db
        .update(socialAssistanceAllocations)
        .set({
            status: payload.status,
            deliveredCashAmount: payload.deliveredCashAmount ?? existing.deliveredCashAmount,
            deliveredItemDescription: payload.deliveredItemDescription ?? existing.deliveredItemDescription,
            deliveryDate: payload.deliveryDate ?? existing.deliveryDate,
            internalNote: payload.internalNote ?? existing.internalNote,
            updatedBy: actorId,
            updatedAt: new Date()
        })
        .where(and(eq(socialAssistanceAllocations.id, id), eq(socialAssistanceAllocations.workspaceId, workspaceId)))
        .returning();

    return updated ?? null;
};

export const listSocialAssistanceAllocations = async (workspaceId: string, scope: PovertyAccessScope) => {
    if (!scope.isSuperAdmin && !scope.hasScope) return [];

    const requestConditions: SQL[] = [eq(socialAssistanceRequests.workspaceId, workspaceId)];
    if (!scope.isSuperAdmin) {
        const locationConditions: SQL[] = [];
        if (scope.areaIds.length > 0) locationConditions.push(inArray(socialAssistanceRequests.areaId, scope.areaIds));
        if (scope.wardCodes.length > 0) locationConditions.push(inArray(socialAssistanceRequests.wardCode, scope.wardCodes));
        if (scope.provinceCodes.length > 0) locationConditions.push(inArray(socialAssistanceRequests.provinceCode, scope.provinceCodes));
        const locationScope = locationConditions.length > 0 ? or(...locationConditions) : undefined;
        if (!locationScope) return [];
        requestConditions.push(locationScope);
    }

    const visibleRequests = await db
        .select({ id: socialAssistanceRequests.id })
        .from(socialAssistanceRequests)
        .where(and(...requestConditions))
        .orderBy(desc(socialAssistanceRequests.createdAt));
    const requestIds = visibleRequests.map((request) => request.id);
    if (requestIds.length === 0) return [];

    return db
        .select()
        .from(socialAssistanceAllocations)
        .where(
            and(
                eq(socialAssistanceAllocations.workspaceId, workspaceId),
                inArray(socialAssistanceAllocations.requestId, requestIds)
            )
        )
        .orderBy(desc(socialAssistanceAllocations.createdAt));
};
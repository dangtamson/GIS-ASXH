import { randomUUID } from "node:crypto";
import { and, eq, gte, inArray, isNull, lte, or, type SQL } from "drizzle-orm";
import { isLocationWithinScope, type PovertyAccessScope } from "@/handlers/admin/resources/poverty/poverty.scope.ts";
import {
    socialAssistanceAllocations,
    socialAssistancePrograms,
    socialAssistancePublications,
    socialAssistanceRequests
} from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import { getPublicPortalBySlug } from "./requests.repository.ts";
import type { SocialAssistancePublicationFilters } from "./publications.schemas.ts";

type PublicationAllocationRow = {
    requestId: string;
    programId: string;
    provinceCode: string;
    wardCode: string;
    areaId: string | null;
    deliveredCashAmount: number | null;
    deliveredItemDescription: string | null;
    status: string;
};

export const aggregateSocialAssistancePublicationRows = (
    allocations: PublicationAllocationRow[],
    filters: Pick<SocialAssistancePublicationFilters, "periodStart" | "periodEnd">
) => {
    type Group = {
        programId: string;
        provinceCode: string;
        wardCode: string;
        areaId: string | null;
        recipientIds: Set<string>;
        deliveredCashAmount: number;
        deliveredItemCount: number;
    };
    const groups = new Map<string, Group>();

    for (const allocation of allocations) {
        if (allocation.status !== "DELIVERED" && allocation.status !== "RECONCILED") continue;
        const key = [allocation.programId, allocation.provinceCode, allocation.wardCode, allocation.areaId ?? ""].join(":");
        let group = groups.get(key);
        if (!group) {
            group = {
                programId: allocation.programId,
                provinceCode: allocation.provinceCode,
                wardCode: allocation.wardCode,
                areaId: allocation.areaId,
                recipientIds: new Set(),
                deliveredCashAmount: 0,
                deliveredItemCount: 0
            };
            groups.set(key, group);
        }
        group.recipientIds.add(allocation.requestId);
        group.deliveredCashAmount += allocation.deliveredCashAmount ?? 0;
        if (allocation.deliveredItemDescription?.trim()) group.deliveredItemCount += 1;
    }

    return [...groups.values()]
        .map((group) => ({
            programId: group.programId,
            provinceCode: group.provinceCode,
            wardCode: group.wardCode,
            areaId: group.areaId,
            recipientCount: group.recipientIds.size,
            deliveredCashAmount: group.deliveredCashAmount,
            deliveredItemCount: group.deliveredItemCount,
            periodStart: filters.periodStart,
            periodEnd: filters.periodEnd
        }))
        .sort((left, right) => left.programId.localeCompare(right.programId)
            || left.provinceCode.localeCompare(right.provinceCode)
            || left.wardCode.localeCompare(right.wardCode)
            || (left.areaId ?? "").localeCompare(right.areaId ?? ""));
};

export const previewSocialAssistancePublication = async (
    workspaceId: string,
    scope: PovertyAccessScope,
    filters: SocialAssistancePublicationFilters
) => {
    if (!scope.isSuperAdmin && !scope.hasScope) return null;

    const conditions: SQL[] = [
        eq(socialAssistanceAllocations.workspaceId, workspaceId),
        eq(socialAssistanceRequests.workspaceId, workspaceId),
        inArray(socialAssistanceAllocations.status, ["DELIVERED", "RECONCILED"]),
        gte(socialAssistanceAllocations.deliveryDate, filters.periodStart),
        lte(socialAssistanceAllocations.deliveryDate, filters.periodEnd)
    ];
    if (filters.programId) conditions.push(eq(socialAssistanceAllocations.programId, filters.programId));
    if (filters.provinceCode) conditions.push(eq(socialAssistanceRequests.provinceCode, filters.provinceCode));
    if (filters.wardCode) conditions.push(eq(socialAssistanceRequests.wardCode, filters.wardCode));
    if (filters.areaId) conditions.push(eq(socialAssistanceRequests.areaId, filters.areaId));

    if (!scope.isSuperAdmin) {
        const locationConditions: SQL[] = [];
        if (scope.areaIds.length > 0) locationConditions.push(inArray(socialAssistanceRequests.areaId, scope.areaIds));
        if (scope.wardCodes.length > 0) locationConditions.push(inArray(socialAssistanceRequests.wardCode, scope.wardCodes));
        if (scope.provinceCodes.length > 0) {
            locationConditions.push(inArray(socialAssistanceRequests.provinceCode, scope.provinceCodes));
        }
        if (locationConditions.length === 0) return null;
        conditions.push(or(...locationConditions)!);
    }

    const rows = await db
        .select({
            requestId: socialAssistanceAllocations.requestId,
            programId: socialAssistanceAllocations.programId,
            provinceCode: socialAssistanceRequests.provinceCode,
            wardCode: socialAssistanceRequests.wardCode,
            areaId: socialAssistanceRequests.areaId,
            deliveredCashAmount: socialAssistanceAllocations.deliveredCashAmount,
            deliveredItemDescription: socialAssistanceAllocations.deliveredItemDescription,
            status: socialAssistanceAllocations.status
        })
        .from(socialAssistanceAllocations)
        .innerJoin(socialAssistanceRequests, eq(socialAssistanceAllocations.requestId, socialAssistanceRequests.id))
        .where(and(...conditions));

    return aggregateSocialAssistancePublicationRows(rows, filters);
};

export const getSocialAssistancePublicationOptions = async (workspaceId: string, scope: PovertyAccessScope) => {
    if (!scope.isSuperAdmin && !scope.hasScope) return null;

    const locationConditions: SQL[] = [];
    if (!scope.isSuperAdmin) {
        if (scope.areaIds.length > 0) locationConditions.push(inArray(socialAssistanceRequests.areaId, scope.areaIds));
        if (scope.wardCodes.length > 0) locationConditions.push(inArray(socialAssistanceRequests.wardCode, scope.wardCodes));
        if (scope.provinceCodes.length > 0) {
            locationConditions.push(inArray(socialAssistanceRequests.provinceCode, scope.provinceCodes));
        }
        if (locationConditions.length === 0) return null;
    }

    const programs = await db
        .select({ id: socialAssistancePrograms.id, title: socialAssistancePrograms.title })
        .from(socialAssistancePrograms)
        .where(eq(socialAssistancePrograms.workspaceId, workspaceId));
    const geographyConditions: SQL[] = [eq(socialAssistanceRequests.workspaceId, workspaceId)];
    if (!scope.isSuperAdmin) geographyConditions.push(or(...locationConditions)!);
    const geographies = await db
        .select({
            provinceCode: socialAssistanceRequests.provinceCode,
            wardCode: socialAssistanceRequests.wardCode
        })
        .from(socialAssistanceRequests)
        .where(and(...geographyConditions))
        .groupBy(socialAssistanceRequests.provinceCode, socialAssistanceRequests.wardCode);

    return { programs, geographies };
};

const publicationReturningFields = {
    id: socialAssistancePublications.id,
    publicationBatchId: socialAssistancePublications.publicationBatchId,
    periodStart: socialAssistancePublications.periodStart,
    periodEnd: socialAssistancePublications.periodEnd,
    programId: socialAssistancePublications.programId,
    provinceCode: socialAssistancePublications.provinceCode,
    wardCode: socialAssistancePublications.wardCode,
    areaId: socialAssistancePublications.areaId,
    recipientCount: socialAssistancePublications.recipientCount,
    deliveredCashAmount: socialAssistancePublications.deliveredCashAmount,
    deliveredItemCount: socialAssistancePublications.deliveredItemCount,
    status: socialAssistancePublications.status
};

export const createSocialAssistancePublicationDraft = async (
    workspaceId: string,
    actorId: string,
    scope: PovertyAccessScope,
    filters: SocialAssistancePublicationFilters
) => {
    const items = await previewSocialAssistancePublication(workspaceId, scope, filters);
    if (!items || items.length === 0) return null;

    const publicationBatchId = randomUUID();
    const inserted = await db
        .insert(socialAssistancePublications)
        .values(items.map((item) => ({
            ...item,
            publicationBatchId,
            workspaceId,
            createdBy: actorId,
            status: "DRAFT"
        })))
        .returning(publicationReturningFields);

    return { publicationBatchId, items: inserted };
};

export const approveSocialAssistancePublication = async (
    workspaceId: string,
    actorId: string,
    scope: PovertyAccessScope,
    publicationBatchId: string
) => db.transaction(async (transaction) => {
    const draftRows = await transaction
        .select()
        .from(socialAssistancePublications)
        .where(and(
            eq(socialAssistancePublications.workspaceId, workspaceId),
            eq(socialAssistancePublications.publicationBatchId, publicationBatchId),
            eq(socialAssistancePublications.status, "DRAFT")
        ));
    if (draftRows.length === 0 || draftRows.some((row) => !isLocationWithinScope(scope, row))) return null;

    for (const row of draftRows) {
        const conditions: SQL[] = [
            eq(socialAssistancePublications.workspaceId, workspaceId),
            eq(socialAssistancePublications.status, "PUBLISHED"),
            eq(socialAssistancePublications.periodStart, row.periodStart),
            eq(socialAssistancePublications.periodEnd, row.periodEnd),
            eq(socialAssistancePublications.programId, row.programId),
            eq(socialAssistancePublications.provinceCode, row.provinceCode),
            eq(socialAssistancePublications.wardCode, row.wardCode),
            row.areaId === null
                ? isNull(socialAssistancePublications.areaId)
                : eq(socialAssistancePublications.areaId, row.areaId)
        ];
        await transaction
            .update(socialAssistancePublications)
            .set({ status: "SUPERSEDED" })
            .where(and(...conditions));
    }

    const approvedAt = new Date();
    const items = await transaction
        .update(socialAssistancePublications)
        .set({ status: "PUBLISHED", approvedBy: actorId, approvedAt })
        .where(and(
            eq(socialAssistancePublications.workspaceId, workspaceId),
            eq(socialAssistancePublications.publicationBatchId, publicationBatchId),
            eq(socialAssistancePublications.status, "DRAFT")
        ))
        .returning(publicationReturningFields);

    return items.length > 0 ? { publicationBatchId, approvedAt, items } : null;
});

export const listPublicSocialAssistanceMap = async (slug: string) => {
    const portal = await getPublicPortalBySlug(slug, "resultsEnabled");
    if (!portal) return null;

    const rows = await db
        .select({
            periodStart: socialAssistancePublications.periodStart,
            periodEnd: socialAssistancePublications.periodEnd,
            programId: socialAssistancePublications.programId,
            programTitle: socialAssistancePrograms.title,
            provinceCode: socialAssistancePublications.provinceCode,
            wardCode: socialAssistancePublications.wardCode,
            recipientCount: socialAssistancePublications.recipientCount,
            deliveredCashAmount: socialAssistancePublications.deliveredCashAmount,
            deliveredItemCount: socialAssistancePublications.deliveredItemCount
        })
        .from(socialAssistancePublications)
        .innerJoin(socialAssistancePrograms, eq(socialAssistancePublications.programId, socialAssistancePrograms.id))
        .where(and(
            eq(socialAssistancePublications.workspaceId, portal.workspaceId),
            eq(socialAssistancePublications.status, "PUBLISHED"),
            eq(socialAssistancePrograms.workspaceId, portal.workspaceId)
        ));

    type PublicMapItem = {
        periodStart: string;
        periodEnd: string;
        programId: string;
        programTitle: string;
        provinceCode: string;
        wardCode: string;
        recipientCount: number;
        deliveredCashAmount: number;
        deliveredItemCount: number;
    };
    const grouped = new Map<string, PublicMapItem>();
    for (const row of rows) {
        const key = [row.periodStart, row.periodEnd, row.programId, row.provinceCode, row.wardCode].join(":");
        const existing = grouped.get(key);
        if (existing) {
            existing.recipientCount += row.recipientCount;
            existing.deliveredCashAmount += row.deliveredCashAmount;
            existing.deliveredItemCount += row.deliveredItemCount;
        } else {
            grouped.set(key, {
                periodStart: row.periodStart,
                periodEnd: row.periodEnd,
                programId: row.programId,
                programTitle: row.programTitle,
                provinceCode: row.provinceCode,
                wardCode: row.wardCode,
                recipientCount: row.recipientCount,
                deliveredCashAmount: row.deliveredCashAmount,
                deliveredItemCount: row.deliveredItemCount
            });
        }
    }
    return {
        items: [...grouped.values()].sort((left, right) => left.periodStart.localeCompare(right.periodStart)
            || left.programTitle.localeCompare(right.programTitle)
            || left.provinceCode.localeCompare(right.provinceCode)
            || left.wardCode.localeCompare(right.wardCode))
    };
};
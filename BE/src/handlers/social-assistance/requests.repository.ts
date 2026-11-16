import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { isLocationWithinScope, type PovertyAccessScope } from "@/handlers/admin/resources/poverty/poverty.scope.ts";
import { provinces, socialAssistancePublicPortals, socialAssistanceRequests, wards, workspaces } from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import { buildSocialAssistancePortalAliases } from "./portal.alias.ts";
import type {
    SocialAssistanceRequestStatus,
    SocialAssistanceSource
} from "./requests.schemas.ts";

export type PublicPortalFeature = "intakeEnabled" | "programsEnabled" | "resultsEnabled";

export type PublicRequestInput = {
    contactName: string;
    phone: string;
    needCategory: string;
    needDescription: string;
    address: string;
    provinceCode: string;
    wardCode: string;
    areaId?: string;
    latitude?: number;
    longitude?: number;
    source: Exclude<SocialAssistanceSource, "STAFF">;
};

export type SocialAssistanceRequestReviewFilters = {
    page: number;
    limit: number;
    status?: SocialAssistanceRequestStatus;
    provinceCode?: string;
    wardCode?: string;
    areaId?: string;
};

export const getPublicPortalBySlug = async (slug: string, feature: PublicPortalFeature) => {
    const [portal] = await db
        .select()
        .from(socialAssistancePublicPortals)
        .where(eq(socialAssistancePublicPortals.publicSlug, slug))
        .limit(1);

    if (portal) return portal[feature] ? portal : null;

    const aliasRows = await db
        .select({
            id: socialAssistancePublicPortals.id,
            workspaceId: socialAssistancePublicPortals.workspaceId,
            publicSlug: socialAssistancePublicPortals.publicSlug,
            intakeEnabled: socialAssistancePublicPortals.intakeEnabled,
            programsEnabled: socialAssistancePublicPortals.programsEnabled,
            resultsEnabled: socialAssistancePublicPortals.resultsEnabled,
            createdBy: socialAssistancePublicPortals.createdBy,
            updatedBy: socialAssistancePublicPortals.updatedBy,
            createdAt: socialAssistancePublicPortals.createdAt,
            updatedAt: socialAssistancePublicPortals.updatedAt,
            workspaceName: workspaces.name
        })
        .from(socialAssistancePublicPortals)
        .innerJoin(workspaces, eq(socialAssistancePublicPortals.workspaceId, workspaces.uuid));
    const aliases = buildSocialAssistancePortalAliases(aliasRows);
    const match = aliasRows.find((row) => aliases.get(row.workspaceId) === slug);
    if (!match) return null;

    const { workspaceName: _workspaceName, ...resolvedPortal } = match;
    return resolvedPortal[feature] ? resolvedPortal : null;
};

export const hashIdempotencyKey = (key: string): string => createHash("sha256").update(key).digest("hex");

export const listPublicSocialAssistanceProvinces = async (slug: string) => {
    const portal = await getPublicPortalBySlug(slug, "intakeEnabled");
    if (!portal) return null;

    return db
        .select({ code: provinces.code, name: provinces.name, fullName: provinces.fullName })
        .from(provinces)
        .orderBy(asc(provinces.name));
};

export const listPublicSocialAssistanceWards = async (slug: string, provinceCode: string) => {
    const portal = await getPublicPortalBySlug(slug, "intakeEnabled");
    if (!portal) return null;

    return db
        .select({ code: wards.code, name: wards.name, fullName: wards.fullName })
        .from(wards)
        .where(eq(wards.provinceCode, provinceCode))
        .orderBy(asc(wards.name));
};

const findRequestReceipt = async (portalId: string, idempotencyKeyHash: string) => {
    const [request] = await db
        .select({ receiptCode: socialAssistanceRequests.receiptCode })
        .from(socialAssistanceRequests)
        .where(
            and(
                eq(socialAssistanceRequests.portalId, portalId),
                eq(socialAssistanceRequests.idempotencyKeyHash, idempotencyKeyHash)
            )
        )
        .limit(1);

    return request?.receiptCode ?? null;
};

export const createPublicRequest = async (
    slug: string,
    input: PublicRequestInput,
    idempotencyKey: string
): Promise<{ receiptCode: string } | null> => {
    if (!idempotencyKey.trim()) {
        throw new Error("Idempotency key is required");
    }

    const portal = await getPublicPortalBySlug(slug, "intakeEnabled");
    if (!portal) return null;

    const idempotencyKeyHash = hashIdempotencyKey(idempotencyKey);
    const existingReceipt = await findRequestReceipt(portal.id, idempotencyKeyHash);
    if (existingReceipt) return { receiptCode: existingReceipt };

    const receiptCode = `SA-${randomUUID()}`;
    const [created] = await db
        .insert(socialAssistanceRequests)
        .values({
            workspaceId: portal.workspaceId,
            portalId: portal.id,
            receiptCode,
            idempotencyKeyHash,
            source: input.source,
            contactName: input.contactName,
            phone: input.phone,
            needCategory: input.needCategory,
            needDescription: input.needDescription,
            address: input.address,
            provinceCode: input.provinceCode,
            wardCode: input.wardCode,
            areaId: input.areaId,
            latitude: input.latitude,
            longitude: input.longitude,
            consentAt: new Date()
        })
        .onConflictDoNothing({
            target: [socialAssistanceRequests.portalId, socialAssistanceRequests.idempotencyKeyHash]
        })
        .returning({ receiptCode: socialAssistanceRequests.receiptCode });

    if (created) return { receiptCode: created.receiptCode };

    const concurrentReceipt = await findRequestReceipt(portal.id, idempotencyKeyHash);
    if (concurrentReceipt) return { receiptCode: concurrentReceipt };

    throw new Error("Could not create social assistance request");
};

export const getSocialAssistanceRequestById = async (
    id: string,
    workspaceId: string,
    scope: PovertyAccessScope
) => {
    const [request] = await db
        .select()
        .from(socialAssistanceRequests)
        .where(and(eq(socialAssistanceRequests.id, id), eq(socialAssistanceRequests.workspaceId, workspaceId)))
        .limit(1);

    if (!request || !isLocationWithinScope(scope, request)) return null;
    return request;
};

export const listSocialAssistanceRequests = async (
    workspaceId: string,
    scope: PovertyAccessScope,
    filters: SocialAssistanceRequestReviewFilters
) => {
    const { page, limit } = filters;
    const conditions: SQL[] = [eq(socialAssistanceRequests.workspaceId, workspaceId)];

    if (!scope.isSuperAdmin) {
        if (!scope.hasScope) return { items: [], hasMore: false, page, limit };

        const locationConditions: SQL[] = [];
        if (scope.areaIds.length > 0) locationConditions.push(inArray(socialAssistanceRequests.areaId, scope.areaIds));
        if (scope.wardCodes.length > 0) locationConditions.push(inArray(socialAssistanceRequests.wardCode, scope.wardCodes));
        if (scope.provinceCodes.length > 0) {
            locationConditions.push(inArray(socialAssistanceRequests.provinceCode, scope.provinceCodes));
        }
        if (locationConditions.length === 0) return { items: [], hasMore: false, page, limit };

        const locationScope = or(...locationConditions);
        if (locationScope) conditions.push(locationScope);
    }

    if (filters.status) conditions.push(eq(socialAssistanceRequests.status, filters.status));
    if (filters.provinceCode) conditions.push(eq(socialAssistanceRequests.provinceCode, filters.provinceCode));
    if (filters.wardCode) conditions.push(eq(socialAssistanceRequests.wardCode, filters.wardCode));
    if (filters.areaId) conditions.push(eq(socialAssistanceRequests.areaId, filters.areaId));

    const rows = await db
        .select()
        .from(socialAssistanceRequests)
        .where(and(...conditions))
        .orderBy(desc(socialAssistanceRequests.createdAt))
        .limit(limit + 1)
        .offset((page - 1) * limit);

    return {
        items: rows.slice(0, limit),
        hasMore: rows.length > limit,
        page,
        limit
    };
};

export const findPotentialDuplicateRequests = async (
    workspaceId: string,
    input: { requestId: string; phone: string; provinceCode: string; wardCode: string }
) => {
    const digits = input.phone.replace(/\D/g, "");
    const normalizedPhone = digits.startsWith("84") && digits.length >= 10 ? `0${digits.slice(2)}` : digits;
    if (normalizedPhone.length < 8) return [];

    return db
        .select({
            id: socialAssistanceRequests.id,
            receiptCode: socialAssistanceRequests.receiptCode,
            status: socialAssistanceRequests.status,
            needCategory: socialAssistanceRequests.needCategory,
            createdAt: socialAssistanceRequests.createdAt
        })
        .from(socialAssistanceRequests)
        .where(
            and(
                eq(socialAssistanceRequests.workspaceId, workspaceId),
                eq(socialAssistanceRequests.provinceCode, input.provinceCode),
                eq(socialAssistanceRequests.wardCode, input.wardCode),
                ne(socialAssistanceRequests.id, input.requestId),
                ne(socialAssistanceRequests.status, "REJECTED"),
                sql`regexp_replace(${socialAssistanceRequests.phone}, '[^0-9]', '', 'g') = ${normalizedPhone}`
            )
        )
        .orderBy(desc(socialAssistanceRequests.createdAt))
        .limit(5)
        .offset(0);
};

export const updateSocialAssistanceRequestStatus = async (
    id: string,
    workspaceId: string,
    scope: PovertyAccessScope,
    status: SocialAssistanceRequestStatus,
    internalReason: string | undefined,
    actorId: string
) => {
    const existing = await getSocialAssistanceRequestById(id, workspaceId, scope);
    if (!existing) return null;

    const whereConditions = [
        eq(socialAssistanceRequests.id, id),
        eq(socialAssistanceRequests.workspaceId, workspaceId),
        eq(socialAssistanceRequests.provinceCode, existing.provinceCode),
        eq(socialAssistanceRequests.wardCode, existing.wardCode)
    ];
    if (existing.areaId) {
        whereConditions.push(eq(socialAssistanceRequests.areaId, existing.areaId));
    }

    const now = new Date();
    const updateData = {
        status,
        internalReason: internalReason ?? null,
        updatedAt: now,
        ...(status === "VERIFIED" ? { verifiedBy: actorId, verifiedAt: now } : {})
    };
    const [updated] = await db
        .update(socialAssistanceRequests)
        .set(updateData)
        .where(and(...whereConditions))
        .returning();

    return updated ?? null;
};
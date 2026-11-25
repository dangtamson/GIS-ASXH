import { and, asc, desc, eq, inArray, isNotNull, type SQL } from "drizzle-orm";
import {
    isLocationWithinScope,
    type PovertyAccessScope
} from "@/handlers/admin/resources/poverty/poverty.scope.ts";
import {
    socialAssistanceDistributionBatches,
    socialAssistanceDistributionLines,
    socialAssistancePrograms,
    provinces,
    wards
} from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import type { DbTransaction } from "@/types/database.ts";
import { getPublicPortalBySlug } from "./requests.repository.ts";
import {
    distributionBatchCreateSchema,
    type DistributionBatchCreateInput,
    type DistributionBatchStatus
} from "./distribution-batches.schemas.ts";

export type DistributionBatchFilters = {
    status?: DistributionBatchStatus;
    programId?: string;
    documentNumber?: string;
};

export type PublicDistributionBatchFilters = {
    provinceCode?: string;
    wardCode?: string;
};

type PublicDistributionLine = DistributionLine & {
    provinceName: string | null;
    wardName: string | null;
};

type DistributionLine = {
    provinceCode: string;
    wardCode: string;
    allocatedQuantity: number;
};

type DistributionBatch = typeof socialAssistanceDistributionBatches.$inferSelect;
type DistributionBatchWithLines = DistributionBatch & { lines: DistributionLine[] };
type StoredDistributionLine = typeof socialAssistanceDistributionLines.$inferSelect;
type StoredDistributionLineWithBatch = Pick<StoredDistributionLine, "batchId" | "provinceCode" | "wardCode" | "allocatedQuantity">;
type PublicDistributionBatch = Pick<DistributionBatch,
    | "documentNumber"
    | "documentDate"
    | "title"
    | "fundingSourceText"
    | "supportItemName"
    | "unitLabel"
    | "unitAmount"
    | "declaredTotalQuantity"
    | "declaredTotalAmount"
    | "eligibilitySummary"
    | "eligibilityApprovalYear"
    | "submissionDeadline"
    | "completionDeadline"
    | "status"
    | "publishedAt"
> & { programTitle: string | null; lines: PublicDistributionLine[] };

const lineIsInScope = (scope: PovertyAccessScope, line: DistributionLine): boolean =>
    isLocationWithinScope(scope, line);

const batchIsInScope = (scope: PovertyAccessScope, lines: DistributionLine[]): boolean =>
    scope.isSuperAdmin || (scope.hasScope && lines.length > 0 && lines.every((line) => lineIsInScope(scope, line)));

const inputIsInScope = (scope: PovertyAccessScope, lines: DistributionLine[]): boolean =>
    lines.length > 0 && (scope.isSuperAdmin || (scope.hasScope && lines.every((line) => lineIsInScope(scope, line))));

const getLinesByBatch = async (transaction: DbTransaction, batchId: string): Promise<DistributionLine[]> => transaction
    .select({
        provinceCode: socialAssistanceDistributionLines.provinceCode,
        wardCode: socialAssistanceDistributionLines.wardCode,
        allocatedQuantity: socialAssistanceDistributionLines.allocatedQuantity
    })
    .from(socialAssistanceDistributionLines)
    .where(eq(socialAssistanceDistributionLines.batchId, batchId))
    .orderBy(asc(socialAssistanceDistributionLines.provinceCode), asc(socialAssistanceDistributionLines.wardCode));

const canReferenceRecords = async (
    transaction: DbTransaction,
    workspaceId: string,
    input: DistributionBatchCreateInput
): Promise<boolean> => {
    if (input.programId) {
        const [program] = await transaction
            .select({ id: socialAssistancePrograms.id })
            .from(socialAssistancePrograms)
            .where(and(
                eq(socialAssistancePrograms.id, input.programId),
                eq(socialAssistancePrograms.workspaceId, workspaceId)
            ))
            .limit(1);
        if (!program) return false;
    }

    if (input.supersedesBatchId) {
        const [superseded] = await transaction
            .select({ id: socialAssistanceDistributionBatches.id })
            .from(socialAssistanceDistributionBatches)
            .where(and(
                eq(socialAssistanceDistributionBatches.id, input.supersedesBatchId),
                eq(socialAssistanceDistributionBatches.workspaceId, workspaceId),
                isNotNull(socialAssistanceDistributionBatches.publishedAt)
            ))
            .limit(1);
        if (!superseded) return false;
    }

    return true;
};

const getBatchLines = async (batchId: string): Promise<DistributionLine[]> => db
    .select({
        provinceCode: socialAssistanceDistributionLines.provinceCode,
        wardCode: socialAssistanceDistributionLines.wardCode,
        allocatedQuantity: socialAssistanceDistributionLines.allocatedQuantity
    })
    .from(socialAssistanceDistributionLines)
    .where(eq(socialAssistanceDistributionLines.batchId, batchId))
    .orderBy(asc(socialAssistanceDistributionLines.provinceCode), asc(socialAssistanceDistributionLines.wardCode));

const linesForBatchIds = async (batchIds: string[]): Promise<StoredDistributionLineWithBatch[]> => {
    if (batchIds.length === 0) return [];
    return db
        .select({
            batchId: socialAssistanceDistributionLines.batchId,
            provinceCode: socialAssistanceDistributionLines.provinceCode,
            wardCode: socialAssistanceDistributionLines.wardCode,
            allocatedQuantity: socialAssistanceDistributionLines.allocatedQuantity
        })
        .from(socialAssistanceDistributionLines)
        .where(inArray(socialAssistanceDistributionLines.batchId, batchIds))
        .orderBy(asc(socialAssistanceDistributionLines.provinceCode), asc(socialAssistanceDistributionLines.wardCode));
};

const toLineInsertRows = (
    workspaceId: string,
    batchId: string,
    lines: DistributionLine[]
): Array<typeof socialAssistanceDistributionLines.$inferInsert> =>
    lines.map((line) => ({ ...line, workspaceId, batchId }));

const toBatchValues = (input: DistributionBatchCreateInput): Omit<DistributionBatchCreateInput, "lines"> => {
    const { lines: _lines, ...batch } = input;
    return batch;
};

export const listDistributionBatches = async (
    workspaceId: string,
    scope: PovertyAccessScope,
    filters: DistributionBatchFilters = {}
): Promise<DistributionBatchWithLines[]> => {
    if (!scope.isSuperAdmin && !scope.hasScope) return [];

    const conditions: SQL[] = [eq(socialAssistanceDistributionBatches.workspaceId, workspaceId)];
    if (filters.status) conditions.push(eq(socialAssistanceDistributionBatches.status, filters.status));
    if (filters.programId) conditions.push(eq(socialAssistanceDistributionBatches.programId, filters.programId));
    if (filters.documentNumber) {
        conditions.push(eq(socialAssistanceDistributionBatches.documentNumber, filters.documentNumber));
    }

    const batches = await db
        .select()
        .from(socialAssistanceDistributionBatches)
        .where(and(...conditions))
        .orderBy(desc(socialAssistanceDistributionBatches.documentDate));
    const lines = await linesForBatchIds(batches.map((batch) => batch.id));
    const linesByBatchId = new Map<string, typeof lines>();
    for (const line of lines) {
        const batchLines = linesByBatchId.get(line.batchId) ?? [];
        batchLines.push(line);
        linesByBatchId.set(line.batchId, batchLines);
    }

    return batches.flatMap((batch) => {
        const batchLines = linesByBatchId.get(batch.id) ?? [];
        if (!batchIsInScope(scope, batchLines)) return [];
        return [{
            ...batch, lines: batchLines.map(({ provinceCode, wardCode, allocatedQuantity }) => ({
                provinceCode,
                wardCode,
                allocatedQuantity
            }))
        }];
    });
};

export const getDistributionBatch = async (
    workspaceId: string,
    scope: PovertyAccessScope,
    batchId: string
): Promise<DistributionBatchWithLines | null> => {
    const [batch] = await db
        .select()
        .from(socialAssistanceDistributionBatches)
        .where(and(
            eq(socialAssistanceDistributionBatches.id, batchId),
            eq(socialAssistanceDistributionBatches.workspaceId, workspaceId)
        ))
        .limit(1);
    if (!batch) return null;

    const lines = await getBatchLines(batch.id);
    if (!batchIsInScope(scope, lines)) return null;
    return { ...batch, lines };
};

export const createDistributionBatch = async (
    workspaceId: string,
    actorId: string,
    scope: PovertyAccessScope,
    input: DistributionBatchCreateInput
): Promise<DistributionBatchWithLines | null> => {
    const validatedInput = distributionBatchCreateSchema.parse(input);
    if (!inputIsInScope(scope, validatedInput.lines)) return null;

    return db.transaction(async (transaction) => {
        if (!await canReferenceRecords(transaction, workspaceId, validatedInput)) return null;

        const [batch] = await transaction
            .insert(socialAssistanceDistributionBatches)
            .values({
                ...toBatchValues(validatedInput),
                workspaceId,
                status: "DRAFT",
                createdBy: actorId,
                updatedBy: actorId
            })
            .returning();
        if (!batch) return null;

        await transaction
            .insert(socialAssistanceDistributionLines)
            .values(toLineInsertRows(workspaceId, batch.id, validatedInput.lines));

        return { ...batch, lines: validatedInput.lines };
    });
};

export const updateDraftDistributionBatch = async (
    workspaceId: string,
    actorId: string,
    scope: PovertyAccessScope,
    batchId: string,
    input: DistributionBatchCreateInput
): Promise<DistributionBatchWithLines | null> => {
    const validatedInput = distributionBatchCreateSchema.parse(input);
    if (!inputIsInScope(scope, validatedInput.lines)) return null;

    return db.transaction(async (transaction) => {
        const [current] = await transaction
            .select()
            .from(socialAssistanceDistributionBatches)
            .where(and(
                eq(socialAssistanceDistributionBatches.id, batchId),
                eq(socialAssistanceDistributionBatches.workspaceId, workspaceId),
                eq(socialAssistanceDistributionBatches.status, "DRAFT")
            ))
            .limit(1);
        if (!current) return null;

        const currentLines = await getLinesByBatch(transaction, batchId);
        if (!batchIsInScope(scope, currentLines)) return null;
        if (!await canReferenceRecords(transaction, workspaceId, validatedInput)) return null;

        const [updated] = await transaction
            .update(socialAssistanceDistributionBatches)
            .set({ ...toBatchValues(validatedInput), updatedBy: actorId, updatedAt: new Date() })
            .where(and(
                eq(socialAssistanceDistributionBatches.id, batchId),
                eq(socialAssistanceDistributionBatches.workspaceId, workspaceId),
                eq(socialAssistanceDistributionBatches.status, "DRAFT")
            ))
            .returning();
        if (!updated) return null;

        await transaction
            .delete(socialAssistanceDistributionLines)
            .where(eq(socialAssistanceDistributionLines.batchId, batchId));
        await transaction
            .insert(socialAssistanceDistributionLines)
            .values(toLineInsertRows(workspaceId, batchId, validatedInput.lines));

        return { ...updated, lines: validatedInput.lines };
    });
};

const batchIsPublishable = (
    batch: DistributionBatch,
    lines: DistributionLine[]
): boolean => distributionBatchCreateSchema.safeParse({
    programId: batch.programId,
    supersedesBatchId: batch.supersedesBatchId,
    documentNumber: batch.documentNumber,
    documentDate: batch.documentDate,
    title: batch.title,
    fundingSourceText: batch.fundingSourceText,
    supportItemName: batch.supportItemName,
    unitLabel: batch.unitLabel,
    unitAmount: batch.unitAmount,
    declaredTotalQuantity: batch.declaredTotalQuantity,
    declaredTotalAmount: batch.declaredTotalAmount,
    eligibilitySummary: batch.eligibilitySummary,
    eligibilityApprovalYear: batch.eligibilityApprovalYear,
    submissionDeadline: batch.submissionDeadline,
    completionDeadline: batch.completionDeadline,
    lines: lines.map(({ provinceCode, wardCode, allocatedQuantity }) => ({
        provinceCode,
        wardCode,
        allocatedQuantity
    }))
}).success;

export const publishDistributionBatch = async (
    workspaceId: string,
    actorId: string,
    scope: PovertyAccessScope,
    batchId: string
): Promise<DistributionBatchWithLines | null> => db.transaction(async (transaction) => {
    const [batch] = await transaction
        .select()
        .from(socialAssistanceDistributionBatches)
        .where(and(
            eq(socialAssistanceDistributionBatches.id, batchId),
            eq(socialAssistanceDistributionBatches.workspaceId, workspaceId),
            eq(socialAssistanceDistributionBatches.status, "DRAFT")
        ))
        .limit(1);
    if (!batch) return null;

    const lines = await getLinesByBatch(transaction, batchId);
    if (!batchIsInScope(scope, lines) || !batchIsPublishable(batch, lines)) return null;

    const publishedAt = new Date();
    const [published] = await transaction
        .update(socialAssistanceDistributionBatches)
        .set({ status: "PUBLISHED", publishedBy: actorId, publishedAt, updatedBy: actorId, updatedAt: publishedAt })
        .where(and(
            eq(socialAssistanceDistributionBatches.id, batchId),
            eq(socialAssistanceDistributionBatches.workspaceId, workspaceId),
            eq(socialAssistanceDistributionBatches.status, "DRAFT")
        ))
        .returning();

    return published ? { ...published, lines } : null;
});

export const closeDistributionBatch = async (
    workspaceId: string,
    actorId: string,
    scope: PovertyAccessScope,
    batchId: string
): Promise<DistributionBatchWithLines | null> => db.transaction(async (transaction) => {
    const [batch] = await transaction
        .select()
        .from(socialAssistanceDistributionBatches)
        .where(and(
            eq(socialAssistanceDistributionBatches.id, batchId),
            eq(socialAssistanceDistributionBatches.workspaceId, workspaceId),
            eq(socialAssistanceDistributionBatches.status, "PUBLISHED"),
            isNotNull(socialAssistanceDistributionBatches.publishedAt)
        ))
        .limit(1);
    if (!batch) return null;

    const lines = await getLinesByBatch(transaction, batchId);
    if (!batchIsInScope(scope, lines)) return null;

    const closedAt = new Date();
    const [closed] = await transaction
        .update(socialAssistanceDistributionBatches)
        .set({ status: "CLOSED", closedBy: actorId, closedAt, updatedBy: actorId, updatedAt: closedAt })
        .where(and(
            eq(socialAssistanceDistributionBatches.id, batchId),
            eq(socialAssistanceDistributionBatches.workspaceId, workspaceId),
            eq(socialAssistanceDistributionBatches.status, "PUBLISHED")
        ))
        .returning();

    return closed ? { ...closed, lines } : null;
});

export const listPublicDistributionBatches = async (
    slug: string,
    filters: PublicDistributionBatchFilters = {}
): Promise<PublicDistributionBatch[] | null> => {
    const portal = await getPublicPortalBySlug(slug, "allocationsEnabled");
    if (!portal) return null;

    const batches = await db
        .select({
            documentNumber: socialAssistanceDistributionBatches.documentNumber,
            documentDate: socialAssistanceDistributionBatches.documentDate,
            title: socialAssistanceDistributionBatches.title,
            fundingSourceText: socialAssistanceDistributionBatches.fundingSourceText,
            supportItemName: socialAssistanceDistributionBatches.supportItemName,
            unitLabel: socialAssistanceDistributionBatches.unitLabel,
            unitAmount: socialAssistanceDistributionBatches.unitAmount,
            declaredTotalQuantity: socialAssistanceDistributionBatches.declaredTotalQuantity,
            declaredTotalAmount: socialAssistanceDistributionBatches.declaredTotalAmount,
            eligibilitySummary: socialAssistanceDistributionBatches.eligibilitySummary,
            eligibilityApprovalYear: socialAssistanceDistributionBatches.eligibilityApprovalYear,
            submissionDeadline: socialAssistanceDistributionBatches.submissionDeadline,
            completionDeadline: socialAssistanceDistributionBatches.completionDeadline,
            status: socialAssistanceDistributionBatches.status,
            publishedAt: socialAssistanceDistributionBatches.publishedAt,
            id: socialAssistanceDistributionBatches.id,
            programTitle: socialAssistancePrograms.title
        })
        .from(socialAssistanceDistributionBatches)
        .leftJoin(socialAssistancePrograms, and(
            eq(socialAssistancePrograms.id, socialAssistanceDistributionBatches.programId),
            eq(socialAssistancePrograms.workspaceId, portal.workspaceId)
        ))
        .where(and(
            eq(socialAssistanceDistributionBatches.workspaceId, portal.workspaceId),
            inArray(socialAssistanceDistributionBatches.status, ["PUBLISHED", "CLOSED"]),
            isNotNull(socialAssistanceDistributionBatches.publishedAt)
        ))
        .orderBy(desc(socialAssistanceDistributionBatches.documentDate));

    const eligibleBatches = batches.filter((batch) =>
        (batch.status === "PUBLISHED" || batch.status === "CLOSED") && batch.publishedAt !== null
    );
    const batchIds = eligibleBatches.map((batch) => batch.id);
    const lines = batchIds.length === 0 ? [] : await db
        .select({
            batchId: socialAssistanceDistributionLines.batchId,
            provinceCode: socialAssistanceDistributionLines.provinceCode,
            wardCode: socialAssistanceDistributionLines.wardCode,
            allocatedQuantity: socialAssistanceDistributionLines.allocatedQuantity,
            provinceName: provinces.fullName,
            wardName: wards.fullName
        })
        .from(socialAssistanceDistributionLines)
        .leftJoin(provinces, eq(provinces.code, socialAssistanceDistributionLines.provinceCode))
        .leftJoin(wards, and(
            eq(wards.code, socialAssistanceDistributionLines.wardCode),
            eq(wards.provinceCode, socialAssistanceDistributionLines.provinceCode)
        ))
        .where(inArray(socialAssistanceDistributionLines.batchId, batchIds))
        .orderBy(asc(socialAssistanceDistributionLines.provinceCode), asc(socialAssistanceDistributionLines.wardCode));
    const filteredLines = lines.filter((line) =>
        (!filters.provinceCode || line.provinceCode === filters.provinceCode)
        && (!filters.wardCode || line.wardCode === filters.wardCode)
    );
    const linesByBatchId = new Map<string, typeof filteredLines>();
    for (const line of filteredLines) {
        const batchLines = linesByBatchId.get(line.batchId) ?? [];
        batchLines.push(line);
        linesByBatchId.set(line.batchId, batchLines);
    }

    return eligibleBatches.flatMap((batch) => {
        const batchLines = linesByBatchId.get(batch.id) ?? [];
        if ((filters.provinceCode || filters.wardCode) && batchLines.length === 0) return [];
        return [{
            documentNumber: batch.documentNumber,
            documentDate: batch.documentDate,
            title: batch.title,
            fundingSourceText: batch.fundingSourceText,
            supportItemName: batch.supportItemName,
            unitLabel: batch.unitLabel,
            unitAmount: batch.unitAmount,
            declaredTotalQuantity: batch.declaredTotalQuantity,
            declaredTotalAmount: batch.declaredTotalAmount,
            eligibilitySummary: batch.eligibilitySummary,
            eligibilityApprovalYear: batch.eligibilityApprovalYear,
            submissionDeadline: batch.submissionDeadline,
            completionDeadline: batch.completionDeadline,
            status: batch.status,
            publishedAt: batch.publishedAt,
            programTitle: batch.programTitle,
            lines: batchLines.map(({ provinceCode, wardCode, allocatedQuantity, provinceName, wardName }) => ({
                provinceCode,
                wardCode,
                allocatedQuantity,
                provinceName,
                wardName
            }))
        }];
    });
};
import { beforeEach, describe, expect, it, vi } from "vitest";

const { select, transaction, getPublicPortalBySlug } = vi.hoisted(() => ({
    select: vi.fn(),
    transaction: vi.fn(),
    getPublicPortalBySlug: vi.fn()
}));

vi.mock("@/services/db/drizzle.ts", () => ({ db: { select, transaction } }));
vi.mock("./requests.repository.ts", () => ({ getPublicPortalBySlug }));

import { socialAssistanceDistributionBatches, socialAssistanceDistributionLines } from "@/schema.ts";
import type { PovertyAccessScope } from "@/handlers/admin/resources/poverty/poverty.scope.ts";
import {
    createDistributionBatch,
    listPublicDistributionBatches,
    closeDistributionBatch,
    publishDistributionBatch
} from "./distribution-batches.repository.ts";
import type { DistributionBatchCreateInput } from "./distribution-batches.schemas.ts";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const actorId = "22222222-2222-4222-8222-222222222222";
const batchId = "33333333-3333-4333-8333-333333333333";

const superAdminScope: PovertyAccessScope = {
    organizationIds: [],
    provinceCodes: [],
    wardCodes: [],
    areaIds: [],
    isBranchAdmin: false,
    isSuperAdmin: true,
    hasScope: true
};

const createInput: DistributionBatchCreateInput = {
    documentNumber: "1440/QD-UBND",
    documentDate: "2026-10-12",
    title: "Housing support allocation",
    fundingSourceText: "Provincial budget reserve",
    supportItemName: "Housing repair grant",
    unitLabel: "household",
    unitAmount: 80_000_000,
    declaredTotalQuantity: 19,
    declaredTotalAmount: 1_520_000_000,
    eligibilitySummary: "Approved poor households under the 2025 review",
    eligibilityApprovalYear: 2025,
    lines: Array.from({ length: 19 }, (_, index) => ({
        provinceCode: "92",
        wardCode: String(31000 + index),
        allocatedQuantity: 1
    }))
};

const makeQuery = (result: unknown): {
    from: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
} => {
    const orderBy = vi.fn().mockResolvedValue(result);
    const where = vi.fn().mockReturnValue({ orderBy });
    const query: { where: ReturnType<typeof vi.fn>; orderBy: ReturnType<typeof vi.fn>; leftJoin?: ReturnType<typeof vi.fn> } = { where, orderBy };
    const leftJoin = vi.fn().mockReturnValue(query);
    query.leftJoin = leftJoin;
    const from = vi.fn().mockReturnValue(query);
    return { from, where, orderBy };
};

describe("social assistance distribution batch repository", () => {
    beforeEach(() => vi.clearAllMocks());

    it("stores the batch header and all locality lines in one transaction", async () => {
        const header = { id: batchId, workspaceId, ...createInput, status: "DRAFT" };
        const headerReturning = vi.fn().mockResolvedValue([header]);
        const headerValues = vi.fn().mockReturnValue({ returning: headerReturning });
        const lineValues = vi.fn().mockResolvedValue([]);
        const tx = {
            insert: vi.fn((table) => table === socialAssistanceDistributionBatches
                ? { values: headerValues }
                : { values: lineValues })
        };
        transaction.mockImplementation((callback: (tx: unknown) => Promise<unknown>) => callback(tx));

        await createDistributionBatch(workspaceId, actorId, superAdminScope, createInput);

        expect(transaction).toHaveBeenCalledTimes(1);
        expect(headerValues).toHaveBeenCalledWith(expect.objectContaining({ workspaceId, createdBy: actorId }));
        expect(tx.insert).toHaveBeenNthCalledWith(2, socialAssistanceDistributionLines);
        expect(lineValues).toHaveBeenCalledWith(createInput.lines.map((line) => ({ ...line, batchId, workspaceId })));
    });

    it("rejects a batch that contains a locality outside the actor scope", async () => {
        const restrictedScope: PovertyAccessScope = {
            ...superAdminScope,
            isSuperAdmin: false,
            provinceCodes: ["91"]
        };

        await expect(createDistributionBatch(workspaceId, actorId, restrictedScope, createInput)).resolves.toBeNull();
        expect(transaction).not.toHaveBeenCalled();
    });

    it("does not query public batches when the portal allocation feature is disabled", async () => {
        getPublicPortalBySlug.mockResolvedValue(null);

        await expect(listPublicDistributionBatches("public-slug")).resolves.toBeNull();
        expect(getPublicPortalBySlug).toHaveBeenCalledWith("public-slug", "allocationsEnabled");
        expect(select).not.toHaveBeenCalled();
    });

    it("publishes a reconciled draft and stamps the actor only after validation", async () => {
        const batch = {
            id: batchId,
            workspaceId,
            programId: null,
            supersedesBatchId: null,
            documentNumber: createInput.documentNumber,
            documentDate: createInput.documentDate,
            title: createInput.title,
            fundingSourceText: createInput.fundingSourceText,
            supportItemName: createInput.supportItemName,
            unitLabel: createInput.unitLabel,
            unitAmount: createInput.unitAmount,
            declaredTotalQuantity: createInput.declaredTotalQuantity,
            declaredTotalAmount: createInput.declaredTotalAmount,
            eligibilitySummary: createInput.eligibilitySummary,
            eligibilityApprovalYear: createInput.eligibilityApprovalYear,
            submissionDeadline: null,
            completionDeadline: null,
            status: "DRAFT",
            createdBy: actorId,
            updatedBy: actorId,
            publishedBy: null,
            publishedAt: null,
            closedBy: null,
            closedAt: null,
            createdAt: new Date("2026-10-12T08:00:00.000Z"),
            updatedAt: new Date("2026-10-12T08:00:00.000Z")
        };
        const lines = createInput.lines.map((line) => ({ ...line }));
        const batchWhere = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([batch]) });
        const batchFrom = vi.fn().mockReturnValue({ where: batchWhere });
        const lineOrderBy = vi.fn().mockResolvedValue(lines);
        const lineWhere = vi.fn().mockReturnValue({ orderBy: lineOrderBy });
        const lineFrom = vi.fn().mockReturnValue({ where: lineWhere });
        const published = { ...batch, status: "PUBLISHED", publishedBy: actorId, publishedAt: new Date() };
        const returning = vi.fn().mockResolvedValue([published]);
        const updateWhere = vi.fn().mockReturnValue({ returning });
        const set = vi.fn().mockReturnValue({ where: updateWhere });
        const tx = {
            select: vi.fn()
                .mockReturnValueOnce({ from: batchFrom })
                .mockReturnValueOnce({ from: lineFrom }),
            update: vi.fn().mockReturnValue({ set })
        };
        transaction.mockImplementation((callback: (tx: unknown) => Promise<unknown>) => callback(tx));

        const result = await publishDistributionBatch(workspaceId, actorId, superAdminScope, batchId);

        expect(result?.status).toBe("PUBLISHED");
        expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: "PUBLISHED", publishedBy: actorId }));
    });

    it("does not publish when the locality totals do not reconcile", async () => {
        const batch = {
            id: batchId,
            workspaceId,
            programId: null,
            supersedesBatchId: null,
            ...createInput,
            declaredTotalAmount: createInput.declaredTotalAmount + createInput.unitAmount,
            status: "DRAFT",
            createdBy: actorId,
            updatedBy: actorId,
            publishedBy: null,
            publishedAt: null,
            closedBy: null,
            closedAt: null,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const batchFrom = vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([batch]) }) });
        const lineFrom = vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue(createInput.lines) }) });
        const tx = {
            select: vi.fn().mockReturnValueOnce({ from: batchFrom }).mockReturnValueOnce({ from: lineFrom }),
            update: vi.fn()
        };
        transaction.mockImplementation((callback: (tx: unknown) => Promise<unknown>) => callback(tx));

        await expect(publishDistributionBatch(workspaceId, actorId, superAdminScope, batchId)).resolves.toBeNull();
        expect(tx.update).not.toHaveBeenCalled();
    });

    it("closes a published batch without deleting its locality history", async () => {
        const batch = {
            id: batchId,
            workspaceId,
            status: "PUBLISHED",
            publishedAt: new Date("2026-10-12T09:00:00.000Z")
        };
        const lines = [{ provinceCode: "92", wardCode: "31117", allocatedQuantity: 19 }];
        const batchFrom = vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([batch]) }) });
        const lineFrom = vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue(lines) }) });
        const closed = { ...batch, status: "CLOSED", closedBy: actorId, closedAt: new Date() };
        const returning = vi.fn().mockResolvedValue([closed]);
        const updateWhere = vi.fn().mockReturnValue({ returning });
        const set = vi.fn().mockReturnValue({ where: updateWhere });
        const tx = {
            select: vi.fn().mockReturnValueOnce({ from: batchFrom }).mockReturnValueOnce({ from: lineFrom }),
            update: vi.fn().mockReturnValue({ set }),
            delete: vi.fn()
        };
        transaction.mockImplementation((callback: (tx: unknown) => Promise<unknown>) => callback(tx));

        const result = await closeDistributionBatch(workspaceId, actorId, superAdminScope, batchId);

        expect(result).toMatchObject({ status: "CLOSED", lines });
        expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: "CLOSED", closedBy: actorId }));
        expect(tx.delete).not.toHaveBeenCalled();
    });

    it("returns only published public fields and excludes drafts and never-published closed batches", async () => {
        const publishedAt = new Date("2026-10-12T09:00:00.000Z");
        const batchRows = [
            { id: batchId, workspaceId, documentNumber: "1440/QD-UBND", title: "Published batch", status: "PUBLISHED", publishedAt, unitLabel: "household", unitAmount: 80_000_000, declaredTotalQuantity: 1, declaredTotalAmount: 80_000_000, fundingSourceText: "Budget", supportItemName: "Repair", eligibilitySummary: "Approved households", eligibilityApprovalYear: 2025, submissionDeadline: null, completionDeadline: "2026-12-31", programTitle: "Housing program", internalNote: "private" },
            { id: "44444444-4444-4444-8444-444444444444", workspaceId, documentNumber: "1441/QD-UBND", title: "Closed published batch", status: "CLOSED", publishedAt, unitLabel: "household", unitAmount: 80_000_000, declaredTotalQuantity: 1, declaredTotalAmount: 80_000_000, fundingSourceText: "Budget", supportItemName: "Repair", eligibilitySummary: "Approved households", eligibilityApprovalYear: 2025, submissionDeadline: null, completionDeadline: "2026-12-31", programTitle: null, internalNote: "private" },
            { id: "55555555-5555-4555-8555-555555555555", workspaceId, documentNumber: "1442/QD-UBND", title: "Draft batch", status: "DRAFT", publishedAt: null, unitLabel: "household", unitAmount: 80_000_000, declaredTotalQuantity: 1, declaredTotalAmount: 80_000_000, fundingSourceText: "Budget", supportItemName: "Repair", eligibilitySummary: "Draft", eligibilityApprovalYear: 2025, submissionDeadline: null, completionDeadline: null, programTitle: null, internalNote: "private" },
            { id: "66666666-6666-4666-8666-666666666666", workspaceId, documentNumber: "1443/QD-UBND", title: "Never-published closed batch", status: "CLOSED", publishedAt: null, unitLabel: "household", unitAmount: 80_000_000, declaredTotalQuantity: 1, declaredTotalAmount: 80_000_000, fundingSourceText: "Budget", supportItemName: "Repair", eligibilitySummary: "Private", eligibilityApprovalYear: 2025, submissionDeadline: null, completionDeadline: null, programTitle: null, internalNote: "private" }
        ];
        const lineRows = [
            { batchId, provinceCode: "92", wardCode: "31001", allocatedQuantity: 1, provinceName: "Can Tho", wardName: "Ninh Kieu" },
            { batchId: "44444444-4444-4444-8444-444444444444", provinceCode: "92", wardCode: "31002", allocatedQuantity: 1, provinceName: "Can Tho", wardName: "Cai Rang" }
        ];
        const batchQuery = makeQuery(batchRows);
        const lineQuery = makeQuery(lineRows);
        select.mockImplementationOnce(() => ({ from: batchQuery.from }))
            .mockImplementationOnce(() => ({ from: lineQuery.from }));
        getPublicPortalBySlug.mockResolvedValue({ workspaceId, allocationsEnabled: true });

        const result = await listPublicDistributionBatches("public-slug");

        expect(result).toHaveLength(2);
        expect(JSON.stringify(result)).not.toContain("internalNote");
        expect(JSON.stringify(result)).not.toContain(workspaceId);
        expect(JSON.stringify(result)).not.toContain(batchId);
        expect(result).toEqual(expect.arrayContaining([
            expect.objectContaining({
                documentNumber: "1440/QD-UBND",
                lines: [{ provinceCode: "92", wardCode: "31001", allocatedQuantity: 1, provinceName: "Can Tho", wardName: "Ninh Kieu" }]
            }),
            expect.objectContaining({
                documentNumber: "1441/QD-UBND",
                lines: [{ provinceCode: "92", wardCode: "31002", allocatedQuantity: 1, provinceName: "Can Tho", wardName: "Cai Rang" }]
            })
        ]));
    });
});
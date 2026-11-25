import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
    listDistributionBatches: vi.fn(),
    getDistributionBatch: vi.fn(),
    createDistributionBatch: vi.fn(),
    updateDraftDistributionBatch: vi.fn(),
    publishDistributionBatch: vi.fn(),
    closeDistributionBatch: vi.fn(),
    listPublicDistributionBatches: vi.fn()
}));
const { resolvePovertyAccessScope } = vi.hoisted(() => ({ resolvePovertyAccessScope: vi.fn() }));
const { createAuditLog } = vi.hoisted(() => ({ createAuditLog: vi.fn() }));

vi.mock("./distribution-batches.repository.ts", () => repository);
vi.mock("@/handlers/admin/resources/poverty/poverty.scope.ts", async () => {
    const actual = await vi.importActual<typeof import("@/handlers/admin/resources/poverty/poverty.scope.ts")>("@/handlers/admin/resources/poverty/poverty.scope.ts");
    return { ...actual, resolvePovertyAccessScope };
});
vi.mock("@/services/auditLog.ts", async () => {
    const actual = await vi.importActual<typeof import("@/services/auditLog.ts")>("@/services/auditLog.ts");
    return { ...actual, createAuditLog };
});

import {
    listPublicDistributionBatchesHandler,
    publishDistributionBatchAdmin
} from "./distribution-batches.handlers.ts";

const scope = {
    organizationIds: ["org-1"],
    provinceCodes: [],
    wardCodes: ["31117"],
    areaIds: [],
    isBranchAdmin: false,
    isSuperAdmin: false,
    hasScope: true
};
const batchId = "11111111-1111-4111-8111-111111111111";

const createMockRes = (): Response => ({
    status: vi.fn().mockReturnThis(),
    send: vi.fn()
}) as unknown as Response;
const flushAsync = async (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe("social assistance distribution batch handlers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resolvePovertyAccessScope.mockResolvedValue(scope);
    });

    it("publishes a batch and records the scoped audit event", async () => {
        const published = {
            id: batchId,
            status: "PUBLISHED",
            documentNumber: "1440/QD-UBND",
            declaredTotalQuantity: 19,
            declaredTotalAmount: 1_520_000_000,
            lines: []
        };
        repository.publishDistributionBatch.mockResolvedValue(published);
        const req = {
            workspaceId: "workspace-1",
            accountId: "account-1",
            user: { isSuperAdmin: false },
            params: { id: batchId }
        } as unknown as Request;
        const res = createMockRes();

        publishDistributionBatchAdmin(req, res, vi.fn());
        await flushAsync();

        expect(repository.publishDistributionBatch).toHaveBeenCalledWith("workspace-1", "account-1", scope, batchId);
        expect(createAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({
                action: "social_assistance_distribution_batch_published",
                entityType: "social_assistance_distribution_batch",
                entityId: batchId,
                details: expect.objectContaining({
                    documentNumber: "1440/QD-UBND",
                    declaredTotalQuantity: 19,
                    declaredTotalAmount: 1_520_000_000
                })
            }),
            req
        );
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it("returns not found when public allocations are unavailable", async () => {
        repository.listPublicDistributionBatches.mockResolvedValue(null);
        const req = { params: { slug: "public-slug" }, query: {} } as unknown as Request;
        const res = createMockRes();

        listPublicDistributionBatchesHandler(req, res, vi.fn());
        await flushAsync();

        expect(repository.listPublicDistributionBatches).toHaveBeenCalledWith("public-slug", {});
        expect(res.status).toHaveBeenCalledWith(404);
    });
});
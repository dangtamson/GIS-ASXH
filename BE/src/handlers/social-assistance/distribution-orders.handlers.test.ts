import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const repositories = vi.hoisted(() => ({
    createDistributionOrder: vi.fn(),
    listDistributionOrders: vi.fn(),
    listPublicDistributionOrders: vi.fn(),
    createDistributionBeneficiary: vi.fn(),
    listDistributionBeneficiaries: vi.fn()
}));
const { resolvePovertyAccessScope, createAuditLog } = vi.hoisted(() => ({
    resolvePovertyAccessScope: vi.fn(), createAuditLog: vi.fn()
}));
vi.mock("./distribution-orders.repository.ts", () => repositories);
vi.mock("./distribution-beneficiaries.repository.ts", () => repositories);
vi.mock("@/handlers/admin/resources/poverty/poverty.scope.ts", async () => {
    const actual = await vi.importActual<typeof import("@/handlers/admin/resources/poverty/poverty.scope.ts")>("@/handlers/admin/resources/poverty/poverty.scope.ts");
    return { ...actual, resolvePovertyAccessScope };
});
vi.mock("@/services/auditLog.ts", async () => {
    const actual = await vi.importActual<typeof import("@/services/auditLog.ts")>("@/services/auditLog.ts");
    return { ...actual, createAuditLog };
});

import {
    createDistributionOrderAdmin,
    listDistributionBeneficiariesAdmin,
    listPublicDistributionOrdersHandler
} from "./distribution-orders.handlers.ts";

const scope = {
    organizationIds: [], provinceCodes: ["92"], wardCodes: [], areaIds: [],
    isBranchAdmin: false, isSuperAdmin: false, hasScope: true
};
const targetId = "44444444-4444-4444-8444-444444444444";
const createMockRes = (): Response => ({ status: vi.fn().mockReturnThis(), send: vi.fn() }) as unknown as Response;
const flushAsync = async (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe("distribution order handlers", () => {
    beforeEach(() => { vi.clearAllMocks(); resolvePovertyAccessScope.mockResolvedValue(scope); });

    it("requires authenticated workspace context for creating an order", async () => {
        const request = { body: {} } as unknown as Request;
        const response = createMockRes();
        createDistributionOrderAdmin(request, response, vi.fn());
        await flushAsync();
        expect(response.status).toHaveBeenCalledWith(403);
        expect(repositories.createDistributionOrder).not.toHaveBeenCalled();
    });

    it("does not reveal beneficiary data for an inaccessible target", async () => {
        repositories.listDistributionBeneficiaries.mockResolvedValue(null);
        const request = { workspaceId: "workspace-1", accountId: "account-1", user: {}, params: { targetId } } as unknown as Request;
        const response = createMockRes();
        listDistributionBeneficiariesAdmin(request, response, vi.fn());
        await flushAsync();
        expect(repositories.listDistributionBeneficiaries).toHaveBeenCalledWith("workspace-1", scope, targetId);
        expect(response.status).toHaveBeenCalledWith(404);
        expect(createAuditLog).not.toHaveBeenCalled();
    });

    it("uses the assigned workspace scope for super admins accessing beneficiaries", async () => {
        repositories.listDistributionBeneficiaries.mockResolvedValue([]);
        const request = { workspaceId: "workspace-1", accountId: "account-1", user: { isSuperAdmin: true }, params: { targetId } } as unknown as Request;
        const response = createMockRes();
        listDistributionBeneficiariesAdmin(request, response, vi.fn());
        await flushAsync();
        expect(resolvePovertyAccessScope).toHaveBeenCalledWith("account-1", "workspace-1");
        expect(repositories.listDistributionBeneficiaries).toHaveBeenCalledWith("workspace-1", scope, targetId);
    });

    it("returns not found when the public allocation portal is disabled", async () => {
        repositories.listPublicDistributionOrders.mockResolvedValue(null);
        const request = { params: { slug: "portal" } } as unknown as Request;
        const response = createMockRes();
        listPublicDistributionOrdersHandler(request, response, vi.fn());
        await flushAsync();
        expect(response.status).toHaveBeenCalledWith(404);
    });
});
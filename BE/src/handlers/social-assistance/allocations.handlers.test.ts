import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSocialAssistanceAllocation, listSocialAssistanceAllocations, updateSocialAssistanceAllocation } = vi.hoisted(() => ({
    createSocialAssistanceAllocation: vi.fn(),
    listSocialAssistanceAllocations: vi.fn(),
    updateSocialAssistanceAllocation: vi.fn()
}));
const { resolvePovertyAccessScope } = vi.hoisted(() => ({ resolvePovertyAccessScope: vi.fn() }));
const { createAuditLog } = vi.hoisted(() => ({ createAuditLog: vi.fn() }));

vi.mock("./allocations.repository.ts", () => ({ createSocialAssistanceAllocation, listSocialAssistanceAllocations, updateSocialAssistanceAllocation }));
vi.mock("@/handlers/admin/resources/poverty/poverty.scope.ts", async () => {
    const actual = await vi.importActual<typeof import("@/handlers/admin/resources/poverty/poverty.scope.ts")>("@/handlers/admin/resources/poverty/poverty.scope.ts");
    return { ...actual, resolvePovertyAccessScope };
});
vi.mock("@/services/auditLog.ts", async () => {
    const actual = await vi.importActual<typeof import("@/services/auditLog.ts")>("@/services/auditLog.ts");
    return { ...actual, createAuditLog };
});

import {
    createSocialAssistanceAllocationAdmin,
    listSocialAssistanceAllocationsAdmin,
    updateSocialAssistanceAllocationAdmin
} from "./allocations.handlers.ts";

const scope = {
    organizationIds: ["org-1"],
    provinceCodes: [],
    wardCodes: ["31117"],
    areaIds: [],
    isBranchAdmin: false,
    isSuperAdmin: false,
    hasScope: true
};

const createMockRes = (): Response =>
    ({ status: vi.fn().mockReturnThis(), send: vi.fn() }) as unknown as Response;
const flushAsync = async (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe("createSocialAssistanceAllocationAdmin", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resolvePovertyAccessScope.mockResolvedValue(scope);
    });

    it("requires location scope before creating an allocation", async () => {
        resolvePovertyAccessScope.mockResolvedValue({ ...scope, hasScope: false });
        const req = {
            workspaceId: "workspace-1",
            accountId: "account-1",
            user: { isSuperAdmin: false },
            body: {
                programId: "11111111-1111-4111-8111-111111111111",
                requestId: "22222222-2222-4222-8222-222222222222",
                plannedCashAmount: 2500000
            }
        } as unknown as Request;
        const res = createMockRes();

        createSocialAssistanceAllocationAdmin(req, res, vi.fn());
        await flushAsync();

        expect(res.status).toHaveBeenCalledWith(403);
        expect(createSocialAssistanceAllocation).not.toHaveBeenCalled();
    });

    it("creates an allocation and audits prior-support advisories", async () => {
        const result = { item: { id: "allocation-1", status: "PLANNED" }, priorSupportCount: 2 };
        createSocialAssistanceAllocation.mockResolvedValue(result);
        const req = {
            workspaceId: "workspace-1",
            accountId: "account-1",
            user: { isSuperAdmin: false },
            body: {
                programId: "11111111-1111-4111-8111-111111111111",
                requestId: "22222222-2222-4222-8222-222222222222",
                plannedCashAmount: 2500000
            }
        } as unknown as Request;
        const res = createMockRes();

        createSocialAssistanceAllocationAdmin(req, res, vi.fn());
        await flushAsync();

        expect(createSocialAssistanceAllocation).toHaveBeenCalledWith("workspace-1", "account-1", scope, req.body);
        expect(createAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({
                action: "social_assistance_allocation_created",
                details: expect.objectContaining({ priorSupportCount: 2 })
            }),
            req
        );
        expect(res.status).toHaveBeenCalledWith(201);
    });

    it("records delivery status and audits the update", async () => {
        const allocationId = "44444444-4444-4444-8444-444444444444";
        const updated = { id: allocationId, status: "DELIVERED", deliveredCashAmount: 2000000 };
        updateSocialAssistanceAllocation.mockResolvedValue(updated);
        const req = {
            workspaceId: "workspace-1",
            accountId: "account-1",
            params: { id: allocationId },
            body: { status: "DELIVERED", deliveredCashAmount: 2000000, deliveryDate: "2026-11-20" }
        } as unknown as Request;
        const res = createMockRes();

        updateSocialAssistanceAllocationAdmin(req, res, vi.fn());
        await flushAsync();

        expect(updateSocialAssistanceAllocation).toHaveBeenCalledWith(allocationId, "workspace-1", "account-1", req.body);
        expect(createAuditLog).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it("lists allocations using the authenticated location scope", async () => {
        listSocialAssistanceAllocations.mockResolvedValue([{ id: "allocation-1" }]);
        const req = {
            workspaceId: "workspace-1",
            accountId: "account-1",
            user: { isSuperAdmin: false }
        } as unknown as Request;
        const res = createMockRes();

        listSocialAssistanceAllocationsAdmin(req, res, vi.fn());
        await flushAsync();

        expect(listSocialAssistanceAllocations).toHaveBeenCalledWith("workspace-1", scope);
        expect(res.status).toHaveBeenCalledWith(200);
    });
});
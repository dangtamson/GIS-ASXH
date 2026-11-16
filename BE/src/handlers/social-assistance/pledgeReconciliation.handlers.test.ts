import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listSocialAssistancePledges, updateSocialAssistancePledgeReconciliation } = vi.hoisted(() => ({
    listSocialAssistancePledges: vi.fn(),
    updateSocialAssistancePledgeReconciliation: vi.fn()
}));
const { createAuditLog } = vi.hoisted(() => ({ createAuditLog: vi.fn() }));

vi.mock("./pledges.repository.ts", () => ({ listSocialAssistancePledges, updateSocialAssistancePledgeReconciliation }));
vi.mock("@/services/auditLog.ts", async () => {
    const actual = await vi.importActual<typeof import("@/services/auditLog.ts")>("@/services/auditLog.ts");
    return { ...actual, createAuditLog };
});

import {
    listSocialAssistancePledgesAdmin,
    updateSocialAssistancePledgeAdmin
} from "./pledgeReconciliation.handlers.ts";

const createMockRes = (): Response =>
    ({ status: vi.fn().mockReturnThis(), send: vi.fn() }) as unknown as Response;

const flushAsync = async (): Promise<void> => {
    await new Promise((resolve) => setImmediate(resolve));
};

describe("pledge reconciliation handlers", () => {
    beforeEach(() => vi.clearAllMocks());

    it("lists private pledges only for the current workspace", async () => {
        listSocialAssistancePledges.mockResolvedValue([{ id: "pledge-1" }]);
        const req = { workspaceId: "workspace-1", accountId: "account-1", query: { status: "PENDING_REVIEW" } } as unknown as Request;
        const res = createMockRes();

        listSocialAssistancePledgesAdmin(req, res, vi.fn());
        await flushAsync();

        expect(listSocialAssistancePledges).toHaveBeenCalledWith("workspace-1", "PENDING_REVIEW");
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it("reconciles a pledge and audits the status change", async () => {
        const updated = { id: "pledge-1", status: "RECEIVED", receivedAmount: 4500 };
        updateSocialAssistancePledgeReconciliation.mockResolvedValue(updated);
        const req = {
            workspaceId: "workspace-1",
            accountId: "account-1",
            params: { id: "11111111-1111-4111-8111-111111111111" },
            body: { status: "RECEIVED", receivedAmount: 4500, internalNote: "Da nhan" }
        } as unknown as Request;
        const res = createMockRes();

        updateSocialAssistancePledgeAdmin(req, res, vi.fn());
        await flushAsync();

        expect(updateSocialAssistancePledgeReconciliation).toHaveBeenCalledWith(
            req.params.id,
            "workspace-1",
            "account-1",
            req.body
        );
        expect(createAuditLog).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
    });
});
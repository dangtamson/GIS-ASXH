import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSocialAssistanceDashboard } = vi.hoisted(() => ({ getSocialAssistanceDashboard: vi.fn() }));
const { resolvePovertyAccessScope, buildSuperAdminPovertyAccessScope } = vi.hoisted(() => ({
    resolvePovertyAccessScope: vi.fn(),
    buildSuperAdminPovertyAccessScope: vi.fn()
}));

vi.mock("./dashboard.repository.ts", () => ({ getSocialAssistanceDashboard }));
vi.mock("@/handlers/admin/resources/poverty/poverty.scope.ts", () => ({
    resolvePovertyAccessScope,
    buildSuperAdminPovertyAccessScope
}));

import { getSocialAssistanceDashboardAdmin } from "./dashboard.handlers.ts";

const createMockRes = (): Response => ({ status: vi.fn().mockReturnThis(), send: vi.fn() }) as unknown as Response;
const flushAsync = async (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe("social assistance dashboard handler", () => {
    beforeEach(() => vi.clearAllMocks());

    it("uses authenticated workspace and location scope with validated filters", async () => {
        const scope = { hasScope: true, isSuperAdmin: false, areaIds: [], wardCodes: ["31117"], provinceCodes: [], organizationIds: [], isBranchAdmin: false };
        const dashboard = { summary: { requestsReceived: 1 }, byProgram: [], byGeography: [] };
        resolvePovertyAccessScope.mockResolvedValue(scope);
        getSocialAssistanceDashboard.mockResolvedValue(dashboard);
        const req = {
            workspaceId: "workspace-1",
            accountId: "account-1",
            query: { from: "2026-01-01", to: "2026-12-31", wardCode: "31117" }
        } as unknown as Request;
        const res = createMockRes();

        getSocialAssistanceDashboardAdmin(req, res, vi.fn());
        await flushAsync();

        expect(getSocialAssistanceDashboard).toHaveBeenCalledWith("workspace-1", scope, {
            from: "2026-01-01",
            to: "2026-12-31",
            wardCode: "31117"
        });
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it("rejects requests without a location scope", async () => {
        resolvePovertyAccessScope.mockResolvedValue({ hasScope: false });
        const req = { workspaceId: "workspace-1", accountId: "account-1", query: {} } as unknown as Request;
        const res = createMockRes();

        getSocialAssistanceDashboardAdmin(req, res, vi.fn());
        await flushAsync();

        expect(getSocialAssistanceDashboard).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });
});
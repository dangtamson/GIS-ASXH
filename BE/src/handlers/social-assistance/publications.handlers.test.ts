import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { previewSocialAssistancePublication, createSocialAssistancePublicationDraft, approveSocialAssistancePublication, getSocialAssistancePublicationOptions, listPublicSocialAssistanceMap } = vi.hoisted(() => ({
    previewSocialAssistancePublication: vi.fn(),
    createSocialAssistancePublicationDraft: vi.fn(),
    approveSocialAssistancePublication: vi.fn(),
    getSocialAssistancePublicationOptions: vi.fn(),
    listPublicSocialAssistanceMap: vi.fn()
}));
const { resolvePovertyAccessScope, buildSuperAdminPovertyAccessScope } = vi.hoisted(() => ({
    resolvePovertyAccessScope: vi.fn(),
    buildSuperAdminPovertyAccessScope: vi.fn()
}));
const { createAuditLog } = vi.hoisted(() => ({ createAuditLog: vi.fn() }));

vi.mock("./publications.repository.ts", () => ({
    previewSocialAssistancePublication,
    createSocialAssistancePublicationDraft,
    approveSocialAssistancePublication,
    getSocialAssistancePublicationOptions,
    listPublicSocialAssistanceMap
}));
vi.mock("@/handlers/admin/resources/poverty/poverty.scope.ts", () => ({
    resolvePovertyAccessScope,
    buildSuperAdminPovertyAccessScope
}));
vi.mock("@/services/auditLog.ts", async () => {
    const actual = await vi.importActual<typeof import("@/services/auditLog.ts")>("@/services/auditLog.ts");
    return { ...actual, createAuditLog };
});

import {
    approveSocialAssistancePublicationAdmin,
    createSocialAssistancePublicationDraftAdmin,
    getSocialAssistancePublicationOptionsAdmin,
    getPublicSocialAssistanceMapHandler,
    previewSocialAssistancePublicationAdmin
} from "./publications.handlers.ts";

const scope = { hasScope: true, isSuperAdmin: false, areaIds: [], wardCodes: ["31117"], provinceCodes: [], organizationIds: [], isBranchAdmin: false };
const filters = { periodStart: "2026-01-01", periodEnd: "2026-12-31", wardCode: "31117" };
const createMockRes = (): Response => ({ status: vi.fn().mockReturnThis(), send: vi.fn() }) as unknown as Response;
const flushAsync = async (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe("social assistance publication handlers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resolvePovertyAccessScope.mockResolvedValue(scope);
    });

    it("loads filter options using publication permission scope", async () => {
        const options = { programs: [{ id: "program-1", title: "Nha o an toan" }], geographies: [{ provinceCode: "92", wardCode: "31117" }] };
        getSocialAssistancePublicationOptions.mockResolvedValue(options);
        const req = { workspaceId: "workspace-1", accountId: "account-1" } as unknown as Request;
        const res = createMockRes();

        getSocialAssistancePublicationOptionsAdmin(req, res, vi.fn());
        await flushAsync();

        expect(getSocialAssistancePublicationOptions).toHaveBeenCalledWith("workspace-1", scope);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it("previews published outcomes using the current workspace and location scope", async () => {
        previewSocialAssistancePublication.mockResolvedValue([{ recipientCount: 3, deliveredCashAmount: 200 }]);
        const req = { workspaceId: "workspace-1", accountId: "account-1", body: filters } as unknown as Request;
        const res = createMockRes();

        previewSocialAssistancePublicationAdmin(req, res, vi.fn());
        await flushAsync();

        expect(previewSocialAssistancePublication).toHaveBeenCalledWith("workspace-1", scope, filters);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it("creates a draft snapshot and approves it only through separate audited actions", async () => {
        const batchId = "11111111-1111-4111-8111-111111111111";
        const draft = { publicationBatchId: batchId, items: [{ recipientCount: 3 }] };
        createSocialAssistancePublicationDraft.mockResolvedValue(draft);
        const draftReq = { workspaceId: "workspace-1", accountId: "account-1", body: filters } as unknown as Request;
        const draftRes = createMockRes();
        createSocialAssistancePublicationDraftAdmin(draftReq, draftRes, vi.fn());
        await flushAsync();
        expect(draftRes.status).toHaveBeenCalledWith(201);

        approveSocialAssistancePublication.mockResolvedValue({ ...draft, approvedAt: new Date("2026-12-31T00:00:00Z") });
        const approveReq = {
            workspaceId: "workspace-1",
            accountId: "account-1",
            params: { batchId }
        } as unknown as Request;
        const approveRes = createMockRes();
        approveSocialAssistancePublicationAdmin(approveReq, approveRes, vi.fn());
        await flushAsync();

        expect(approveSocialAssistancePublication).toHaveBeenCalledWith("workspace-1", "account-1", scope, batchId);
        expect(createAuditLog).toHaveBeenCalled();
        expect(approveRes.status).toHaveBeenCalledWith(200);
    });

    it("serves the public map through the results-enabled portal repository", async () => {
        listPublicSocialAssistanceMap.mockResolvedValue({ items: [{ wardCode: "31117", recipientCount: 3 }] });
        const req = { params: { slug: "portal-slug" } } as unknown as Request;
        const res = createMockRes();

        getPublicSocialAssistanceMapHandler(req, res, vi.fn());
        await flushAsync();

        expect(listPublicSocialAssistanceMap).toHaveBeenCalledWith("portal-slug");
        expect(res.status).toHaveBeenCalledWith(200);
    });
});
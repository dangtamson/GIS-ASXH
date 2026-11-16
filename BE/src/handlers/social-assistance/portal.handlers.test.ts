import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getOrCreateSocialAssistancePortal, updateSocialAssistancePortal, resolveSocialAssistancePortalFromWardSlug } = vi.hoisted(() => ({
    getOrCreateSocialAssistancePortal: vi.fn(),
    updateSocialAssistancePortal: vi.fn(),
    resolveSocialAssistancePortalFromWardSlug: vi.fn()
}));
const { createAuditLog } = vi.hoisted(() => ({ createAuditLog: vi.fn() }));

vi.mock("./portal.repository.ts", () => ({
    getOrCreateSocialAssistancePortal,
    updateSocialAssistancePortal,
    resolveSocialAssistancePortalFromWardSlug
}));
vi.mock("@/services/auditLog.ts", async () => {
    const actual = await vi.importActual<typeof import("@/services/auditLog.ts")>("@/services/auditLog.ts");
    return { ...actual, createAuditLog };
});

import {
    getPublicSocialAssistancePortalFromWardHandler,
    getSocialAssistancePortalAdmin,
    updateSocialAssistancePortalAdmin
} from "./portal.handlers.ts";

const portal = {
    id: "11111111-1111-4111-8111-111111111111",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    publicSlug: "sa-stable-slug",
    intakeEnabled: false,
    programsEnabled: false,
    resultsEnabled: false
};

const createMockRes = (): Response =>
    ({ status: vi.fn().mockReturnThis(), send: vi.fn() }) as unknown as Response;

const createAdminRequest = (body = {}): Request =>
    ({
        workspaceId: portal.workspaceId,
        accountId: "33333333-3333-4333-8333-333333333333",
        body,
        params: {}
    }) as unknown as Request;

const flushAsync = async (): Promise<void> => {
    await new Promise((resolve) => setImmediate(resolve));
};

describe("social assistance portal handlers", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns a stable portal with features disabled by default", async () => {
        getOrCreateSocialAssistancePortal.mockResolvedValue(portal);
        const req = createAdminRequest();
        const res = createMockRes();

        getSocialAssistancePortalAdmin(req, res, vi.fn());
        await flushAsync();

        expect(getOrCreateSocialAssistancePortal).toHaveBeenCalledWith(portal.workspaceId, req.accountId);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it("updates portal settings and writes an audit record", async () => {
        getOrCreateSocialAssistancePortal.mockResolvedValue(portal);
        updateSocialAssistancePortal.mockResolvedValue({ ...portal, intakeEnabled: true });
        const req = createAdminRequest({ intakeEnabled: true });
        const res = createMockRes();

        updateSocialAssistancePortalAdmin(req, res, vi.fn());
        await flushAsync();

        expect(updateSocialAssistancePortal).toHaveBeenCalledWith(portal.workspaceId, req.accountId, { intakeEnabled: true });
        expect(createAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({ action: "social_assistance_portal_updated", workspaceId: portal.workspaceId }),
            req
        );
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it("returns only the enabled public slug when resolving a public ward link", async () => {
        resolveSocialAssistancePortalFromWardSlug.mockResolvedValue({ publicSlug: portal.publicSlug });
        const req = { params: { wardSlug: "public-ward-slug" } } as unknown as Request;
        const res = createMockRes();

        getPublicSocialAssistancePortalFromWardHandler(req, res, vi.fn());
        await flushAsync();

        expect(resolveSocialAssistancePortalFromWardSlug).toHaveBeenCalledWith("public-ward-slug");
        expect(res.status).toHaveBeenCalledWith(200);
        const body = vi.mocked(res.send).mock.calls[0]?.[0];
        expect(JSON.stringify(body)).toContain(portal.publicSlug);
        expect(JSON.stringify(body)).not.toContain(portal.workspaceId);
    });
});
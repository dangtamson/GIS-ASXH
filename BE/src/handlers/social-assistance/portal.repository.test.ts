import { beforeEach, describe, expect, it, vi } from "vitest";

const { select, insert, update, insertValues, getWardPublicLinkBySlug } = vi.hoisted(() => ({
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    insertValues: vi.fn(),
    getWardPublicLinkBySlug: vi.fn()
}));

vi.mock("@/services/db/drizzle.ts", () => ({ db: { select, insert, update } }));
vi.mock("@/handlers/admin/resources/poverty/poverty.repository.ts", () => ({ getWardPublicLinkBySlug }));

import {
    createSocialAssistancePortalAlias,
    getOrCreateSocialAssistancePortal,
    resolveSocialAssistancePortalFromWardSlug,
    updateSocialAssistancePortal
} from "./portal.repository.ts";

const portal = {
    id: "11111111-1111-4111-8111-111111111111",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    publicSlug: "sa-stable-slug",
    intakeEnabled: true,
    programsEnabled: false,
    resultsEnabled: false,
    allocationsEnabled: false
};
const actorId = "33333333-3333-4333-8333-333333333333";

const setPortalRows = (rows: unknown[]) => {
    let callIndex = 0;
    select.mockImplementation(() => {
        if (callIndex++ === 0) {
            const limit = vi.fn().mockResolvedValue(rows);
            const where = vi.fn().mockReturnValue({ limit });
            const from = vi.fn().mockReturnValue({ where });
            return { from };
        }
        const innerJoin = vi.fn().mockResolvedValue([{ workspaceId: portal.workspaceId, workspaceName: "UBND TP Cần Thơ" }]);
        const from = vi.fn().mockReturnValue({ innerJoin });
        return { from };
    });
};

describe("social assistance portal repository", () => {
    beforeEach(() => vi.clearAllMocks());

    it("derives a readable city alias from the workspace name", () => {
        expect(createSocialAssistancePortalAlias("UBND TP Cần Thơ")).toBe("can-tho");
        expect(createSocialAssistancePortalAlias("Thành phố Hồ Chí Minh")).toBe("ho-chi-minh");
    });

    it("returns the existing portal so its slug remains stable", async () => {
        setPortalRows([portal]);

        await expect(getOrCreateSocialAssistancePortal(portal.workspaceId, "account-1")).resolves.toEqual({
            ...portal,
            publicAlias: "can-tho"
        });
        expect(insert).not.toHaveBeenCalled();
    });

    it("does not resolve a portal from a private or unknown poverty ward link", async () => {
        getWardPublicLinkBySlug.mockResolvedValue({ ...portal, isPublic: false });
        await expect(resolveSocialAssistancePortalFromWardSlug("private-ward-slug")).resolves.toBeNull();

        getWardPublicLinkBySlug.mockResolvedValue(null);
        await expect(resolveSocialAssistancePortalFromWardSlug("unknown-ward-slug")).resolves.toBeNull();
        expect(select).not.toHaveBeenCalled();
    });

    it("returns the friendly city alias for public ward links", async () => {
        getWardPublicLinkBySlug.mockResolvedValue({ workspaceId: portal.workspaceId, isPublic: true });
        setPortalRows([portal]);

        await expect(resolveSocialAssistancePortalFromWardSlug("public-ward-slug")).resolves.toEqual({
            publicSlug: "can-tho"
        });
    });

    it("supports allocation visibility independently from delivered result visibility", async () => {
        const updatedPortal = { ...portal, allocationsEnabled: true, resultsEnabled: false };
        const returning = vi.fn().mockResolvedValue([updatedPortal]);
        const where = vi.fn().mockReturnValue({ returning });
        const set = vi.fn().mockReturnValue({ where });
        update.mockReturnValue({ set });
        const innerJoin = vi.fn().mockResolvedValue([{ workspaceId: portal.workspaceId, workspaceName: "UBND TP Cần Thơ" }]);
        select.mockReturnValue({ from: vi.fn().mockReturnValue({ innerJoin }) });

        await expect(updateSocialAssistancePortal(portal.workspaceId, actorId, { allocationsEnabled: true })).resolves.toEqual({
            ...updatedPortal,
            publicAlias: "can-tho"
        });
        expect(set).toHaveBeenCalledWith(expect.objectContaining({ allocationsEnabled: true, updatedBy: actorId }));
        expect(set).not.toHaveBeenCalledWith(expect.objectContaining({ resultsEnabled: true }));
    });
});
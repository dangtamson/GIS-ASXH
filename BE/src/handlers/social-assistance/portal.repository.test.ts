import { beforeEach, describe, expect, it, vi } from "vitest";

const { select, insert, insertValues, getWardPublicLinkBySlug } = vi.hoisted(() => ({
    select: vi.fn(),
    insert: vi.fn(),
    insertValues: vi.fn(),
    getWardPublicLinkBySlug: vi.fn()
}));

vi.mock("@/services/db/drizzle.ts", () => ({ db: { select, insert } }));
vi.mock("@/handlers/admin/resources/poverty/poverty.repository.ts", () => ({ getWardPublicLinkBySlug }));

import {
    createSocialAssistancePortalAlias,
    getOrCreateSocialAssistancePortal,
    resolveSocialAssistancePortalFromWardSlug
} from "./portal.repository.ts";

const portal = {
    id: "11111111-1111-4111-8111-111111111111",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    publicSlug: "sa-stable-slug",
    intakeEnabled: true,
    programsEnabled: false,
    resultsEnabled: false
};

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
});
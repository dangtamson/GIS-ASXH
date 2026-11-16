import { beforeEach, describe, expect, it, vi } from "vitest";

const { select, getPublicPortalBySlug } = vi.hoisted(() => ({
    select: vi.fn(),
    getPublicPortalBySlug: vi.fn()
}));
vi.mock("@/services/db/drizzle.ts", () => ({ db: { select } }));
vi.mock("./requests.repository.ts", () => ({ getPublicPortalBySlug }));

import { listPublicSocialAssistanceMap } from "./publications.repository.ts";

describe("public social assistance map repository", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns no snapshot data while the portal results switch is disabled", async () => {
        getPublicPortalBySlug.mockResolvedValue(null);

        await expect(listPublicSocialAssistanceMap("portal-slug")).resolves.toBeNull();
        expect(getPublicPortalBySlug).toHaveBeenCalledWith("portal-slug", "resultsEnabled");
        expect(select).not.toHaveBeenCalled();
    });

    it("returns only published aggregate fields and combines area rows at ward level", async () => {
        getPublicPortalBySlug.mockResolvedValue({ id: "portal-1", workspaceId: "workspace-1", resultsEnabled: true });
        const rows = [
            { periodStart: "2026-01-01", periodEnd: "2026-12-31", programId: "program-1", programTitle: "Hỗ trợ nhà ở", provinceCode: "92", wardCode: "31117", recipientCount: 2, deliveredCashAmount: 120, deliveredItemCount: 1, status: "PUBLISHED", phone: "0900000001", address: "private" },
            { periodStart: "2026-01-01", periodEnd: "2026-12-31", programId: "program-1", programTitle: "Hỗ trợ nhà ở", provinceCode: "92", wardCode: "31117", recipientCount: 3, deliveredCashAmount: 80, deliveredItemCount: 2, status: "PUBLISHED", phone: "0900000002", address: "private" }
        ];
        const where = vi.fn().mockResolvedValue(rows);
        const innerJoin = vi.fn().mockReturnValue({ where });
        const from = vi.fn().mockReturnValue({ innerJoin });
        select.mockReturnValue({ from });

        await expect(listPublicSocialAssistanceMap("portal-slug")).resolves.toEqual({
            items: [
                {
                    periodStart: "2026-01-01",
                    periodEnd: "2026-12-31",
                    programId: "program-1",
                    programTitle: "Hỗ trợ nhà ở",
                    provinceCode: "92",
                    wardCode: "31117",
                    recipientCount: 5,
                    deliveredCashAmount: 200,
                    deliveredItemCount: 3
                }
            ]
        });
    });
});
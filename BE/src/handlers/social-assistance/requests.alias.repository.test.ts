import { beforeEach, describe, expect, it, vi } from "vitest";

const { select } = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock("@/services/db/drizzle.ts", () => ({ db: { select } }));

import { getPublicPortalBySlug } from "./requests.repository.ts";

const portal = {
    id: "portal-1",
    workspaceId: "f3933a6a-015a-4254-b61d-97c7750e2f56",
    publicSlug: "sa-opaque-slug",
    intakeEnabled: true,
    programsEnabled: true,
    resultsEnabled: true
};

describe("public portal city alias resolution", () => {
    beforeEach(() => vi.resetAllMocks());

    it("resolves a city URL alias from the workspace name while retaining the opaque slug", async () => {
        const directLimit = vi.fn().mockResolvedValue([]);
        const directWhere = vi.fn().mockReturnValue({ limit: directLimit });
        const directFrom = vi.fn().mockReturnValue({ where: directWhere });
        select.mockReturnValueOnce({ from: directFrom });

        const aliasRows = [{ ...portal, workspaceName: "UBND TP Cần Thơ" }];
        const innerJoin = vi.fn().mockResolvedValue(aliasRows);
        const aliasFrom = vi.fn().mockReturnValue({ innerJoin });
        select.mockReturnValueOnce({ from: aliasFrom });

        await expect(getPublicPortalBySlug("can-tho", "intakeEnabled")).resolves.toMatchObject(portal);
        expect(select).toHaveBeenCalledTimes(2);
    });

    it("keeps opaque public slug lookup as the first-choice resolution", async () => {
        const limit = vi.fn().mockResolvedValue([portal]);
        const where = vi.fn().mockReturnValue({ limit });
        const from = vi.fn().mockReturnValue({ where });
        select.mockReturnValueOnce({ from });

        await expect(getPublicPortalBySlug("sa-opaque-slug", "programsEnabled")).resolves.toEqual(portal);
        expect(select).toHaveBeenCalledTimes(1);
    });
});
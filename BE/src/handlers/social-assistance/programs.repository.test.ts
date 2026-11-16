import { beforeEach, describe, expect, it, vi } from "vitest";

const { select, insert, insertValues, update } = vi.hoisted(() => ({
    select: vi.fn(),
    insert: vi.fn(),
    insertValues: vi.fn(),
    update: vi.fn()
}));
const { getPublicPortalBySlug } = vi.hoisted(() => ({ getPublicPortalBySlug: vi.fn() }));

vi.mock("@/services/db/drizzle.ts", () => ({ db: { select, insert, update } }));
vi.mock("./requests.repository.ts", () => ({ getPublicPortalBySlug }));

import {
    createSocialAssistanceProgram,
    listPublicSocialAssistancePrograms,
    updateSocialAssistanceProgram
} from "./programs.repository.ts";

const portal = {
    id: "11111111-1111-4111-8111-111111111111",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    programsEnabled: true
};

const publicProgram = {
    id: "33333333-3333-4333-8333-333333333333",
    title: "Nha o an toan",
    publicDescription: "Ho tro sua chua nha.",
    category: "HOUSING",
    eligibilitySummary: "Ho da duoc xac minh.",
    startDate: "2026-11-01",
    endDate: "2026-12-31",
    status: "PUBLISHED"
};

const setSelectRows = (rows: unknown[]) => {
    const query = Promise.resolve(rows);
    const orderBy = vi.fn().mockReturnValue(query);
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where, orderBy });
    select.mockReturnValue({ from });
};

const setUpdateRows = (rows: unknown[]) => {
    const returning = vi.fn().mockResolvedValue(rows);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    update.mockReturnValue({ set });
};

describe("social assistance programs repository", () => {
    beforeEach(() => vi.clearAllMocks());

    it("creates a draft program in the authenticated workspace", async () => {
        const program = { ...publicProgram, status: "DRAFT", workspaceId: portal.workspaceId };
        const returning = vi.fn().mockResolvedValue([program]);
        insertValues.mockReturnValue({ returning });
        insert.mockReturnValue({ values: insertValues });

        await expect(createSocialAssistanceProgram(portal.workspaceId, "account-1", {
            title: publicProgram.title,
            publicDescription: publicProgram.publicDescription,
            category: "HOUSING",
            eligibilitySummary: publicProgram.eligibilitySummary,
            startDate: "2026-11-01",
            endDate: "2026-12-31",
            status: "DRAFT"
        })).resolves.toEqual(program);
        expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: portal.workspaceId, createdBy: "account-1" }));
    });

    it("returns published public fields only when the portal programs feature is enabled", async () => {
        getPublicPortalBySlug.mockResolvedValue(portal);
        setSelectRows([publicProgram]);

        await expect(listPublicSocialAssistancePrograms("sa-slug")).resolves.toEqual([publicProgram]);
        expect(getPublicPortalBySlug).toHaveBeenCalledWith("sa-slug", "programsEnabled");
    });

    it("does not query programs for a disabled public portal", async () => {
        getPublicPortalBySlug.mockResolvedValue(null);

        await expect(listPublicSocialAssistancePrograms("sa-disabled")).resolves.toBeNull();
        expect(select).not.toHaveBeenCalled();
    });

    it("updates a program only in its workspace and records the actor", async () => {
        const updated = { ...publicProgram, workspaceId: portal.workspaceId, updatedBy: "account-1" };
        setUpdateRows([updated]);

        await expect(updateSocialAssistanceProgram(
            publicProgram.id,
            portal.workspaceId,
            "account-1",
            { status: "PUBLISHED" }
        )).resolves.toEqual(updated);
        expect(update).toHaveBeenCalled();
    });
});
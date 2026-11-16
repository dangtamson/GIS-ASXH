import { beforeEach, describe, expect, it, vi } from "vitest";

const { select, insert, insertValues, getPublicPortalBySlug } = vi.hoisted(() => ({
    select: vi.fn(),
    insert: vi.fn(),
    insertValues: vi.fn(),
    getPublicPortalBySlug: vi.fn()
}));

vi.mock("@/services/db/drizzle.ts", () => ({ db: { select, insert } }));
vi.mock("./requests.repository.ts", () => ({ getPublicPortalBySlug }));

import { createPublicSocialAssistancePledge } from "./pledges.repository.ts";

const portal = {
    id: "11111111-1111-4111-8111-111111111111",
    workspaceId: "22222222-2222-4222-8222-222222222222"
};
const program = {
    id: "33333333-3333-4333-8333-333333333333",
    workspaceId: portal.workspaceId,
    status: "PUBLISHED"
};
const pledge = {
    programId: program.id,
    donorType: "ORGANIZATION" as const,
    donorName: "Doanh nghiep A",
    contactPhone: "0909123456",
    pledgeType: "CASH" as const,
    pledgedAmount: 5000000,
    consent: true as const
};

const setSelectResponses = (...responses: unknown[][]) => {
    let responseIndex = 0;
    select.mockImplementation(() => {
        const rows = responses[responseIndex++] ?? [];
        const limit = vi.fn().mockResolvedValue(rows);
        const where = vi.fn().mockReturnValue({ limit });
        const from = vi.fn().mockReturnValue({ where });
        return { from };
    });
};

const setInsertResult = (rows: unknown[]) => {
    const returning = vi.fn().mockResolvedValue(rows);
    const onConflictDoNothing = vi.fn().mockReturnValue({ returning });
    insertValues.mockReturnValue({ onConflictDoNothing });
    insert.mockReturnValue({ values: insertValues });
};

describe("public pledge repository", () => {
    beforeEach(() => vi.clearAllMocks());

    it("creates a pending program-level pledge and stores an idempotency hash", async () => {
        getPublicPortalBySlug.mockResolvedValue(portal);
        setSelectResponses([program], []);
        setInsertResult([{ id: "pledge-id" }]);

        await expect(createPublicSocialAssistancePledge("sa-slug", pledge, "pledge-key-123")).resolves.toEqual({
            pledgeId: "pledge-id"
        });
        expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
            workspaceId: portal.workspaceId,
            portalId: portal.id,
            programId: program.id,
            status: "PENDING_REVIEW"
        }));
        expect(JSON.stringify(insertValues.mock.calls[0]?.[0])).not.toContain("pledge-key-123");
        expect(JSON.stringify(insertValues.mock.calls[0]?.[0])).not.toContain("householdId");
    });

    it("does not create a pledge for a disabled portal or unpublished program", async () => {
        getPublicPortalBySlug.mockResolvedValue(null);
        await expect(createPublicSocialAssistancePledge("disabled", pledge, "key-1")).resolves.toBeNull();
        expect(select).not.toHaveBeenCalled();

        getPublicPortalBySlug.mockResolvedValue(portal);
        setSelectResponses([{ ...program, status: "DRAFT" }]);
        await expect(createPublicSocialAssistancePledge("sa-slug", pledge, "key-2")).resolves.toBeNull();
        expect(insert).not.toHaveBeenCalled();
    });

    it("returns the same pledge reference for a repeated idempotency key", async () => {
        getPublicPortalBySlug.mockResolvedValue(portal);
        setSelectResponses([program], [{ id: "existing-pledge-id" }]);

        await expect(createPublicSocialAssistancePledge("sa-slug", pledge, "same-key")).resolves.toEqual({
            pledgeId: "existing-pledge-id"
        });
        expect(insert).not.toHaveBeenCalled();
    });
});
import { beforeEach, describe, expect, it, vi } from "vitest";

const { select, insert, insertValues, update } = vi.hoisted(() => ({
    select: vi.fn(),
    insert: vi.fn(),
    insertValues: vi.fn(),
    update: vi.fn()
}));

vi.mock("@/services/db/drizzle.ts", () => ({
    db: { select, insert, update }
}));

import {
    createPublicRequest,
    getPublicPortalBySlug,
    getSocialAssistanceRequestById,
    hashIdempotencyKey,
    findPotentialDuplicateRequests,
    listSocialAssistanceRequests,
    updateSocialAssistanceRequestStatus
} from "./requests.repository.ts";

const enabledPortal = {
    id: "11111111-1111-4111-8111-111111111111",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    publicSlug: "opaque-portal-slug",
    intakeEnabled: true,
    programsEnabled: false,
    resultsEnabled: false
};

const validRequest = {
    contactName: "Nguyen Van A",
    phone: "0909123456",
    needCategory: "FOOD",
    needDescription: "Can ho tro luong thuc",
    address: "Phuong An Khanh, Can Tho",
    provinceCode: "92",
    wardCode: "31117",
    consent: true,
    source: "MAP" as const
};

const setSelectResponses = (...responses: unknown[][]) => {
    let responseIndex = 0;
    select.mockImplementation(() => {
        const rows = responses[responseIndex++] ?? [];
        const limit = vi.fn().mockResolvedValue(rows);
        const where = vi.fn().mockReturnValue({ limit });
        const innerJoin = vi.fn().mockResolvedValue(rows);
        const from = vi.fn().mockReturnValue({ where, innerJoin });
        return { from };
    });
};

const setInsertResult = (rows: unknown[]) => {
    const returning = vi.fn().mockResolvedValue(rows);
    const onConflictDoNothing = vi.fn().mockReturnValue({ returning });
    insertValues.mockReturnValue({ onConflictDoNothing });
    insert.mockReturnValue({ values: insertValues });
};

const setUpdateResult = (rows: unknown[]) => {
    const returning = vi.fn().mockResolvedValue(rows);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    update.mockReturnValue({ set });
};

const setListSelectRows = (rows: unknown[]) => {
    const offset = vi.fn().mockResolvedValue(rows);
    const limit = vi.fn().mockReturnValue({ offset });
    const orderBy = vi.fn().mockReturnValue({ limit });
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    select.mockImplementationOnce(() => ({ from }));
};

const staffScope = {
    organizationIds: ["org-1"],
    provinceCodes: [],
    wardCodes: ["31117"],
    areaIds: [],
    isBranchAdmin: false,
    isSuperAdmin: false,
    hasScope: true
};

const reviewRequest = {
    id: "request-1",
    workspaceId: "workspace-1",
    status: "IN_REVIEW",
    provinceCode: "92",
    wardCode: "31117",
    areaId: null
};

describe("social assistance request repository", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("resolves an enabled portal by its opaque slug", async () => {
        setSelectResponses([enabledPortal]);

        await expect(getPublicPortalBySlug("opaque-portal-slug", "intakeEnabled")).resolves.toEqual(enabledPortal);
    });

    it("does not resolve an unknown or disabled intake portal", async () => {
        setSelectResponses([]);
        await expect(getPublicPortalBySlug("unknown-slug", "intakeEnabled")).resolves.toBeNull();

        setSelectResponses([{ ...enabledPortal, intakeEnabled: false }]);
        await expect(getPublicPortalBySlug("opaque-portal-slug", "intakeEnabled")).resolves.toBeNull();
    });

    it("hashes idempotency keys before persistence", () => {
        const hash = hashIdempotencyKey("request-key-123");

        expect(hash).toMatch(/^[a-f0-9]{64}$/);
        expect(hash).not.toContain("request-key-123");
        expect(hashIdempotencyKey("request-key-123")).toBe(hash);
    });

    it("creates a request with an opaque receipt and a hashed idempotency key", async () => {
        setSelectResponses([enabledPortal], []);
        setInsertResult([{ receiptCode: "SA-11111111-1111-4111-8111-111111111111" }]);

        const result = await createPublicRequest("opaque-portal-slug", validRequest, "request-key-123");

        expect(result).toEqual({ receiptCode: "SA-11111111-1111-4111-8111-111111111111" });
        expect(insertValues).toHaveBeenCalledWith(
            expect.objectContaining({
                workspaceId: enabledPortal.workspaceId,
                portalId: enabledPortal.id,
                idempotencyKeyHash: hashIdempotencyKey("request-key-123"),
                provinceCode: "92",
                wardCode: "31117"
            })
        );
        expect(JSON.stringify(insertValues.mock.calls[0]?.[0])).not.toContain("request-key-123");
    });

    it("returns the receipt for a repeated idempotency key without inserting twice", async () => {
        setSelectResponses([enabledPortal], [{ receiptCode: "SA-existing-receipt" }]);

        await expect(createPublicRequest("opaque-portal-slug", validRequest, "request-key-123")).resolves.toEqual({
            receiptCode: "SA-existing-receipt"
        });
        expect(insert).not.toHaveBeenCalled();
    });

    it("returns the concurrent request receipt when the idempotency insert conflicts", async () => {
        setSelectResponses([enabledPortal], [], [{ receiptCode: "SA-concurrent-receipt" }]);
        setInsertResult([]);

        await expect(createPublicRequest("opaque-portal-slug", validRequest, "request-key-123")).resolves.toEqual({
            receiptCode: "SA-concurrent-receipt"
        });
    });

    it("does not return requests outside the staff location scope", async () => {
        setSelectResponses([{ ...reviewRequest, wardCode: "31118" }]);

        await expect(getSocialAssistanceRequestById("request-1", "workspace-1", staffScope)).resolves.toBeNull();
    });

    it("updates only an in-scope request and records reviewer fields", async () => {
        const updated = { ...reviewRequest, status: "VERIFIED", verifiedBy: "account-1" };
        setSelectResponses([reviewRequest]);
        setUpdateResult([updated]);

        await expect(
            updateSocialAssistanceRequestStatus("request-1", "workspace-1", staffScope, "VERIFIED", "Checked", "account-1")
        ).resolves.toEqual(updated);
        expect(update).toHaveBeenCalled();
    });

    it("lists requests only within the staff ward scope", async () => {
        setListSelectRows([reviewRequest]);

        await expect(
            listSocialAssistanceRequests("workspace-1", staffScope, { page: 1, limit: 25 })
        ).resolves.toEqual({ items: [reviewRequest], hasMore: false, page: 1, limit: 25 });
    });

    it("does not query when the staff member has no location scope", async () => {
        await expect(
            listSocialAssistanceRequests("workspace-1", { ...staffScope, hasScope: false }, { page: 1, limit: 25 })
        ).resolves.toEqual({ items: [], hasMore: false, page: 1, limit: 25 });
        expect(select).not.toHaveBeenCalled();
    });

    it("returns only safe candidate summaries for a normalized phone and ward match", async () => {
        const candidate = {
            id: "duplicate-request-id",
            receiptCode: "SA-duplicate",
            status: "IN_REVIEW",
            needCategory: "FOOD",
            createdAt: new Date("2026-10-20T00:00:00.000Z")
        };
        setListSelectRows([candidate]);

        await expect(findPotentialDuplicateRequests("workspace-1", {
            requestId: "request-new",
            phone: "0909 123 456",
            provinceCode: "92",
            wardCode: "31117"
        })).resolves.toEqual([candidate]);
    });
});
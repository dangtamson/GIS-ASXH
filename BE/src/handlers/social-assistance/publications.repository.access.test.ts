import { beforeEach, describe, expect, it, vi } from "vitest";

const { select, insert, transaction } = vi.hoisted(() => ({
    select: vi.fn(),
    insert: vi.fn(),
    transaction: vi.fn()
}));
vi.mock("@/services/db/drizzle.ts", () => ({ db: { select, insert, transaction } }));

import {
    approveSocialAssistancePublication,
    previewSocialAssistancePublication
} from "./publications.repository.ts";

const scope = {
    organizationIds: ["org-1"],
    provinceCodes: [],
    wardCodes: ["31117"],
    areaIds: [],
    isBranchAdmin: false,
    isSuperAdmin: false,
    hasScope: true
};

describe("social assistance publication repository access", () => {
    beforeEach(() => vi.clearAllMocks());

    it("builds a delivered-only preview from the caller's workspace and location scope", async () => {
        const rows = [{
            requestId: "request-1",
            programId: "program-1",
            provinceCode: "92",
            wardCode: "31117",
            areaId: null,
            deliveredCashAmount: 500,
            deliveredItemDescription: null,
            status: "DELIVERED"
        }];
        const where = vi.fn().mockResolvedValue(rows);
        const innerJoin = vi.fn().mockReturnValue({ where });
        const from = vi.fn().mockReturnValue({ innerJoin });
        select.mockReturnValue({ from });

        const result = await previewSocialAssistancePublication("workspace-1", scope, {
            periodStart: "2026-01-01",
            periodEnd: "2026-12-31",
            wardCode: "31117"
        });

        expect(result).toEqual([expect.objectContaining({ recipientCount: 1, deliveredCashAmount: 500 })]);
        expect(select.mock.calls[0]?.[0]).not.toHaveProperty("phone");
        expect(select.mock.calls[0]?.[0]).not.toHaveProperty("address");
        expect(where).toHaveBeenCalled();
    });

    it("does not query preview data for a caller with no location scope", async () => {
        await expect(previewSocialAssistancePublication("workspace-1", { ...scope, hasScope: false }, {
            periodStart: "2026-01-01",
            periodEnd: "2026-12-31"
        })).resolves.toBeNull();
        expect(select).not.toHaveBeenCalled();
    });

    it("refuses approval when any draft row is outside the approver's location scope", async () => {
        const draftRow = {
            publicationBatchId: "11111111-1111-4111-8111-111111111111",
            status: "DRAFT",
            provinceCode: "92",
            wardCode: "31118",
            areaId: null
        };
        const where = vi.fn().mockResolvedValue([draftRow]);
        const from = vi.fn().mockReturnValue({ where });
        const tx = { select: vi.fn().mockReturnValue({ from }), update: vi.fn() };
        transaction.mockImplementation((callback: (value: typeof tx) => unknown) => callback(tx));

        await expect(approveSocialAssistancePublication(
            "workspace-1",
            "account-1",
            scope,
            draftRow.publicationBatchId
        )).resolves.toBeNull();
        expect(tx.update).not.toHaveBeenCalled();
    });
});
import { beforeEach, describe, expect, it, vi } from "vitest";

const { select, insert, insertValues, update } = vi.hoisted(() => ({
    select: vi.fn(),
    insert: vi.fn(),
    insertValues: vi.fn(),
    update: vi.fn()
}));
vi.mock("@/services/db/drizzle.ts", () => ({ db: { select, insert, update } }));

import {
    createSocialAssistanceAllocation,
    listSocialAssistanceAllocations,
    updateSocialAssistanceAllocation
} from "./allocations.repository.ts";

const staffScope = {
    organizationIds: ["org-1"],
    provinceCodes: [],
    wardCodes: ["31117"],
    areaIds: [],
    isBranchAdmin: false,
    isSuperAdmin: false,
    hasScope: true
};

const verifiedRequest = {
    id: "11111111-1111-4111-8111-111111111111",
    workspaceId: "workspace-1",
    status: "VERIFIED",
    provinceCode: "92",
    wardCode: "31117",
    areaId: null,
    matchedHouseholdId: "22222222-2222-4222-8222-222222222222"
};
const publishedProgram = { id: "33333333-3333-4333-8333-333333333333", workspaceId: "workspace-1", status: "PUBLISHED" };

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

const setAllocationListResponses = (requestIds: unknown[], allocations: unknown[]) => {
    const createQuery = (rows: unknown[]) => {
        const orderBy = vi.fn().mockResolvedValue(rows);
        const where = vi.fn().mockReturnValue({ orderBy });
        const from = vi.fn().mockReturnValue({ where, orderBy });
        return { from };
    };
    select.mockImplementationOnce(() => createQuery(requestIds)).mockImplementationOnce(() => createQuery(allocations));
};

const setInsertResult = (rows: unknown[]) => {
    const returning = vi.fn().mockResolvedValue(rows);
    insertValues.mockReturnValue({ returning });
    insert.mockReturnValue({ values: insertValues });
};

const setUpdateResult = (rows: unknown[]) => {
    const returning = vi.fn().mockResolvedValue(rows);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    update.mockReturnValue({ set });
};

describe("social assistance allocation repository", () => {
    beforeEach(() => vi.clearAllMocks());

    it("allocates only to a verified request and reports prior support as advisory", async () => {
        setSelectResponses([verifiedRequest], [publishedProgram], [{ id: "prior-support-1" }], []);
        const allocation = {
            id: "allocation-1",
            workspaceId: "workspace-1",
            requestId: verifiedRequest.id,
            programId: publishedProgram.id,
            status: "PLANNED"
        };
        setInsertResult([allocation]);

        await expect(createSocialAssistanceAllocation("workspace-1", "account-1", staffScope, {
            requestId: verifiedRequest.id,
            programId: publishedProgram.id,
            plannedCashAmount: 2500000
        })).resolves.toEqual({ item: allocation, priorSupportCount: 1 });
        expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ status: "PLANNED", createdBy: "account-1" }));
    });

    it("does not allocate an unverified request", async () => {
        setSelectResponses([]);

        await expect(createSocialAssistanceAllocation("workspace-1", "account-1", staffScope, {
            requestId: verifiedRequest.id,
            programId: publishedProgram.id,
            plannedCashAmount: 2500000
        })).resolves.toBeNull();
        expect(insert).not.toHaveBeenCalled();
    });

    it("rejects delivery amounts above the approved plan", async () => {
        setSelectResponses([{
            id: "allocation-1",
            workspaceId: "workspace-1",
            status: "APPROVED",
            plannedCashAmount: 2500000,
            plannedItemDescription: null
        }]);

        await expect(updateSocialAssistanceAllocation("allocation-1", "workspace-1", "account-1", {
            status: "DELIVERED",
            deliveredCashAmount: 3000000
        })).resolves.toBeNull();
        expect(update).not.toHaveBeenCalled();
    });

    it("stores in-plan delivery and advances the allocation state", async () => {
        setSelectResponses([{
            id: "allocation-1",
            workspaceId: "workspace-1",
            status: "APPROVED",
            plannedCashAmount: 2500000,
            plannedItemDescription: null
        }]);
        const updated = { id: "allocation-1", status: "DELIVERED", deliveredCashAmount: 2000000 };
        setUpdateResult([updated]);

        await expect(updateSocialAssistanceAllocation("allocation-1", "workspace-1", "account-1", {
            status: "DELIVERED",
            deliveredCashAmount: 2000000,
            deliveryDate: "2026-11-20"
        })).resolves.toEqual(updated);
        expect(update).toHaveBeenCalled();
    });

    it("preserves the original delivery date when reconciling an allocation", async () => {
        const deliveryDate = "2026-11-20";
        setSelectResponses([{
            id: "allocation-1",
            workspaceId: "workspace-1",
            status: "DELIVERED",
            plannedCashAmount: 2500000,
            plannedItemDescription: null,
            deliveryDate
        }]);
        const returning = vi.fn().mockResolvedValue([{ id: "allocation-1", status: "RECONCILED", deliveryDate }]);
        const where = vi.fn().mockReturnValue({ returning });
        const set = vi.fn().mockReturnValue({ where });
        update.mockReturnValue({ set });

        await expect(updateSocialAssistanceAllocation("allocation-1", "workspace-1", "account-1", {
            status: "RECONCILED"
        })).resolves.toEqual({ id: "allocation-1", status: "RECONCILED", deliveryDate });
        expect(set).toHaveBeenCalledWith(expect.objectContaining({ deliveryDate }));
    });

    it("lists allocations only for request ids within the location scope", async () => {
        const allocation = { id: "allocation-1", requestId: verifiedRequest.id, status: "PLANNED" };
        setAllocationListResponses([{ id: verifiedRequest.id }], [allocation]);

        await expect(listSocialAssistanceAllocations("workspace-1", staffScope)).resolves.toEqual([allocation]);
    });

    it("does not query allocations for a staff member without scope", async () => {
        await expect(listSocialAssistanceAllocations("workspace-1", { ...staffScope, hasScope: false })).resolves.toEqual([]);
        expect(select).not.toHaveBeenCalled();
    });
});
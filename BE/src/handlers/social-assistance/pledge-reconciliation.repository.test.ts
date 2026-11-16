import { beforeEach, describe, expect, it, vi } from "vitest";

const { select, update } = vi.hoisted(() => ({ select: vi.fn(), update: vi.fn() }));
vi.mock("@/services/db/drizzle.ts", () => ({ db: { select, update } }));

import { updateSocialAssistancePledgeReconciliation } from "./pledges.repository.ts";

const existing = {
    id: "11111111-1111-4111-8111-111111111111",
    workspaceId: "workspace-1",
    pledgeType: "CASH",
    pledgedAmount: 5000,
    status: "REVIEWED"
};

const setExistingPledge = (pledge: unknown) => {
    const limit = vi.fn().mockResolvedValue(pledge ? [pledge] : []);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    select.mockReturnValue({ from });
};

const setUpdateResult = (pledge: unknown) => {
    const returning = vi.fn().mockResolvedValue(pledge ? [pledge] : []);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    update.mockReturnValue({ set });
};

describe("updateSocialAssistancePledgeReconciliation", () => {
    beforeEach(() => vi.clearAllMocks());

    it("rejects receipt status without actual cash or item details", async () => {
        setExistingPledge(existing);

        await expect(updateSocialAssistancePledgeReconciliation(
            existing.id,
            existing.workspaceId,
            "account-1",
            { status: "RECEIVED" }
        )).resolves.toBeNull();
        expect(update).not.toHaveBeenCalled();
    });

    it("stores received cash, reviewer, and reconciliation state", async () => {
        setExistingPledge(existing);
        const updated = { ...existing, status: "RECEIVED", receivedAmount: 4500, reviewedBy: "account-1" };
        setUpdateResult(updated);

        await expect(updateSocialAssistancePledgeReconciliation(
            existing.id,
            existing.workspaceId,
            "account-1",
            { status: "RECEIVED", receivedAmount: 4500, internalNote: "Da doi soat" }
        )).resolves.toEqual(updated);
        expect(update).toHaveBeenCalled();
    });
});
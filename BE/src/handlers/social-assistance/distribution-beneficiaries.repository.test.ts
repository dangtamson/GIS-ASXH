import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PovertyAccessScope } from "@/handlers/admin/resources/poverty/poverty.scope.ts";

const { transaction, select } = vi.hoisted(() => ({ transaction: vi.fn(), select: vi.fn() }));
vi.mock("@/services/db/drizzle.ts", () => ({ db: { transaction, select } }));
vi.mock("@/handlers/report/common.ts", () => ({ expandOrganizationDescendants: vi.fn() }));

import { createDistributionBeneficiary, listDistributionBeneficiaries } from "./distribution-beneficiaries.repository.ts";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const actorId = "22222222-2222-4222-8222-222222222222";
const componentId = "33333333-3333-4333-8333-333333333333";
const targetId = "44444444-4444-4444-8444-444444444444";
const orderId = "55555555-5555-4555-8555-555555555555";
const scope: PovertyAccessScope = {
    organizationIds: [],
    provinceCodes: [],
    wardCodes: ["31348"],
    areaIds: [],
    isBranchAdmin: false,
    isSuperAdmin: false,
    hasScope: true
};
const input = { componentId, targetId, fullName: "Nguyễn Văn A", status: "PROPOSED" as const };

const mockTransaction = (target: Record<string, unknown> | null): {
    tx: { select: ReturnType<typeof vi.fn>; insert: ReturnType<typeof vi.fn> };
    values: ReturnType<typeof vi.fn>;
    locked: ReturnType<typeof vi.fn>;
} => {
    const locked = vi.fn().mockResolvedValue(target ? [target] : []);
    const limit = vi.fn().mockReturnValue({ for: locked });
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const returning = vi.fn().mockResolvedValue([{ id: "beneficiary-1", ...input, workspaceId, orderId }]);
    const values = vi.fn().mockReturnValue({ returning });
    const tx = { select: vi.fn().mockReturnValue({ from }), insert: vi.fn().mockReturnValue({ values }) };
    transaction.mockImplementation((callback: (value: typeof tx) => Promise<unknown>) => callback(tx));
    return { tx, values, locked };
};

describe("private distribution beneficiary repository", () => {
    beforeEach(() => vi.clearAllMocks());

    it("stores a proposed beneficiary only under the trusted matching target", async () => {
        const { values, locked } = mockTransaction({ id: targetId, workspaceId, orderId, componentId, type: "LOCALITY", provinceCode: "92", wardCode: "31348", organizationId: null });
        const result = await createDistributionBeneficiary(workspaceId, actorId, scope, input);
        expect(result).toMatchObject({ workspaceId, orderId, fullName: input.fullName, status: "PROPOSED" });
        expect(locked).toHaveBeenCalledWith("update");
        expect(values).toHaveBeenCalledWith(expect.objectContaining({ workspaceId, orderId, targetId, componentId, createdBy: actorId }));
    });

    it("does not insert when the target is outside the actor locality", async () => {
        const { tx } = mockTransaction({ id: targetId, workspaceId, orderId, componentId, type: "LOCALITY", provinceCode: "92", wardCode: "31135", organizationId: null });
        await expect(createDistributionBeneficiary(workspaceId, actorId, scope, input)).resolves.toBeNull();
        expect(tx.insert).not.toHaveBeenCalled();
    });

    it("does not insert when no target exists in the requested workspace", async () => {
        const { tx } = mockTransaction(null);
        await expect(createDistributionBeneficiary(workspaceId, actorId, scope, input)).resolves.toBeNull();
        expect(tx.insert).not.toHaveBeenCalled();
    });

    it("does not link a household when the stored household does not match the target locality", async () => {
        const { tx } = mockTransaction({ id: targetId, workspaceId, orderId, componentId, type: "LOCALITY", provinceCode: "92", wardCode: "31348", organizationId: null });
        const targetQuery = tx.select();
        tx.select.mockReset();
        tx.select.mockReturnValueOnce(targetQuery).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }) })
        });
        const householdId = "66666666-6666-4666-8666-666666666666";
        await expect(createDistributionBeneficiary(workspaceId, actorId, scope, { ...input, householdId })).resolves.toBeNull();
        expect(tx.insert).not.toHaveBeenCalled();
    });

    it("does not link a household through an organization-only target", async () => {
        const organizationId = "77777777-7777-4777-8777-777777777777";
        const { tx } = mockTransaction({ id: targetId, workspaceId, orderId, componentId, type: "ORGANIZATION", provinceCode: null, wardCode: null, organizationId });
        const householdId = "66666666-6666-4666-8666-666666666666";
        const organizationScope = { ...scope, organizationIds: [organizationId] };
        await expect(createDistributionBeneficiary(workspaceId, actorId, organizationScope, { ...input, householdId })).resolves.toBeNull();
        expect(tx.insert).not.toHaveBeenCalled();
    });

    it("does not query private beneficiary records for an out-of-scope target", async () => {
        const target = { id: targetId, workspaceId, orderId, componentId, type: "LOCALITY", provinceCode: "92", wardCode: "31135", organizationId: null };
        select.mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([target]) }) }) });
        await expect(listDistributionBeneficiaries(workspaceId, scope, targetId)).resolves.toBeNull();
        expect(select).toHaveBeenCalledTimes(1);
    });

    it("returns beneficiaries only after validating their stored target scope", async () => {
        const target = { id: targetId, workspaceId, orderId, componentId, type: "LOCALITY", provinceCode: "92", wardCode: "31348", organizationId: null };
        const beneficiaries = [{ id: "beneficiary-1", targetId, workspaceId, fullName: "Nguyễn Văn A" }];
        select.mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([target]) }) }) })
            .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue(beneficiaries) }) }) });
        await expect(listDistributionBeneficiaries(workspaceId, scope, targetId)).resolves.toEqual(beneficiaries);
        expect(select).toHaveBeenCalledTimes(2);
    });
});
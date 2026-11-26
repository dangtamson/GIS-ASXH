import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PovertyAccessScope } from "@/handlers/admin/resources/poverty/poverty.scope.ts";

const { transaction, select, getPublicPortalBySlug } = vi.hoisted(() => ({ transaction: vi.fn(), select: vi.fn(), getPublicPortalBySlug: vi.fn() }));
vi.mock("@/services/db/drizzle.ts", () => ({ db: { transaction, select } }));
vi.mock("@/handlers/report/common.ts", () => ({ expandOrganizationDescendants: vi.fn() }));
vi.mock("./requests.repository.ts", () => ({ getPublicPortalBySlug }));

import { closeDistributionOrder, createDistributionOrder, listDistributionOrders, listPublicDistributionOrders, publishDistributionOrder, toPublicDistributionOrder, updateDraftDistributionOrder } from "./distribution-orders.repository.ts";
import type { DistributionOrderCreateInput } from "./distribution-orders.schemas.ts";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const actorId = "22222222-2222-4222-8222-222222222222";
const orderId = "33333333-3333-4333-8333-333333333333";
const componentId = "44444444-4444-4444-8444-444444444444";
const scope: PovertyAccessScope = {
    organizationIds: [], provinceCodes: ["92"], wardCodes: [], areaIds: [],
    isBranchAdmin: false, isSuperAdmin: false, hasScope: true
};
const input: DistributionOrderCreateInput = {
    documentNumber: "1433/MTTQ-BTT",
    documentDate: "2026-10-30",
    title: "Tết Quân Dân",
    fundingSourceText: "Quỹ Vì người nghèo",
    components: [{
        name: "Nhà Đại đoàn kết", unitLabel: "căn", unitAmount: 80_000_000,
        period: "ONCE", periodCount: 1, declaredTotalQuantity: 3,
        declaredTotalAmount: 240_000_000, eligibilitySummary: "Hộ khó khăn",
        allocations: [{ type: "LOCALITY", provinceCode: "92", wardCode: "31338", allocatedQuantity: 3 }]
    }]
};

describe("distribution order repository", () => {
    beforeEach(() => vi.clearAllMocks());

    it("creates a scoped order, components and targets in one transaction", async () => {
        const limit = vi.fn().mockResolvedValue([{ code: "31338", provinceCode: "92" }]);
        const where = vi.fn().mockReturnValue({ limit });
        const select = vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where }) });
        const targetValues = vi.fn().mockResolvedValue(undefined);
        const componentValues = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: componentId }]) });
        const orderValues = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: orderId, workspaceId, status: "DRAFT" }]) });
        const insert = vi.fn()
            .mockReturnValueOnce({ values: orderValues })
            .mockReturnValueOnce({ values: componentValues })
            .mockReturnValueOnce({ values: targetValues });
        const tx = { select, insert };
        transaction.mockImplementation((callback: (value: typeof tx) => Promise<unknown>) => callback(tx));

        const result = await createDistributionOrder(workspaceId, actorId, scope, input);

        expect(result).toMatchObject({ id: orderId, workspaceId, status: "DRAFT" });
        expect(transaction).toHaveBeenCalledTimes(1);
        expect(orderValues).toHaveBeenCalledWith(expect.objectContaining({ workspaceId, createdBy: actorId }));
        expect(targetValues).toHaveBeenCalledWith([expect.objectContaining({ workspaceId, orderId, componentId, wardCode: "31338", allocatedQuantity: 3 })]);
    });

    it("only updates, publishes and closes orders in valid lifecycle states", async () => {
        const forUpdate = vi.fn().mockResolvedValue([]);
        const limit = vi.fn().mockReturnValue({ for: forUpdate });
        const where = vi.fn().mockReturnValue({ limit });
        const select = vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where }) });
        const updateSet = vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: orderId, workspaceId, status: "PUBLISHED" }]) }) });
        const tx = { select, update: vi.fn().mockReturnValue({ set: updateSet }) };
        transaction.mockImplementation((callback: (value: typeof tx) => Promise<unknown>) => callback(tx));

        await expect(publishDistributionOrder(workspaceId, actorId, scope, orderId)).resolves.toBeNull();
        await expect(updateDraftDistributionOrder(workspaceId, actorId, scope, orderId, input)).resolves.toBeNull();
        await expect(closeDistributionOrder(workspaceId, actorId, scope, orderId)).resolves.toBeNull();
    });

    it("rejects targets outside the actor scope without starting a transaction", async () => {
        const restricted = { ...scope, provinceCodes: [], wardCodes: ["31135"] };
        await expect(createDistributionOrder(workspaceId, actorId, restricted, input)).resolves.toBeNull();
        expect(transaction).not.toHaveBeenCalled();
    });

    it("only projects previously published aggregate fields without private data or internal identifiers", () => {
        const order = {
            id: orderId, workspaceId, status: "PUBLISHED", publishedAt: new Date("2026-11-01T00:00:00Z"),
            documentNumber: "1433/MTTQ-BTT", documentDate: "2026-10-30", title: "Tết Quân Dân",
            fundingSourceText: "Quỹ", submissionDeadline: null, submissionDeadlineExclusive: false,
            completionDeadline: null, completionDeadlineExclusive: false, programTitle: null,
            privateNote: "PRIVATE_NOTE", beneficiaries: [{ fullName: "PRIVATE_NAME" }],
            components: [{
                id: componentId, name: "Xe đạp", unitLabel: "chiếc", unitAmount: 1_600_000,
                period: "ONCE", periodCount: 1, periodStart: null, periodEnd: null,
                declaredTotalQuantity: 3, declaredTotalAmount: 4_800_000,
                eligibilitySummary: "Học sinh khó khăn",
                targets: [{ id: "private-target-id", type: "LOCALITY", provinceCode: "92", wardCode: "31338", provinceName: "Cần Thơ", wardName: "Hỏa Lựu", organizationName: null, allocatedQuantity: 3 }]
            }]
        };
        const projected = toPublicDistributionOrder(order);
        expect(projected).toMatchObject({ documentNumber: "1433/MTTQ-BTT", components: [{ name: "Xe đạp", projectedTotalAmount: 4_800_000 }] });
        const serialized = JSON.stringify(projected);
        expect(serialized).not.toContain("PRIVATE_NAME");
        expect(serialized).not.toContain("PRIVATE_NOTE");
        expect(serialized).not.toContain(workspaceId);
        expect(serialized).not.toContain(orderId);
        expect(serialized).not.toContain("private-target-id");
        expect(toPublicDistributionOrder({ ...order, status: "DRAFT", publishedAt: null })).toBeNull();
        expect(toPublicDistributionOrder({ ...order, status: "CLOSED", publishedAt: null })).toBeNull();
        expect(toPublicDistributionOrder({ ...order, status: "CLOSED" })).not.toBeNull();
    });

    it("does not query any orders when public allocations are disabled", async () => {
        getPublicPortalBySlug.mockResolvedValue(null);
        await expect(listPublicDistributionOrders("portal-slug")).resolves.toBeNull();
        expect(getPublicPortalBySlug).toHaveBeenCalledWith("portal-slug", "allocationsEnabled");
        expect(select).not.toHaveBeenCalled();
    });

    it("only returns previously published aggregates from the enabled portal", async () => {
        const publishedAt = new Date("2026-11-01T00:00:00Z");
        const order = {
            id: orderId, documentNumber: "1433/MTTQ-BTT", documentDate: "2026-10-30",
            title: "Tết Quân Dân", fundingSourceText: "Quỹ", status: "PUBLISHED", publishedAt,
            submissionDeadline: null, submissionDeadlineExclusive: false,
            completionDeadline: null, completionDeadlineExclusive: false, programTitle: null,
            beneficiaries: [{ fullName: "PRIVATE_NAME" }]
        };
        const component = {
            id: componentId, orderId, name: "Xe đạp", unitLabel: "chiếc", unitAmount: 1_600_000,
            period: "ONCE", periodCount: 1, periodStart: null, periodEnd: null,
            declaredTotalQuantity: 3, declaredTotalAmount: 4_800_000, eligibilitySummary: "Học sinh khó khăn"
        };
        const target = { componentId, type: "LOCALITY", provinceCode: "92", wardCode: "31338", provinceName: "Cần Thơ", wardName: "Hỏa Lựu", organizationName: null, allocatedQuantity: 3 };
        const headerQuery = { leftJoin: vi.fn(), where: vi.fn(), orderBy: vi.fn() };
        headerQuery.leftJoin.mockReturnValue(headerQuery);
        headerQuery.where.mockReturnValue(headerQuery);
        headerQuery.orderBy.mockResolvedValue([
            order,
            { ...order, id: "draft", status: "DRAFT", publishedAt: null },
            { ...order, id: "unpublished-closed", status: "CLOSED", publishedAt: null }
        ]);
        const targetQuery = { leftJoin: vi.fn(), where: vi.fn() };
        targetQuery.leftJoin.mockReturnValue(targetQuery);
        targetQuery.where.mockResolvedValue([target]);
        select.mockReturnValueOnce({ from: vi.fn().mockReturnValue(headerQuery) })
            .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([component]) }) })
            .mockReturnValueOnce({ from: vi.fn().mockReturnValue(targetQuery) });
        getPublicPortalBySlug.mockResolvedValue({ workspaceId });

        const result = await listPublicDistributionOrders("portal-slug");
        expect(result).toHaveLength(1);
        expect(result?.[0]?.components[0]?.targets).toEqual([expect.objectContaining({ wardCode: "31338", allocatedQuantity: 3 })]);
        expect(JSON.stringify(result)).not.toContain("PRIVATE_NAME");
        expect(JSON.stringify(result)).not.toContain(orderId);
    });

    it("returns only targets within the current actor scope", async () => {
        const order = { id: orderId, workspaceId, status: "DRAFT" };
        const otherOrderId = "99999999-9999-4999-8999-999999999999";
        const components = [
            { id: componentId, orderId, workspaceId, name: "Nhà" },
            { id: "88888888-8888-4888-8888-888888888888", orderId: otherOrderId, workspaceId, name: "Khác" }
        ];
        const targets = [
            { id: "target-allowed", componentId, orderId, workspaceId, type: "LOCALITY", provinceCode: "92", wardCode: "31338", organizationId: null },
            { id: "target-hidden", componentId, orderId, workspaceId, type: "LOCALITY", provinceCode: "92", wardCode: "31135", organizationId: null },
            { id: "target-other-order", componentId: components[1]!.id, orderId: otherOrderId, workspaceId, type: "LOCALITY", provinceCode: "92", wardCode: "31135", organizationId: null }
        ];
        const headerQuery = { where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue([order, { ...order, id: otherOrderId }]) }) };
        select.mockReturnValueOnce({ from: vi.fn().mockReturnValue(headerQuery) })
            .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(components) }) })
            .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(targets) }) });

        const wardScope = { ...scope, provinceCodes: [], wardCodes: ["31338"] };
        const result = await listDistributionOrders(workspaceId, wardScope);
        expect(result).toHaveLength(1);
        expect(result[0]?.components[0]?.targets.map((target) => target.id)).toEqual(["target-allowed"]);
        expect(JSON.stringify(result)).not.toContain("target-hidden");
    });
});
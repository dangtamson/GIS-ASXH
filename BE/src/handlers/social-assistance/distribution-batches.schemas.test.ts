import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
    socialAssistanceDistributionOrders,
    socialAssistanceDistributionComponents,
    socialAssistanceDistributionTargets,
    socialAssistanceDistributionBeneficiaries,
    organizations
} from "@/schema.ts";
import {
    distributionBatchCreateSchema,
    distributionBatchStatusSchema,
    canTransitionDistributionBatch
} from "./distribution-batches.schemas.ts";
import {
    calculateDistributionComponentAmount,
    distributionBeneficiaryCreateSchema,
    distributionOrderCreateSchema
} from "./distribution-orders.schemas.ts";

const validBatch = {
    documentNumber: "1441/MTTQ-BTT",
    documentDate: "2026-11-02",
    title: "Phân bổ nhà Đại đoàn kết",
    fundingSourceText: "Công ty TNHH NN MTV Xổ số Kiến thiết Cần Thơ",
    supportItemName: "Nhà Đại đoàn kết",
    unitLabel: "căn",
    unitAmount: 80_000_000,
    declaredTotalQuantity: 50,
    declaredTotalAmount: 4_000_000_000,
    eligibilitySummary: "Hộ cận nghèo được phê duyệt trong năm 2026",
    eligibilityApprovalYear: 2026,
    submissionDeadline: "2026-11-06",
    completionDeadline: "2026-12-30",
    lines: [
        { provinceCode: "92", wardCode: "31150", allocatedQuantity: 9 },
        { provinceCode: "92", wardCode: "31531", allocatedQuantity: 41 }
    ]
};

describe("social assistance distribution batch schema", () => {
    it("accepts a reconciled official allocation", () => {
        expect(distributionBatchCreateSchema.safeParse(validBatch).success).toBe(true);
    });

    it("rejects locality quantities that do not match the letter total", () => {
        const result = distributionBatchCreateSchema.safeParse({
            ...validBatch,
            lines: [{ provinceCode: "92", wardCode: "31150", allocatedQuantity: 49 }]
        });

        expect(result.success).toBe(false);
    });

    it("rejects a declared budget that does not match the unit value and quantity", () => {
        const result = distributionBatchCreateSchema.safeParse({
            ...validBatch,
            declaredTotalAmount: 3_900_000_000
        });

        expect(result.success).toBe(false);
    });

    it("rejects duplicate locality rows within the same batch", () => {
        const result = distributionBatchCreateSchema.safeParse({
            ...validBatch,
            lines: [
                { provinceCode: "92", wardCode: "31150", allocatedQuantity: 25 },
                { provinceCode: "92", wardCode: "31150", allocatedQuantity: 25 }
            ]
        });

        expect(result.success).toBe(false);
    });

    it("reconciles all three official letter totals and locality-row counts", () => {
        const letters = [
            { documentNumber: "1441/MTTQ-BTT", quantities: [9, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1], total: 50, amount: 4_000_000_000, rows: 19 },
            { documentNumber: "1440/MTTQ-BTT", quantities: [...Array(16).fill(4), ...Array(5).fill(3)], total: 79, amount: 6_320_000_000, rows: 21 },
            { documentNumber: "1444/MTTQ-BTT", quantities: [1, 1, 1, 1, 1], total: 5, amount: 400_000_000, rows: 5 }
        ];

        for (const letter of letters) {
            expect(letter.quantities).toHaveLength(letter.rows);
            expect(letter.quantities.reduce((sum, quantity) => sum + quantity, 0), letter.documentNumber).toBe(letter.total);
            expect(letter.total * 80_000_000, letter.documentNumber).toBe(letter.amount);
        }
    });

    it("only allows draft publish and published close transitions", () => {
        expect(distributionBatchStatusSchema.safeParse("DRAFT").success).toBe(true);
        expect(canTransitionDistributionBatch("DRAFT", "PUBLISHED")).toBe(true);
        expect(canTransitionDistributionBatch("PUBLISHED", "CLOSED")).toBe(true);
        expect(canTransitionDistributionBatch("DRAFT", "CLOSED")).toBe(false);
        expect(canTransitionDistributionBatch("CLOSED", "PUBLISHED")).toBe(false);
    });
});

describe("social assistance distribution order schema", () => {
    const locality = { type: "LOCALITY", provinceCode: "92", wardCode: "31135", allocatedQuantity: 100 };
    const monthlyOrder = {
        documentNumber: "42/MTTQ-BTT",
        documentDate: "2025-11-28",
        title: "Tấm lòng Eco-shop Tết Bính Ngọ",
        fundingSourceText: "Công ty TNHH Dong Mart",
        components: [{
            name: "Hỗ trợ hàng tháng",
            unitLabel: "hộ",
            unitAmount: 1_500_000,
            period: "MONTHLY",
            periodCount: 12,
            declaredTotalQuantity: 100,
            declaredTotalAmount: null,
            eligibilitySummary: "Hộ dân có hoàn cảnh đặc biệt khó khăn",
            allocations: [locality]
        }]
    };

    it("accepts periodic support without inventing a declared total", () => {
        const result = distributionOrderCreateSchema.safeParse(monthlyOrder);
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.components[0]?.declaredTotalAmount).toBeNull();
    });

    it("calculates projected periodic cost separately from the declared amount", () => {
        const component = monthlyOrder.components[0]!;
        expect(calculateDistributionComponentAmount(component)).toBe(1_800_000_000);
        expect(component.declaredTotalAmount).toBeNull();
    });

    it("accepts a program link and the explicit support period", () => {
        const result = distributionOrderCreateSchema.safeParse({
            ...monthlyOrder,
            programId: "11111111-1111-4111-8111-111111111111",
            components: [{ ...monthlyOrder.components[0], periodStart: "2026-01-01", periodEnd: "2026-12-31" }]
        });
        expect(result.success).toBe(true);
    });

    it("rejects a support period that ends before it starts", () => {
        const result = distributionOrderCreateSchema.safeParse({
            ...monthlyOrder,
            components: [{ ...monthlyOrder.components[0], periodStart: "2026-12-01", periodEnd: "2026-01-01" }]
        });
        expect(result.success).toBe(false);
    });

    it("accepts several components under one official document", () => {
        const component = monthlyOrder.components[0]!;
        const result = distributionOrderCreateSchema.safeParse({
            ...monthlyOrder,
            documentNumber: "1433/MTTQ-BTT",
            components: [component, { ...component, name: "Xe đạp", unitLabel: "chiếc", unitAmount: 1_600_000, period: "ONCE", periodCount: 1 }]
        });
        expect(result.success).toBe(true);
    });

    it("accepts organization allocations without inventing locality codes", () => {
        const result = distributionOrderCreateSchema.safeParse({
            ...monthlyOrder,
            components: [{
                ...monthlyOrder.components[0],
                period: "ONCE",
                periodCount: 1,
                allocations: [{ type: "ORGANIZATION", organizationId: "11111111-1111-4111-8111-111111111111", allocatedQuantity: 100 }]
            }]
        });
        expect(result.success).toBe(true);
    });

    it("rejects unreconciled quantities and duplicate localities", () => {
        const result = distributionOrderCreateSchema.safeParse({
            ...monthlyOrder,
            components: [{ ...monthlyOrder.components[0], allocations: [locality, locality] }]
        });
        expect(result.success).toBe(false);
    });

    it("rejects a declared total different from the calculated periodic amount", () => {
        const result = distributionOrderCreateSchema.safeParse({
            ...monthlyOrder,
            components: [{ ...monthlyOrder.components[0], declaredTotalAmount: 150_000_000 }]
        });
        expect(result.success).toBe(false);
    });

    it("preserves exclusive submission deadlines stated in official documents", () => {
        const result = distributionOrderCreateSchema.safeParse({
            ...monthlyOrder,
            submissionDeadline: "2025-12-05",
            submissionDeadlineExclusive: true
        });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.submissionDeadlineExclusive).toBe(true);
    });

    it("accepts a private proposed beneficiary without fabricating a household link", () => {
        const result = distributionBeneficiaryCreateSchema.safeParse({
            componentId: "11111111-1111-4111-8111-111111111111",
            targetId: "22222222-2222-4222-8222-222222222222",
            fullName: "Nguyễn Văn A",
            birthYear: 1970,
            localityDetails: "Ấp Trường Thọ",
            eligibilityDetails: "Hộ cận nghèo",
            status: "PROPOSED"
        });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.householdId).toBeUndefined();
    });

    it("rejects beneficiaries without a stored allocation target", () => {
        const result = distributionBeneficiaryCreateSchema.safeParse({
            componentId: "11111111-1111-4111-8111-111111111111",
            fullName: "Nguyễn Văn A",
            status: "PROPOSED"
        });
        expect(result.success).toBe(false);
    });

    it("rejects caller-supplied locality scope so the server must resolve it from the stored target", () => {
        const result = distributionBeneficiaryCreateSchema.safeParse({
            componentId: "11111111-1111-4111-8111-111111111111",
            targetId: "22222222-2222-4222-8222-222222222222",
            fullName: "Nguyễn Văn A",
            provinceCode: "92",
            wardCode: "31348",
            status: "PROPOSED"
        });
        expect(result.success).toBe(false);
    });
});

describe("social assistance distribution persistence schema", () => {
    it("keeps orders, components, targets and private beneficiaries in separate workspace-scoped tables", () => {
        const tables = [
            socialAssistanceDistributionOrders,
            socialAssistanceDistributionComponents,
            socialAssistanceDistributionTargets,
            socialAssistanceDistributionBeneficiaries
        ];
        expect(tables.map((table) => getTableConfig(table).name)).toEqual([
            "social_assistance_distribution_orders",
            "social_assistance_distribution_components",
            "social_assistance_distribution_targets",
            "social_assistance_distribution_beneficiaries"
        ]);
        for (const table of tables) {
            expect(getTableConfig(table).columns.some((column) => column.name === "workspace_id" && column.notNull)).toBe(true);
        }
    });

    it("keeps identifiable beneficiary fields out of public allocation records", () => {
        const targetColumns = getTableConfig(socialAssistanceDistributionTargets).columns.map((column) => column.name);
        const beneficiaryColumns = getTableConfig(socialAssistanceDistributionBeneficiaries).columns.map((column) => column.name);
        expect(targetColumns).not.toContain("full_name");
        expect(targetColumns).not.toContain("birth_year");
        expect(beneficiaryColumns).toContain("full_name");
        expect(beneficiaryColumns).toContain("birth_year");
    });

    it("uses the application schema for organization targets", () => {
        expect(getTableConfig(organizations).schema).toBe(getTableConfig(socialAssistanceDistributionTargets).schema);
    });

    it("binds optional legacy batches and programs to the same workspace", () => {
        const foreignKeys = getTableConfig(socialAssistanceDistributionOrders).foreignKeys.map((key) => ({
            columns: key.reference().columns.map((column) => column.name),
            foreignColumns: key.reference().foreignColumns.map((column) => column.name)
        }));
        expect(foreignKeys).toEqual(expect.arrayContaining([
            { columns: ["legacy_batch_id", "workspace_id"], foreignColumns: ["id", "workspace_id"] },
            { columns: ["program_id", "workspace_id"], foreignColumns: ["id", "workspace_id"] },
            { columns: ["supersedes_order_id", "workspace_id"], foreignColumns: ["id", "workspace_id"] }
        ]));
    });
});
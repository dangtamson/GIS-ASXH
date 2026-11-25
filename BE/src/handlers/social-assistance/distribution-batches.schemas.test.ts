import { describe, expect, it } from "vitest";
import {
    distributionBatchCreateSchema,
    distributionBatchStatusSchema,
    canTransitionDistributionBatch
} from "./distribution-batches.schemas.ts";

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
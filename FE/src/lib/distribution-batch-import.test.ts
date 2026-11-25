import assert from "node:assert/strict";
import test from "node:test";
import { normalizeDistributionLineImportRows } from "./distribution-batch-import.ts";

const localities = [
    { provinceCode: "92", provinceLabel: "Cần Thơ", wardCode: "31117", wardLabel: "Ninh Kiều" },
    { provinceCode: "92", provinceLabel: "Cần Thơ", wardCode: "31118", wardLabel: "Cái Răng" }
];

test("normalizes Vietnamese locality headers and matches official locality names", () => {
    const result = normalizeDistributionLineImportRows([
        { "Tỉnh/thành phố": "Cần Thơ", "Xã/phường": "Ninh Kiều", "Số lượng": "4" },
        { "Tỉnh/thành phố": "Cần Thơ", "Xã/phường": "Cái Răng", "Số lượng": 2 }
    ], localities);

    assert.deepEqual(result, {
        lines: [
            { provinceCode: "92", wardCode: "31117", allocatedQuantity: 4 },
            { provinceCode: "92", wardCode: "31118", allocatedQuantity: 2 }
        ],
        errors: []
    });
});

test("accepts canonical locality codes as an alternate input", () => {
    const result = normalizeDistributionLineImportRows([
        { provinceCode: " 92 ", wardCode: " 31117 ", allocatedQuantity: "3" }
    ], localities);

    assert.deepEqual(result.lines, [{ provinceCode: "92", wardCode: "31117", allocatedQuantity: 3 }]);
    assert.deepEqual(result.errors, []);
});

test("reports row-specific errors for invalid quantities, unknown locations, and duplicates", () => {
    const result = normalizeDistributionLineImportRows([
        { provinceCode: "92", wardCode: "31117", allocatedQuantity: "1.5" },
        { provinceCode: "92", wardCode: "99999", allocatedQuantity: 1 },
        { provinceCode: "92", wardCode: "31118", allocatedQuantity: 0 },
        { provinceCode: "92", wardCode: "31117", allocatedQuantity: 2 },
        { provinceCode: "92", wardCode: "31117", allocatedQuantity: 3 }
    ], localities);

    assert.deepEqual(result.lines, [
        { provinceCode: "92", wardCode: "31117", allocatedQuantity: 2 }
    ]);
    assert.deepEqual(result.errors.map(({ rowNumber, field }) => ({ rowNumber, field })), [
        { rowNumber: 2, field: "allocatedQuantity" },
        { rowNumber: 3, field: "wardCode" },
        { rowNumber: 4, field: "allocatedQuantity" },
        { rowNumber: 6, field: "wardCode" }
    ]);
});
import test from "node:test";
import assert from "node:assert/strict";
import type { HouseholdSupport } from "@/types/poverty";
import { getSupportTotalAmount, sortHouseholdSupports, supportTypeLabel } from "./poverty-support-utils.ts";

test("supportTypeLabel returns Vietnamese labels", () => {
    assert.equal(supportTypeLabel("HOUSING"), "Nhà cửa");
    assert.equal(supportTypeLabel("CASH"), "Tiền mặt");
    assert.equal(supportTypeLabel("UNKNOWN"), "UNKNOWN");
});

test("getSupportTotalAmount sums numeric amounts only", () => {
    const support = {
        amounts: {
            HOUSING: 1200000,
            CASH: 300000,
            HEALTHCARE: null,
        },
    } as unknown as HouseholdSupport;

    assert.equal(getSupportTotalAmount(support), 1500000);
});

test("sortHouseholdSupports orders from oldest to newest", () => {
    const supports = [
        { id: "3", supportDate: "2025-01-01", createdAt: "2025-01-02T00:00:00Z" },
        { id: "1", supportDate: "2024-01-01", createdAt: "2024-01-02T00:00:00Z" },
        { id: "2", supportDate: "2024-01-01", createdAt: "2024-01-03T00:00:00Z" },
    ] as HouseholdSupport[];

    assert.deepEqual(sortHouseholdSupports(supports).map((item) => item.id), ["1", "2", "3"]);
});

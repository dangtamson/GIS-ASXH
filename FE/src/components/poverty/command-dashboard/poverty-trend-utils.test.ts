import assert from "node:assert/strict";
import test from "node:test";

import {
    MONTH_LABELS,
    buildMonthlyDashboardTrendPoints,
    buildYearlyDashboardTrendPoints,
    calculateDashboardTrendChangePercent,
    resolveDefaultDashboardTrendYear,
} from "./poverty-trend-utils.ts";

test("resolveDefaultDashboardTrendYear prefers the newest available year", () => {
    assert.equal(resolveDefaultDashboardTrendYear([2024, 2026, 2025]), 2026);
});

test("resolveDefaultDashboardTrendYear falls back to monthly trend data when year list is missing", () => {
    assert.equal(
        resolveDefaultDashboardTrendYear(undefined, [
            { year: 2025, months: [] },
            { year: 2026, months: [] },
        ]),
        2026
    );
});

test("buildYearlyDashboardTrendPoints sorts years ascending", () => {
    assert.deepEqual(
        buildYearlyDashboardTrendPoints([
            { year: 2026, poor: 4, nearPoor: 2, total: 6 },
            { year: 2024, poor: 5, nearPoor: 3, total: 8 },
            { year: 2025, poor: 3, nearPoor: 1, total: 4 },
        ]).map((item) => item.year),
        [2024, 2025, 2026]
    );
});

test("buildMonthlyDashboardTrendPoints expands the selected year to all 12 months", () => {
    const result = buildMonthlyDashboardTrendPoints(
        [
            {
                year: 2026,
                months: [
                    { month: 1, poor: 2, nearPoor: 1, total: 3 },
                    { month: 3, poor: 1, nearPoor: 0, total: 1 },
                ],
            },
        ],
        2026
    );

    assert.equal(result.year, 2026);
    assert.equal(result.points.length, 12);
    assert.equal(result.points[0]?.total, 3);
    assert.equal(result.points[1]?.total, 0);
    assert.equal(result.points[2]?.poor, 1);
    assert.deepEqual(MONTH_LABELS.slice(0, 3), ["T1", "T2", "T3"]);
});

test("buildMonthlyDashboardTrendPoints falls back to the newest year when selected year is unavailable", () => {
    const result = buildMonthlyDashboardTrendPoints(
        [
            { year: 2024, months: [{ month: 12, poor: 1, nearPoor: 0, total: 1 }] },
            { year: 2026, months: [{ month: 1, poor: 0, nearPoor: 2, total: 2 }] },
        ],
        2025
    );

    assert.equal(result.year, 2026);
    assert.equal(result.points[0]?.nearPoor, 2);
});

test("calculateDashboardTrendChangePercent returns zero when there is no usable baseline", () => {
    assert.equal(calculateDashboardTrendChangePercent([0, 4, 8]), 0);
    assert.equal(calculateDashboardTrendChangePercent([5]), 0);
});

test("calculateDashboardTrendChangePercent returns rounded percentage growth", () => {
    assert.equal(calculateDashboardTrendChangePercent([10, 12, 15]), 50);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
    buildPovertyMapAreaSummaries,
    buildPovertyDashboardQuery,
    DEFAULT_CANTHO_PROVINCE_CODE,
    filterPovertyMarkersBySelectedArea,
    getInitialProvinceCode,
    hasUnresolvedStandardizedLocation,
    resolvePovertyDashboardSelectedWardName,
    shouldShowPovertyDashboardLocationSelect,
} from "./poverty-location-utils.ts";
import type { PovertyMarker } from "@/types/poverty";

test("getInitialProvinceCode defaults to Can Tho when no province is selected", () => {
    assert.equal(getInitialProvinceCode(undefined), DEFAULT_CANTHO_PROVINCE_CODE);
    assert.equal(getInitialProvinceCode(""), DEFAULT_CANTHO_PROVINCE_CODE);
    assert.equal(getInitialProvinceCode("92"), "92");
});

test("hasUnresolvedStandardizedLocation detects legacy snapshot-only rows", () => {
    assert.equal(
        hasUnresolvedStandardizedLocation({
            provinceName: "Thanh pho Can Tho",
            wardName: "Phuong An Khanh",
            areaName: "Khu vuc 1",
        }),
        true
    );

    assert.equal(
        hasUnresolvedStandardizedLocation({
            provinceCode: "92",
            wardCode: "31117",
            areaId: "9fb97875-4916-41b8-8151-b0d655e0352b",
            provinceName: "Thanh pho Can Tho",
        }),
        false
    );
});

test("buildPovertyDashboardQuery serializes province and ward filters", () => {
    assert.equal(buildPovertyDashboardQuery({}), "");
    assert.equal(buildPovertyDashboardQuery({ provinceCode: "92" }), "provinceCode=92");
    assert.equal(
        buildPovertyDashboardQuery({ provinceCode: "92", wardCode: "31117" }),
        "provinceCode=92&wardCode=31117"
    );
});

test("shouldShowPovertyDashboardLocationSelect only enables superadmin controls", () => {
    assert.equal(shouldShowPovertyDashboardLocationSelect(true), true);
    assert.equal(shouldShowPovertyDashboardLocationSelect(false), false);
});

test("resolvePovertyDashboardSelectedWardName prefers the selected ward option label", () => {
    assert.equal(
        resolvePovertyDashboardSelectedWardName({
            selectedWardCode: "31117",
            wardOptions: [
                { code: "31117", name: "An Khánh", fullName: "Phường An Khánh" },
                { code: "31120", name: "Hung Loi", fullName: "Phường Hưng Lợi" },
            ],
            markerWardNames: ["Phường Hưng Lợi"],
        }),
        "An Khánh"
    );
});

test("resolvePovertyDashboardSelectedWardName falls back to a single ward name from markers", () => {
    assert.equal(
        resolvePovertyDashboardSelectedWardName({
            markerWardNames: ["Phường An Khánh", "Phường An Khánh", null],
        }),
        "An Khánh"
    );

    assert.equal(
        resolvePovertyDashboardSelectedWardName({
            markerWardNames: ["Phường An Khánh", "Phường Hưng Lợi"],
        }),
        undefined
    );
});

test("buildPovertyMapAreaSummaries groups and sorts area cards from current markers", () => {
    const markers: PovertyMarker[] = [
        { id: "1", year: 2026, povertyType: "POOR", areaId: "b", areaName: "Khu vực 2" },
        { id: "2", year: 2026, povertyType: "NEAR_POOR", areaId: "a", areaName: "Khu vực 1" },
        { id: "3", year: 2026, povertyType: "POOR", areaId: "a", areaName: "Khu vực 1" },
        { id: "4", year: 2026, povertyType: "NONE", areaName: "Khu vực chưa mã" },
    ];

    assert.deepEqual(buildPovertyMapAreaSummaries(markers), [
        { key: "id:a", areaId: "a", areaName: "Khu vực 1", totalCount: 2, poorCount: 1, nearPoorCount: 1 },
        { key: "id:b", areaId: "b", areaName: "Khu vực 2", totalCount: 1, poorCount: 1, nearPoorCount: 0 },
        { key: "name:khu vuc chua ma", areaId: null, areaName: "Khu vực chưa mã", totalCount: 1, poorCount: 0, nearPoorCount: 0 },
    ]);
});

test("filterPovertyMarkersBySelectedArea narrows the marker set by the selected area key", () => {
    const markers: PovertyMarker[] = [
        { id: "1", year: 2026, povertyType: "POOR", areaId: "a", areaName: "Khu vực 1" },
        { id: "2", year: 2026, povertyType: "NEAR_POOR", areaId: "b", areaName: "Khu vực 2" },
        { id: "3", year: 2026, povertyType: "POOR", areaName: "Khu vực chưa mã" },
    ];

    assert.deepEqual(
        filterPovertyMarkersBySelectedArea(markers, "id:a").map((item) => item.id),
        ["1"]
    );
    assert.deepEqual(
        filterPovertyMarkersBySelectedArea(markers, "name:khu vuc chua ma").map((item) => item.id),
        ["3"]
    );
    assert.equal(filterPovertyMarkersBySelectedArea(markers, null).length, 3);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
    buildCommandMapHeatmapPoints,
    doesCommandMapFeatureMatchSelection,
    filterCommandMapItemsBySelection,
    filterCommandMapMarkersBySelection,
    getCommandMapFocusConfig,
    getCommandMapFeatureAliases,
    resolveCommandMapFeatureDisplayName,
    shouldFocusCommandMapSelection,
} from "./PovertyCommandMap.utils.ts";

test("getCommandMapFeatureAliases includes feature name and merged legacy names", () => {
    assert.deepEqual(
        getCommandMapFeatureAliases({
            name: "Tân An",
            mergedFrom: "An Khánh, Hưng Lợi, Bùi Hữu Nghĩa (1 phần)",
        }),
        ["Tân An", "An Khánh", "Hưng Lợi", "Bùi Hữu Nghĩa"]
    );
});

test("doesCommandMapFeatureMatchSelection matches direct and merged legacy names", () => {
    const feature = {
        name: "Tân An",
        mergedFrom: "An Khánh, Hưng Lợi",
    };

    assert.equal(doesCommandMapFeatureMatchSelection(feature, "Tân An"), true);
    assert.equal(doesCommandMapFeatureMatchSelection(feature, "An Khánh"), true);
    assert.equal(doesCommandMapFeatureMatchSelection(feature, "Hưng Lợi"), true);
    assert.equal(doesCommandMapFeatureMatchSelection(feature, "Ninh Kiều"), false);
});

test("filterCommandMapItemsBySelection keeps the full map when no polygon matches", () => {
    const items = [
        { name: "Tân An", mergedFrom: "An Khánh, Hưng Lợi" },
        { name: "Ninh Kiều", mergedFrom: "Tân An, Thới Bình, Xuân Khánh" },
    ];

    assert.deepEqual(
        filterCommandMapItemsBySelection(items, "Không tồn tại"),
        items
    );

    assert.deepEqual(
        filterCommandMapItemsBySelection(items, "An Khánh"),
        [{ name: "Tân An", mergedFrom: "An Khánh, Hưng Lợi" }]
    );
});

test("resolveCommandMapFeatureDisplayName prefers the selected legacy ward label when matched via mergedFrom", () => {
    assert.equal(
        resolveCommandMapFeatureDisplayName(
            { name: "Tân An", mergedFrom: "An Khánh, Hưng Lợi" },
            "An Khánh"
        ),
        "An Khánh"
    );

    assert.equal(
        resolveCommandMapFeatureDisplayName(
            { name: "Ninh Kiều", mergedFrom: "Tân An, Thới Bình, Xuân Khánh" },
            undefined
        ),
        "Ninh Kiều"
    );
});

test("filterCommandMapMarkersBySelection keeps only markers inside the selected ward when matched", () => {
    const markers = [
        { id: "marker-1", wardName: "An Khánh", areaName: "Khu vực 1" },
        { id: "marker-2", wardName: "Hưng Lợi", areaName: "Khu vực 2" },
    ];

    assert.deepEqual(
        filterCommandMapMarkersBySelection(markers, "An Khánh"),
        [{ id: "marker-1", wardName: "An Khánh", areaName: "Khu vực 1" }]
    );

    assert.deepEqual(
        filterCommandMapMarkersBySelection(markers, "Không tồn tại"),
        markers
    );
});

test("buildCommandMapHeatmapPoints projects valid markers into weighted heatmap points", () => {
    const points = buildCommandMapHeatmapPoints(
        [
            { id: "poor-1", latitude: 10.03, longitude: 105.77, povertyType: "POOR" },
            { id: "near-1", latitude: 10.04, longitude: 105.78, povertyType: "NEAR_POOR" },
            { id: "bad-1", latitude: undefined, longitude: 105.78, povertyType: "POOR" },
        ],
        (coords) => [coords[0] * 10, coords[1] * 10]
    );

    assert.equal(points.length, 2);
    assert.deepEqual(
        points.map((point) => ({ id: point.id, value: point.value, povertyType: point.povertyType })),
        [
            { id: "poor-1", value: 1, povertyType: "POOR" },
            { id: "near-1", value: 1, povertyType: "NEAR_POOR" },
        ]
    );
    assert.ok(Math.abs(points[0].x - 1057.7) < 0.000001);
    assert.ok(Math.abs(points[0].y + 100.3) < 0.000001);
    assert.ok(Math.abs(points[1].x - 1057.8) < 0.000001);
    assert.ok(Math.abs(points[1].y + 100.4) < 0.000001);
});

test("buildCommandMapHeatmapPoints ignores non-finite projection results", () => {
    const points = buildCommandMapHeatmapPoints(
        [{ id: "poor-1", latitude: 10.03, longitude: 105.77, povertyType: "POOR" }],
        () => [Number.NaN, Number.POSITIVE_INFINITY]
    );

    assert.deepEqual(points, []);
});

test("buildCommandMapHeatmapPoints keeps markers already filtered by selected region", () => {
    const markers = filterCommandMapMarkersBySelection(
        [
            { id: "a", wardName: "An Khánh", latitude: 10.03, longitude: 105.77, povertyType: "POOR" },
            { id: "b", wardName: "Hưng Lợi", latitude: 10.05, longitude: 105.79, povertyType: "NEAR_POOR" },
        ],
        "An Khánh"
    );

    const points = buildCommandMapHeatmapPoints(markers, (coords) => [coords[0], coords[1]]);

    assert.deepEqual(points, [
        { id: "a", x: 105.77, y: -10.03, value: 1, povertyType: "POOR" },
    ]);
});

test("buildCommandMapHeatmapPoints preserves non-unit weights for future emphasis rules", () => {
    const points = buildCommandMapHeatmapPoints(
        [
            { id: "poor-1", latitude: 10, longitude: 105, povertyType: "POOR", heatValue: 2 },
            { id: "near-1", latitude: 10.1, longitude: 105.1, povertyType: "NEAR_POOR", heatValue: 1 },
        ],
        (coords) => [coords[0], coords[1]]
    );

    assert.deepEqual(points, [
        { id: "poor-1", x: 105, y: -10, value: 2, povertyType: "POOR" },
        { id: "near-1", x: 105.1, y: -10.1, value: 1, povertyType: "NEAR_POOR" },
    ]);
});

test("getCommandMapFocusConfig zooms deeper when deep focus is preferred", () => {
    const normalFocus = getCommandMapFocusConfig({
        selectedRegionSize: 40,
        fullMapSize: 200,
        preferDeepFocus: false,
    });
    const deepFocus = getCommandMapFocusConfig({
        selectedRegionSize: 40,
        fullMapSize: 200,
        preferDeepFocus: true,
    });

    assert.ok(deepFocus.selectedRegionScale > normalFocus.selectedRegionScale);
    assert.ok(deepFocus.focusDistance < normalFocus.focusDistance);
    assert.ok(deepFocus.minDistance < normalFocus.minDistance);
    assert.ok(deepFocus.maxDistance < normalFocus.maxDistance);
});

test("shouldFocusCommandMapSelection only enables focused region mode when the filtered region list is singular", () => {
    assert.equal(
        shouldFocusCommandMapSelection({
            selectedRegionName: "An Khánh",
            visibleRegionCount: 1,
        }),
        true
    );

    assert.equal(
        shouldFocusCommandMapSelection({
            selectedRegionName: "An Khánh",
            visibleRegionCount: 9,
        }),
        false
    );

    assert.equal(
        shouldFocusCommandMapSelection({
            selectedRegionName: undefined,
            visibleRegionCount: 1,
        }),
        false
    );
});

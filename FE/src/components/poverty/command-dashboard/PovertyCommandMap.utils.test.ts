import test from "node:test";
import assert from "node:assert/strict";
import {
    doesCommandMapFeatureMatchSelection,
    filterCommandMapItemsBySelection,
    filterCommandMapMarkersBySelection,
    getCommandMapFocusConfig,
    getCommandMapFeatureAliases,
    resolveCommandMapFeatureDisplayName,
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

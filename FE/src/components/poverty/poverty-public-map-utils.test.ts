import assert from "node:assert/strict";
import test from "node:test";
import type { FeatureCollection, Geometry } from "geojson";

import {
    getPublicClusterInteractionOptions,
    getPublicMapFitBoundsOptions,
    buildPublicWardBoundaryGeoJson,
    buildPublicWardHouseholdListDescription,
    getPublicMapHeightClass,
    buildPublicWardMapTitle,
    getPublicBaseLayerLabel,
    buildPublicAreaSlug,
    buildPublicPovertyAreaDetailUrl,
    buildPublicPovertyAreaSummaries,
    buildPublicPovertyHouseholdDetailUrl,
    buildPovertyWardPublicUrl,
    filterPublicPovertyMarkers,
    PUBLIC_MAP_INITIAL_LOADER_EXIT_MS,
    PUBLIC_MAP_INITIAL_LOADER_MIN_MS,
    shouldShowPublicMapHeroLoader,
    shouldStartPublicMapHeroLoaderExit,
} from "./poverty-public-map-utils.ts";
import type { PublicPovertyMarker } from "@/types/poverty";

test("buildPovertyWardPublicUrl appends the slug to the public route", () => {
    assert.equal(
        buildPovertyWardPublicUrl("ward-slug-123", "https://example.com"),
        "https://example.com/ban-do-ho-ngheo-cong-khai/ward-slug-123"
    );
});

test("buildPovertyWardPublicUrl trims a trailing slash from the origin", () => {
    assert.equal(
        buildPovertyWardPublicUrl("ward-slug-123", "https://example.com/"),
        "https://example.com/ban-do-ho-ngheo-cong-khai/ward-slug-123"
    );
});

test("buildPublicPovertyAreaDetailUrl nests the area route under the public ward slug", () => {
    assert.equal(
        buildPublicPovertyAreaDetailUrl("ward-public-abc", "phu-tri-b1--0d7ce58c", "https://example.com"),
        "https://example.com/ban-do-ho-ngheo-cong-khai/ward-public-abc/khu-vuc/phu-tri-b1--0d7ce58c"
    );
});

test("buildPublicAreaSlug creates a readable slug with the shortened area id suffix", () => {
    assert.equal(
        buildPublicAreaSlug("Phu Tri B1", "0d7ce58c-4137-4db3-8132-a4eb56d6411f"),
        "phu-tri-b1--0d7ce58c"
    );
});

test("ward-level public map copy stays scoped to the full ward view", () => {
    assert.equal(buildPublicWardMapTitle("Phu Huu"), "Bản đồ số hộ nghèo Phu Huu");
    assert.equal(
        buildPublicWardHouseholdListDescription(),
        "Tổng hợp các hộ trong xã/phường công khai."
    );
});

test("getPublicBaseLayerLabel returns the current public map layer label", () => {
    assert.equal(getPublicBaseLayerLabel("streets"), "Đường phố");
    assert.equal(getPublicBaseLayerLabel("satellite"), "Vệ tinh");
    assert.equal(getPublicBaseLayerLabel("hybrid"), "Hybrid");
    assert.equal(getPublicBaseLayerLabel("streets", "compact"), "Đường");
    assert.equal(getPublicBaseLayerLabel("satellite", "compact"), "Vệ tinh");
});

test("getPublicMapHeightClass expands mobile map height by view type", () => {
    assert.equal(getPublicMapHeightClass("ward"), "h-[560px] md:h-[620px]");
    assert.equal(getPublicMapHeightClass("area"), "h-[480px] md:h-[460px]");
    assert.equal(getPublicMapHeightClass("household"), "h-[420px] md:h-[380px]");
});

test("getPublicClusterInteractionOptions disables automatic zoom bounce on cluster tap", () => {
    const options = getPublicClusterInteractionOptions();

    assert.equal(options.zoomToBoundsOnClick, false);
    assert.equal(options.spiderfyOnMaxZoom, false);
    assert.equal(options.disableClusteringAtZoom, 18);
});

test("getPublicMapFitBoundsOptions disables animation to keep first marker tap stable", () => {
    const options = getPublicMapFitBoundsOptions();

    assert.deepEqual(options.padding, [48, 48]);
    assert.equal(options.maxZoom, 17);
    assert.equal(options.animate, false);
});

test("public map hero loader uses the agreed timing budget", () => {
    assert.equal(PUBLIC_MAP_INITIAL_LOADER_MIN_MS, 900);
    assert.equal(PUBLIC_MAP_INITIAL_LOADER_EXIT_MS, 300);
});

test("shouldShowPublicMapHeroLoader keeps the loader visible during the first request", () => {
    assert.equal(
        shouldShowPublicMapHeroLoader({
            loading: true,
            hasLoadedOnce: false,
            hasData: false,
            hasError: false,
            minimumDelayReached: false,
            isExitAnimating: false,
        }),
        true
    );
});

test("shouldShowPublicMapHeroLoader hides the loader when the first request fails", () => {
    assert.equal(
        shouldShowPublicMapHeroLoader({
            loading: false,
            hasLoadedOnce: false,
            hasData: false,
            hasError: true,
            minimumDelayReached: true,
            isExitAnimating: false,
        }),
        false
    );
});

test("shouldStartPublicMapHeroLoaderExit waits for data and the minimum delay", () => {
    assert.equal(
        shouldStartPublicMapHeroLoaderExit({
            loading: false,
            hasLoadedOnce: false,
            hasData: true,
            hasError: false,
            minimumDelayReached: true,
        }),
        true
    );
});

test("shouldStartPublicMapHeroLoaderExit skips exit when later refetches happen", () => {
    assert.equal(
        shouldStartPublicMapHeroLoaderExit({
            loading: false,
            hasLoadedOnce: true,
            hasData: true,
            hasError: false,
            minimumDelayReached: true,
        }),
        false
    );
});

test("buildPublicPovertyAreaSummaries groups markers by area and sorts by total desc", () => {
    const summaries = buildPublicPovertyAreaSummaries([
        { id: "1", areaId: "a-1", areaName: "Phu Tri B1", povertyType: "NEAR_POOR" },
        { id: "2", areaId: "a-1", areaName: "Phu Tri B1", povertyType: "POOR" },
        { id: "3", areaId: "a-2", areaName: "Phu Tri B2", povertyType: "NONE" },
    ] as PublicPovertyMarker[]);

    assert.deepEqual(summaries.map((item) => item.areaName), ["Phu Tri B1", "Phu Tri B2"]);
    assert.equal(summaries[0]?.totalCount, 2);
    assert.equal(summaries[0]?.poorCount, 1);
    assert.equal(summaries[0]?.nearPoorCount, 1);
});

test("filterPublicPovertyMarkers keeps only households matching search type and area", () => {
    const items = filterPublicPovertyMarkers(
        [
            { id: "1", headFullName: "Nguyen Thanh Thuy", areaId: "a-1", areaName: "Phu Tri B1", povertyType: "NEAR_POOR" },
            { id: "2", headFullName: "Tran Van B", areaId: "a-2", areaName: "Phu Tri B2", povertyType: "POOR" },
        ] as PublicPovertyMarker[],
        {
            search: "thuy",
            activeAreaId: "a-1",
            povertyFilter: "NEAR_POOR",
        }
    );

    assert.equal(items.length, 1);
    assert.equal(items[0]?.id, "1");
});

test("buildPublicPovertyHouseholdDetailUrl nests the household under the ward slug", () => {
    assert.equal(
        buildPublicPovertyHouseholdDetailUrl("ward-public-abc", "household-1", "https://example.com"),
        "https://example.com/ban-do-ho-ngheo-cong-khai/ward-public-abc/ho/household-1"
    );
});

test("buildPublicWardBoundaryGeoJson keeps only the matching ward polygon", () => {
    const source: FeatureCollection<Geometry, { name?: string; level?: string }> = {
        type: "FeatureCollection",
        features: [
            {
                type: "Feature",
                properties: { name: "Phú Hữu", level: "Xã" },
                geometry: {
                    type: "Polygon",
                    coordinates: [[[105.7, 10.0], [105.8, 10.0], [105.8, 10.1], [105.7, 10.0]]],
                },
            },
            {
                type: "Feature",
                properties: { name: "Long Thọ", level: "Xã" },
                geometry: {
                    type: "Polygon",
                    coordinates: [[[105.6, 10.0], [105.65, 10.0], [105.65, 10.1], [105.6, 10.0]]],
                },
            },
        ],
    };

    const result = buildPublicWardBoundaryGeoJson(source, "Phu Huu");

    assert.equal(result?.type, "FeatureCollection");
    assert.equal(result?.features.length, 1);
    assert.equal(result?.features[0]?.properties?.name, "Phú Hữu");
});

test("buildPublicWardBoundaryGeoJson matches full ward names with administrative prefixes", () => {
    const source: FeatureCollection<Geometry, { name?: string; level?: string }> = {
        type: "FeatureCollection",
        features: [
            {
                type: "Feature",
                properties: { name: "Phú Lợi", level: "Phường" },
                geometry: {
                    type: "Polygon",
                    coordinates: [[[105.7, 10.0], [105.8, 10.0], [105.8, 10.1], [105.7, 10.0]]],
                },
            },
        ],
    };

    const result = buildPublicWardBoundaryGeoJson(source, "Phường Phú Lợi");

    assert.equal(result?.features.length, 1);
    assert.equal(result?.features[0]?.properties?.name, "Phú Lợi");
});

test("buildPublicWardBoundaryGeoJson returns null when the ward polygon is missing", () => {
    const source: FeatureCollection<Geometry, { name?: string }> = {
        type: "FeatureCollection",
        features: [],
    };

    const result = buildPublicWardBoundaryGeoJson(source, "Khong Ton Tai");

    assert.equal(result, null);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
    buildPublicClusterIconHtml,
    buildPublicMarkerIconHtml,
    formatPublicMarkerCoordinate,
    getPublicClusterBadgeSize,
} from "./poverty-public-map-marker-utils.ts";

test("buildPublicMarkerIconHtml uses the poor marker asset for poor households", () => {
    const html = buildPublicMarkerIconHtml("POOR");

    assert.match(html, /poverty-map-marker--poor/);
    assert.match(html, /\/images\/poverty\/marker-poor\.png/);
});

test("buildPublicMarkerIconHtml uses the near-poor marker asset for near-poor households", () => {
    const nearPoorHtml = buildPublicMarkerIconHtml("NEAR_POOR");

    assert.match(nearPoorHtml, /poverty-map-marker--near-poor/);
    assert.match(nearPoorHtml, /\/images\/poverty\/marker-near-poor\.png/);
});

test("buildPublicMarkerIconHtml uses the normal marker class for regular households", () => {
    const html = buildPublicMarkerIconHtml("NONE");

    assert.match(html, /poverty-map-marker--normal/);
    assert.match(html, /poverty-map-marker__dot/);
    assert.doesNotMatch(html, /marker-poor\.png/);
    assert.doesNotMatch(html, /marker-near-poor\.png/);
});

test("getPublicClusterBadgeSize matches the admin cluster thresholds", () => {
    assert.equal(getPublicClusterBadgeSize(1), 40);
    assert.equal(getPublicClusterBadgeSize(10), 46);
    assert.equal(getPublicClusterBadgeSize(100), 52);
});

test("buildPublicClusterIconHtml renders the child count inside the cluster badge html", () => {
    const html = buildPublicClusterIconHtml(24);

    assert.match(html, /width:46px/);
    assert.match(html, />24</);
    assert.match(html, /background:#0f766e/);
});

test("formatPublicMarkerCoordinate trims valid coordinates to five decimals", () => {
    assert.equal(formatPublicMarkerCoordinate(10.1234567), "10.12346");
    assert.equal(formatPublicMarkerCoordinate(105.7654321), "105.76543");
});

test("formatPublicMarkerCoordinate returns fallback text for missing coordinates", () => {
    assert.equal(formatPublicMarkerCoordinate(null), "-");
    assert.equal(formatPublicMarkerCoordinate(undefined), "-");
});

import test from "node:test";
import assert from "node:assert/strict";
import { Box2, Vector2 } from "three";
import {
    buildHeatmapCanvasData,
    getHeatmapGradientStops,
} from "./PovertyCommandHeatmap.utils.ts";

test("buildHeatmapCanvasData maps projected points into canvas coordinates inside bbox", () => {
    const bbox = new Box2(new Vector2(-50, -20), new Vector2(50, 80));
    const result = buildHeatmapCanvasData({
        bbox,
        canvasSize: 200,
        points: [
            { id: "p1", x: -50, y: -20, value: 1, povertyType: "POOR" },
            { id: "p2", x: 50, y: 80, value: 1, povertyType: "NEAR_POOR" },
        ],
    });

    assert.deepEqual(result.points, [
        { x: 0, y: 200, value: 1 },
        { x: 200, y: 0, value: 1 },
    ]);
    assert.equal(result.max, 1);
});

test("buildHeatmapCanvasData clamps empty input to a safe default", () => {
    const result = buildHeatmapCanvasData({
        bbox: new Box2(new Vector2(0, 0), new Vector2(0, 0)),
        canvasSize: 256,
        points: [],
    });

    assert.deepEqual(result.points, []);
    assert.equal(result.max, 1);
});

test("getHeatmapGradientStops returns stable dashboard colors", () => {
    assert.deepEqual(getHeatmapGradientStops(), {
        0.2: "#fde68a",
        0.4: "#fb923c",
        0.65: "#f97316",
        0.85: "#ef4444",
        1: "#be123c",
    });
});

test("buildHeatmapCanvasData merges repeated rounded positions into stronger heat cells", () => {
    const bbox = new Box2(new Vector2(0, 0), new Vector2(100, 100));
    const result = buildHeatmapCanvasData({
        bbox,
        canvasSize: 100,
        points: [
            { id: "poor-1", x: 25.2, y: 25.4, value: 1, povertyType: "POOR" },
            { id: "poor-2", x: 25.3, y: 25.2, value: 2, povertyType: "POOR" },
            { id: "near-1", x: 75, y: 75, value: 1, povertyType: "NEAR_POOR" },
        ],
    });

    assert.equal(result.max, 3);
    assert.deepEqual(result.points, [
        { x: 25, y: 75, value: 3 },
        { x: 75, y: 25, value: 1 },
    ]);
});

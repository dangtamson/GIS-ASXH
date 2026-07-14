# Poverty Command Dashboard Heatmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-household 3D markers on the poverty command dashboard with a map-bound heatmap layer and rebalance the underlying 3D scene so the heatmap becomes the primary visual surface.

**Architecture:** Keep the existing `PovertyCommandMap` projection, region filtering, and camera focus pipeline. Move heatmap point preparation into pure utilities with tests first, then render the heatmap in a dedicated `react-three-fiber` component that sits inside the same transformed map group as the region meshes. Finally, integrate the new layer and tone down cloud/grid/ring/light intensity so the scene tracks the `Demo1` reference more closely without changing dashboard data flow.

**Tech Stack:** Next.js 16, React 19, TypeScript, node:test, react-three-fiber, drei, three, d3-geo

---

### Task 1: Add heatmap point preparation utilities

**Files:**
- Modify: `FE/src/components/poverty/command-dashboard/PovertyCommandMap.utils.ts`
- Test: `FE/src/components/poverty/command-dashboard/PovertyCommandMap.utils.test.ts`

- [ ] **Step 1: Write the failing tests**

Add these tests to `FE/src/components/poverty/command-dashboard/PovertyCommandMap.utils.test.ts` after the existing marker-selection test:

```ts
test("buildCommandMapHeatmapPoints projects valid markers into weighted heatmap points", () => {
    const points = buildCommandMapHeatmapPoints(
        [
            { id: "poor-1", latitude: 10.03, longitude: 105.77, povertyType: "POOR" },
            { id: "near-1", latitude: 10.04, longitude: 105.78, povertyType: "NEAR_POOR" },
            { id: "bad-1", latitude: undefined, longitude: 105.78, povertyType: "POOR" },
        ],
        (coords) => [coords[0] * 10, coords[1] * 10]
    );

    assert.deepEqual(points, [
        { id: "poor-1", x: 1057.7, y: -100.30000000000001, value: 1, povertyType: "POOR" },
        { id: "near-1", x: 1057.8, y: -100.4, value: 1, povertyType: "NEAR_POOR" },
    ]);
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
```

Also extend the import list at the top of the file:

```ts
import {
    buildCommandMapHeatmapPoints,
    doesCommandMapFeatureMatchSelection,
    filterCommandMapItemsBySelection,
    filterCommandMapMarkersBySelection,
    getCommandMapFocusConfig,
    getCommandMapFeatureAliases,
    resolveCommandMapFeatureDisplayName,
} from "./PovertyCommandMap.utils.ts";
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd FE && npm test -- src/components/poverty/command-dashboard/PovertyCommandMap.utils.test.ts`

Expected: FAIL with an error similar to `buildCommandMapHeatmapPoints is not exported` or `is not defined`.

- [ ] **Step 3: Write the minimal implementation**

Append this type and helper to `FE/src/components/poverty/command-dashboard/PovertyCommandMap.utils.ts` below `filterCommandMapMarkersBySelection`:

```ts
export type CommandMapHeatmapPoint = {
    id: string;
    x: number;
    y: number;
    value: number;
    povertyType: string | null | undefined;
};

export const buildCommandMapHeatmapPoints = <
    T extends {
        id?: string | number | null;
        latitude?: number | string | null;
        longitude?: number | string | null;
        povertyType?: string | null;
    },
>(
    markers: T[],
    projection: (coordinates: [number, number]) => [number, number] | null | undefined
): CommandMapHeatmapPoint[] =>
    markers.flatMap((marker) => {
        const latitude = Number(marker.latitude);
        const longitude = Number(marker.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return [];
        }

        const projected = projection([longitude, latitude]);
        if (!projected) {
            return [];
        }

        const [x, y] = projected;
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return [];
        }

        return [{
            id: String(marker.id ?? `${longitude}:${latitude}`),
            x,
            y: -y,
            value: 1,
            povertyType: marker.povertyType,
        }];
    });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd FE && npm test -- src/components/poverty/command-dashboard/PovertyCommandMap.utils.test.ts`

Expected: PASS for all existing tests plus the three new heatmap point tests.

- [ ] **Step 5: Commit**

```bash
git add FE/src/components/poverty/command-dashboard/PovertyCommandMap.utils.ts FE/src/components/poverty/command-dashboard/PovertyCommandMap.utils.test.ts
git commit -m "test: add command dashboard heatmap point utilities"
```

### Task 2: Add canvas-space heatmap layout helpers

**Files:**
- Create: `FE/src/components/poverty/command-dashboard/PovertyCommandHeatmap.utils.ts`
- Create: `FE/src/components/poverty/command-dashboard/PovertyCommandHeatmap.utils.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `FE/src/components/poverty/command-dashboard/PovertyCommandHeatmap.utils.test.ts` with:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd FE && npm test -- src/components/poverty/command-dashboard/PovertyCommandHeatmap.utils.test.ts`

Expected: FAIL with `Cannot find module './PovertyCommandHeatmap.utils.ts'`.

- [ ] **Step 3: Write the minimal implementation**

Create `FE/src/components/poverty/command-dashboard/PovertyCommandHeatmap.utils.ts` with:

```ts
import { Box2 } from "three";
import type { CommandMapHeatmapPoint } from "./PovertyCommandMap.utils";

export const getHeatmapGradientStops = () => ({
    0.2: "#fde68a",
    0.4: "#fb923c",
    0.65: "#f97316",
    0.85: "#ef4444",
    1: "#be123c",
});

export const buildHeatmapCanvasData = (input: {
    bbox: Box2;
    canvasSize: number;
    points: CommandMapHeatmapPoint[];
}) => {
    const width = Math.max(1, input.bbox.max.x - input.bbox.min.x);
    const height = Math.max(1, input.bbox.max.y - input.bbox.min.y);
    const size = Math.max(1, input.canvasSize);
    const mapped = input.points.map((point) => ({
        x: ((point.x - input.bbox.min.x) / width) * size,
        y: size - (((point.y - input.bbox.min.y) / height) * size),
        value: point.value,
    }));

    return {
        points: mapped,
        max: Math.max(1, ...mapped.map((point) => point.value)),
    };
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd FE && npm test -- src/components/poverty/command-dashboard/PovertyCommandHeatmap.utils.test.ts`

Expected: PASS for all three tests.

- [ ] **Step 5: Commit**

```bash
git add FE/src/components/poverty/command-dashboard/PovertyCommandHeatmap.utils.ts FE/src/components/poverty/command-dashboard/PovertyCommandHeatmap.utils.test.ts
git commit -m "test: add command dashboard heatmap canvas helpers"
```

### Task 3: Implement the dedicated heatmap layer component

**Files:**
- Create: `FE/src/components/poverty/command-dashboard/PovertyCommandHeatmapLayer.tsx`
- Modify: `FE/src/components/poverty/command-dashboard/PovertyCommandHeatmap.utils.ts`
- Test: `FE/src/components/poverty/command-dashboard/PovertyCommandHeatmap.utils.test.ts`

- [ ] **Step 1: Write the failing tests**

Extend `FE/src/components/poverty/command-dashboard/PovertyCommandHeatmap.utils.test.ts` with:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd FE && npm test -- src/components/poverty/command-dashboard/PovertyCommandHeatmap.utils.test.ts`

Expected: FAIL because `buildHeatmapCanvasData` still returns duplicate mapped points instead of a merged stronger cell.

- [ ] **Step 3: Write the minimal implementation**

First, update the helper in `FE/src/components/poverty/command-dashboard/PovertyCommandHeatmap.utils.ts` so it rounds canvas positions and merges repeated cells:

```ts
export const buildHeatmapCanvasData = (input: {
    bbox: Box2;
    canvasSize: number;
    points: CommandMapHeatmapPoint[];
}) => {
    const width = Math.max(1, input.bbox.max.x - input.bbox.min.x);
    const height = Math.max(1, input.bbox.max.y - input.bbox.min.y);
    const size = Math.max(1, input.canvasSize);
    const cells = new Map<string, { x: number; y: number; value: number }>();

    input.points.forEach((point) => {
        const x = Math.round(((point.x - input.bbox.min.x) / width) * size);
        const y = Math.round(size - (((point.y - input.bbox.min.y) / height) * size));
        const key = `${x}:${y}`;
        const current = cells.get(key);

        if (current) {
            current.value += point.value;
            return;
        }

        cells.set(key, {
            x,
            y,
            value: point.value,
        });
    });

    const mapped = [...cells.values()];

    return {
        points: mapped,
        max: Math.max(1, ...mapped.map((point) => point.value)),
    };
};
```

Then create `FE/src/components/poverty/command-dashboard/PovertyCommandHeatmapLayer.tsx` with:

```tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { DoubleSide, CanvasTexture, Color, type Mesh, type ShaderMaterial, Box2 } from "three";
import { buildHeatmapCanvasData, getHeatmapGradientStops } from "./PovertyCommandHeatmap.utils";
import type { CommandMapHeatmapPoint } from "./PovertyCommandMap.utils";

const CANVAS_SIZE = 512;
const RADIUS = 28;

function drawHeatTexture(points: { x: number; y: number; value: number }[], max: number) {
    const alphaCanvas = document.createElement("canvas");
    alphaCanvas.width = CANVAS_SIZE;
    alphaCanvas.height = CANVAS_SIZE;
    const alphaCtx = alphaCanvas.getContext("2d");
    if (!alphaCtx) {
        throw new Error("Canvas 2D context is unavailable");
    }

    alphaCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    points.forEach((point) => {
        const gradient = alphaCtx.createRadialGradient(point.x, point.y, 0, point.x, point.y, RADIUS);
        const opacity = Math.max(0.18, point.value / max);
        gradient.addColorStop(0, `rgba(255,255,255,${opacity})`);
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        alphaCtx.fillStyle = gradient;
        alphaCtx.fillRect(point.x - RADIUS, point.y - RADIUS, RADIUS * 2, RADIUS * 2);
    });

    const colorCanvas = document.createElement("canvas");
    colorCanvas.width = CANVAS_SIZE;
    colorCanvas.height = CANVAS_SIZE;
    const colorCtx = colorCanvas.getContext("2d");
    if (!colorCtx) {
        throw new Error("Canvas 2D context is unavailable");
    }

    const image = alphaCtx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    const palette = colorCtx.createLinearGradient(0, 0, 256, 0);
    Object.entries(getHeatmapGradientStops()).forEach(([offset, color]) => {
        palette.addColorStop(Number(offset), color);
    });
    colorCtx.fillStyle = palette;
    colorCtx.fillRect(0, 0, 256, 1);
    const palettePixels = colorCtx.getImageData(0, 0, 256, 1).data;

    for (let index = 0; index < image.data.length; index += 4) {
        const alpha = image.data[index + 3];
        if (alpha === 0) {
            continue;
        }
        const paletteIndex = alpha * 4;
        image.data[index] = palettePixels[paletteIndex];
        image.data[index + 1] = palettePixels[paletteIndex + 1];
        image.data[index + 2] = palettePixels[paletteIndex + 2];
    }

    colorCtx.putImageData(image, 0, 0);
    return new CanvasTexture(colorCanvas);
}

export default function PovertyCommandHeatmapLayer(props: {
    bbox: Box2;
    points: CommandMapHeatmapPoint[];
    visible: boolean;
    zOffset?: number;
}) {
    const { bbox, points, visible, zOffset = 6.8 } = props;
    const meshRef = useRef<Mesh>(null);
    const shaderRef = useRef<ShaderMaterial>(null);
    const layout = useMemo(
        () => buildHeatmapCanvasData({ bbox, canvasSize: CANVAS_SIZE, points }),
        [bbox, points]
    );

    useEffect(() => {
        if (!shaderRef.current) {
            return;
        }

        const texture = drawHeatTexture(layout.points, layout.max);
        texture.needsUpdate = true;
        shaderRef.current.uniforms.heatMap.value = texture;

        return () => {
            texture.dispose();
        };
    }, [layout]);

    const width = Math.max(1, bbox.max.x - bbox.min.x);
    const height = Math.max(1, bbox.max.y - bbox.min.y);
    const centerX = (bbox.min.x + bbox.max.x) / 2;
    const centerY = (bbox.min.y + bbox.max.y) / 2;

    if (!visible || points.length === 0) {
        return null;
    }

    return (
        <mesh ref={meshRef} position={[centerX, centerY, zOffset]} renderOrder={18}>
            <planeGeometry args={[width, height, 128, 128]} />
            <shaderMaterial
                ref={shaderRef}
                transparent
                side={DoubleSide}
                depthWrite={false}
                uniforms={{
                    heatMap: { value: null },
                    uColor: { value: new Color("#ffffff") },
                    uOpacity: { value: 0.92 },
                }}
                vertexShader={`
                    varying vec2 vUv;
                    void main() {
                        vUv = uv;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `}
                fragmentShader={`
                    varying vec2 vUv;
                    uniform sampler2D heatMap;
                    uniform vec3 uColor;
                    uniform float uOpacity;
                    void main() {
                        vec4 tex = texture2D(heatMap, vUv);
                        gl_FragColor = vec4(uColor, uOpacity) * tex;
                    }
                `}
            />
        </mesh>
    );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd FE && npm test -- src/components/poverty/command-dashboard/PovertyCommandHeatmap.utils.test.ts`

Expected: PASS for the existing coordinate-mapping tests and the new merged-cell heatmap test.

- [ ] **Step 5: Commit**

```bash
git add FE/src/components/poverty/command-dashboard/PovertyCommandHeatmap.utils.ts FE/src/components/poverty/command-dashboard/PovertyCommandHeatmap.utils.test.ts FE/src/components/poverty/command-dashboard/PovertyCommandHeatmapLayer.tsx
git commit -m "feat: add poverty command dashboard heatmap layer"
```

### Task 4: Integrate the heatmap into the 3D command map scene

**Files:**
- Modify: `FE/src/components/poverty/command-dashboard/PovertyCommandMap.tsx`
- Modify: `FE/src/components/poverty/command-dashboard/PovertyCommandMap.utils.ts`
- Test: `FE/src/components/poverty/command-dashboard/PovertyCommandMap.utils.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test to `FE/src/components/poverty/command-dashboard/PovertyCommandMap.utils.test.ts`:

```ts
test("buildCommandMapHeatmapPoints preserves non-unit weights so focused regions can emphasize poor households later", () => {
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd FE && npm test -- src/components/poverty/command-dashboard/PovertyCommandMap.utils.test.ts`

Expected: FAIL because `buildCommandMapHeatmapPoints` still hardcodes `value: 1`.

- [ ] **Step 3: Write the minimal implementation**

First, update the helper in `FE/src/components/poverty/command-dashboard/PovertyCommandMap.utils.ts`:

```ts
export const buildCommandMapHeatmapPoints = <
    T extends {
        id?: string | number | null;
        latitude?: number | string | null;
        longitude?: number | string | null;
        povertyType?: string | null;
        heatValue?: number | null;
    },
>(
    markers: T[],
    projection: (coordinates: [number, number]) => [number, number] | null | undefined
): CommandMapHeatmapPoint[] =>
    markers.flatMap((marker) => {
        const latitude = Number(marker.latitude);
        const longitude = Number(marker.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return [];
        }

        const projected = projection([longitude, latitude]);
        if (!projected) {
            return [];
        }

        const [x, y] = projected;
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return [];
        }

        return [{
            id: String(marker.id ?? `${longitude}:${latitude}`),
            x,
            y: -y,
            value: Math.max(1, Number(marker.heatValue ?? 1)),
            povertyType: marker.povertyType,
        }];
    });
```

Then update `FE/src/components/poverty/command-dashboard/PovertyCommandMap.tsx`:

1. Replace the old marker projection helper import and add the new heatmap layer import:

```ts
import PovertyCommandHeatmapLayer from "./PovertyCommandHeatmapLayer";
import {
    buildCommandMapHeatmapPoints,
    filterCommandMapMarkersBySelection,
    filterCommandMapItemsBySelection,
    getCommandMapFocusConfig,
    resolveCommandMapFeatureDisplayName,
} from "./PovertyCommandMap.utils";
```

2. Delete the `HouseholdPoint` component entirely.

3. Replace `useMapMarkers` with a pure projection adapter:

```ts
function useHeatmapPoints(markers: PovertyMarker[], projection: GeoProjection) {
    return useMemo(
        () => buildCommandMapHeatmapPoints(markers, (coordinates) => {
            const projected = projection(coordinates);
            return projected ? [projected[0], projected[1]] : null;
        }),
        [markers, projection]
    );
}
```

4. In `DataBar`, expand the tooltip content:

```tsx
<Html position={[0, 0, height + 2]} center distanceFactor={82}>
    <div className="pointer-events-none min-w-[132px] rounded-lg border border-orange-200 bg-white/95 px-2 py-1 text-center text-[11px] shadow-lg">
        <div className="truncate font-semibold text-gray-900">{region.displayName}</div>
        <div className="font-semibold text-red-600">{total.toLocaleString("vi-VN")} hộ</div>
        <div className="text-[10px] text-rose-600">Nghèo: {region.stat.poorCount.toLocaleString("vi-VN")}</div>
        <div className="text-[10px] text-orange-600">Cận nghèo: {region.stat.nearPoorCount.toLocaleString("vi-VN")}</div>
    </div>
</Html>
```

5. In `Scene`, replace marker rendering and soften the base effects:

```tsx
const { bar, cloud, rotation, baseLayer, heat } = useCommandDashboardStore();
const heatmapPoints = useHeatmapPoints(visibleMarkers, projection);
```

```tsx
<ambientLight intensity={1.2} />
<directionalLight position={[80, 120, 110]} intensity={2.4} />
<pointLight position={[-80, 90, -80]} intensity={0.9} color="#fdba74" />
<CloudLayer visible={cloud} />
<group
    rotation={[-Math.PI / 2, 0, 0]}
    position={mapGroupPosition}
    scale={[selectedRegionScale, selectedRegionScale, 1]}
>
    {items.map((region) => (
        <RegionMesh key={region.name} region={region} bbox={textureBbox} maxValue={maxValue} mapTexture={mapTexture} showBar={bar} />
    ))}
    <PovertyCommandHeatmapLayer bbox={textureBbox} points={heatmapPoints} visible={heat} />
</group>
```

6. In `BottomGrid`, reduce opacity to bring it closer to `Demo1`:

```tsx
<mesh>
    <planeGeometry args={[320, 320]} />
    <meshBasicMaterial transparent map={glow} color="#fb923c" opacity={0.28} />
</mesh>
<mesh ref={ringOneRef} position-z={0.08}>
    <planeGeometry args={[260, 260]} />
    <meshBasicMaterial transparent map={ringOne} color="#fed7aa" opacity={0.12} depthWrite={false} />
</mesh>
<mesh ref={ringTwoRef} position-z={0.1}>
    <planeGeometry args={[238, 238]} />
    <meshBasicMaterial transparent map={ringTwo} color="#fb923c" opacity={0.24} depthWrite={false} />
</mesh>
<mesh position-z={0.04}>
    <planeGeometry args={[1000, 1000]} />
    <meshBasicMaterial transparent map={grid} alphaMap={gridMask} color="#fb923c" opacity={0.1} depthWrite={false} />
</mesh>
```

7. In `CloudLayer`, reduce opacity from `0.38` to `0.18`.

- [ ] **Step 4: Run the test and verification commands**

Run these commands in order:

```bash
cd FE && npm test -- src/components/poverty/command-dashboard/PovertyCommandMap.utils.test.ts
cd FE && npm test -- src/components/poverty/command-dashboard/PovertyCommandHeatmap.utils.test.ts
cd FE && npx tsc --noEmit
cd FE && npx eslint src/components/poverty/command-dashboard/PovertyCommandMap.tsx src/components/poverty/command-dashboard/PovertyCommandMap.utils.ts src/components/poverty/command-dashboard/PovertyCommandHeatmapLayer.tsx src/components/poverty/command-dashboard/PovertyCommandHeatmap.utils.ts
```

Expected:

- both node:test suites PASS
- `tsc --noEmit` exits 0
- eslint exits 0

Then run the app manually with `cd FE && npm run dev` and verify:

- no per-household beam/sphere markers remain
- the heatmap stays attached to the map during zoom and focus
- focused region tooltips show total, poor, and near-poor counts
- the bottom rings/grid/cloud no longer dominate the scene

- [ ] **Step 5: Commit**

```bash
git add FE/src/components/poverty/command-dashboard/PovertyCommandMap.tsx FE/src/components/poverty/command-dashboard/PovertyCommandMap.utils.ts FE/src/components/poverty/command-dashboard/PovertyCommandMap.utils.test.ts FE/src/components/poverty/command-dashboard/PovertyCommandHeatmapLayer.tsx FE/src/components/poverty/command-dashboard/PovertyCommandHeatmap.utils.ts FE/src/components/poverty/command-dashboard/PovertyCommandHeatmap.utils.test.ts
git commit -m "feat: replace poverty command markers with heatmap"
```

# Poverty Public Map Marker Cluster Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the public poverty map use the same image markers and grouped clusters as the admin map while keeping the public page read-only and popup-driven.

**Architecture:** Keep the public map implementation isolated inside the public map component, but extract marker and cluster presentation rules into a small pure helper so the visual parity logic is testable without spinning up Leaflet. Then replace the current `CircleMarker` loop with a `leaflet.markercluster` layer that binds React-rendered popups for household detail navigation.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Leaflet, `leaflet.markercluster`, Ant Design, `node:test`

---

## File Structure

- Create: `FE/src/components/poverty/poverty-public-map-marker-utils.ts`
  Responsibility: pure helper functions that decide public marker HTML, asset choice, and cluster badge sizing using the same thresholds and CSS classes as the admin map.
- Create: `FE/src/components/poverty/poverty-public-map-marker-utils.test.ts`
  Responsibility: lock in parity rules for poor vs near-poor marker assets and cluster size thresholds.
- Modify: `FE/src/components/poverty/PovertyPublicMapStage.tsx`
  Responsibility: replace `CircleMarker` rendering with a clustered Leaflet layer, keep existing fit-bounds/base-layer/loading shell, and preserve popup-based household navigation.
- Reuse without change: `FE/src/app/globals.css`
  Responsibility: existing `.poverty-map-marker*` classes already style the same animated image markers used by the admin map.

### Task 1: Build testable public marker and cluster helpers

**Files:**
- Create: `FE/src/components/poverty/poverty-public-map-marker-utils.ts`
- Test: `FE/src/components/poverty/poverty-public-map-marker-utils.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    buildPublicClusterIconHtml,
    buildPublicMarkerIconHtml,
    getPublicClusterBadgeSize,
} from "./poverty-public-map-marker-utils";

describe("buildPublicMarkerIconHtml", () => {
    it("uses the poor marker asset for poor households", () => {
        const html = buildPublicMarkerIconHtml("POOR");

        assert.match(html, /poverty-map-marker--poor/);
        assert.match(html, /\/images\/poverty\/marker-poor\.png/);
    });

    it("uses the near-poor marker asset for near-poor and regular households", () => {
        const nearPoorHtml = buildPublicMarkerIconHtml("NEAR_POOR");
        const regularHtml = buildPublicMarkerIconHtml("NORMAL");

        assert.match(nearPoorHtml, /poverty-map-marker--near-poor/);
        assert.match(nearPoorHtml, /\/images\/poverty\/marker-near-poor\.png/);
        assert.match(regularHtml, /poverty-map-marker--near-poor/);
        assert.match(regularHtml, /\/images\/poverty\/marker-near-poor\.png/);
    });
});

describe("public cluster badge sizing", () => {
    it("matches the admin cluster thresholds", () => {
        assert.equal(getPublicClusterBadgeSize(1), 40);
        assert.equal(getPublicClusterBadgeSize(10), 46);
        assert.equal(getPublicClusterBadgeSize(100), 52);
    });

    it("renders the child count inside the cluster badge html", () => {
        const html = buildPublicClusterIconHtml(24);

        assert.match(html, /width:46px/);
        assert.match(html, />24</);
        assert.match(html, /background:#0f766e/);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd FE && npm test -- src/components/poverty/poverty-public-map-marker-utils.test.ts`
Expected: FAIL with `Cannot find module './poverty-public-map-marker-utils'` or missing export errors because the helper file does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
import { normalizePovertyType } from "@/components/poverty/poverty-utils";

const POOR_MARKER_ICON_URL = "/images/poverty/marker-poor.png";
const NEAR_POOR_MARKER_ICON_URL = "/images/poverty/marker-near-poor.png";

export function buildPublicMarkerIconHtml(povertyType?: string | null): string {
    const normalizedType = normalizePovertyType(povertyType);
    const isPoor = normalizedType === "POOR";
    const markerTypeClass = isPoor ? "poverty-map-marker--poor" : "poverty-map-marker--near-poor";
    const iconUrl = isPoor ? POOR_MARKER_ICON_URL : NEAR_POOR_MARKER_ICON_URL;

    return `
        <span class="poverty-map-marker ${markerTypeClass}">
            <span class="poverty-map-marker__pulse" aria-hidden="true"></span>
            <img class="poverty-map-marker__image" src="${iconUrl}" alt="" />
        </span>
    `;
}

export function getPublicClusterBadgeSize(count: number): number {
    if (count >= 100) return 52;
    if (count >= 10) return 46;
    return 40;
}

export function buildPublicClusterIconHtml(count: number): string {
    const size = getPublicClusterBadgeSize(count);

    return `
        <span style="
            display:flex;
            width:${size}px;
            height:${size}px;
            align-items:center;
            justify-content:center;
            border-radius:999px;
            background:#0f766e;
            border:4px solid rgba(204,251,241,.95);
            color:#fff;
            font-weight:700;
            font-size:13px;
            box-shadow:0 10px 26px rgba(15,23,42,.28);
        ">${count}</span>
    `;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd FE && npm test -- src/components/poverty/poverty-public-map-marker-utils.test.ts`
Expected: PASS with 4 assertions covering marker asset selection and cluster size parity.

- [ ] **Step 5: Commit**

```bash
git add FE/src/components/poverty/poverty-public-map-marker-utils.ts FE/src/components/poverty/poverty-public-map-marker-utils.test.ts
git commit -m "test: cover public map marker parity helpers"
```

### Task 2: Replace public `CircleMarker` rendering with clustered Leaflet markers

**Files:**
- Modify: `FE/src/components/poverty/PovertyPublicMapStage.tsx`
- Reuse: `FE/src/components/poverty/poverty-public-map-marker-utils.ts`
- Test: `FE/src/components/poverty/poverty-public-map-marker-utils.test.ts`

- [ ] **Step 1: Write the failing integration stub**

Replace the current marker loop with a clustered component call so the type checker exposes the missing implementation boundary first:

```tsx
<TileLayer
    key={baseLayer}
    url={`https://{s}.google.com/vt/lyrs=${GOOGLE_LAYERS[baseLayer].layer}&hl=vi&x={x}&y={y}&z={z}`}
    subdomains={GOOGLE_SUBDOMAINS}
    maxZoom={21}
    attribution="Map data &copy; Google"
/>
<PublicMapFitBoundsControl markers={validMarkers} />
<PublicClusteredMarkers
    markers={validMarkers}
    onSelectHousehold={onSelectHousehold}
/>
```

- [ ] **Step 2: Run type-check to verify it fails**

Run: `cd FE && npx tsc --noEmit`
Expected: FAIL with `Cannot find name 'PublicClusteredMarkers'` and missing Leaflet-side helpers because the clustered renderer has not been implemented yet.

- [ ] **Step 3: Write minimal implementation**

Update the imports and add the clustered renderer inside `FE/src/components/poverty/PovertyPublicMapStage.tsx`:

```ts
import L from "leaflet";
import "leaflet.markercluster";
import { Button, Empty, Tag } from "antd";
import { Layers3, MapPinned } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MapContainer, TileLayer, ZoomControl, useMap } from "react-leaflet";

import {
    buildPublicClusterIconHtml,
    buildPublicMarkerIconHtml,
    getPublicClusterBadgeSize,
} from "@/components/poverty/poverty-public-map-marker-utils";
import { getValidGeoPosition, normalizePovertyType, povertyTypeLabel } from "@/components/poverty/poverty-utils";
import type { PublicPovertyMarker } from "@/types/poverty";
```

```ts
const createPublicLeafletMarkerIcon = (povertyType?: string | null) =>
    L.divIcon({
        className: "poverty-map-marker-container",
        html: buildPublicMarkerIconHtml(povertyType),
        iconSize: [42, 42],
        iconAnchor: [21, 42],
        popupAnchor: [0, -40],
    });

const createPublicLeafletClusterIcon = (cluster: L.MarkerCluster) => {
    const count = cluster.getChildCount();
    const size = getPublicClusterBadgeSize(count);

    return L.divIcon({
        className: "poverty-map-cluster",
        html: buildPublicClusterIconHtml(count),
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    });
};

const schedulePopupRootUnmounts = (roots: Root[]) => {
    window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
            roots.forEach((root) => root.unmount());
        });
    });
};
```

```tsx
function PublicMarkerPopupContent({
    marker,
    onSelectHousehold,
}: {
    marker: PublicPovertyMarker;
    onSelectHousehold?: (marker: PublicPovertyMarker) => void;
}) {
    const povertyType = normalizePovertyType(marker.povertyType);

    return (
        <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                        {marker.headFullName || marker.code || "Hộ gia đình"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                        {[marker.areaName, marker.wardName].filter(Boolean).join(" / ") || "Chưa có địa bàn"}
                    </p>
                </div>
                <Tag className="!m-0" color={povertyType === "POOR" ? "red" : povertyType === "NEAR_POOR" ? "gold" : "cyan"}>
                    {povertyTypeLabel(marker.povertyType)}
                </Tag>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{Number(marker.memberCount ?? 0).toLocaleString("vi-VN")} thành viên</span>
                <span>{Number(marker.fieldPhotoCount ?? 0).toLocaleString("vi-VN")} ảnh</span>
            </div>
            {onSelectHousehold ? (
                <Button type="primary" size="small" block onClick={() => onSelectHousehold(marker)}>
                    Xem chi tiết hộ
                </Button>
            ) : null}
        </div>
    );
}
```

```tsx
function PublicClusteredMarkers({
    markers,
    onSelectHousehold,
}: {
    markers: PublicPovertyMarker[];
    onSelectHousehold?: (marker: PublicPovertyMarker) => void;
}) {
    const map = useMap();

    useEffect(() => {
        const clusterGroup = L.markerClusterGroup({
            showCoverageOnHover: false,
            spiderfyOnMaxZoom: true,
            zoomToBoundsOnClick: true,
            maxClusterRadius: 46,
            disableClusteringAtZoom: 18,
            iconCreateFunction: createPublicLeafletClusterIcon,
        });

        const popupRoots: Root[] = [];

        markers.forEach((marker) => {
            const position = getValidGeoPosition(marker.latitude, marker.longitude);
            if (!position) return;

            const leafletMarker = L.marker([position.latitude, position.longitude], {
                icon: createPublicLeafletMarkerIcon(marker.povertyType),
                keyboard: true,
                title: marker.headFullName || marker.code || "Hộ gia đình",
            });

            const popupContainer = document.createElement("div");
            const popupRoot = createRoot(popupContainer);
            popupRoot.render(
                <PublicMarkerPopupContent marker={marker} onSelectHousehold={onSelectHousehold} />
            );
            popupRoots.push(popupRoot);

            leafletMarker.bindPopup(popupContainer, {
                minWidth: 220,
            });

            clusterGroup.addLayer(leafletMarker);
        });

        map.addLayer(clusterGroup);

        return () => {
            map.removeLayer(clusterGroup);
            schedulePopupRootUnmounts(popupRoots);
        };
    }, [map, markers, onSelectHousehold]);

    return null;
}
```

Also remove the old `CircleMarker` and `Popup` imports and delete the old `{validMarkers.map(...)}` block entirely so only the cluster layer owns marker rendering.

- [ ] **Step 4: Run verification**

Run: `cd FE && npm test -- src/components/poverty/poverty-public-map-marker-utils.test.ts`
Expected: PASS

Run: `cd FE && npx tsc --noEmit`
Expected: PASS

Run: `cd FE && npx eslint src/components/poverty/PovertyPublicMapStage.tsx src/components/poverty/poverty-public-map-marker-utils.ts src/components/poverty/poverty-public-map-marker-utils.test.ts`
Expected: PASS with no new lint errors from the public map marker integration.

Manual smoke check:
- Start the frontend and open any public ward link copied from the admin public-share toggle.
- Zoom out and confirm markers collapse into teal circular clusters identical to the admin map.
- Zoom in and confirm each household shows the same animated image pin style as the admin map.
- Click a marker popup and confirm `Xem chi tiết hộ` still opens the public household detail page.
- Open a public household detail page and confirm its embedded single-household map still renders the same marker style without the right-side admin panel.

- [ ] **Step 5: Commit**

```bash
git add FE/src/components/poverty/PovertyPublicMapStage.tsx FE/src/components/poverty/poverty-public-map-marker-utils.ts FE/src/components/poverty/poverty-public-map-marker-utils.test.ts
git commit -m "feat: cluster markers on poverty public map"
```

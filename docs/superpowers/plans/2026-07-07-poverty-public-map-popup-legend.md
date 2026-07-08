# Poverty Public Map Popup And Legend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the public map popup with richer household information and make public markers plus the legend accurately represent all three household categories.

**Architecture:** Keep the current clustered public map structure in `PovertyPublicMapStage.tsx`, but extend the marker helper so marker HTML distinguishes `POOR`, `NEAR_POOR`, and `NONE`. Then update the popup renderer and legend in the map stage, and add one CSS variant for the normal-household marker because the repository only contains red and amber marker image assets today.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Leaflet, `leaflet.markercluster`, Ant Design, `node:test`, global CSS

---

## File Structure

- Modify: `FE/src/components/poverty/poverty-public-map-marker-utils.ts`
  Responsibility: map poverty types to the correct marker class and asset strategy, and expose small formatting helpers for popup display.
- Modify: `FE/src/components/poverty/poverty-public-map-marker-utils.test.ts`
  Responsibility: lock in the three-category marker rules and popup coordinate formatting.
- Modify: `FE/src/components/poverty/PovertyPublicMapStage.tsx`
  Responsibility: render the richer popup content and update the legend so it matches the three real marker variants.
- Modify: `FE/src/app/globals.css`
  Responsibility: add a `.poverty-map-marker--normal` variant that gives `Hộ thường` a blue marker while preserving the existing marker silhouette and pulse.

### Task 1: Extend public marker helpers for three marker categories

**Files:**
- Modify: `FE/src/components/poverty/poverty-public-map-marker-utils.ts`
- Test: `FE/src/components/poverty/poverty-public-map-marker-utils.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
    buildPublicClusterIconHtml,
    buildPublicMarkerIconHtml,
    formatPublicMarkerCoordinate,
    getPublicClusterBadgeSize,
} from "./poverty-public-map-marker-utils.ts";

test("buildPublicMarkerIconHtml uses the normal marker class for regular households", () => {
    const html = buildPublicMarkerIconHtml("NONE");

    assert.match(html, /poverty-map-marker--normal/);
    assert.doesNotMatch(html, /marker-poor\.png/);
    assert.doesNotMatch(html, /marker-near-poor\.png/);
});

test("formatPublicMarkerCoordinate trims valid coordinates to five decimals", () => {
    assert.equal(formatPublicMarkerCoordinate(10.1234567), "10.12346");
    assert.equal(formatPublicMarkerCoordinate(105.7654321), "105.76543");
});

test("formatPublicMarkerCoordinate returns fallback text for missing coordinates", () => {
    assert.equal(formatPublicMarkerCoordinate(null), "-");
    assert.equal(formatPublicMarkerCoordinate(undefined), "-");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd FE && npm test -- src/components/poverty/poverty-public-map-marker-utils.test.ts`
Expected: FAIL because `buildPublicMarkerIconHtml("NONE")` still resolves to the near-poor variant and `formatPublicMarkerCoordinate` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
import { normalizePovertyType, parseCoordinate } from "./poverty-utils.ts";

const POOR_MARKER_ICON_URL = "/images/poverty/marker-poor.png";
const NEAR_POOR_MARKER_ICON_URL = "/images/poverty/marker-near-poor.png";

function resolvePublicMarkerVariant(povertyType?: string | null): {
    markerTypeClass: string;
    iconUrl: string | null;
} {
    const normalizedType = normalizePovertyType(povertyType);

    if (normalizedType === "POOR") {
        return {
            markerTypeClass: "poverty-map-marker--poor",
            iconUrl: POOR_MARKER_ICON_URL,
        };
    }

    if (normalizedType === "NEAR_POOR") {
        return {
            markerTypeClass: "poverty-map-marker--near-poor",
            iconUrl: NEAR_POOR_MARKER_ICON_URL,
        };
    }

    return {
        markerTypeClass: "poverty-map-marker--normal",
        iconUrl: null,
    };
}

export function buildPublicMarkerIconHtml(povertyType?: string | null): string {
    const { markerTypeClass, iconUrl } = resolvePublicMarkerVariant(povertyType);
    const content = iconUrl
        ? `<img class="poverty-map-marker__image" src="${iconUrl}" alt="" />`
        : `<span class="poverty-map-marker__dot" aria-hidden="true"></span>`;

    return `
        <span class="poverty-map-marker ${markerTypeClass}">
            <span class="poverty-map-marker__pulse" aria-hidden="true"></span>
            ${content}
        </span>
    `;
}

export function formatPublicMarkerCoordinate(value: unknown): string {
    const numeric = parseCoordinate(value);
    return numeric === null ? "-" : numeric.toFixed(5);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd FE && npm test -- src/components/poverty/poverty-public-map-marker-utils.test.ts`
Expected: PASS with the original marker and cluster assertions plus the new normal-marker and coordinate-format assertions.

- [ ] **Step 5: Commit**

```bash
git add FE/src/components/poverty/poverty-public-map-marker-utils.ts FE/src/components/poverty/poverty-public-map-marker-utils.test.ts
git commit -m "test: cover public map popup marker variants"
```

### Task 2: Add the normal-household marker styling

**Files:**
- Modify: `FE/src/app/globals.css:1372-1414`

- [ ] **Step 1: Add the failing usage boundary**

Update the helper output from Task 1 so it emits both `.poverty-map-marker--normal` and `.poverty-map-marker__dot`, then verify the stylesheet does not define them yet.

Run: `rg -n "poverty-map-marker--normal|poverty-map-marker__dot" FE/src/app/globals.css`
Expected: no matches in `FE/src/app/globals.css`.

- [ ] **Step 2: Add the minimal CSS**

```css
.poverty-map-marker__dot {
  position: relative;
  z-index: 2;
  display: block;
  width: 24px;
  height: 24px;
  margin: 9px;
  border: 3px solid rgba(255, 255, 255, 0.95);
  border-radius: 999px;
  background:
    radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.18) 35%, transparent 36%),
    linear-gradient(180deg, #38bdf8, #2563eb);
  box-shadow:
    0 6px 18px rgba(37, 99, 235, 0.35),
    inset 0 -2px 6px rgba(15, 23, 42, 0.16);
}

.poverty-map-marker--normal {
  color: rgba(37, 99, 235, 0.9);
}
```

- [ ] **Step 3: Verify the stylesheet now defines the normal marker**

Run: `rg -n "poverty-map-marker--normal|poverty-map-marker__dot" FE/src/app/globals.css`
Expected: both selectors are present exactly once.

- [ ] **Step 4: Commit**

```bash
git add FE/src/app/globals.css
git commit -m "style: add public normal-household marker"
```

### Task 3: Expand the public popup and align the legend with the three marker types

**Files:**
- Modify: `FE/src/components/poverty/PovertyPublicMapStage.tsx`
- Reuse: `FE/src/components/poverty/poverty-public-map-marker-utils.ts`
- Reuse: `FE/src/app/globals.css`
- Test: `FE/src/components/poverty/poverty-public-map-marker-utils.test.ts`

- [ ] **Step 1: Write the failing integration stub**

Add the new helper import to the map stage and replace the old two-line metadata block in `PublicMarkerPopupContent` with a reference to a not-yet-rendered coordinate helper.

```tsx
import {
    buildPublicClusterIconHtml,
    buildPublicMarkerIconHtml,
    formatPublicMarkerCoordinate,
    getPublicClusterBadgeSize,
} from "@/components/poverty/poverty-public-map-marker-utils";
```

```tsx
<span>
    Tọa độ: {formatPublicMarkerCoordinate(marker.latitude)}, {formatPublicMarkerCoordinate(marker.longitude)}
</span>
```

- [ ] **Step 2: Run type-check to verify it fails if Task 1 is not applied**

Run: `cd FE && npx tsc --noEmit`
Expected: FAIL before Task 1 is implemented because `formatPublicMarkerCoordinate` is missing.

- [ ] **Step 3: Write the minimal popup and legend implementation**

Replace `PublicMarkerPopupContent` with:

```tsx
function PublicMarkerPopupContent({
    marker,
    onSelectHousehold,
}: {
    marker: PublicPovertyMarker;
    onSelectHousehold?: (marker: PublicPovertyMarker) => void;
}) {
    const povertyType = normalizePovertyType(marker.povertyType);
    const locationLine = marker.areaName || marker.wardName
        ? [marker.areaName, marker.wardName].filter(Boolean).join(" / ")
        : "Chưa cập nhật";

    return (
        <div className="space-y-3 text-[13px] text-slate-600">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                        {marker.headFullName || marker.code || "Hộ gia đình"}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500">{locationLine}</p>
                </div>
                <Tag className="!m-0 !rounded-full" color={povertyType === "POOR" ? "red" : povertyType === "NEAR_POOR" ? "gold" : "cyan"}>
                    {povertyTypeLabel(marker.povertyType)}
                </Tag>
            </div>

            <div className="grid gap-2 rounded-2xl bg-slate-50 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">Mã hộ</span>
                    <span className="truncate font-medium text-slate-700">{marker.code || "-"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">Địa chỉ</span>
                    <span className="truncate font-medium text-slate-700">{marker.address || "Chưa cập nhật"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">Khu vực/Ấp</span>
                    <span className="truncate font-medium text-slate-700">{marker.areaName || "Chưa cập nhật"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">Xã/Phường</span>
                    <span className="truncate font-medium text-slate-700">{marker.wardName || "Chưa cập nhật"}</span>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl border border-slate-200 px-2 py-2">
                    <div className="font-semibold text-slate-900">{Number(marker.memberCount ?? 0).toLocaleString("vi-VN")}</div>
                    <div className="mt-1 text-[11px] text-slate-400">Thành viên</div>
                </div>
                <div className="rounded-xl border border-slate-200 px-2 py-2">
                    <div className="font-semibold text-slate-900">{Number(marker.fieldPhotoCount ?? 0).toLocaleString("vi-VN")}</div>
                    <div className="mt-1 text-[11px] text-slate-400">Ảnh</div>
                </div>
                <div className="rounded-xl border border-slate-200 px-2 py-2">
                    <div className="font-semibold text-slate-900">
                        {formatPublicMarkerCoordinate(marker.latitude)}, {formatPublicMarkerCoordinate(marker.longitude)}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400">Tọa độ</div>
                </div>
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

Replace the legend block with:

```tsx
<div className="pointer-events-auto rounded-2xl border border-white/80 bg-white/92 px-3 py-2 text-xs text-slate-600 shadow-sm backdrop-blur">
    <div className="flex items-center gap-2">
        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
        Hộ nghèo
    </div>
    <div className="mt-1 flex items-center gap-2">
        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
        Hộ cận nghèo
    </div>
    <div className="mt-1 flex items-center gap-2">
        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
        Hộ thường
    </div>
</div>
```

- [ ] **Step 4: Run verification**

Run: `cd FE && npm test -- src/components/poverty/poverty-public-map-marker-utils.test.ts`
Expected: PASS

Run: `cd FE && npx tsc --noEmit`
Expected: PASS

Run: `cd FE && npx eslint src/components/poverty/PovertyPublicMapStage.tsx src/components/poverty/poverty-public-map-marker-utils.ts src/components/poverty/poverty-public-map-marker-utils.test.ts`
Expected: PASS

Manual smoke check:
- open a public ward with poor, near-poor, and normal households
- confirm the legend has three entries and matches the marker colors on the map
- click one marker from each category and confirm the popup shows code, address, area, ward, member count, photo count, and trimmed coordinates
- confirm `Xem chi tiết hộ` still opens the public detail page
- open a public household detail page and confirm its embedded map uses the correct marker style for that household type

- [ ] **Step 5: Commit**

```bash
git add FE/src/components/poverty/PovertyPublicMapStage.tsx FE/src/components/poverty/poverty-public-map-marker-utils.ts FE/src/components/poverty/poverty-public-map-marker-utils.test.ts FE/src/app/globals.css
git commit -m "feat: expand public map popups and legend"
```

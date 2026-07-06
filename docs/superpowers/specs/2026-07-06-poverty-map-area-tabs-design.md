# Poverty Map Area Tabs Design

## Goal

Add a second left-panel tab to the poor-household map so users can switch between a household list view and an area overview view, then filter the map and the list together by selecting a specific area.

## Scope

This design covers:

- The left-side panel inside `FE/src/components/poverty/PovertyLeafletMap.tsx`.
- A new `Khu vực` tab beside the existing `Danh sách` tab.
- Area summary cards derived from the current filtered map dataset.
- Shared filtering behavior so an area selection affects both the map markers and the household list.

This design does not cover:

- New backend APIs.
- Changes to the top-level map page filters in `PovertyMapPage.tsx`.
- New permissions or location-scope rules.
- Changes to the right-side detail and analytics panel beyond keeping counts consistent with the selected area.

## Requirements

### Functional Requirements

- The left panel must expose two tabs:
  - `Danh sách`
  - `Khu vực`
- The `Khu vực` tab must render a `Tất cả khu vực` card and one card per area.
- Area cards must be computed from the same dataset currently loaded for the map after the page filters are applied.
- Each area card must show:
  - area name
  - total household count
  - poor household count
  - near-poor household count
- Clicking an area card must:
  - filter the map to markers from that area
  - filter the `Danh sách` tab to households from that area
- Clicking `Tất cả khu vực` must clear the area selection and restore the full current dataset.
- If the active area disappears after the page filters change, the area selection must reset automatically to `Tất cả khu vực`.

### UX Requirements

- The current list search input remains in the `Danh sách` tab.
- The `Khu vực` tab must help users scan totals quickly without opening individual households.
- Active area selection must have a clear visual state.
- Area cards should be ordered from highest total household count to lowest for faster overview scanning.
- Empty states must be explicit when there is no area data or no matching households.

### Non-Functional Requirements

- No additional API requests should be introduced for the area tab.
- Existing marker focus, detail panel, edit flow, and coordinate update behavior must keep working.
- New filtering logic should be isolated into reusable helpers where practical so aggregation and filtering can be tested outside the component.

## Recommended Approach

Extend `PovertyLeafletMap` with a small amount of left-panel state and derive area summaries directly from the already loaded `markers`.

This is the best fit because the requested overview is a presentation and interaction change on top of an existing dataset, not a new data source. Reusing `markers` keeps the tab counts aligned with the current page filters, avoids API churn, and minimizes regression risk in the broader poverty-map flow.

## Alternatives Considered

### Alternative 1: Fetch a separate area-summary endpoint

Reject. The user explicitly wants counts to follow the current map filters. A separate summary endpoint would either duplicate the current filtering contract or drift from the map state.

### Alternative 2: Add the area overview outside the map panel

Reject. The request is specifically about the left household panel, and splitting overview/filter controls into another page region would slow the scan-and-click workflow.

### Alternative 3: Use a lightweight segmented switch instead of tabs

Reject for now. Tabs provide clearer structure for a larger list area and match the mental model of two distinct browsing modes.

## Interaction Design

### Left Panel Tabs

Use `Tabs` from `antd` inside the existing left panel card.

Tabs:

- `Danh sách`
- `Khu vực`

### Danh sách Tab

Keep the current household list structure:

- header with counts
- create and refresh actions
- keyword search
- household cards

Behavior change:

- the list source becomes the current area-filtered marker set
- keyword search applies after area filtering

### Khu vực Tab

Render:

- one summary card for `Tất cả khu vực`
- one summary card per area

Each card shows:

- area name
- total households
- poor households
- near-poor households

Card behavior:

- clicking a card sets the active area filter
- the active card gets a highlighted border/background state
- `Tất cả khu vực` clears the active area filter

Ordering:

- sort by total household count descending
- for ties, sort by area name ascending

## Data and State Design

### New Local State

Add to `PovertyLeafletMap`:

- `activeLeftTab: "list" | "area"`
- `selectedAreaKey: string | null`

Use a stable area key:

- prefer `areaId`
- fallback to a derived key from `areaName` when `areaId` is missing

### Derived Data

Create helper logic to derive:

- `areaSummaries` from the current `markers`
- `markersBySelectedArea`
- `filteredListMarkers` from `markersBySelectedArea` plus `listSearch`
- `visibleMarkers` from `markersBySelectedArea` plus coordinate validity and currently visible poverty types

Each area summary should include:

- `key`
- `areaId`
- `areaName`
- `totalCount`
- `poorCount`
- `nearPoorCount`

### Consistency Rules

- Summary counts are based on the current page-filtered `markers`, not the text search box.
- The area tab reflects the same overall dataset the map received from `PovertyMapPage`.
- The right-side overview cards should reflect the currently selected area where they already describe the displayed map set.

## Frontend Architecture

### Component Changes

Primary implementation file:

- `FE/src/components/poverty/PovertyLeafletMap.tsx`

Add or extend helper logic in:

- `FE/src/components/poverty/poverty-location-utils.ts` or
- a new focused helper file near the poverty map if the aggregation logic becomes large

Recommended split:

- keep rendering logic in `PovertyLeafletMap.tsx`
- move area aggregation and area-key generation into pure helpers for easier tests

### Data Flow

1. `PovertyMapPage` continues to load `markers` from the current page filters.
2. `PovertyLeafletMap` derives area summaries from `markers`.
3. If `selectedAreaKey` exists, the component narrows the working dataset to that area.
4. The narrowed dataset feeds:
   - left list tab
   - visible map markers
   - overview counts tied to the displayed set

## Error Handling and Edge Cases

- If no markers exist, both tabs must show empty states without throwing.
- If an area has no `areaId`, fallback grouping must still let users select and filter it.
- If a selected area becomes invalid after refresh or top-level filter change, reset the selection automatically.
- If a user searches in `Danh sách` after selecting an area, only households in that selected area should be searchable.

## Testing Strategy

### Unit Tests

Add tests for the pure helper logic:

- groups markers into area summaries correctly
- counts `POOR` and `NEAR_POOR` correctly
- orders summaries by total descending then name ascending
- handles missing `areaId` with name-based fallback keys
- filters markers correctly for a selected area

### Verification

- `Danh sách` still focuses markers and opens detail correctly after area selection.
- `Khu vực` card selection changes the map marker set as expected.
- `Tất cả khu vực` restores the full current dataset.
- TypeScript and lint checks pass for touched files.

## Implementation Notes

- Keep the current `listSearch` state and apply it only inside the list tab flow.
- Do not mutate the original `markers` prop.
- Prefer deriving counts from memoized arrays to avoid unnecessary recalculation on every render.

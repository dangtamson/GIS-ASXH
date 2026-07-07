# Poverty Public Map Marker And Cluster Parity Design

## Goal

Make the public poverty map use the same marker and cluster visual language as the admin poverty map, while keeping the public interaction model lightweight and read-only.

## Scope

This design covers:

- Marker rendering in `FE/src/components/poverty/PovertyPublicMapStage.tsx`
- Cluster rendering and clustering behavior in the public map stage
- Public marker popup behavior after switching to admin-style markers

This design does not cover:

- Admin map behavior
- Public ward page layout redesign beyond the map rendering itself
- Public household detail page content
- Backend DTO changes

## Requirements

### Functional Requirements

- The public map must no longer use simple `CircleMarker` rendering for households.
- The public map must cluster markers at lower zoom levels, like the admin map.
- The public map must use the same marker icon family as the admin map:
  - poor-household marker image
  - near-poor marker image
  - matching pulse effect
- Cluster sizing behavior should match the admin map thresholds.
- Clicking a public marker must still open the public popup and must not restore the admin side detail panel.

### UX Requirements

- Public viewers should immediately recognize the same map language across admin and public views.
- Marker icons should feel consistent with the public page’s premium look, not like a separate map implementation.
- Clusters should remain clean and readable on both desktop and mobile.

### Non-Functional Requirements

- The change should avoid pulling in unrelated admin layout or state management.
- Public map code should stay isolated from admin-only side effects such as detail-panel fetches and edit flows.

## Recommended Approach

Port the admin marker and cluster rendering logic into the public map stage as a focused, public-only implementation.

This is the best fit because the user wants visual and clustering parity, not a full admin map reuse. Copying the narrow marker and cluster layer into `PovertyPublicMapStage` achieves the requested result with lower regression risk than threading more public-specific conditionals through `PovertyLeafletMap.tsx`.

## Alternatives Considered

### Alternative 1: Reuse `PovertyLeafletMap` marker internals directly

Reject for now. The admin map file already carries significant behavior unrelated to the public map, including list, detail-panel, edit, and modal flows.

### Alternative 2: Keep `CircleMarker` and only restyle the circles

Reject. This does not satisfy the requirement that marker and clustering behavior match the admin map.

## Design

### Public Marker Rendering

Replace `CircleMarker` rendering in `PovertyPublicMapStage.tsx` with `L.marker` plus `L.divIcon`, using the same icon assets and pulse classes as the admin map.

Expected visual behavior:

- poor households use the red marker image and poor pulse styling
- near-poor households use the amber marker image and near-poor pulse styling
- other public-safe households may reuse the near-poor family or a dedicated fallback only if needed, but the initial implementation should prioritize parity for poor and near-poor categories

### Public Cluster Rendering

Use `leaflet.markercluster` in the public map stage with the same cluster icon sizing rules as the admin map:

- small clusters use the smallest circle
- medium clusters use the medium circle
- large clusters use the largest circle

The cluster badge should reuse the same color, border, shadow, and centered count treatment as admin.

### Popup Behavior

The public popup contract stays unchanged:

- household head name or code
- household type badge
- member count
- image count if already available
- `Xem chi tiết hộ` button

Only the marker engine changes. The public popup remains the public interaction surface.

## Frontend Architecture

Primary implementation file:

- `FE/src/components/poverty/PovertyPublicMapStage.tsx`

Supporting style source:

- `FE/src/app/globals.css`

Recommended implementation boundaries:

- keep the admin map untouched
- create a small public-only clustered marker helper inside `PovertyPublicMapStage.tsx` or alongside it if the file grows too large
- reuse the existing CSS classes already defined for admin markers when possible

## Testing Strategy

### Verification Scenarios

- Public map shows image-based markers instead of circles at close zoom levels.
- Public map shows admin-style cluster badges at lower zoom levels.
- Clicking a marker still opens the public popup.
- Clicking the popup CTA still navigates to the public household detail page.
- No admin side panel appears in the public map.

### Verification Commands

- `cd FE && npx tsc --noEmit`
- `cd FE && npx eslint src/components/poverty/PovertyPublicMapStage.tsx`

## Risks And Mitigations

- Risk: public map duplicates a small portion of admin marker logic.
  Mitigation: keep duplication narrowly limited to marker and cluster rendering only.

- Risk: popup behavior could regress while swapping rendering engines.
  Mitigation: preserve the current popup payload and only replace the underlying marker layer.

- Risk: cluster rendering may affect fit-bounds or zoom behavior.
  Mitigation: verify both low-zoom cluster view and high-zoom marker view after the change.

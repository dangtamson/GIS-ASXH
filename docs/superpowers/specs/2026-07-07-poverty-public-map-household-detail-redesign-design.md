# Poverty Public Map And Household Detail Redesign

## Goal

Redesign the public poverty ward map into a modern, map-first public experience that matches the approved visual direction, removes the right-side map detail panel, adds clearer household browsing by area or hamlet, and introduces a dedicated public household detail page.

## Scope

This design covers:

- The public ward page at `FE/src/app/ban-do-ho-ngheo-cong-khai/[slug]/page.tsx`
- The main public page component `FE/src/components/poverty/PovertyPublicMapPage.tsx`
- Public browsing interactions for map, household list, and area or hamlet exploration
- A new public household detail route and page
- Public backend DTO and endpoint extensions required to support the new UI
- Public-safe data exposure rules for the redesigned experience

This design does not cover:

- Admin pages or admin permissions
- Changes to the ward public-link generation flow
- Public editing, public submissions, or feedback forms
- Analytics, share counters, or public traffic dashboards

## Requirements

### Functional Requirements

- The public ward page must use a dedicated public-facing layout, not an admin-style map layout with controls hidden.
- The map must become the primary visual section and must no longer use the existing right-side household detail panel pattern.
- The public ward page must let viewers switch between:
  - a map-first view
  - a household list view
  - an area or hamlet browsing view
- Area or hamlet browsing must let viewers focus both the map and the visible household list on a selected area.
- Clicking a household from the map or list must open a dedicated public household detail page.
- The public household detail page must support the mockup structure:
  - status-aware hero
  - summary cards
  - information tab
  - image tab
  - support-history tab
  - embedded map section
- The public ward page must continue to always show the current year only and must not expose year switching.

### UX Requirements

- The public ward page must visually follow the approved hero-loader design language:
  - bright layered gradients
  - elevated cards
  - soft shimmer-friendly surfaces
  - clear hierarchy and large spacing
- The top hero must communicate place identity clearly:
  - province or city
  - ward
  - optional administrative context
  - ward-level summary cards
  - ward note or public information note
- The map section must feel clean and focused, with only public-relevant controls.
- The household list must be much easier to scan than the current popup-driven map experience.
- Area or hamlet cards must behave like an exploration tool, not a hidden filter.
- The public household detail page must feel like a distinct destination page rather than a modal substitute.

### Security And Data Requirements

- Public APIs must continue to return dedicated public DTOs, never reused admin detail contracts.
- Sensitive fields must remain excluded:
  - citizen IDs
  - phone numbers
  - internal change logs
  - internal notes not explicitly approved for public display
  - full member records with personal details
- The public redesign may expose more data than the first public map version, but only via explicit public-safe fields defined in this design.
- All public detail data must be resolved through the public slug and public household ID flow, not through workspace-bound client input.

## Recommended Approach

Extend the current public map architecture instead of replacing it completely: keep the public slug route and map engine, but redesign the page shell, move household exploration out of the map side panel, and add a dedicated public household detail route backed by a separate public detail endpoint.

This is the best fit because it preserves the current public-link and public-data model, avoids redoing the map engine, and still creates enough separation to deliver a modern public-facing product. It also keeps the risk focused on public DTO expansion and presentation logic instead of rebuilding the public experience from scratch.

## Alternatives Considered

### Alternative 1: Reuse the current `PovertyLeafletMap` layout with minimal cosmetic changes

Reject. The existing right-side panel pattern is optimized for admin workflows and will continue to feel cramped and tool-heavy for public viewers.

### Alternative 2: Build a completely separate public map stack disconnected from `PovertyLeafletMap`

Reject for now. This would provide maximum design freedom, but it would duplicate too much map behavior and increase long-term maintenance cost.

### Alternative 3: Keep everything on one page and open household detail in a large drawer

Reject. The approved direction explicitly favors a separate public detail page closer to the supplied mockup, and a dedicated page scales better for mobile and public sharing.

## Public Ward Page Design

### Overall Layout

The public ward page should be reorganized into three vertical zones:

1. `Hero zone`
2. `Map stage`
3. `Explorer zone`

This keeps the public map prominent while making list browsing and area exploration easier to understand.

### Hero Zone

The hero should visually follow the approved loading concept and the first mockup:

- breadcrumb or compact place path
- large ward title
- one supporting administrative action button such as `Thông tin hành chính`
- four summary cards
- a public note card or informational callout

Suggested content:

- total tracked households
- normal households if available in the dataset
- near-poor households
- poor households

If `normal households` is not directly available from the backend, derive it from `total - poor - nearPoor` only if the product owner accepts that meaning explicitly.

### Map Stage

The map stage should become a clean, full-width section directly under the hero.

Behavior:

- no right-side household detail panel
- retain public-safe controls only:
  - zoom
  - base-layer switch
  - fit map to visible households
  - legend
  - optional quick household search shortcut
- clicking a marker opens a lightweight popup card, not a side panel
- popup content should stay brief and include:
  - household name
  - type badge
  - member count
  - area or hamlet
  - `Xem chi tiết hộ` action

### Explorer Zone

The explorer zone should sit below the map and become the primary browsing surface.

It should use tabs:

- `Danh sách hộ`
- `Khu vực/Ấp`

#### Danh sách hộ tab

This tab should provide:

- headline with count
- search input
- household-type pill filters
- clear active area indicator when filtered by a selected area
- card grid or stacked cards depending on screen size

Each household card should include:

- avatar or icon treatment
- household head name
- poverty-type badge
- short location text
- member count
- detail CTA

#### Khu vực/Ấp tab

This tab should provide one card per area or hamlet plus an `All` option.

Each area card should include:

- area name
- total household count
- poor household count
- near-poor household count
- optional short note if public-safe area notes are available

Selecting an area should:

- visually highlight the area card
- focus the map to households from that area
- narrow the household list view to that area
- show an active filter label in the list tab and map toolbar

### Mobile Behavior

- Hero cards collapse to one or two columns
- Map remains above the explorer zone
- Tabs and filter pills scroll horizontally if needed
- Household cards stack vertically
- Detail links stay large enough for touch interactions

## Public Household Detail Page Design

### Route Design

Add a dedicated public route:

- `FE/src/app/ban-do-ho-ngheo-cong-khai/[slug]/ho/[householdId]/page.tsx`

The page must resolve the ward by `slug` and the household by `householdId` under that public ward scope.

### Page Structure

The page should follow the second approved mockup:

- hero banner with household name and household-type badge
- four top summary cards
- tab bar
- large content card blocks with strong spacing and modern card treatment

### Hero Banner

Use a status-aware but restrained theme:

- green-leaning theme for active or stable public-safe households
- warm amber or orange accent for near-poor
- stronger red accent for poor households

Required hero content:

- household head name
- poverty-type badge
- back link to the parent public ward page

### Summary Cards

Recommended cards:

- household type
- member count
- image count
- support event count

The card set can adapt when a value is unavailable, but the layout should stay balanced.

### Detail Tabs

Tabs:

- `Thông tin`
- `Hình ảnh & Video`
- `Lịch sử hỗ trợ`

#### Thông tin tab

Contains:

- embedded map block with marker and open-in-Google-Maps action
- basic household information card
- family situation card
- current status card

#### Hình ảnh & Video tab

Contains:

- public-safe field photo gallery
- no upload, delete, or admin actions

#### Lịch sử hỗ trợ tab

Contains:

- public-safe support timeline or card list
- support date
- support type
- support content summary if allowed
- support amount only if approved for public display

## Backend API Design

### Extend the current public ward response

The existing public ward endpoint should continue to serve the ward page, but the ward DTO should be expanded where needed for the redesigned explorer.

Add or confirm support for:

- ward note or public note
- area identifiers and names on every marker
- optional aggregated area summaries if deriving them client-side becomes too brittle
- optional field photo count and support count on public list items

### Add a public household detail endpoint

Recommended endpoint:

- `GET /public/poverty/wards/:slug/households/:householdId`

Behavior:

- resolve the ward public link by slug
- confirm the household belongs to that ward and current public dataset
- reject when the ward is not public or the household is outside the ward scope
- return a dedicated public household detail DTO

### Public Ward DTO

Keep the existing structure but expand the marker item if needed.

Suggested list-level item fields:

- `id`
- `code`
- `headFullName`
- `povertyType`
- `status`
- `areaId`
- `areaName`
- `wardName`
- `memberCount`
- `latitude`
- `longitude`
- public-safe address or location text
- `fieldPhotoCount`
- `supportCount`

### Public Household Detail DTO

Add a new dedicated type, for example `PublicPovertyHouseholdDetailResponse`.

Suggested shape:

- `share`
  - public slug
  - ward name
  - province name
  - current year
- `household`
  - `id`
  - `code`
  - `headFullName`
  - `povertyType`
  - `status`
  - `memberCount`
  - `areaId`
  - `areaName`
  - `wardName`
  - public-safe address or fallback location string
  - `latitude`
  - `longitude`
- `summary`
  - `fieldPhotoCount`
  - `supportCount`
- `latestContext`
  - `familySituation`
  - `currentStatus`
  - `recordedAt`
- `fieldPhotos`
  - public-safe file URLs and display metadata
- `supports`
  - date
  - support types
  - public-safe content
  - optional amount fields if approved

## Frontend Architecture

### Public Ward Page

Primary file:

- `FE/src/components/poverty/PovertyPublicMapPage.tsx`

Recommended supporting files:

- a new public-layout helper file for pure UI derivations if the component grows too large
- a new public map browser helper file for:
  - area grouping
  - list filtering
  - active tab state helpers

The ward page should no longer rely on the current `PovertyLeafletMap` side-panel detail flow in public mode.

### Map Reuse Strategy

Reuse `PovertyLeafletMap` as the rendering engine for the map stage, but extend public mode so it can:

- suppress the side detail panel entirely
- emit marker-selection events for public navigation
- preserve the public-safe controls

If these changes make `PovertyLeafletMap.tsx` too overloaded, extract focused public-mode helpers rather than pushing more conditional rendering into one branch.

### Public Household Detail Page

New frontend route and component:

- `FE/src/app/ban-do-ho-ngheo-cong-khai/[slug]/ho/[householdId]/page.tsx`
- `FE/src/components/poverty/PovertyPublicHouseholdDetailPage.tsx`

This page should not depend on admin-authenticated API helpers.

## Data Exposure Rules

Allowed public fields for the redesigned experience:

- household head name
- household code
- household type
- household status if approved
- member count
- area or hamlet name
- ward and province names
- public-safe address or fallback location text
- coordinates
- field photos explicitly approved for public display
- public-safe family situation and current status text
- public-safe support history

Still excluded:

- citizen ID
- phone numbers
- full household-member roster with personal details
- admin-only notes
- internal workflow metadata
- audit trails and change logs

## Testing Strategy

### Backend

- repository and handler tests for the new public household detail endpoint
- tests that the endpoint rejects disabled or mismatched slug or household combinations
- tests that sensitive fields stay excluded from both ward-list and household-detail public DTOs

### Frontend

- utility tests for public area grouping and filtering helpers
- utility tests for detail-route builders if added
- TypeScript verification for the new DTOs and page components
- interaction checks for:
  - area selection
  - list filtering
  - marker click to detail navigation
  - household detail rendering with empty photos or empty support history

### Verification

- open a public ward link and confirm the hero, map, list, and area tabs render correctly
- confirm the map no longer shows the right-side public detail panel
- confirm clicking a household opens the public household detail page
- confirm the detail page map, tabs, and cards render correctly
- confirm no login is required for either public page

## Risks And Mitigations

- Risk: extending public detail data may accidentally expose internal-only fields.
  Mitigation: add a separate public detail DTO and dedicated tests for excluded fields.

- Risk: `PovertyLeafletMap.tsx` may become too conditional in public mode.
  Mitigation: keep public-mode behavior behind a small, explicit set of props or extract helpers when complexity rises.

- Risk: the public ward page may grow into a single large component.
  Mitigation: split filtering and layout helpers into focused files early.

- Risk: support-history or photo data may not yet be safe for public exposure in all cases.
  Mitigation: keep those sections driven only by fields explicitly approved in the public DTO and fall back to empty sections gracefully.

# Poverty Household Mobile Collection Design

## Goal

Add a dedicated mobile-first collection flow at `/ho-ngheo/thu-thap` for field workers to quickly find an existing poor household or create a new one, then collect location, family situation, current status, and field photos with minimal friction on a phone.

## Scope

This design covers:

- A new mobile-first frontend route for household field collection.
- A search-first entry flow that prefers updating existing households before creating a new one.
- A shared two-step wizard for both update and create flows.
- Step 1 data capture for basic household information and coordinates.
- Step 2 data capture for `Hoàn cảnh gia đình`, `Hiện trạng`, and field photos.
- Reuse of existing APIs, coordinate picker, geolocation, context-history, and file-upload patterns where possible.
- Required backend compatibility checks before implementation.

This design does not cover:

- Offline sync or full draft persistence across sessions.
- Desktop-focused redesign of the current list, detail, or map pages.
- Bulk collection workflows.
- Report or dashboard changes.

## Requirements

### Functional Requirements

- The route is `/ho-ngheo/thu-thap`.
- The entry screen starts with household search.
- Users can search existing households before deciding to create a new one.
- If a matching household exists, the user enters a two-step update wizard.
- If no suitable household exists, the user can create a new household through the same two-step wizard pattern.
- Step 1 stores coordinates and core household data.
- Step 2 stores `Hoàn cảnh gia đình`, `Hiện trạng`, and field photos.
- Coordinates can come from:
  - manual latitude/longitude input
  - current device location
  - interactive map selection
- Field photos can come from:
  - camera capture
  - device photo library
- Data is saved step by step rather than only at the end.

### UX Requirements

- The entire flow is optimized for mobile first.
- The search screen uses cards, not tables.
- The primary actions are reachable with one-hand use through sticky footer actions.
- The update flow uses a two-step wizard:
  - Step 1: location and basic information
  - Step 2: family situation, current status, and photos
- The create flow uses the same two-step wizard:
  - Step 1: create household with core data and coordinates
  - Step 2: add family situation, current status, and photos
- The UI must remain readable without horizontal scrolling on phones.

### Non-Functional Requirements

- The new flow should reuse existing backend APIs where they already satisfy the data contract.
- The new flow should avoid coupling mobile-specific state into the current desktop list or map pages.
- Error states must preserve user-entered data on the current screen.
- Photo upload failures should not erase already selected images from the UI state.

## Recommended Approach

Create a dedicated route and component tree for a mobile-first collection mini-app while reusing the existing poverty APIs and frontend primitives.

This is the best fit because the requested experience is materially different from the current admin-style list and detail pages. A dedicated route keeps the mobile flow focused, avoids bloating existing pages, and allows the UI to prioritize large touch targets, stepwise progress, and sticky actions. Reusing the existing APIs and shared logic minimizes regression risk and shortens implementation time.

## Alternatives Considered

### Alternative 1: Reuse the existing list-page modal for collection

Reject. The existing list page is desktop-oriented and already complex. Pushing a phone-first wizard into that page would create a large mixed-responsibility component and a weaker mobile UX.

### Alternative 2: Add a fullscreen drawer instead of a route

Reject. A dedicated route is a better fit for a mini-app flow, allows direct linking, and simplifies state reset and navigation on mobile.

### Alternative 3: Build new backend aggregator endpoints first

Reject for the first iteration. The current requirement can be delivered faster by reusing household create/update, context-history, and file-upload APIs. Backend aggregation can be revisited later if the client orchestration becomes too heavy.

## User Flow Design

### Entry Flow

Route: `/ho-ngheo/thu-thap`

The first screen is always `Tìm hộ trước`.

Screen behavior:

- large search input
- optional compact filters for xã/phường and khu vực when needed
- result cards for existing households
- empty state with a prominent `Thêm hộ mới` action

### Existing Household Flow

#### Step 1: Location Update

- show household identity summary in read-only form
- allow updates to:
  - province, ward, area if permitted by existing scope rules
  - address
  - latitude
  - longitude
- allow coordinate capture by:
  - current location
  - map picker
  - manual input
- save immediately on `Lưu và tiếp tục`

#### Step 2: Context and Photos

- collect:
  - `Hoàn cảnh gia đình`
  - `Hiện trạng`
  - field photos
- allow camera and library selection
- save immediately on `Lưu hoàn tất`

### New Household Flow

#### Step 1: Basic Information and Coordinates

- collect:
  - `code`
  - `year`
  - `povertyType`
  - `status`
  - `headFullName`
  - `headCitizenId`
  - `memberCount`
  - `provinceCode`
  - `wardCode`
  - `areaId`
  - `address`
  - `latitude`
  - `longitude`
- save immediately to create the household record

#### Step 2: Context and Photos

- same UI and behavior as the existing-household flow
- save context history and photos using the newly created `householdId`

## Frontend Architecture

### Route

Add:

- `FE/src/app/(admin)/ho-ngheo/thu-thap/page.tsx`

This page should render a dedicated collection container rather than reuse the list page.

### Component Structure

Add a dedicated component folder:

- `FE/src/components/poverty/collection/PovertyCollectionPage.tsx`
- `FE/src/components/poverty/collection/PovertyCollectionSearchView.tsx`
- `FE/src/components/poverty/collection/PovertyCollectionStepOneForm.tsx`
- `FE/src/components/poverty/collection/PovertyCollectionStepTwoForm.tsx`
- `FE/src/components/poverty/collection/poverty-collection-utils.ts`

Responsibilities:

- `PovertyCollectionPage`
  - owns route-level state
  - switches among search and wizard screens
  - tracks selected or created household
- `PovertyCollectionSearchView`
  - search input
  - compact filters
  - result cards
  - empty state CTA
- `PovertyCollectionStepOneForm`
  - create/update step 1 UI
  - coordinate actions
  - map picker open/close
- `PovertyCollectionStepTwoForm`
  - family situation input
  - current status input
  - photo capture/library selection
  - photo preview and removal before save

### Shared Logic Reuse

Reuse and extract logic from current modules instead of copying behavior:

- coordinate picker from `PovertyCoordinatePicker.tsx`
- geolocation pattern from `PovertyCoordinatePicker.tsx` or `PovertyLeafletMap.tsx`
- location option loading from `PovertyHouseholdListPage.tsx`
- field-photo upload pattern from `PovertyHouseholdDetailPage.tsx`
- context-history create semantics from the existing household detail implementation

## Mobile UI Design

### General Layout

- max-width mobile container, centered on larger screens
- sticky header with:
  - back button
  - short page title
  - compact step label where relevant
- sticky footer with the primary action button
- single-column layout on phones

### Search Screen

Use cards, not tables.

Each result card should show:

- head of household
- household code
- area path
- short address
- coordinate status badge
- primary action `Cập nhật thu thập`

The empty state should show:

- concise no-result message
- large `Thêm hộ mới` button

### Step 1 Screen

If updating an existing household:

- show a read-only summary card first
- focus the editable section on location and address

If creating a new household:

- split content into:
  - household information block
  - location block

Coordinate actions:

- `Lấy vị trí hiện tại`
- `Chọn trên bản đồ`

The map picker should open in a mobile-friendly full-height modal or sheet.

### Step 2 Screen

Main sections:

- `Hoàn cảnh gia đình`
- `Hiện trạng`
- `Ảnh hiện trường`

Photo section:

- button for camera
- button for photo library
- thumbnail grid preview
- remove button per image before upload

## Data and API Flow

### Search

Use the existing household list/search surface if it can support mobile search by:

- household code
- head of household name
- citizen ID
- address text

If the current endpoint is too restrictive, extend the backend query behavior without introducing a separate mobile-only search endpoint.

### Existing Household Step 1 Save

Use the existing household update endpoint:

- `PATCH /poverty/households/:id`

Payload fields:

- `provinceCode`
- `wardCode`
- `areaId`
- `address`
- `latitude`
- `longitude`

### New Household Step 1 Save

Use the existing household create endpoint:

- `POST /poverty/households`

Expected payload fields:

- `code`
- `year`
- `povertyType`
- `status`
- `headFullName`
- `headCitizenId`
- `memberCount`
- `provinceCode`
- `wardCode`
- `areaId`
- `address`
- `latitude`
- `longitude`

This must be verified before implementation. If the current backend create schema does not accept the household identity fields, backend support must be added.

### Step 2 Save

Create a context-history record first, then upload photos.

Calls:

- `POST /poverty/households/:id/context-histories`
- `POST /admin/files` for each selected image

Step 2 payload:

- `recordedAt`
- `familySituation`
- `currentStatus`
- optional `note` if the UI later includes it

Photo upload entity binding should match the existing field-photo model for poor households.

## Validation Rules

### Step 1

Require:

- location hierarchy consistent with current scope rules
- address at the same minimum level used in current household create/update
- valid coordinates before continuing

Coordinate fallback rules:

- if geolocation fails, the user can still select on map or type coordinates manually

### Step 2

Require at least one of:

- `familySituation`
- `currentStatus`
- one or more photos

This rule is intentionally less strict than requiring all three, because field collection conditions may vary.

## Error Handling

- Search failures keep the search screen usable and show a standard notification.
- Step 1 save failure keeps all entered values on screen.
- Step 2 context-history failure stops photo upload and keeps current form state.
- Partial photo-upload failure reports which part failed while preserving the rest of the step state for retry.
- Geolocation permission denial should show a short message and point the user to map selection.

## Permissions

The new route should reuse existing permission checks where possible:

- view/access to the collection route must be explicitly gated
- create flow uses `poverty.household.create`
- update flow uses `poverty.household.update`
- coordinate updates align with current map-position update capability where applicable
- context and photo updates align with the current detail-update capability or equivalent poverty update permissions

The exact route-level permission check must be aligned with the current authorization model during implementation.

## Backend Compatibility Checks

The following must be confirmed before coding starts:

1. The create and update household endpoints accept `headFullName`, `headCitizenId`, and `memberCount`.
2. The household search endpoint can find records by code, household head, citizen ID, and address text.
3. The context-history create endpoint is ready for mobile step 2 usage.
4. Field-photo uploads already support the intended `entityType` and preview/delete behavior for poor households.
5. Existing permissions are sufficient for the new route or can be extended cleanly.

If any of these fail, backend updates become part of the implementation plan.

## Testing Strategy

### Frontend

Add tests for:

- search-state transitions
- wizard mode transitions between search, step 1, and step 2
- coordinate source handling logic
- step payload building
- validation rules, especially the step 2 “at least one of three inputs” rule

Also run:

- TypeScript compile for FE
- targeted tests for new collection utilities

### Backend

If backend adjustments are needed, add tests for:

- create/update schema support for mobile step 1 fields
- search filtering behavior
- context-history create compatibility
- permission enforcement for the new route or reused handlers

## Risks and Mitigations

### Risk 1: Backend create/update schema is incomplete for step 1

Mitigation:

- verify current schemas before implementation
- plan backend support first if required

### Risk 2: Mobile photo capture differs across Android and iPhone

Mitigation:

- rely on browser-compatible file input patterns first
- keep camera and library actions distinct in the UI

### Risk 3: Geolocation permission is denied or unreliable

Mitigation:

- always provide map selection and manual coordinate entry as fallback

### Risk 4: The new flow duplicates too much logic from existing pages

Mitigation:

- extract shared utilities before wiring the new route
- keep collection-specific UI isolated while reusing data helpers

## Implementation Boundaries

The first implementation pass should deliver:

- the new route
- mobile search-first entry
- step 1 create/update save
- step 2 context and photo save
- mobile-friendly UI and error handling

The first pass should not attempt:

- offline storage
- resumable drafts across sessions
- batch collection
- redesign of unrelated poverty pages

# Poverty Public Ward Map Design

## Goal

Add a controlled public-sharing flow for poverty ward maps so an admin can enable a single fixed public link per `workspace + ward`, copy that link from the ward general-info screen, and let outside viewers open a read-only poverty map without logging in.

## Scope

This design covers:

- Backend data model for one public-share record per `workspace + ward`.
- Backend admin APIs to read and update the public-share state.
- Backend public API to serve a sanitized read-only ward map for the current year.
- Frontend admin UI in the ward general-info modal for enabling public access and copying the link.
- Frontend public page for outside viewers.
- Data sanitization, empty/error states, and testing expectations.

This design does not cover:

- Public editing or contribution flows.
- Public access to household detail pages, field photos, member lists, support timelines, or change logs.
- Multi-year public browsing.
- Analytics, rate limits, or audit dashboards for public traffic.

## Requirements

### Functional Requirements

- Each ward has at most one fixed public link per workspace.
- The public link remains stable across enable/disable cycles.
- The admin enables or disables public access from the ward general-info screen.
- The public page does not require login or workspace headers.
- The public page always opens the current year and does not let outside viewers change year.
- The public page shows map markers and ward-level summary information for the selected ward only.
- Outside viewers can inspect marker popups, but sensitive data must be excluded.
- If public access is disabled after a link was generated, the old link must stop working for public viewers.

### UX Requirements

- The admin UI exposes a simple `Công khai thông tin` toggle plus `Copy` and `Mở thử` actions.
- The public page must feel like a dedicated public-facing experience, not an admin page with controls hidden.
- The map remains the primary visual element on desktop and mobile.
- The public page should keep a small set of read-only conveniences such as search, legend, fit-to-extent, and simple poverty-type filtering.

### Security Requirements

- Public APIs must not depend on client-supplied workspace or ward identifiers once the slug is resolved.
- Public APIs must return a dedicated sanitized DTO instead of reusing the internal admin marker response.
- Sensitive fields such as citizen ID, phone numbers, field photos, members, assessment histories, support histories, context histories, and change logs must not be included in the public response.

## Recommended Approach

Create a separate ward-public-share entity keyed by `workspace + ward`, plus a dedicated public page and public API surface.

This is the best fit because the user wants one fixed link per ward, independent of year-specific ward-overview rows. Keeping the public-share state outside `poverty_ward_overviews` avoids duplicated toggle state across years, keeps access control explicit, and gives the backend a single place to enforce slug uniqueness and public enablement.

## Alternatives Considered

### Alternative 1: Store `isPublic` and `publicSlug` on `poverty_ward_overviews`

Reject. `poverty_ward_overviews` is year-based, while the share link is ward-based and fixed across years. This would duplicate state and create drift risk.

### Alternative 2: Build the public URL from predictable identifiers like `workspaceId + wardCode`

Reject. Predictable URLs are easier to enumerate, harder to rotate safely, and make public access feel like an exposed internal endpoint instead of a controlled share feature.

### Alternative 3: Reuse the existing internal map page with auth disabled

Reject. The current map page is tied to session-based API calls, permission logic, internal controls, and a wider data contract than public viewers should receive.

## Data Model Design

Add a new table, tentatively named `poverty_ward_public_links`.

Proposed columns:

- `id`: UUID primary key
- `workspace_id`: UUID, required
- `province_code`: text/varchar, required
- `ward_code`: text/varchar, required
- `public_slug`: text/varchar, required
- `is_public`: boolean, required, default `false`
- `published_at`: timestamp, nullable
- `created_by`: UUID, nullable
- `updated_by`: UUID, nullable
- `created_at`: timestamp, default now
- `updated_at`: timestamp, default now

Constraints:

- unique on `(workspace_id, province_code, ward_code)`
- unique on `public_slug`
- index on `public_slug`

Business rules:

- First enable generates a stable slug if one does not already exist.
- Later enable/disable operations keep the same slug.
- A ward can have a share record even when `is_public = false`; this preserves the fixed link.

Slug design:

- Use a generated opaque slug, not a human-readable location string.
- The slug should be long enough to resist guessing and independent from future ward renames.

## Backend API Design

### Admin API

Add a workspace-scoped admin surface for ward public-share state.

Recommended endpoints:

- `GET /poverty/ward-public-links?provinceCode=...&wardCode=...`
- `PUT /poverty/ward-public-links`

`GET` response:

- `item | null` for the selected ward
- enough data for the admin UI to render current toggle state and preview/copy URL

`PUT` payload:

- `provinceCode`
- `wardCode`
- `isPublic`

`PUT` behavior:

- validate the ward is inside the caller scope
- create the share record if missing
- generate slug only on first create
- update `isPublic`, `publishedAt`, and audit fields
- return the current share record

### Public API

Add a public endpoint that does not require authentication, for example:

- `GET /public/poverty/wards/:slug`

Behavior:

- resolve the share record by slug
- reject when the slug is unknown
- reject when the share record exists but `isPublic = false`
- derive `workspace`, `provinceCode`, and `wardCode` from the share record, not from query input
- fetch only current-year data for that ward
- return a dedicated public response object

Public response shape:

- `share`: basic share metadata such as ward/province display names
- `overview`: current-year ward overview if available
- `summary`: current-year aggregate totals for the ward
- `markers`: sanitized household markers for the ward

## Public Data Contract

Add frontend and backend public DTOs instead of reusing internal map types directly.

### Allowed ward-level fields

- ward name
- province name
- current year
- population
- total households
- total members
- natural area
- a ward note if the current note is acceptable for public display

### Allowed marker-level fields

- `id`
- `code`
- `headFullName`
- `povertyType`
- `status`
- `areaName`
- `wardName`
- `memberCount`
- `latitude`
- `longitude`
- `address`, only if the current business decision accepts that granularity

### Excluded marker-level and detail fields

- `headCitizenId`
- phone numbers
- field photos
- household members
- assessments
- supports
- context histories
- change logs
- internal notes not explicitly approved for public display

Implementation note:

- If `address` is currently too specific, the public DTO should fall back to a safer display like `areaName + wardName` instead of returning the full address string.

## Frontend Admin Design

Target screen:

- [`FE/src/components/poverty/PovertyAdminGeneralInfoPage.tsx`](/Users/sondt/Dev/Git/GIS%20ASXH/FE/src/components/poverty/PovertyAdminGeneralInfoPage.tsx)

Inside the ward general-info modal, add a dedicated card for public sharing.

Card contents:

- `Checkbox` or `Switch`: `Công khai thông tin`
- helper text explaining that the ward map becomes publicly viewable in read-only mode
- readonly input showing the public URL when available
- `Copy` button
- `Mở thử` button to open the public page in a new tab

Behavior:

- loading the modal should also load the ward public-share record
- before first enable, the URL input shows placeholder text
- enabling public access triggers the admin `PUT` endpoint and reveals the fixed URL
- disabling public access keeps the URL but public visitors can no longer open it successfully
- API failure rolls the toggle state back to the previous value

Permissions:

- viewing the card can follow the same permission as ward overview view
- changing the toggle should require ward overview update permission unless a separate `poverty.ward_public.update` permission is introduced later

## Frontend Public Page Design

Add a dedicated public page, for example:

- `FE/src/app/ban-do-ho-ngheo-cong-khai/[slug]/page.tsx`

Use a public-only data loader instead of the authenticated `api` helper, because the public page must not depend on tokens or `x-workspace-id`.

Page structure:

- top hero/header with ward name, public-map title, and current-year badge
- compact summary cards for total poor, near-poor, total tracked households, and maybe member totals if available
- large map section as the primary focus
- supporting controls for search, legend, fit bounds, and simple poverty-type filtering

Do not include:

- year selector
- create/edit actions
- coordinate update controls
- internal navigation to collection or household detail management
- timeline panels or admin-only sidebars

## Shared Map Component Strategy

Refactor the current map rendering so the visual map engine can support at least two modes:

- `admin`
- `public`

Recommended approach:

- keep a shared base map component or shared internal helpers for marker rendering, clustering, bounds fitting, and layer switching
- separate admin-only popup/actions from the public popup/actions
- public mode must turn off every mutation branch in the current map component

This avoids duplicating complex map behavior while keeping the public experience clean and safe.

## Error Handling

### Admin UI

- If the public-share state fails to load, show an inline error state in the sharing card and allow retry.
- If toggle update fails, restore the previous UI state and show a notification.
- If clipboard copy fails, show a fallback error message and keep the URL selectable.

### Public Page

- unknown slug: show `Liên kết không hợp lệ`
- known slug but disabled: show `Trang này hiện không còn được công khai`
- no current-year ward overview or no markers: show a valid empty state rather than an error
- API/network failure: show a public-safe retry state

## Testing Strategy

### Backend

Add tests for:

- create-first-share flow generates a slug and stores one record per `workspace + ward`
- enable/disable cycles do not rotate the slug
- public lookup rejects unknown slugs
- public lookup rejects disabled shares
- public lookup resolves the correct workspace and ward even if the same ward code exists in another workspace
- public response only returns current-year data
- public response excludes sensitive fields such as `headCitizenId`

### Frontend

Add tests for:

- admin sharing card states: no link yet, enabled, disabled, loading, and error
- link copy behavior and preview link rendering
- public page empty/error states
- public page does not render admin-only actions
- public page year handling always pins to the current year

### Manual Verification

- enable sharing for one ward, copy the link, and open it in an incognito window
- verify the page loads without login
- verify the page shows the correct workspace data and correct ward only
- verify marker popup data is sanitized
- disable the share and confirm the old public link is blocked on reload

## Risks and Mitigations

### Risk: accidental data leakage from reused internal marker types

Mitigation: define a dedicated public DTO and keep the public serializer explicit.

### Risk: public page drifts into a partially disabled admin page

Mitigation: create a dedicated public route and layout, reusing only low-level map rendering pieces.

### Risk: ward notes or addresses may still be too sensitive for public display

Mitigation: keep the public DTO conservative and treat full address/note exposure as an explicit allow-list decision.

## Implementation Sequence

1. Add database schema and migration for ward public links.
2. Add backend repository methods and admin/public handlers.
3. Add backend tests for slug lifecycle and sanitized public response.
4. Add frontend endpoints and public DTO types.
5. Add admin sharing card in the ward general-info modal.
6. Build the public page and read-only map mode.
7. Verify admin and public flows end to end.

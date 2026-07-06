# Poverty Admin Location Standardization Design

## Goal

Move poverty “Thông tin chung” management into the admin section, standardize location data around province, ward, and area master data, and migrate poverty-household location entry and filtering from free-text fields to DB-backed selections.

## Scope

This design covers:

- A new admin route at `/quan-tri/thong-tin-chung`.
- Ward-level annual overview management, separate from household context history.
- A new `areas` master-data table for `khu vực/ấp`, managed per ward.
- Standardized province, ward, and area keys for poverty households while keeping text snapshots for compatibility.
- Backend APIs for location options, ward overviews, and area CRUD.
- Frontend updates for admin management screens, household forms, and location filters.
- A backfill process from existing `province_name`, `ward_name`, and `area_name` text data to standardized keys.

This design does not cover:

- Replacing the existing province-level `poverty_year_overviews` dashboard source.
- Changing the purpose or structure of `household_context_histories`.
- Bulk import UI for ward overviews or areas beyond the migration/backfill flow.

## Confirmed Decisions

- Use **Approach 2**: store standardized location keys and also keep text snapshot columns on poverty households.
- `household_context_histories` stays unchanged and remains household-only.
- Ward general information must be stored yearly, similar in behavior to `poverty_year_overviews`, with an added `naturalArea` field.
- The system supports multiple provinces in data, but the UI defaults to `Cần Thơ`.
- “Thông tin chung” moves under admin and uses route `/quan-tri/thong-tin-chung`.
- `khu vực/ấp` is a new master-data entity managed under each ward.
- Backfill must be designed and implemented for legacy poverty-household text location data.

## Requirements

### Functional Requirements

- Admin users can open `/quan-tri/thong-tin-chung` and manage ward-level annual general information.
- The admin page defaults to province `Cần Thơ`, but allows switching to other provinces.
- The admin page lists wards for the selected province.
- Each ward supports yearly CRUD for:
  - `population`
  - `totalHouseholds`
  - `totalMembers`
  - `naturalArea`
  - `note`
- Each ward links to a dedicated `khu vực/ấp` management page.
- Admin users can CRUD `khu vực/ấp` records with:
  - `Bí thư`
  - `Số điện thoại bí thư`
  - `Trưởng ấp`
  - `Số điện thoại trưởng ấp`
  - `Tổ trưởng TANTTCS`
  - `Số điện thoại Tổ trưởng TANTTCS`
  - `diện tích tự nhiên`
  - `mô tả`
  - `ghi chú`
- Poverty households no longer allow manual entry of `province_name`, `ward_name`, or `area_name`.
- Poverty household create, update, detail, and filters use standardized province, ward, and area sources from DB-backed master data.
- Existing reports, lists, and maps continue to display readable names.
- Legacy poverty-household rows are backfilled to standardized keys where matching is safe.
- Unmatched or ambiguous legacy rows are preserved and surfaced as migration exceptions instead of being auto-assigned incorrectly.

### UX Requirements

- `/quan-tri/thong-tin-chung` feels like an admin configuration page, not an operational household page.
- Province defaults to `Cần Thơ` on first load for admin screens and household filters.
- Ward annual overview editing follows the same interaction pattern as the current yearly overview page.
- Area management uses a full CRUD list page with modal create/edit flows, consistent with existing poverty UI patterns.
- Existing household screens continue to render older records gracefully during transition.
- If a household record has not been fully standardized after backfill, the UI shows a short warning and asks the user to reselect location values.

### Non-Functional Requirements

- Changes should minimize regression risk in current poverty dashboards, reports, and maps.
- Existing `poverty_year_overviews` behavior remains intact.
- Existing `household_context_histories` behavior remains intact.
- The system must remain usable during phased migration, even if some old records are unresolved.

## Recommended Approach

Introduce a new ward-level overview table and a new `areas` master-data table, then migrate poverty households to standardized foreign-key-like location fields while preserving text snapshots for compatibility.

This is the best fit because it separates three distinct concepts cleanly:

- province-level yearly overview used by current dashboards
- ward-level yearly admin data
- household-level context history

It also aligns with the user requirement that location values must come from DB tables, while protecting existing surfaces that still depend on text labels.

## Alternatives Considered

### Alternative 1: Reuse `household_context_histories` for ward information

Reject. This table is confirmed to be household-only and time-based per household, not per ward and year.

### Alternative 2: Replace `poverty_year_overviews` with ward-specific data

Reject. Current province-level dashboards already depend on `poverty_year_overviews`, and replacing that source would add unnecessary regression risk.

### Alternative 3: Keep only text location fields and standardize in UI only

Reject. This would not satisfy the requirement that household location values and filters come from DB-backed master data.

## Data Model Design

### Existing Administrative Source Tables

Use the existing administrative tables as the authoritative source for province and ward lists:

- `provinces`
- `wards`
- `administrative_units`
- `administrative_regions`

The poverty module should read from these tables for location options and labels. No manual text entry is allowed for province or ward in the new UI.

### New Table: `gisasxh.poverty_ward_overviews`

Purpose:

- store annual “Thông tin chung” for a specific ward
- keep this concept separate from province-level `poverty_year_overviews`

Proposed columns:

- `id`: UUID primary key
- `province_code`: text, required
- `ward_code`: text, required
- `year`: integer, required
- `population`: integer, required, default `0`
- `total_households`: integer, required, default `0`
- `total_members`: integer, required, default `0`
- `natural_area`: numeric, required
- `note`: text, optional
- `created_at`: timestamp
- `updated_at`: timestamp

Constraints:

- unique `(province_code, ward_code, year)`
- indexes on `province_code`, `ward_code`, and `(province_code, ward_code, year desc)`

### New Table: `gisasxh.areas`

Purpose:

- store `khu vực/ấp` master data per ward

Proposed columns:

- `id`: UUID primary key
- `province_code`: text, required
- `ward_code`: text, required
- `code`: text, optional
- `name`: text, required
- `secretary_name`: text, optional
- `secretary_phone`: text, optional
- `hamlet_head_name`: text, optional
- `hamlet_head_phone`: text, optional
- `security_team_leader_name`: text, optional
- `security_team_leader_phone`: text, optional
- `natural_area`: numeric or double precision, optional
- `description`: text, optional
- `note`: text, optional
- `status`: boolean, required, default `true`
- `created_at`: timestamp
- `updated_at`: timestamp

Constraints:

- unique `(ward_code, name)`
- indexes on `province_code`, `ward_code`, `status`

### Changes to `gisasxh.poor_households`

Add standardized key fields:

- `province_code`
- `ward_code`
- `area_id`

Keep existing text snapshot fields:

- `province_name`
- `ward_name`
- `area_name`

Purpose of snapshot fields:

- preserve legacy values
- reduce regression risk in older list/report/map reads
- retain user-visible labels during partial migration

Read behavior after migration:

- prefer joined names from `province_code`, `ward_code`, and `area_id`
- fallback to snapshot text if standardized keys are missing

### No Changes to `gisasxh.household_context_histories`

This table remains exactly for household-level time history and is explicitly out of scope for this location-admin redesign.

## Backend API Design

### Location Option APIs

Provide read APIs for standardized location options:

- `GET /poverty/locations/provinces`
- `GET /poverty/locations/wards?provinceCode=...`
- `GET /poverty/locations/areas?wardCode=...`

Response shape should include:

- code/id
- display name
- minimal administrative metadata needed for dropdown rendering

These APIs are shared by:

- admin information screens
- household forms
- household filters

### Ward Overview APIs

Create a new CRUD surface for ward annual general information:

- `GET /poverty/ward-overviews?provinceCode=...&wardCode=...`
- `PUT /poverty/ward-overviews`
- `DELETE /poverty/ward-overviews/:id`

`PUT` payload:

- `provinceCode`
- `wardCode`
- `year`
- `population`
- `totalHouseholds`
- `totalMembers`
- `naturalArea`
- `note`

Behavior:

- update existing row when `(provinceCode, wardCode, year)` already exists
- otherwise create a new row

### Area APIs

Create nested ward-scoped area CRUD:

- `GET /poverty/wards/:wardCode/areas`
- `POST /poverty/wards/:wardCode/areas`
- `PATCH /poverty/wards/:wardCode/areas/:areaId`
- `DELETE /poverty/wards/:wardCode/areas/:areaId`

Payload fields:

- `provinceCode`
- `wardCode`
- `code`
- `name`
- `secretaryName`
- `secretaryPhone`
- `hamletHeadName`
- `hamletHeadPhone`
- `securityTeamLeaderName`
- `securityTeamLeaderPhone`
- `naturalArea`
- `description`
- `note`
- `status`

### Poverty Household API Changes

Extend household create/update/list/detail contracts with:

- `provinceCode`
- `wardCode`
- `areaId`

Retain response fields:

- `provinceName`
- `wardName`
- `areaName`

Behavior:

- write standardized keys from selected master data
- update text snapshot fields from the selected joined labels
- during reads, derive names from joined data first and fallback to snapshot text second

### Existing Province-Level Overview APIs Stay Intact

Keep the current `poverty_year_overviews` API surface unchanged so current dashboard behavior remains stable.

## Repository and Query Design

### Ward List for Admin Screen

Repository needs a province-scoped ward list query that returns:

- `wardCode`
- `wardName`
- administrative unit/region metadata if useful
- count of yearly overview records per ward

### Ward Overview Repository Logic

Repository should support:

- list by `provinceCode` and `wardCode`
- upsert by `(provinceCode, wardCode, year)`
- delete by `id`

### Area Repository Logic

Repository should support:

- list areas by ward
- create area
- update area
- delete area
- optional lightweight search/sort if needed by the admin list page

### Household Read Logic

Household repository should:

- filter by standardized keys when present
- join standardized labels for province, ward, and area
- fallback to snapshot text values for legacy rows not yet standardized

This fallback is required for:

- list page
- detail page
- map markers
- report exports

## Frontend Design

### Admin Route

New admin route:

- `/quan-tri/thong-tin-chung`

This page belongs in the admin navigation, not under poverty operational routes.

### Admin General Information Page

Main layout:

- top filter for province, default `Cần Thơ`
- ward list for the selected province
- action per ward to manage yearly general information
- action per ward to manage `khu vực/ấp`

Ward list columns:

- ward name
- administrative unit label if available
- number of yearly records
- action: `Cập nhật thông tin chung`
- action: `Quản lý khu vực/ấp`

### Ward Overview Editing UX

Interaction pattern should mirror the current `PovertyYearOverviewPage`, but scoped to one ward.

Form fields:

- `Năm`
- `Dân số`
- `Số hộ`
- `Số nhân khẩu`
- `Diện tích`
- `Ghi chú`

Table fields:

- `Năm`
- `Dân số`
- `Số hộ`
- `Số nhân khẩu`
- `Diện tích`
- `Ghi chú`
- `Thao tác`

### Area Management Route

New route:

- `/quan-tri/thong-tin-chung/[wardCode]/khu-vuc-ap`

Page structure:

- breadcrumb or title showing province and ward
- back action to ward list
- full CRUD table
- modal create/edit form

Area list columns:

- `Mã`
- `Tên khu vực/ấp`
- `Bí thư`
- `SĐT Bí thư`
- `Trưởng ấp`
- `SĐT Trưởng ấp`
- `Tổ trưởng TANTTCS`
- `SĐT Tổ trưởng TANTTCS`
- `Diện tích tự nhiên`
- `Mô tả`
- `Ghi chú`
- `Trạng thái`
- `Thao tác`

### Household Form Changes

The household location section changes from free-text inputs to dependent selects:

- `Tỉnh/Thành phố`
- `Xã/Phường`
- `Khu vực/Ấp`

Rules:

- province defaults to `Cần Thơ`
- ward options depend on province
- area options depend on ward
- no manual typing for these fields

If a household record is not fully standardized:

- show a short warning
- display old snapshot text as reference
- require the user to reselect location from standardized options before saving

### Filter Changes

Replace text-based location filters across poverty screens with standardized dropdowns:

- province
- ward
- area

Applies to:

- household list
- household map
- poverty reports

Default filter state:

- province preselected to `Cần Thơ`

## Migration and Backfill Design

### Backfill Target

Backfill only affects poverty households in this scope.

No backfill is required for:

- `household_context_histories`
- province-level `poverty_year_overviews`
- new ward overviews, because no reliable ward-year source exists in the current schema

### Backfill Steps

1. Map `province_name` to `province_code`
2. Map `ward_name` to `ward_code` within the resolved province
3. Resolve or create `areas` from `area_name` within the resolved ward
4. Update `poor_households` with `province_code`, `ward_code`, and `area_id`
5. Preserve original `province_name`, `ward_name`, and `area_name`
6. Capture unresolved or ambiguous records into an exception report

### Matching Rules

Use normalized name matching:

- trim whitespace
- lowercase
- remove Vietnamese accents
- normalize punctuation and spacing

Safe auto-assignment only when:

- province match is unique
- ward match is unique within province
- area match is unique within ward

If an area does not exist but province and ward are resolved:

- create a minimal `areas` row with:
  - `province_code`
  - `ward_code`
  - `name`
  - `status = true`

Leave the rest of the area detail fields blank for later admin completion.

### Exception Handling

When matching is ambiguous or missing:

- do not auto-assign the standardized key
- leave snapshot text intact
- record the row in a backfill exception output

The output should include enough context for admin review:

- household id
- code
- province_name
- ward_name
- area_name
- reason for failure

## Validation Rules

### Ward Overview Validation

- `provinceCode`: required
- `wardCode`: required
- `year`: required, valid range
- numeric metrics: non-negative
- `naturalArea`: non-negative if provided

### Area Validation

- `name`: required
- phone fields: optional, but validated against system phone format if present
- `naturalArea`: non-negative if provided

### Household Validation

- `provinceCode`: required for new and edited household records
- `wardCode`: required
- `areaId`: required

## Error Handling

Backend:

- return normal validation responses for invalid overview, area, or household location payloads
- return not found for invalid ward or area references
- prevent cross-ward or cross-province mismatches in nested area routes

Frontend:

- use current notification pattern for load, save, delete, and filter failures
- show empty states for wards without yearly overview rows
- show empty states for wards without area rows
- show clear warning when a household still depends on unresolved snapshot location text

## Testing Strategy

### Backend

Add tests for:

- ward overview schema validation
- area schema validation
- upsert behavior for `(provinceCode, wardCode, year)`
- area CRUD behavior
- household write/read behavior with standardized location keys
- fallback to snapshot text when standardized keys are missing
- backfill name matching
- backfill area creation
- backfill exception output

### Frontend

Add tests for:

- `/quan-tri/thong-tin-chung` defaulting to `Cần Thơ`
- province switch reloading the ward list
- ward overview CRUD flow
- area CRUD flow
- household dependent location selects
- standardized location filters on list/map/report screens
- unresolved legacy household warning state

## Risks and Mitigations

### Risk: backfill maps wrong legacy names

Mitigation:

- auto-assign only on unambiguous matches
- output exceptions for manual review

### Risk: current list/report/map pages regress because they still depend on text labels

Mitigation:

- keep text snapshot fields
- repository prefers joined standardized names and falls back to snapshot values

### Risk: existing province-level dashboard behavior changes unintentionally

Mitigation:

- leave `poverty_year_overviews` and its APIs unchanged
- introduce ward-level annual data in a separate table and route family

### Risk: route move hides the feature from users

Mitigation:

- add admin navigation entry for `/quan-tri/thong-tin-chung`
- optionally redirect old operational route to the new admin route during transition if needed

## Completion Criteria

- `/quan-tri/thong-tin-chung` exists in admin and defaults to `Cần Thơ`
- admin can manage yearly general information for each ward
- admin can manage `khu vực/ấp` per ward with all required fields
- poverty households use standardized location selections instead of manual text entry
- poverty list/map/report filters use standardized location data
- legacy poverty households are backfilled safely to standardized keys
- unresolved backfill rows are reported for manual follow-up
- existing `poverty_year_overviews` dashboards remain functional
- `household_context_histories` remains unchanged in behavior and schema

# Poverty Household MVP Design

## Goal

Build the first usable backend and frontend workflow for the digital poverty household map based on the Excel function list. The MVP covers household administration, members, assessments, change history, Excel import/export, GIS marker display, dashboard aggregates, and Excel reports.

## Scope

The MVP uses the existing database tables in schema `gisasxh`:

- `poor_households`
- `household_members`
- `household_change_logs`
- `household_assessments`

Administrative geography stays as text fields on `poor_households`: `province_name`, `district_name`, `ward_name`, and `area_name`. The MVP does not add `organization_id` or new administrative-area relations.

Field photos use the existing `files` table with `entityType = "poor_household"` and `entityId` set to the household id. Location history is recorded through `household_change_logs`.

## Backend Architecture

Add Drizzle table definitions for the four existing `gisasxh` tables in `BE/src/schema.ts`. Route handlers will follow the existing Express pattern under `BE/src/handlers/admin/resources`, with zod validation, `apiResponse`, `asyncHandler`, pagination metadata, and guarded routes.

Add a new route group, registered from `BE/src/routes/admin.ts`, for poverty household endpoints:

- `GET /poverty/households`
- `POST /poverty/households`
- `GET /poverty/households/:id`
- `PATCH /poverty/households/:id`
- `DELETE /poverty/households/:id`
- `GET /poverty/households/:id/members`
- `POST /poverty/households/:id/members`
- `PATCH /poverty/households/:id/members/:memberId`
- `DELETE /poverty/households/:id/members/:memberId`
- `GET /poverty/households/:id/assessments`
- `POST /poverty/households/:id/assessments`
- `PATCH /poverty/households/:id/assessments/:assessmentId`
- `DELETE /poverty/households/:id/assessments/:assessmentId`
- `GET /poverty/households/:id/change-logs`
- `POST /poverty/households/import-excel`
- `GET /poverty/households/export-excel`
- `GET /poverty/gis/markers`
- `GET /poverty/dashboard`
- `GET /poverty/reports/summary`
- `GET /poverty/reports/export-excel`

Every create, update, and delete operation writes one `household_change_logs` row. The log stores `action_type`, `object_type`, `object_id`, `old_data`, `new_data`, `changed_by`, and `change_note` where available.

## Backend Behavior

Household list supports pagination, search, year, poverty type, status, province, district, ward, area, and sort. Search checks code, address, and geography text.

Household detail returns the household, members, assessments, recent change logs, and attached photo metadata from `files`.

Import Excel accepts a JSON body with `fileName` and `fileContentBase64`. The first sheet is parsed with `xlsx-js-style`. Rows are mapped by Vietnamese or English column names. Valid rows are inserted or updated by unique `code`; invalid rows are reported with row number and reason. Import creates change logs for inserted and updated rows.

Export Excel returns a base64 `.xlsx` payload with household rows and common columns. Report export returns aggregate rows by area and poverty type.

Dashboard returns:

- total poor households
- total near-poor households
- total active households
- totals by province, district, ward, and area
- poverty type ratio
- yearly trend

GIS markers return only households with valid latitude and longitude, plus popup fields: id, code, poverty type, status, year, address, province, district, ward, and area.

## Frontend Architecture

Add endpoints to `FE/src/lib/endpoints.ts`.

Add a new admin section for poverty household management. The frontend will use existing patterns: client components, `api`, Ant Design controls, controller components, `TitleSpace`, `FilterSpace`, `ActionModal`, `ConfirmModal`, `AppPagination`, and ApexCharts.

Pages:

- `/ho-ngheo`: household administration list, filters, create/edit/delete, import/export.
- `/ho-ngheo/[id]`: household detail with tabs for household info, members, assessments, photos, and change history.
- `/ban-do-ho-ngheo`: GIS marker view with filters and household popup.
- `/dashboard-ho-ngheo`: summary cards and charts.
- `/bao-cao-ho-ngheo`: aggregate report filters and export Excel.

The MVP map will render a practical marker view using latitude and longitude without adding a new map dependency. If a true map tile background is required later, add Leaflet/OpenStreetMap in a follow-up.

## Error Handling

API validation errors return existing `HttpErrors.ValidationFailed`. Missing household/member/assessment records return `HttpErrors.NotFound`. Import returns a success response even when some rows fail, with `created`, `updated`, `failed`, and `errors` arrays so the UI can show partial results.

Frontend errors use `App.useApp().notification` and keep current form data intact.

## Testing And Verification

Backend unit tests cover:

- household query schema and filter construction
- create/update/delete log writing
- import row mapping and validation
- dashboard aggregation helpers
- export workbook payload shape

Frontend verification covers TypeScript/build checks and manual workflow checks:

- list/filter households
- create/edit household
- manage members and assessments in detail page
- import/export Excel
- dashboard renders aggregate data
- GIS marker view renders households with coordinates

## Out Of Scope

- New administrative-area relation columns.
- Advanced map tile rendering.
- PDF export.
- Offline/mobile survey workflow.
- Row-level geographic authorization beyond existing route guards.

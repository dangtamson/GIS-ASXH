# Poverty Household MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a usable full-stack MVP for poverty household administration, GIS markers, dashboard, and Excel reports.

**Architecture:** The backend adds typed Drizzle access to existing `gisasxh` poverty tables and exposes guarded Express routes under `/poverty`. The frontend adds focused Next.js admin pages that call these APIs through the existing `api` helper and use current controller/Ant Design patterns.

**Tech Stack:** Express, TypeScript, Drizzle ORM, PostgreSQL, zod, xlsx-js-style, Vitest, Next.js, React, Ant Design, ApexCharts.

---

## File Structure

- Modify `BE/src/schema.ts`: add `gisasxh` schema tables for households, members, assessments, and change logs.
- Create `BE/src/handlers/admin/resources/poverty/poverty.schemas.ts`: zod schemas, constants, and shared parsing helpers.
- Create `BE/src/handlers/admin/resources/poverty/poverty.repository.ts`: database operations and aggregate queries.
- Create `BE/src/handlers/admin/resources/poverty/poverty.excel.ts`: import/export workbook helpers.
- Create `BE/src/handlers/admin/resources/poverty/poverty.handlers.ts`: Express handlers.
- Create `BE/src/handlers/admin/resources/poverty/index.ts`: exports.
- Create `BE/src/routes/admin/poverty.ts`: route registration.
- Modify `BE/src/routes/admin.ts`: register poverty routes.
- Modify `BE/src/helpers/permissions.ts`: add route constants and permission mapping.
- Create `BE/src/handlers/admin/resources/poverty/poverty.excel.test.ts`: import/export helper tests.
- Create `BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts`: pure helper/aggregate tests where possible.
- Modify `FE/src/lib/endpoints.ts`: add poverty endpoint paths.
- Create `FE/src/types/poverty.ts`: shared frontend types.
- Create `FE/src/components/poverty/poverty-utils.ts`: formatting and download helpers.
- Create `FE/src/components/poverty/PovertyHouseholdListPage.tsx`: administration list and modal form.
- Create `FE/src/components/poverty/PovertyHouseholdDetailPage.tsx`: detail tabs for members, assessments, files, and logs.
- Create `FE/src/components/poverty/PovertyMapPage.tsx`: coordinate marker view.
- Create `FE/src/components/poverty/PovertyDashboardPage.tsx`: cards and charts.
- Create `FE/src/components/poverty/PovertyReportPage.tsx`: aggregate report and export.
- Create app routes:
  - `FE/src/app/(admin)/ho-ngheo/page.tsx`
  - `FE/src/app/(admin)/ho-ngheo/[id]/page.tsx`
  - `FE/src/app/(admin)/ban-do-ho-ngheo/page.tsx`
  - `FE/src/app/(admin)/dashboard-ho-ngheo/page.tsx`
  - `FE/src/app/(admin)/bao-cao-ho-ngheo/page.tsx`
- Modify `FE/src/layout/AppSidebar.tsx`: add static fallback menu items if dynamic features are not seeded.

## Task 1: Backend Table Definitions

**Files:**
- Modify: `BE/src/schema.ts`

- [ ] **Step 1: Add `pgSchema` import**

Add `pgSchema` to the `drizzle-orm/pg-core` import list in `BE/src/schema.ts`.

- [ ] **Step 2: Define `gisasxh` poverty tables**

Add table definitions matching the live database: bigint ids, text geography, numeric assessment scores, JSONB log payloads, and timestamps.

- [ ] **Step 3: Run typecheck**

Run: `pnpm tsc:check`

Expected: TypeScript does not report schema typing errors.

## Task 2: Backend Schemas And Repository

**Files:**
- Create: `BE/src/handlers/admin/resources/poverty/poverty.schemas.ts`
- Create: `BE/src/handlers/admin/resources/poverty/poverty.repository.ts`

- [ ] **Step 1: Write zod schemas**

Create list, household create/update, member create/update, assessment create/update, import, and export query schemas. Use normalized poverty values `POOR` and `NEAR_POOR`, but accept common Vietnamese labels during import.

- [ ] **Step 2: Write repository functions**

Implement list/detail CRUD helpers, `insertChangeLog`, marker query, dashboard aggregate query, and report summary query using Drizzle.

- [ ] **Step 3: Run typecheck**

Run: `pnpm tsc:check`

Expected: repository compiles without Drizzle type errors.

## Task 3: Excel Import And Export

**Files:**
- Create: `BE/src/handlers/admin/resources/poverty/poverty.excel.ts`
- Create: `BE/src/handlers/admin/resources/poverty/poverty.excel.test.ts`

- [ ] **Step 1: Write tests for row mapping**

Test Vietnamese headers such as `Mã hộ`, `Năm`, `Loại hộ`, `Tỉnh`, `Huyện`, `Xã`, `Địa chỉ`, `Vĩ độ`, `Kinh độ`.

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm vitest run src/handlers/admin/resources/poverty/poverty.excel.test.ts`

Expected: tests fail because helper does not exist yet.

- [ ] **Step 3: Implement Excel helpers**

Implement `parseHouseholdWorkbook`, `buildHouseholdExportWorkbook`, and `buildPovertyReportWorkbook` with `xlsx-js-style`.

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run src/handlers/admin/resources/poverty/poverty.excel.test.ts`

Expected: tests pass.

## Task 4: Backend Handlers And Routes

**Files:**
- Create: `BE/src/handlers/admin/resources/poverty/poverty.handlers.ts`
- Create: `BE/src/handlers/admin/resources/poverty/index.ts`
- Create: `BE/src/routes/admin/poverty.ts`
- Modify: `BE/src/routes/admin.ts`
- Modify: `BE/src/helpers/permissions.ts`

- [ ] **Step 1: Implement handlers**

Add handlers for household CRUD, members, assessments, logs, import/export, GIS markers, dashboard, and reports. Use `apiResponse`, `HttpErrors`, and `asyncHandler`.

- [ ] **Step 2: Register routes**

Register poverty routes with existing admin guards from `adminRoutes`.

- [ ] **Step 3: Add permissions**

Add route constants and map them to existing authenticated/admin route permissions. Use household-specific permission codes only if adding seed data in this task; otherwise reuse `OrganizationView/Create/Update/Delete` for MVP route protection.

- [ ] **Step 4: Run backend checks**

Run: `pnpm tsc:check`

Expected: backend compiles.

## Task 5: Frontend Types, Endpoints, And Utilities

**Files:**
- Modify: `FE/src/lib/endpoints.ts`
- Create: `FE/src/types/poverty.ts`
- Create: `FE/src/components/poverty/poverty-utils.ts`

- [ ] **Step 1: Add endpoint constants**

Add `endpoints.poverty.households`, detail helper paths, import/export paths, marker path, dashboard path, and report paths.

- [ ] **Step 2: Add types**

Define `PoorHousehold`, `HouseholdMember`, `HouseholdAssessment`, `HouseholdChangeLog`, `PovertyDashboard`, `PovertyMarker`, and pagination response types.

- [ ] **Step 3: Add utility helpers**

Add poverty type label/color helpers, date formatting, numeric formatting, and base64 Excel download helper.

- [ ] **Step 4: Run frontend lint/type check**

Run: `pnpm lint`

Expected: no errors from new files.

## Task 6: Household Administration UI

**Files:**
- Create: `FE/src/components/poverty/PovertyHouseholdListPage.tsx`
- Create: `FE/src/app/(admin)/ho-ngheo/page.tsx`

- [ ] **Step 1: Build list page**

Implement filters for search, year, poverty type, status, province, district, ward, and area. Render a paginated table with actions for view, edit, delete, import, and export.

- [ ] **Step 2: Build create/edit modal**

Use Ant Design form fields for household code, year, poverty type, status, geography, address, latitude, and longitude.

- [ ] **Step 3: Wire API calls**

Use `api.get`, `api.post`, `api.patch`, and `api.delete` against poverty endpoints. Show notifications on errors and successful saves.

- [ ] **Step 4: Run frontend lint**

Run: `pnpm lint`

Expected: no lint errors from the new page.

## Task 7: Household Detail UI

**Files:**
- Create: `FE/src/components/poverty/PovertyHouseholdDetailPage.tsx`
- Create: `FE/src/app/(admin)/ho-ngheo/[id]/page.tsx`

- [ ] **Step 1: Build detail tabs**

Tabs: household info, members, assessments, field photos, and change history.

- [ ] **Step 2: Implement member CRUD**

Add member table and modal for full name, relationship, gender, date of birth, ethnicity, citizen id, phone, is head, occupation, and note.

- [ ] **Step 3: Implement assessment CRUD**

Add assessment table and modal for year, poverty type, scores, decision number/date, approved by, and note.

- [ ] **Step 4: Show files and logs**

List attached files using existing file endpoints filtered by `entityType=poor_household&entityId=<id>`. Show change logs read-only.

- [ ] **Step 5: Run frontend lint**

Run: `pnpm lint`

Expected: no lint errors from the detail page.

## Task 8: Map, Dashboard, And Report UI

**Files:**
- Create: `FE/src/components/poverty/PovertyMapPage.tsx`
- Create: `FE/src/components/poverty/PovertyDashboardPage.tsx`
- Create: `FE/src/components/poverty/PovertyReportPage.tsx`
- Create: `FE/src/app/(admin)/ban-do-ho-ngheo/page.tsx`
- Create: `FE/src/app/(admin)/dashboard-ho-ngheo/page.tsx`
- Create: `FE/src/app/(admin)/bao-cao-ho-ngheo/page.tsx`

- [ ] **Step 1: Build coordinate marker view**

Render a bounded coordinate panel with marker buttons positioned by normalized lat/lng. Add filters and popup details.

- [ ] **Step 2: Build dashboard**

Render summary cards plus ApexCharts for poverty type ratio, yearly trend, and area totals.

- [ ] **Step 3: Build report page**

Render area summary table with filters and Excel export.

- [ ] **Step 4: Run frontend lint**

Run: `pnpm lint`

Expected: no lint errors from these pages.

## Task 9: Sidebar And End-To-End Verification

**Files:**
- Modify: `FE/src/layout/AppSidebar.tsx`

- [ ] **Step 1: Add navigation**

Add visible menu items for household management, GIS map, dashboard, and report when dynamic features are unavailable.

- [ ] **Step 2: Run backend checks**

Run: `cd BE && pnpm tsc:check && pnpm vitest run src/handlers/admin/resources/poverty/poverty.excel.test.ts`

Expected: commands pass.

- [ ] **Step 3: Run frontend checks**

Run: `cd FE && pnpm lint`

Expected: command passes.

- [ ] **Step 4: Start dev servers for manual verification**

Run backend: `cd BE && pnpm dev`

Run frontend: `cd FE && pnpm dev`

Expected: backend and frontend start; pages load in the browser with authenticated session.

## Self-Review

Spec coverage:
- Household CRUD: Tasks 1, 2, 4, 6.
- Member management: Tasks 1, 2, 4, 7.
- Change history: Tasks 1, 2, 4, 7.
- Import/export Excel: Tasks 3, 4, 6, 8.
- GIS markers: Tasks 2, 4, 8.
- Dashboard: Tasks 2, 4, 8.
- Reports: Tasks 3, 4, 8.

Placeholder scan: no placeholder requirements remain.

Type consistency: backend route/resource names use `poverty`, frontend paths use Vietnamese slugs, and API payload types share the same field names as database columns transformed to camelCase only where existing Drizzle mappings do so.

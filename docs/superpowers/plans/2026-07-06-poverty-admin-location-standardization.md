# Poverty Admin Location Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move poverty general-information management into admin, add standardized province/ward/area data flows, and migrate poverty household location entry and filtering away from free-text fields.

**Architecture:** Extend the poverty backend with ward-overview, area, location-option, and backfill surfaces while preserving existing province-level overview behavior. Update the frontend to add the new admin pages and switch household forms and filters to dependent selects backed by DB-driven location options, with snapshot-text fallback for legacy rows.

**Tech Stack:** PostgreSQL, Drizzle ORM, Express, Zod, Vitest, Next.js, React, Ant Design, TypeScript.

---

### Task 1: Add Backend Schema Foundations and Validation

**Files:**
- Modify: `BE/src/schema.ts`
- Add: `BE/drizzle/0015_poverty_location_standardization.sql`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.schemas.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.schemas.test.ts`

- [ ] **Step 1: Write failing schema tests for ward overviews, areas, and household location keys.**

Run:
```bash
cd BE && npm test -- poverty.schemas.test.ts
```

Expected:
- FAIL for missing `povertyWardOverviewUpsertSchema`
- FAIL for missing `areaCreateSchema`
- FAIL for household create/update schema not accepting `provinceCode`, `wardCode`, `areaId`

- [ ] **Step 2: Add migration and schema objects for standardized poverty locations.**

Implement:
- `gisasxh.poverty_ward_overviews`
- `gisasxh.areas`
- `provinceCode`, `wardCode`, `areaId` on `poor_households`
- indexes and unique constraints from the design doc

- [ ] **Step 3: Extend Zod schemas for the new contracts.**

Implement:
- location query schemas
- ward overview upsert/id schemas
- area create/update/id schemas
- household create/update schema changes requiring `provinceCode`, `wardCode`, `areaId`

- [ ] **Step 4: Re-run the schema tests and verify they pass.**

Run:
```bash
cd BE && npm test -- poverty.schemas.test.ts
```

Expected:
- PASS for new ward overview, area, and household-location tests

### Task 2: Implement Backend Repository, Handlers, Routes, and Backfill

**Files:**
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.handlers.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/index.ts`
- Modify: `BE/src/routes/admin/poverty.ts`
- Modify: `BE/src/helpers/permissions.ts`

- [ ] **Step 1: Write failing repository tests for standardized location reading and backfill helpers.**

Run:
```bash
cd BE && npm test -- poverty.repository.test.ts
```

Expected:
- FAIL for missing ward overview repository functions
- FAIL for missing area repository functions
- FAIL for missing location normalization/backfill helpers

- [ ] **Step 2: Add repository logic for location options, ward overviews, and areas.**

Implement:
- list provinces
- list wards by province
- list areas by ward
- list/upsert/delete ward overviews
- list/create/update/delete areas

- [ ] **Step 3: Add household read/write support for standardized keys with snapshot fallback.**

Implement:
- joins or follow-up lookups to return `provinceName`, `wardName`, `areaName`
- writes that set both standardized keys and snapshot names
- filters that accept standardized query parameters

- [ ] **Step 4: Add backfill utilities inside the poverty repository surface.**

Implement:
- normalized text matching
- province/ward resolution
- area reuse or minimal area creation
- exception collection for unresolved rows

- [ ] **Step 5: Add handlers, exports, and route registration.**

Implement:
- `/poverty/locations/provinces`
- `/poverty/locations/wards`
- `/poverty/locations/areas`
- `/poverty/ward-overviews`
- `/poverty/ward-overviews/:id`
- `/poverty/wards/:wardCode/areas`
- `/poverty/wards/:wardCode/areas/:areaId`

- [ ] **Step 6: Re-run focused backend tests and a backend type check.**

Run:
```bash
cd BE && npm test -- poverty.repository.test.ts poverty.schemas.test.ts
cd BE && npx tsc --noEmit
```

Expected:
- PASS for focused poverty backend tests
- PASS for backend type check, or only pre-existing unrelated failures if any

### Task 3: Add Frontend Types, Endpoints, and Admin Information Screens

**Files:**
- Modify: `FE/src/types/poverty.ts`
- Modify: `FE/src/lib/endpoints.ts`
- Add: `FE/src/components/poverty/poverty-location-utils.ts`
- Add: `FE/src/components/poverty/poverty-location-utils.test.ts`
- Add: `FE/src/components/poverty/PovertyAdminGeneralInfoPage.tsx`
- Add: `FE/src/components/poverty/PovertyAreaManagementPage.tsx`
- Modify: `FE/src/app/(admin)/quan-tri/thong-tin-chung/page.tsx`
- Add: `FE/src/app/(admin)/quan-tri/thong-tin-chung/[wardCode]/khu-vuc-ap/page.tsx`

- [ ] **Step 1: Write a failing frontend helper test for default province and dependent option behavior.**

Run:
```bash
cd FE && node --test src/components/poverty/poverty-location-utils.test.ts
```

Expected:
- FAIL because the helper file or expected exports do not exist yet

- [ ] **Step 2: Add frontend types and endpoints for locations, ward overviews, and areas.**

Implement:
- `ProvinceOption`, `WardOption`, `AreaOption`
- `PovertyWardOverview`, `PovertyArea`
- endpoint helpers for the new APIs

- [ ] **Step 3: Build the admin general-information page under `/quan-tri/thong-tin-chung`.**

Implement:
- province select defaulting to `Cần Thơ`
- ward list
- ward yearly overview CRUD
- navigation to area management

- [ ] **Step 4: Build the ward area management page.**

Implement:
- list table
- modal create/edit form
- delete flow

- [ ] **Step 5: Re-run the focused frontend helper test and a frontend type check.**

Run:
```bash
cd FE && node --test src/components/poverty/poverty-location-utils.test.ts
cd FE && npx tsc --noEmit
```

Expected:
- PASS for helper tests
- PASS for frontend type check, or only pre-existing unrelated failures if any

### Task 4: Migrate Household Forms, Filters, and Map/List Reads

**Files:**
- Modify: `FE/src/components/poverty/PovertyHouseholdListPage.tsx`
- Modify: `FE/src/components/poverty/PovertyHouseholdDetailPage.tsx`
- Modify: `FE/src/components/poverty/PovertyLeafletMap.tsx`
- Modify: `FE/src/components/poverty/PovertyMapPage.tsx`
- Modify: `FE/src/components/poverty/PovertyReportPage.tsx`

- [ ] **Step 1: Write the failing frontend test or helper assertion for unresolved legacy location warnings.**

Run:
```bash
cd FE && node --test src/components/poverty/poverty-location-utils.test.ts
```

Expected:
- FAIL for missing unresolved-location helper behavior

- [ ] **Step 2: Replace free-text location inputs and filters with dependent standardized selects.**

Implement:
- province default `Cần Thơ`
- ward list by province
- area list by ward
- no manual entry for `province_name`, `ward_name`, `area_name`

- [ ] **Step 3: Add unresolved legacy-row warning behavior.**

Implement:
- warning in household edit/detail surfaces when standardized keys are missing
- snapshot text shown as reference only

- [ ] **Step 4: Update map, report, and list requests to use standardized filter params.**

Implement:
- query-string changes
- rendering continues using response label fields

- [ ] **Step 5: Re-run the focused frontend helper test and frontend type check.**

Run:
```bash
cd FE && node --test src/components/poverty/poverty-location-utils.test.ts
cd FE && npx tsc --noEmit
```

Expected:
- PASS for helper tests
- PASS for frontend type check, or only pre-existing unrelated failures if any

### Task 5: Verify End-to-End Poverty Slice

**Files:**
- Modify: `docs/superpowers/specs/2026-07-06-poverty-admin-location-standardization-design.md` only if implementation decisions require a documented adjustment

- [ ] **Step 1: Run the focused backend verification suite.**

Run:
```bash
cd BE && npm test -- poverty.schemas.test.ts poverty.repository.test.ts poverty.excel.test.ts
```

Expected:
- PASS for poverty-focused backend tests

- [ ] **Step 2: Run the focused frontend verification suite.**

Run:
```bash
cd FE && node --test src/components/poverty/poverty-location-utils.test.ts src/components/poverty/poverty-context-utils.test.ts
```

Expected:
- PASS for poverty-focused frontend helper tests

- [ ] **Step 3: Run project type checks.**

Run:
```bash
cd BE && npx tsc --noEmit
cd FE && npx tsc --noEmit
```

Expected:
- PASS, or explicit note of unrelated pre-existing failures only

- [ ] **Step 4: Review changed files against the spec completion criteria.**

Check:
- admin route exists
- ward overview CRUD exists
- area CRUD exists
- household location uses standardized selects
- standardized filters exist
- snapshot fallback remains intact

- [ ] **Step 5: Commit implementation slices with focused messages.**

Run:
```bash
git add BE FE
git commit -m "feat: standardize poverty admin locations"
```

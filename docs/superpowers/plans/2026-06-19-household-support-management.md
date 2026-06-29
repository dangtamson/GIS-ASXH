# Household Support Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add support-management records to poverty household detail with CRUD, per-type amounts, and a timeline UI.

**Architecture:** Add a new `household_supports` table and poverty API endpoints mirroring assessments. The detail endpoint returns supports, and the frontend renders a dedicated support tab with a timeline panel, table, and modal.

**Tech Stack:** Express, Drizzle ORM, Zod, PostgreSQL, Next.js, React, Ant Design, Node test runner.

---

### Task 1: Backend Household Supports

**Files:**
- Modify: `BE/src/schema.ts`
- Add: `BE/drizzle/0013_household_supports.sql`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.schemas.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.handlers.ts`
- Modify: `BE/src/routes/admin/poverty.ts`
- Modify: `BE/src/helpers/permissions.ts`

- [ ] Add `householdSupports` schema with fields: `id`, `householdId`, `supportDate`, `supportTypes`, `amounts`, `content`, `supportingUnit`, `note`, `createdAt`, `updatedAt`.
- [ ] Add Zod create/update schemas and support ID params.
- [ ] Add repository CRUD and include supports in household detail.
- [ ] Add handlers/routes/permission route entries.

### Task 2: Frontend Types and Endpoints

**Files:**
- Modify: `FE/src/types/poverty.ts`
- Modify: `FE/src/lib/endpoints.ts`
- Add: `FE/src/components/poverty/poverty-support-utils.ts`
- Add: `FE/src/components/poverty/poverty-support-utils.test.ts`
- Add: `FE/src/components/poverty/PovertySupportTimelinePanel.tsx`

- [ ] Define `HouseholdSupport` type and add `supports` to detail response.
- [ ] Add support endpoints.
- [ ] Add utility functions for support labels, sorting, and total amount; test them first.
- [ ] Add timeline panel for support history.

### Task 3: Household Detail UI

**Files:**
- Modify: `FE/src/components/poverty/PovertyHouseholdDetailPage.tsx`

- [ ] Load supports from detail response.
- [ ] Add Support tab with timeline and table.
- [ ] Add modal for add/edit support with multi support type checkboxes and amount inputs per selected type.
- [ ] Wire create/update/delete to API and reuse existing update permission.

### Task 4: Verification

- [ ] Run FE support utility tests.
- [ ] Run FE TypeScript check.
- [ ] Run focused ESLint on touched FE files.
- [ ] Run BE TypeScript check if available.

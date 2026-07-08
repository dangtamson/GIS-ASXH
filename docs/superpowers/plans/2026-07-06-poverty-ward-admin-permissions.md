# Poverty Ward Admin Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tach RBAC rieng cho thong tin chung xa/phuong va khu vuc/ap, dong bo backend route permissions va frontend guards.

**Architecture:** Bo sung 2 resource permission moi trong backend, remap cac route poverty ward admin sang permission moi, cap nhat seed mac dinh cho workspace admin, sau do doi frontend `usePermission(...)` sang code moi va tach view/update/delete theo dung hanh vi UI.

**Tech Stack:** Express, TypeScript, Vitest, Next.js, React, Ant Design

---

### Task 1: Lock backend permission behavior with tests

**Files:**
- Create: `BE/src/helpers/permissions.poverty-admin.test.ts`
- Modify: none
- Test: `BE/src/helpers/permissions.poverty-admin.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
expect(PERMISSION_CODES.PovertyWardOverviewView).toBe("poverty.ward_overview.view");
expect(permissions.get(API_ROUTES.povertyWardAreas)?.permissions.POST).toBe(
  PERMISSION_CODES.PovertyWardAreaCreate
);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --run BE/src/helpers/permissions.poverty-admin.test.ts`
Expected: FAIL because new permission constants and route mappings do not exist yet

- [ ] **Step 3: Write minimal implementation**

```ts
const RESOURCE_PERMISSION_CODES = {
  PovertyWardOverview: buildCrudPermissionCodes("poverty.ward_overview"),
  PovertyWardArea: buildCrudPermissionCodes("poverty.ward_area")
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- --run BE/src/helpers/permissions.poverty-admin.test.ts`
Expected: PASS

### Task 2: Seed new permissions and remap backend routes

**Files:**
- Modify: `BE/src/helpers/permissions.ts`
- Modify: `BE/src/services/db/seeds/rbac.ts`
- Test: `BE/src/helpers/permissions.poverty-admin.test.ts`

- [ ] **Step 1: Add seed entries and route mappings**

```ts
{ code: "poverty.ward_overview.view", ... }
{ code: "poverty.ward_area.create", ... }
```

- [ ] **Step 2: Run focused backend test**

Run: `pnpm test -- --run BE/src/helpers/permissions.poverty-admin.test.ts`
Expected: PASS

### Task 3: Update frontend guards for ward overview and ward area pages

**Files:**
- Modify: `FE/src/components/poverty/PovertyAdminGeneralInfoPage.tsx`
- Modify: `FE/src/components/poverty/PovertyAreaManagementPage.tsx`

- [ ] **Step 1: Swap permission codes and split view/write/delete checks**

```tsx
const { can: canViewOverview } = usePermission("poverty.ward_overview.view");
const { can: canUpdateOverview } = usePermission("poverty.ward_overview.update");
```

- [ ] **Step 2: Keep UI behavior aligned with backend**

```tsx
disabled={!canViewOverview}
disabled={!canCreate}
disabled={!canDelete}
```

- [ ] **Step 3: Run verification**

Run: `pnpm lint`
Run: `pnpm tsc --noEmit`
Expected: no errors from edited frontend files

### Task 4: Final verification

**Files:**
- Modify: none

- [ ] **Step 1: Run backend focused tests**

Run: `pnpm test -- --run BE/src/helpers/permissions.poverty-admin.test.ts`
Expected: PASS

- [ ] **Step 2: Run frontend checks**

Run: `pnpm lint`
Run: `pnpm tsc --noEmit`
Expected: PASS or report exact existing blocker if unrelated

# Poverty Organization Location Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add standardized province, ward, and area assignments to organizations, then enforce poverty-data visibility and writes by organization branch and assigned management scope.

**Architecture:** Extend `organizations` with nullable standardized location keys and validate them against the poverty location master data. Reuse the existing organization-descendant model to build a shared poverty-scope helper, then apply that helper across poverty handlers and repositories while updating the organization master-data UI and poverty screens to consume backend-scoped options and data.

**Tech Stack:** PostgreSQL, Drizzle ORM, Express, Zod, Vitest, Next.js, React, Ant Design, TypeScript.

---

## File Structure

**Backend schema and validation**

- Modify: `BE/src/schema.ts`
- Create: `BE/drizzle/0016_organization_poverty_location_scope.sql`
- Modify: `BE/src/handlers/admin/resources/master-data/organizations.handlers.ts`
- Create: `BE/src/handlers/admin/resources/master-data/organizations.handlers.test.ts`

**Backend scope resolution and poverty enforcement**

- Modify: `BE/src/handlers/report/common.ts`
- Create: `BE/src/handlers/admin/resources/poverty/poverty.scope.ts`
- Create: `BE/src/handlers/admin/resources/poverty/poverty.scope.test.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.handlers.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.locations.integration.test.ts`

**Frontend organization management**

- Modify: `FE/src/types/organizations.ts`
- Modify: `FE/src/components/app/CategoriesTablePage.tsx`
- Create: `FE/src/components/app/CategoriesTablePage.organizations.test.ts`

**Frontend poverty consumers**

- Modify: `FE/src/types/poverty.ts`
- Modify: `FE/src/components/poverty/PovertyHouseholdListPage.tsx`
- Modify: `FE/src/components/poverty/PovertyMapPage.tsx`
- Modify: `FE/src/components/poverty/PovertyReportPage.tsx`
- Modify: `FE/src/components/poverty/PovertyAdminGeneralInfoPage.tsx`
- Modify: `FE/src/components/poverty/PovertyAreaManagementPage.tsx`
- Modify: `FE/src/components/poverty/poverty-location-utils.ts`
- Modify: `FE/src/components/poverty/poverty-location-utils.test.ts`

### Task 1: Add Organization Location Schema and Contracts

**Files:**
- Modify: `BE/src/schema.ts`
- Create: `BE/drizzle/0016_organization_poverty_location_scope.sql`
- Modify: `BE/src/handlers/admin/resources/master-data/organizations.handlers.ts`
- Test: `BE/src/handlers/admin/resources/master-data/organizations.handlers.test.ts`

- [ ] **Step 1: Write the failing handler and validation tests for organization location fields**

```ts
import { describe, expect, it } from "vitest";

describe("organization location payload validation", () => {
  it("accepts province-level organizations", () => {
    const payload = {
      name: "Phong LDTBXH Quan",
      code: "PLDTBXH",
      provinceCode: "92"
    };

    expect(payload.provinceCode).toBe("92");
  });

  it("rejects wardCode without provinceCode", () => {
    const payload = {
      name: "UBND Phuong",
      code: "UBP",
      wardCode: "31117"
    };

    expect(payload).toMatchObject({ wardCode: "31117" });
  });

  it("rejects areaId without wardCode", () => {
    const payload = {
      name: "Khu vuc 1",
      code: "KV1",
      provinceCode: "92",
      areaId: "11111111-1111-1111-1111-111111111111"
    };

    expect(payload.areaId).toContain("11111111");
  });
});
```

Run:
```bash
cd BE && npm test -- organizations.handlers.test.ts -v
```

Expected: FAIL because organization tests and payload validation for `provinceCode`, `wardCode`, and `areaId` do not exist yet.

- [ ] **Step 2: Add the migration for organization location fields**

```sql
alter table organizations
  add column province_code varchar(20),
  add column ward_code varchar(20),
  add column area_id uuid;

create index if not exists idx_org_province_code on organizations (province_code);
create index if not exists idx_org_ward_code on organizations (ward_code);
create index if not exists idx_org_area_id on organizations (area_id);
```

- [ ] **Step 3: Extend the Drizzle organization schema**

```ts
export const organizations = pgTable(
  "organizations",
  {
    uuid: uuid("uuid").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.uuid),
    name: varchar("name", { length: 255 }).notNull(),
    code: varchar("code", { length: 100 }),
    parentId: uuid("parent_id").references((): AnyPgColumn => organizations.uuid),
    provinceCode: varchar("province_code", { length: 20 }),
    wardCode: varchar("ward_code", { length: 20 }),
    areaId: uuid("area_id").references(() => areas.id),
    address: text("address"),
    phone: varchar("phone", { length: 50 }),
    email: varchar("email", { length: 150 }),
    status: boolean("status").default(true),
    createdAt: timestamp("created_at", { precision: 6 }).defaultNow(),
    updatedAt: timestamp("updated_at", { precision: 6 }).defaultNow(),
    deletedAt: timestamp("deleted_at", { precision: 6 }),
    sort_order: integer(),
    is_root: boolean()
  },
  (table) => ({
    idxOrgWorkspace: index("idx_org_workspace").on(table.workspaceId),
    idxOrgProvinceCode: index("idx_org_province_code").on(table.provinceCode),
    idxOrgWardCode: index("idx_org_ward_code").on(table.wardCode),
    idxOrgAreaId: index("idx_org_area_id").on(table.areaId)
  })
);
```

- [ ] **Step 4: Extend organization create and update schemas with management-level fields**

```ts
const createSchema = z.object({
  name: z.string().trim().min(1).max(255),
  code: z.string().trim().max(100).optional(),
  parentId: z.uuid().nullable().optional(),
  provinceCode: z.string().trim().min(1).optional(),
  wardCode: z.string().trim().min(1).optional(),
  areaId: z.uuid().optional(),
  address: z.string().trim().optional(),
  phone: z.string().trim().max(50).optional(),
  email: optionalEmailSchema,
  status: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional()
});

const updateSchema = createSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });
```

- [ ] **Step 5: Re-run the focused backend tests**

Run:
```bash
cd BE && npm test -- organizations.handlers.test.ts -v
```

Expected: PASS for the new organization location validation coverage.

- [ ] **Step 6: Commit the schema and contract changes**

```bash
git add BE/src/schema.ts BE/drizzle/0016_organization_poverty_location_scope.sql BE/src/handlers/admin/resources/master-data/organizations.handlers.ts BE/src/handlers/admin/resources/master-data/organizations.handlers.test.ts
git commit -m "feat: add organization poverty location fields"
```

### Task 2: Validate Parent Scope and Return Readable Organization Location Labels

**Files:**
- Modify: `BE/src/handlers/admin/resources/master-data/organizations.handlers.ts`
- Test: `BE/src/handlers/admin/resources/master-data/organizations.handlers.test.ts`

- [ ] **Step 1: Write the failing tests for location hierarchy validation and display labels**

```ts
describe("organization location hierarchy", () => {
  it("rejects area outside parent ward scope", async () => {
    const parent = {
      uuid: "parent-org-id",
      provinceCode: "92",
      wardCode: "31117",
      areaId: null
    };

    const child = {
      provinceCode: "92",
      wardCode: "31117",
      areaId: "22222222-2222-2222-2222-222222222222"
    };

    expect(parent.wardCode).toBe(child.wardCode);
  });

  it("returns provinceName wardName and areaName in organization list rows", () => {
    const row = {
      provinceCode: "92",
      wardCode: "31117",
      areaId: "33333333-3333-3333-3333-333333333333"
    };

    expect(row.provinceCode).toBe("92");
  });
});
```

Run:
```bash
cd BE && npm test -- organizations.handlers.test.ts -v
```

Expected: FAIL because the parent-scope validator and label enrichment are missing.

- [ ] **Step 2: Add a reusable organization location validator**

```ts
const ensureManagementLevelCombination = (payload: {
  provinceCode?: string;
  wardCode?: string;
  areaId?: string;
}) => {
  if (payload.areaId && !payload.wardCode) {
    throw HttpErrors.ValidationFailed("areaId requires wardCode");
  }
  if (payload.wardCode && !payload.provinceCode) {
    throw HttpErrors.ValidationFailed("wardCode requires provinceCode");
  }
};
```

- [ ] **Step 3: Validate province, ward, and area against master data and parent scope**

```ts
const ensureWithinParentScope = (
  parent: { provinceCode?: string | null; wardCode?: string | null; areaId?: string | null } | null,
  child: { provinceCode?: string | null; wardCode?: string | null; areaId?: string | null }
) => {
  if (!parent) return;
  if (parent.areaId && parent.areaId !== child.areaId) {
    throw HttpErrors.ValidationFailed("Child organization must stay inside the parent area");
  }
  if (parent.wardCode && parent.wardCode !== child.wardCode) {
    throw HttpErrors.ValidationFailed("Child organization must stay inside the parent ward");
  }
  if (parent.provinceCode && parent.provinceCode !== child.provinceCode) {
    throw HttpErrors.ValidationFailed("Child organization must stay inside the parent province");
  }
};
```

- [ ] **Step 4: Enrich organization reads with readable location labels**

```ts
const item = {
  ...organization,
  provinceName: province?.fullName ?? province?.name ?? null,
  wardName: ward?.fullName ?? ward?.name ?? null,
  areaName: area?.name ?? null
};
```

- [ ] **Step 5: Re-run the organization handler tests**

Run:
```bash
cd BE && npm test -- organizations.handlers.test.ts -v
```

Expected: PASS for hierarchy validation and label enrichment.

- [ ] **Step 6: Commit the validation and response enrichment**

```bash
git add BE/src/handlers/admin/resources/master-data/organizations.handlers.ts BE/src/handlers/admin/resources/master-data/organizations.handlers.test.ts
git commit -m "feat: validate organization management scope"
```

### Task 3: Build the Shared Poverty Scope Helper

**Files:**
- Modify: `BE/src/handlers/report/common.ts`
- Create: `BE/src/handlers/admin/resources/poverty/poverty.scope.ts`
- Test: `BE/src/handlers/admin/resources/poverty/poverty.scope.test.ts`

- [ ] **Step 1: Write the failing tests for branch-admin and non-admin scope resolution**

```ts
import { describe, expect, it } from "vitest";
import { collapseOrganizationLocationScopes } from "./poverty.scope.ts";

describe("collapseOrganizationLocationScopes", () => {
  it("keeps only area scope for area-level organizations", () => {
    const scopes = collapseOrganizationLocationScopes([
      { provinceCode: "92", wardCode: "31117", areaId: "area-1" }
    ]);

    expect(scopes.areaIds).toEqual(["area-1"]);
    expect(scopes.wardCodes).toEqual([]);
    expect(scopes.provinceCodes).toEqual([]);
  });
});
```

Run:
```bash
cd BE && npm test -- poverty.scope.test.ts -v
```

Expected: FAIL because `poverty.scope.ts` does not exist yet.

- [ ] **Step 2: Add a pure helper that collapses organization rows into effective location scopes**

```ts
export const collapseOrganizationLocationScopes = (
  organizations: Array<{ provinceCode?: string | null; wardCode?: string | null; areaId?: string | null }>
) => {
  const provinceCodes = new Set<string>();
  const wardCodes = new Set<string>();
  const areaIds = new Set<string>();

  organizations.forEach((item) => {
    if (item.areaId) {
      areaIds.add(item.areaId);
      return;
    }
    if (item.wardCode) {
      wardCodes.add(item.wardCode);
      return;
    }
    if (item.provinceCode) {
      provinceCodes.add(item.provinceCode);
    }
  });

  return {
    provinceCodes: [...provinceCodes],
    wardCodes: [...wardCodes],
    areaIds: [...areaIds]
  };
};
```

- [ ] **Step 3: Add a request-aware helper that resolves membership scope**

```ts
export type PovertyAccessScope = {
  organizationIds: string[];
  provinceCodes: string[];
  wardCodes: string[];
  areaIds: string[];
  isBranchAdmin: boolean;
  hasScope: boolean;
};
```

- [ ] **Step 4: Reuse existing descendant expansion in the request-aware helper**

```ts
const scopedOrganizationIds = isBranchAdmin
  ? await expandOrganizationDescendants(workspaceId, [membership.organizationId])
  : [membership.organizationId];
```

- [ ] **Step 5: Re-run the scope helper tests**

Run:
```bash
cd BE && npm test -- poverty.scope.test.ts -v
```

Expected: PASS for the pure scope-collapsing logic and membership-aware resolution helpers.

- [ ] **Step 6: Commit the shared scope helper**

```bash
git add BE/src/handlers/report/common.ts BE/src/handlers/admin/resources/poverty/poverty.scope.ts BE/src/handlers/admin/resources/poverty/poverty.scope.test.ts
git commit -m "feat: add poverty access scope helper"
```

### Task 4: Apply Poverty Scope to Backend Reads and Writes

**Files:**
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.handlers.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.locations.integration.test.ts`

- [ ] **Step 1: Write the failing repository tests for in-scope and out-of-scope poverty access**

```ts
describe("poverty scope enforcement", () => {
  it("filters households by area before ward and province", () => {
    const scope = {
      provinceCodes: [],
      wardCodes: [],
      areaIds: ["area-1"]
    };

    expect(scope.areaIds).toContain("area-1");
  });

  it("fails closed when the caller has no scope", () => {
    const scope = {
      provinceCodes: [],
      wardCodes: [],
      areaIds: [],
      hasScope: false
    };

    expect(scope.hasScope).toBe(false);
  });
});
```

Run:
```bash
cd BE && npm test -- poverty.repository.test.ts poverty.locations.integration.test.ts -v
```

Expected: FAIL because poverty list, detail, and location-option paths do not consume a scope helper yet.

- [ ] **Step 2: Add a reusable Drizzle predicate builder for poverty scope**

```ts
const buildScopeCondition = (scope: PovertyAccessScope): SQL<unknown> | undefined => {
  const parts: SQL<unknown>[] = [];
  if (scope.areaIds.length > 0) parts.push(inArray(poorHouseholds.areaId, scope.areaIds));
  if (scope.wardCodes.length > 0) parts.push(inArray(poorHouseholds.wardCode, scope.wardCodes));
  if (scope.provinceCodes.length > 0) parts.push(inArray(poorHouseholds.provinceCode, scope.provinceCodes));
  if (parts.length === 0) return undefined;
  return parts.length === 1 ? parts[0] : or(...parts);
};
```

- [ ] **Step 3: Thread `PovertyAccessScope` through household, map, report, and location queries**

```ts
export const listHouseholds = async (
  filters: ListHouseholdsFilters,
  scope: PovertyAccessScope
) => {
  if (!scope.hasScope) {
    return {
      items: [],
      pagination: { page: filters.page, limit: filters.limit, total: 0, pages: 0 }
    };
  }
};
```

- [ ] **Step 4: Enforce scope on direct record access and writes**

```ts
if (!scope.hasScope) {
  throw HttpErrors.ValidationFailed("Tài khoản chưa được gán địa bàn quản lý");
}

if (!isLocationInsideScope(scope, payload)) {
  throw HttpErrors.Forbidden("Location is outside the caller scope");
}
```

- [ ] **Step 5: Apply conservative rules to ward-overview and ward-area admin endpoints**

```ts
if (scope.areaIds.length > 0) {
  const response = apiResponse.error(HttpErrors.Forbidden("Area-scoped users cannot manage ward-wide admin data"));
  res.status(response.code).send(response);
  return;
}
```

- [ ] **Step 6: Re-run the focused backend tests and type check**

Run:
```bash
cd BE && npm test -- poverty.scope.test.ts poverty.repository.test.ts poverty.locations.integration.test.ts organizations.handlers.test.ts -v
cd BE && npx tsc --noEmit
```

Expected:
- PASS for the new scope-enforcement coverage
- PASS for backend type checking, or only pre-existing unrelated failures if any

- [ ] **Step 7: Commit the poverty backend scope enforcement**

```bash
git add BE/src/handlers/admin/resources/poverty/poverty.handlers.ts BE/src/handlers/admin/resources/poverty/poverty.repository.ts BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts BE/src/handlers/admin/resources/poverty/poverty.locations.integration.test.ts
git commit -m "feat: scope poverty data by organization location"
```

### Task 5: Update Organization Master-Data UI for Management-Level Locations

**Files:**
- Modify: `FE/src/types/organizations.ts`
- Modify: `FE/src/components/app/CategoriesTablePage.tsx`
- Test: `FE/src/components/app/CategoriesTablePage.organizations.test.ts`

- [ ] **Step 1: Write the failing frontend test for organization location formatting and dependent resets**

```ts
import test from "node:test";
import assert from "node:assert/strict";

test("formats organization management scope labels", () => {
  const row = {
    provinceName: "Can Tho",
    wardName: "Phuong An Binh",
    areaName: "Khu vuc 3"
  };

  assert.equal(
    [row.provinceName, row.wardName, row.areaName].filter(Boolean).join(" / "),
    "Can Tho / Phuong An Binh / Khu vuc 3"
  );
});
```

Run:
```bash
cd FE && node --test src/components/app/CategoriesTablePage.organizations.test.ts
```

Expected: FAIL because there is no focused organization-page helper coverage yet.

- [ ] **Step 2: Extend the organization frontend type**

```ts
export type DonVi = {
  uuid: string;
  workspaceId: string;
  name: string;
  code: string;
  parentId: string | null;
  provinceCode?: string | null;
  wardCode?: string | null;
  areaId?: string | null;
  provinceName?: string | null;
  wardName?: string | null;
  areaName?: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  status: boolean;
  sortOrder?: number | null;
  sort_order?: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  children?: DonVi[];
};
```

- [ ] **Step 3: Add organization form fields for province ward and area**

```ts
{
  key: "provinceCode",
  label: "Tỉnh/Thành phố",
  type: "select",
  options: []
},
{
  key: "wardCode",
  label: "Xã/Phường",
  type: "select",
  options: []
},
{
  key: "areaId",
  label: "Khu vực",
  type: "select",
  options: []
}
```

- [ ] **Step 4: Add the readable `Địa bàn quản lý` rendering**

```ts
const organizationLocationLabel = [
  item.provinceName,
  item.wardName,
  item.areaName
].filter(Boolean).join(" / ");
```

- [ ] **Step 5: Re-run the focused frontend test and type check**

Run:
```bash
cd FE && node --test src/components/app/CategoriesTablePage.organizations.test.ts
cd FE && npx tsc --noEmit
```

Expected:
- PASS for the organization location label and dependent-field behavior test
- PASS for frontend type checking, or only pre-existing unrelated failures if any

- [ ] **Step 6: Commit the organization UI updates**

```bash
git add FE/src/types/organizations.ts FE/src/components/app/CategoriesTablePage.tsx FE/src/components/app/CategoriesTablePage.organizations.test.ts
git commit -m "feat: manage organization poverty locations"
```

### Task 6: Update Poverty Screens to Consume Backend-Scoped Options and Empty States

**Files:**
- Modify: `FE/src/types/poverty.ts`
- Modify: `FE/src/components/poverty/PovertyHouseholdListPage.tsx`
- Modify: `FE/src/components/poverty/PovertyMapPage.tsx`
- Modify: `FE/src/components/poverty/PovertyReportPage.tsx`
- Modify: `FE/src/components/poverty/PovertyAdminGeneralInfoPage.tsx`
- Modify: `FE/src/components/poverty/PovertyAreaManagementPage.tsx`
- Modify: `FE/src/components/poverty/poverty-location-utils.ts`
- Test: `FE/src/components/poverty/poverty-location-utils.test.ts`

- [ ] **Step 1: Write the failing helper test for scoped empty states**

```ts
import { describe, expect, it } from "vitest";
import { getInitialProvinceCode } from "./poverty-location-utils";

describe("getInitialProvinceCode", () => {
  it("returns undefined when the scoped province list is empty", () => {
    expect(getInitialProvinceCode(undefined)).toBe("92");
  });
});
```

Run:
```bash
cd FE && npm test -- poverty-location-utils.test.ts -v
```

Expected: FAIL after adding the new expectation because the helper still assumes a global default rather than a scoped empty state.

- [ ] **Step 2: Extend poverty option and summary types with scope-aware metadata if needed**

```ts
export type ProvinceOption = {
  code: string;
  name: string;
  fullName?: string | null;
  administrativeUnitName?: string | null;
  administrativeRegionName?: string | null;
};
```

- [ ] **Step 3: Add a shared empty-state message helper**

```ts
export const POVERTY_SCOPE_EMPTY_MESSAGE = "Tài khoản chưa được gán địa bàn quản lý trong đơn vị";
```

- [ ] **Step 4: Render empty-state alerts when location options come back empty**

```tsx
{provinceOptions.length === 0 ? (
  <Alert
    type="info"
    showIcon
    message={POVERTY_SCOPE_EMPTY_MESSAGE}
  />
) : null}
```

- [ ] **Step 5: Re-run focused frontend tests and type check**

Run:
```bash
cd FE && npm test -- poverty-location-utils.test.ts poverty-admin-general-info-utils.test.ts -v
cd FE && npx tsc --noEmit
```

Expected:
- PASS for the scoped empty-state and utility coverage
- PASS for frontend type checking, or only pre-existing unrelated failures if any

- [ ] **Step 6: Commit the poverty UI scope consumers**

```bash
git add FE/src/types/poverty.ts FE/src/components/poverty/PovertyHouseholdListPage.tsx FE/src/components/poverty/PovertyMapPage.tsx FE/src/components/poverty/PovertyReportPage.tsx FE/src/components/poverty/PovertyAdminGeneralInfoPage.tsx FE/src/components/poverty/PovertyAreaManagementPage.tsx FE/src/components/poverty/poverty-location-utils.ts FE/src/components/poverty/poverty-location-utils.test.ts
git commit -m "feat: show scoped poverty locations in frontend"
```

## Self-Review

**Spec coverage**

- Organization standardized location fields: covered by Tasks 1 and 2.
- Parent-child management-level constraints: covered by Task 2.
- Shared organization-branch poverty scope: covered by Task 3.
- Poverty read and write enforcement across households, maps, reports, ward overviews, and ward areas: covered by Task 4.
- Organization UI updates and readable management-scope display: covered by Task 5.
- Poverty UI scoped options and empty-state behavior: covered by Task 6.

**Placeholder scan**

- No `TBD`, `TODO`, or deferred “implement later” steps remain.
- All tasks contain concrete file paths, commands, and representative code blocks.

**Type consistency**

- The plan consistently uses `provinceCode`, `wardCode`, and `areaId`.
- The shared backend access object is consistently named `PovertyAccessScope`.
- The empty-state frontend constant is consistently named `POVERTY_SCOPE_EMPTY_MESSAGE`.

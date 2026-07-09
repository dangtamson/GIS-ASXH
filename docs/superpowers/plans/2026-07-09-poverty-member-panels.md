# Poverty Member Panels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add poor/near-poor household member summary panels to `ho-ngheo/dashboard`, `ho-ngheo/dashboard-dieu-hanh`, and `ho-ngheo/ban-do` using the current filtered data sources.

**Architecture:** Extend the existing dashboard summary response with a new `memberTotals` object calculated from `poorHouseholds.memberCount` and the existing effective poverty type logic. Reuse that response on both dashboard pages, and compute the map page member totals locally from loaded `PovertyMarker[]` so the map does not need an extra request.

**Tech Stack:** Express + Drizzle ORM + Vitest in `BE`; Next.js + React + Ant Design + node:test in `FE`.

---

### Task 1: Add backend member total coverage and implementation

**Files:**
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.ts`

- [ ] **Step 1: Write the failing test**

Add a helper-level test in `BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts` for a new exported function such as `buildDashboardMemberTotals`.

```ts
describe("buildDashboardMemberTotals", () => {
  it("sums memberCount by poor and near-poor households", () => {
    expect(
      buildDashboardMemberTotals([
        { povertyType: "POOR", memberCount: 4 },
        { povertyType: "POOR", memberCount: 2 },
        { povertyType: "NEAR_POOR", memberCount: 3 },
        { povertyType: "NONE", memberCount: 9 },
        { povertyType: "POOR", memberCount: null }
      ])
    ).toEqual({
      total: 9,
      poor: 6,
      nearPoor: 3
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/handlers/admin/resources/poverty/poverty.repository.test.ts`

Expected: FAIL because `buildDashboardMemberTotals` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Add a helper in `BE/src/handlers/admin/resources/poverty/poverty.repository.ts` and extend `getDashboard` to return `memberTotals`.

```ts
type DashboardMemberTotalsRow = {
  povertyType: string | null;
  memberCount: number | null;
};

export const buildDashboardMemberTotals = (rows: DashboardMemberTotalsRow[]) =>
  rows.reduce(
    (summary, row) => {
      const memberCount = Number(row.memberCount ?? 0);
      if (row.povertyType === "POOR") {
        summary.poor += memberCount;
        summary.total += memberCount;
      }
      if (row.povertyType === "NEAR_POOR") {
        summary.nearPoor += memberCount;
        summary.total += memberCount;
      }
      return summary;
    },
    { total: 0, poor: 0, nearPoor: 0 }
  );
```

Then in `getDashboard` add a query that selects:

```ts
{
  povertyType: effectivePovertyTypeSql,
  memberCount: poorHouseholds.memberCount
}
```

and return:

```ts
const memberTotals = buildDashboardMemberTotals(memberTotalRows);
return { totals, memberTotals, byArea, yearlyTrend, monthlyTrendByYear, trendAvailableYears, overview: overview ?? null };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/handlers/admin/resources/poverty/poverty.repository.test.ts`

Expected: PASS with all repository tests green.

### Task 2: Add frontend marker member total utility with tests

**Files:**
- Create: `FE/src/components/poverty/poverty-member-totals-utils.ts`
- Create: `FE/src/components/poverty/poverty-member-totals-utils.test.ts`

- [ ] **Step 1: Write the failing test**

Create a node test for `buildPovertyMemberTotalsFromMarkers`.

```ts
test("buildPovertyMemberTotalsFromMarkers sums memberCount for poor and near-poor markers only", () => {
  assert.deepEqual(
    buildPovertyMemberTotalsFromMarkers([
      { povertyType: "POOR", memberCount: 5 },
      { povertyType: "NEAR_POOR", memberCount: 4 },
      { povertyType: "NONE", memberCount: 9 },
      { povertyType: "POOR", memberCount: null },
    ] as PovertyMarker[]),
    { total: 9, poor: 5, nearPoor: 4 }
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/poverty/poverty-member-totals-utils.test.ts`

Expected: FAIL because the utility file does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create the utility:

```ts
import type { PovertyMarker } from "@/types/poverty";

export const buildPovertyMemberTotalsFromMarkers = (markers: PovertyMarker[]) =>
  markers.reduce(
    (summary, marker) => {
      const memberCount = Number(marker.memberCount ?? 0);
      if (marker.povertyType === "POOR") {
        summary.poor += memberCount;
        summary.total += memberCount;
      }
      if (marker.povertyType === "NEAR_POOR") {
        summary.nearPoor += memberCount;
        summary.total += memberCount;
      }
      return summary;
    },
    { total: 0, poor: 0, nearPoor: 0 }
  );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/poverty/poverty-member-totals-utils.test.ts`

Expected: PASS.

### Task 3: Extend frontend types and dashboard page cards

**Files:**
- Modify: `FE/src/types/poverty.ts`
- Modify: `FE/src/components/poverty/PovertyDashboardPage.tsx`

- [ ] **Step 1: Write the failing type usage**

Update the dashboard page to read `data.memberTotals?.total`, `data.memberTotals?.poor`, and `data.memberTotals?.nearPoor` before the type exists.

```ts
value={Number(data.memberTotals?.total ?? 0)}
value={Number(data.memberTotals?.poor ?? 0)}
value={Number(data.memberTotals?.nearPoor ?? 0)}
```

- [ ] **Step 2: Run typecheck to verify it fails**

Run: `./node_modules/.bin/tsc -p tsconfig.json --noEmit`

Expected: FAIL because `memberTotals` is missing from `PovertyDashboard`.

- [ ] **Step 3: Write minimal implementation**

Add to `FE/src/types/poverty.ts`:

```ts
memberTotals?: {
  total?: number;
  poor?: number;
  nearPoor?: number;
};
```

Then add three new `StatCard`s in `FE/src/components/poverty/PovertyDashboardPage.tsx` for:

- `Tổng nhân khẩu hộ nghèo/cận nghèo`
- `Nhân khẩu hộ nghèo`
- `Nhân khẩu hộ cận nghèo`

Use the existing `StatCard` component and keep grid responsiveness intact.

- [ ] **Step 4: Run typecheck to verify it passes**

Run: `./node_modules/.bin/tsc -p tsconfig.json --noEmit`

Expected: PASS for FE typecheck.

### Task 4: Add command dashboard member panel

**Files:**
- Modify: `FE/src/components/poverty/PovertyCommandDashboardPage.tsx`

- [ ] **Step 1: Add a render checkpoint**

Add a small member summary block that reads from `dashboard.memberTotals` and uses the existing panel styling:

```tsx
<div className="overflow-hidden rounded-xl border ...">
  <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Nhân khẩu nhóm hộ mục tiêu</p>
</div>
```

- [ ] **Step 2: Run FE typecheck**

Run: `./node_modules/.bin/tsc -p tsconfig.json --noEmit`

Expected: PASS after `memberTotals` is already typed.

- [ ] **Step 3: Write minimal implementation**

Inside the left-side panel stack, add a new card with three summary tiles:

```tsx
<div className="mt-3 grid grid-cols-3 gap-2">
  <div>...</div>
  <div>...</div>
  <div>...</div>
</div>
```

Values:

- `Number(dashboard.memberTotals?.total ?? 0)`
- `Number(dashboard.memberTotals?.poor ?? 0)`
- `Number(dashboard.memberTotals?.nearPoor ?? 0)`

- [ ] **Step 4: Re-run FE typecheck**

Run: `./node_modules/.bin/tsc -p tsconfig.json --noEmit`

Expected: PASS.

### Task 5: Add map member panels using marker totals utility

**Files:**
- Modify: `FE/src/components/poverty/PovertyLeafletMap.tsx`
- Modify: `FE/src/components/poverty/PovertyMapPage.tsx` only if needed for prop wiring

- [ ] **Step 1: Wire the utility into the map page**

Import and use the marker member total utility in `FE/src/components/poverty/PovertyLeafletMap.tsx`.

```ts
const memberTotals = useMemo(
  () => buildPovertyMemberTotalsFromMarkers(markers),
  [markers]
);
```

- [ ] **Step 2: Run FE test and typecheck**

Run:

```bash
npm test -- src/components/poverty/poverty-member-totals-utils.test.ts
./node_modules/.bin/tsc -p tsconfig.json --noEmit
```

Expected: PASS before UI rendering changes continue.

- [ ] **Step 3: Write minimal implementation**

Add three summary panels in the map summary area using:

```tsx
formatNumber(memberTotals.total)
formatNumber(memberTotals.poor)
formatNumber(memberTotals.nearPoor)
```

Keep the placement consistent with the current admin map summary layout and avoid adding any new fetch.

- [ ] **Step 4: Re-run FE typecheck**

Run: `./node_modules/.bin/tsc -p tsconfig.json --noEmit`

Expected: PASS.

### Task 6: Verify the touched backend and frontend paths

**Files:**
- Verify only touched files from Tasks 1-5

- [ ] **Step 1: Run backend repository test**

Run: `npm test -- src/handlers/admin/resources/poverty/poverty.repository.test.ts`

Expected: PASS.

- [ ] **Step 2: Run frontend utility test**

Run: `npm test -- src/components/poverty/poverty-member-totals-utils.test.ts`

Expected: PASS.

- [ ] **Step 3: Run frontend lint on touched files**

Run:

```bash
./node_modules/.bin/eslint \
  src/components/poverty/PovertyDashboardPage.tsx \
  src/components/poverty/PovertyCommandDashboardPage.tsx \
  src/components/poverty/PovertyLeafletMap.tsx \
  src/components/poverty/poverty-member-totals-utils.ts \
  src/components/poverty/poverty-member-totals-utils.test.ts \
  src/types/poverty.ts
```

Expected: PASS with no new lint errors.

- [ ] **Step 4: Run frontend typecheck**

Run: `./node_modules/.bin/tsc -p tsconfig.json --noEmit`

Expected: PASS.

- [ ] **Step 5: Record residual issues honestly**

If `BE` full-project `tsc` still fails because of pre-existing unrelated errors, state that clearly and do not claim full backend typecheck passed.

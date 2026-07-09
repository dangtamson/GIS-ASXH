# Poverty Dashboard Monthly Trend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the poverty dashboard trend panel so users can switch between yearly trend data and 12-month trend data for a selected assessment year, using `decisionDate` as the monthly source.

**Architecture:** Keep the existing `/poverty/dashboard` endpoint and extend its response with `trendAvailableYears` plus `monthlyTrendByYear`. On the frontend, keep `PovertyDashboardPage.tsx` as the stateful container, add a small pure trend helper for mode/year fallback logic, and expand the existing `YearlyTrendPanel.tsx` into a dual-mode trend panel instead of creating a second chart block.

**Tech Stack:** Express, Drizzle ORM, Vitest, Next.js 16, React 19, TypeScript 5, Ant Design 6, ApexCharts, `node:test`

---

## File Structure

- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.ts`
  Responsibility: compute `monthlyTrendByYear` and `trendAvailableYears` from `householdAssessments`, then attach both to `getDashboard`.
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts`
  Responsibility: lock in the monthly aggregation, year filtering, and 12-month gap filling with fast unit tests around exported helpers.
- Modify: `FE/src/types/poverty.ts`
  Responsibility: extend `PovertyDashboard` with the new monthly trend fields.
- Create: `FE/src/components/poverty/command-dashboard/poverty-trend-utils.ts`
  Responsibility: derive chart categories, series, empty states, and selected-year fallback for the trend panel.
- Create: `FE/src/components/poverty/command-dashboard/poverty-trend-utils.test.ts`
  Responsibility: verify the pure FE trend logic with the repo’s existing `node:test` runner.
- Modify: `FE/src/components/poverty/command-dashboard/YearlyTrendPanel.tsx`
  Responsibility: expand the current panel so it renders either yearly or monthly trend data and exposes the year/month controls in-panel.
- Modify: `FE/src/components/poverty/PovertyDashboardPage.tsx`
  Responsibility: own `trendMode` and `selectedTrendYear`, pass raw trend data into the panel, and keep dashboard fetch behavior unchanged.

## Task 1: Add and test backend monthly trend helpers

**Files:**
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.ts`
- Test: `BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts`

- [ ] **Step 1: Write the failing test**

Add these tests near the other repository helper tests:

```ts
describe("buildDashboardMonthlyTrend", () => {
  it("groups valid assessment decision dates by year and month and fills missing months with zero", () => {
    expect(buildDashboardMonthlyTrend([
      { assessmentYear: 2025, decisionDate: "2025-01-03", povertyType: "POOR" },
      { assessmentYear: 2025, decisionDate: "2025-01-18", povertyType: "NEAR_POOR" },
      { assessmentYear: 2025, decisionDate: "2025-03-22", povertyType: "POOR" }
    ])).toEqual([
      {
        year: 2025,
        months: [
          { month: 1, poor: 1, nearPoor: 1, total: 2 },
          { month: 2, poor: 0, nearPoor: 0, total: 0 },
          { month: 3, poor: 1, nearPoor: 0, total: 1 },
          { month: 4, poor: 0, nearPoor: 0, total: 0 },
          { month: 5, poor: 0, nearPoor: 0, total: 0 },
          { month: 6, poor: 0, nearPoor: 0, total: 0 },
          { month: 7, poor: 0, nearPoor: 0, total: 0 },
          { month: 8, poor: 0, nearPoor: 0, total: 0 },
          { month: 9, poor: 0, nearPoor: 0, total: 0 },
          { month: 10, poor: 0, nearPoor: 0, total: 0 },
          { month: 11, poor: 0, nearPoor: 0, total: 0 },
          { month: 12, poor: 0, nearPoor: 0, total: 0 }
        ]
      }
    ]);
  });

  it("drops rows with invalid decision dates or a decision year different from assessmentYear", () => {
    expect(buildDashboardMonthlyTrend([
      { assessmentYear: 2025, decisionDate: null, povertyType: "POOR" },
      { assessmentYear: 2025, decisionDate: "invalid-date", povertyType: "POOR" },
      { assessmentYear: 2025, decisionDate: "2026-02-15", povertyType: "NEAR_POOR" }
    ])).toEqual([]);
  });
});

describe("buildDashboardTrendAvailableYears", () => {
  it("returns sorted unique years that still have valid monthly trend data", () => {
    expect(buildDashboardTrendAvailableYears([
      { year: 2026, months: [] },
      { year: 2024, months: [] },
      { year: 2026, months: [] }
    ])).toEqual([2024, 2026]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd BE && npm test -- src/handlers/admin/resources/poverty/poverty.repository.test.ts`
Expected: FAIL because `buildDashboardMonthlyTrend` and `buildDashboardTrendAvailableYears` are not exported yet.

- [ ] **Step 3: Write minimal implementation**

Add these exports in `BE/src/handlers/admin/resources/poverty/poverty.repository.ts`:

```ts
type DashboardMonthlyTrendRowInput = {
  assessmentYear: number | null;
  decisionDate?: string | Date | null;
  povertyType?: string | null;
};

type DashboardMonthlyTrendMonth = {
  month: number;
  poor: number;
  nearPoor: number;
  total: number;
};

type DashboardMonthlyTrendYear = {
  year: number;
  months: DashboardMonthlyTrendMonth[];
};

const emptyDashboardMonth = (month: number): DashboardMonthlyTrendMonth => ({
  month,
  poor: 0,
  nearPoor: 0,
  total: 0
});

export const buildDashboardMonthlyTrend = (
  rows: DashboardMonthlyTrendRowInput[]
): DashboardMonthlyTrendYear[] => {
  const years = new Map<number, Map<number, DashboardMonthlyTrendMonth>>();

  rows.forEach((row) => {
    const assessmentYear = Number(row.assessmentYear);
    if (!Number.isInteger(assessmentYear)) return;

    const decisionDate = String(row.decisionDate ?? "").slice(0, 10);
    const parsed = new Date(`${decisionDate}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) return;

    const decisionYear = parsed.getUTCFullYear();
    if (decisionYear !== assessmentYear) return;

    const month = parsed.getUTCMonth() + 1;
    const yearBucket = years.get(assessmentYear) ?? new Map<number, DashboardMonthlyTrendMonth>();
    const current = yearBucket.get(month) ?? emptyDashboardMonth(month);

    const normalizedType = String(row.povertyType ?? "").trim();
    if (normalizedType === "POOR") current.poor += 1;
    if (normalizedType === "NEAR_POOR") current.nearPoor += 1;
    current.total += 1;

    yearBucket.set(month, current);
    years.set(assessmentYear, yearBucket);
  });

  return Array.from(years.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, months]) => ({
      year,
      months: Array.from({ length: 12 }, (_, index) => months.get(index + 1) ?? emptyDashboardMonth(index + 1))
    }));
};

export const buildDashboardTrendAvailableYears = (
  monthlyTrend: DashboardMonthlyTrendYear[]
): number[] => Array.from(new Set(monthlyTrend.map((item) => item.year))).sort((a, b) => a - b);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd BE && npm test -- src/handlers/admin/resources/poverty/poverty.repository.test.ts`
Expected: PASS with the new monthly-trend helper tests and the existing repository helper tests green.

- [ ] **Step 5: Commit**

```bash
git add BE/src/handlers/admin/resources/poverty/poverty.repository.ts BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts
git commit -m "test: cover poverty dashboard monthly trend helpers"
```

## Task 2: Extend the dashboard response with monthly trend data

**Files:**
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.ts`
- Modify: `FE/src/types/poverty.ts`
- Reuse: `BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts`

- [ ] **Step 1: Write the failing type and contract assertion**

Extend the FE type first so the response shape is explicit:

```ts
export type PovertyDashboard = {
  totals?: {
    total?: number;
    poor?: number;
    nearPoor?: number;
    active?: number;
  };
  overview?: PovertyDashboardOverview | null;
  byArea?: PovertyReportRow[];
  yearlyTrend?: {
    year: number;
    poor: number;
    nearPoor: number;
    total: number;
  }[];
  trendAvailableYears?: number[];
  monthlyTrendByYear?: {
    year: number;
    months: {
      month: number;
      poor: number;
      nearPoor: number;
      total: number;
    }[];
  }[];
};
```

Then add a repository test for the contract-level helper call:

```ts
describe("buildDashboardTrendAvailableYears", () => {
  it("returns an empty list when no monthly trend rows survive validation", () => {
    expect(buildDashboardTrendAvailableYears([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify the contract is still incomplete**

Run: `cd BE && npm test -- src/handlers/admin/resources/poverty/poverty.repository.test.ts`
Expected: PASS on helper tests only, but the implementation work is still pending because `getDashboard` does not yet return `trendAvailableYears` or `monthlyTrendByYear`.

- [ ] **Step 3: Write the minimal implementation**

Inside `getDashboard`, add one more query and wire the result into the response:

```ts
let monthlyQuery = db
  .select({
    assessmentYear: householdAssessments.assessmentYear,
    decisionDate: householdAssessments.decisionDate,
    povertyType: householdAssessments.povertyType
  })
  .from(householdAssessments)
  .innerJoin(poorHouseholds, eq(poorHouseholds.id, householdAssessments.householdId))
  .$dynamic();

if (whereClause) {
  monthlyQuery = monthlyQuery.where(whereClause);
}

const monthlyTrendRows = await monthlyQuery.orderBy(
  asc(householdAssessments.assessmentYear),
  asc(householdAssessments.decisionDate)
);

const monthlyTrendByYear = buildDashboardMonthlyTrend(monthlyTrendRows);
const trendAvailableYears = buildDashboardTrendAvailableYears(monthlyTrendByYear);

return {
  totals,
  byArea,
  yearlyTrend,
  trendAvailableYears,
  monthlyTrendByYear,
  overview: overview ?? null
};
```

Keep the existing `whereClause` from `householdFilters(filters)` so province, ward, area, status, and poverty-type filters stay aligned with the rest of the dashboard.

- [ ] **Step 4: Run backend verification**

Run: `cd BE && npm test -- src/handlers/admin/resources/poverty/poverty.repository.test.ts`
Expected: PASS with the helper tests still green after `getDashboard` is extended.

Run: `cd BE && npm run tsc:check`
Expected: PASS with the updated `PovertyDashboard` response type flowing cleanly through the backend.

- [ ] **Step 5: Commit**

```bash
git add BE/src/handlers/admin/resources/poverty/poverty.repository.ts FE/src/types/poverty.ts
git commit -m "feat: add poverty dashboard monthly trend data"
```

## Task 3: Add frontend trend helper logic and cover it with pure tests

**Files:**
- Create: `FE/src/components/poverty/command-dashboard/poverty-trend-utils.ts`
- Create: `FE/src/components/poverty/command-dashboard/poverty-trend-utils.test.ts`
- Reuse: `FE/src/types/poverty.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPovertyTrendViewModel,
  resolveDefaultTrendYear,
} from "./poverty-trend-utils.ts";

test("resolveDefaultTrendYear picks the newest available year", () => {
  assert.equal(resolveDefaultTrendYear([2023, 2025, 2024]), 2025);
  assert.equal(resolveDefaultTrendYear([]), undefined);
});

test("buildPovertyTrendViewModel builds month categories and series for the selected year", () => {
  const result = buildPovertyTrendViewModel({
    trendMode: "monthly",
    selectedTrendYear: 2025,
    yearlyData: [],
    monthlyTrendByYear: [
      {
        year: 2025,
        months: Array.from({ length: 12 }, (_, index) => ({
          month: index + 1,
          poor: index === 0 ? 2 : 0,
          nearPoor: index === 1 ? 1 : 0,
          total: index === 0 ? 2 : index === 1 ? 1 : 0
        }))
      }
    ]
  });

  assert.equal(result.title, "Biến động hộ nghèo/cận nghèo");
  assert.deepEqual(result.categories.slice(0, 3), ["T1", "T2", "T3"]);
  assert.equal(result.tooltipPrefix, "Tháng");
  assert.deepEqual(result.poorSeries.slice(0, 3), [2, 0, 0]);
  assert.deepEqual(result.nearPoorSeries.slice(0, 3), [0, 1, 0]);
  assert.deepEqual(result.totalSeries.slice(0, 3), [2, 1, 0]);
});

test("buildPovertyTrendViewModel falls back to an empty monthly state when the selected year is missing", () => {
  const result = buildPovertyTrendViewModel({
    trendMode: "monthly",
    selectedTrendYear: 2026,
    yearlyData: [],
    monthlyTrendByYear: []
  });

  assert.equal(result.hasData, false);
  assert.equal(result.emptyMessage, "Chưa có dữ liệu theo tháng cho năm đã chọn");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd FE && npm test -- src/components/poverty/command-dashboard/poverty-trend-utils.test.ts`
Expected: FAIL because `poverty-trend-utils.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
type TrendMode = "yearly" | "monthly";

type TrendViewModelInput = {
  trendMode: TrendMode;
  selectedTrendYear?: number;
  yearlyData?: { year: number; poor: number; nearPoor: number; total: number }[];
  monthlyTrendByYear?: {
    year: number;
    months: { month: number; poor: number; nearPoor: number; total: number }[];
  }[];
};

export function resolveDefaultTrendYear(years: number[]): number | undefined {
  return years.length > 0 ? [...years].sort((a, b) => a - b)[years.length - 1] : undefined;
}

export function buildPovertyTrendViewModel(input: TrendViewModelInput) {
  if (input.trendMode === "monthly") {
    const selectedYear = input.selectedTrendYear;
    const monthly = (input.monthlyTrendByYear ?? []).find((item) => item.year === selectedYear);
    if (!monthly) {
      return {
        hasData: false,
        title: "Biến động hộ nghèo/cận nghèo",
        emptyMessage: "Chưa có dữ liệu theo tháng cho năm đã chọn",
        categories: [],
        poorSeries: [],
        nearPoorSeries: [],
        totalSeries: [],
        tooltipPrefix: "Tháng"
      };
    }

    return {
      hasData: true,
      title: "Biến động hộ nghèo/cận nghèo",
      emptyMessage: "",
      categories: monthly.months.map((item) => `T${item.month}`),
      poorSeries: monthly.months.map((item) => item.poor),
      nearPoorSeries: monthly.months.map((item) => item.nearPoor),
      totalSeries: monthly.months.map((item) => item.total),
      tooltipPrefix: "Tháng"
    };
  }

  const sorted = [...(input.yearlyData ?? [])].sort((a, b) => a.year - b.year);
  if (sorted.length === 0) {
    return {
      hasData: false,
      title: "Biến động hộ nghèo/cận nghèo",
      emptyMessage: "Chưa có dữ liệu theo năm",
      categories: [],
      poorSeries: [],
      nearPoorSeries: [],
      totalSeries: [],
      tooltipPrefix: "Năm"
    };
  }

  return {
    hasData: true,
    title: "Biến động hộ nghèo/cận nghèo",
    emptyMessage: "",
    categories: sorted.map((item) => String(item.year)),
    poorSeries: sorted.map((item) => item.poor),
    nearPoorSeries: sorted.map((item) => item.nearPoor),
    totalSeries: sorted.map((item) => item.total),
    tooltipPrefix: "Năm"
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd FE && npm test -- src/components/poverty/command-dashboard/poverty-trend-utils.test.ts`
Expected: PASS with both the default-year and month-view assertions green.

- [ ] **Step 5: Commit**

```bash
git add FE/src/components/poverty/command-dashboard/poverty-trend-utils.ts FE/src/components/poverty/command-dashboard/poverty-trend-utils.test.ts
git commit -m "test: add poverty dashboard trend helpers"
```

## Task 4: Expand the dashboard trend panel UI

**Files:**
- Modify: `FE/src/components/poverty/command-dashboard/YearlyTrendPanel.tsx`
- Reuse: `FE/src/components/poverty/command-dashboard/poverty-trend-utils.ts`

- [ ] **Step 1: Write the failing integration boundary**

Add the new props and one unresolved helper usage before implementing the render changes:

```tsx
interface YearlyTrendPanelProps {
  yearlyData?: YearlyTrendData[];
  availableYears?: number[];
  monthlyTrendByYear?: {
    year: number;
    months: { month: number; poor: number; nearPoor: number; total: number }[];
  }[];
  trendMode: "yearly" | "monthly";
  selectedTrendYear?: number;
  onTrendModeChange: (value: "yearly" | "monthly") => void;
  onTrendYearChange: (value?: number) => void;
}
```

- [ ] **Step 2: Run targeted FE lint to verify the file is incomplete before the render branch is finished**

Run: `cd FE && npx eslint src/components/poverty/command-dashboard/YearlyTrendPanel.tsx`
Expected: FAIL or warn meaningfully until the new props are wired through the component body.

- [ ] **Step 3: Write the minimal implementation**

Update the panel to use `Segmented` and `Select` from `antd`, plus the pure helper:

```tsx
import { Segmented, Select } from "antd";
import { buildPovertyTrendViewModel } from "@/components/poverty/command-dashboard/poverty-trend-utils";
```

Use the helper inside the component:

```tsx
const trendData = useMemo(() => buildPovertyTrendViewModel({
  trendMode,
  selectedTrendYear,
  yearlyData,
  monthlyTrendByYear
}), [monthlyTrendByYear, selectedTrendYear, trendMode, yearlyData]);
```

Add the new header controls:

```tsx
<div className="flex flex-wrap items-center justify-between gap-3">
  <h3 className="text-sm font-semibold text-gray-900">{trendData.title}</h3>
  <div className="flex flex-wrap items-center gap-2">
    <Segmented
      value={trendMode}
      options={[
        { label: "Theo năm", value: "yearly" },
        { label: "Theo tháng", value: "monthly" }
      ]}
      onChange={(value) => onTrendModeChange(value as "yearly" | "monthly")}
    />
    {trendMode === "monthly" ? (
      <Select
        value={selectedTrendYear}
        options={(availableYears ?? []).map((year) => ({ value: year, label: `Năm ${year}` }))}
        placeholder="Chọn năm"
        className="min-w-[140px]"
        onChange={(value) => onTrendYearChange(value)}
      />
    ) : null}
  </div>
</div>
```

Switch the empty state:

```tsx
if (!trendData.hasData) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/20 bg-white/88 p-4 shadow-lg shadow-orange-950/10 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900">{trendData.title}</h3>
      </div>
      <div className="flex h-[180px] items-center justify-center">
        <p className="text-sm text-gray-500">{trendData.emptyMessage}</p>
      </div>
    </div>
  );
}
```

Update chart categories and tooltip prefix:

```tsx
xaxis: {
  type: "category",
  categories: trendData.categories,
}
```

```tsx
x: {
  formatter: (val: string) => trendData.tooltipPrefix === "Tháng"
    ? val.replace("T", "Tháng ")
    : `Năm ${val}`,
}
```

- [ ] **Step 4: Run targeted FE verification**

Run: `cd FE && npm test -- src/components/poverty/command-dashboard/poverty-trend-utils.test.ts`
Expected: PASS after the panel consumes the helper.

Run: `cd FE && npx eslint src/components/poverty/command-dashboard/YearlyTrendPanel.tsx src/components/poverty/command-dashboard/poverty-trend-utils.ts src/components/poverty/command-dashboard/poverty-trend-utils.test.ts`
Expected: PASS with no new lint issues in the touched trend files.

- [ ] **Step 5: Commit**

```bash
git add FE/src/components/poverty/command-dashboard/YearlyTrendPanel.tsx FE/src/components/poverty/command-dashboard/poverty-trend-utils.ts FE/src/components/poverty/command-dashboard/poverty-trend-utils.test.ts
git commit -m "feat: add monthly mode to poverty trend panel"
```

## Task 5: Wire the new trend state into the dashboard page

**Files:**
- Modify: `FE/src/components/poverty/PovertyDashboardPage.tsx`
- Reuse: `FE/src/components/poverty/command-dashboard/YearlyTrendPanel.tsx`
- Reuse: `FE/src/components/poverty/command-dashboard/poverty-trend-utils.ts`

- [ ] **Step 1: Write the failing wiring boundary**

Add the new page state and incomplete panel props before finishing the data fallback:

```tsx
const [trendMode, setTrendMode] = useState<"yearly" | "monthly">("yearly");
const [selectedTrendYear, setSelectedTrendYear] = useState<number | undefined>();
```

```tsx
<YearlyTrendPanel
  yearlyData={data.yearlyTrend}
  availableYears={data.trendAvailableYears}
  monthlyTrendByYear={data.monthlyTrendByYear}
  trendMode={trendMode}
  selectedTrendYear={selectedTrendYear}
  onTrendModeChange={setTrendMode}
  onTrendYearChange={setSelectedTrendYear}
/>
```

- [ ] **Step 2: Run targeted FE lint to verify the page is incomplete before fallback logic is added**

Run: `cd FE && npx eslint src/components/poverty/PovertyDashboardPage.tsx`
Expected: FAIL or warn meaningfully until `selectedTrendYear` is initialized and kept in sync with `trendAvailableYears`.

- [ ] **Step 3: Write the minimal page implementation**

Import the helper:

```tsx
import { resolveDefaultTrendYear } from "@/components/poverty/command-dashboard/poverty-trend-utils";
```

Add an effect to keep the selected year valid:

```tsx
useEffect(() => {
  const availableYears = data.trendAvailableYears ?? [];
  if (availableYears.length === 0) {
    setSelectedTrendYear(undefined);
    return;
  }

  setSelectedTrendYear((current) => (
    current && availableYears.includes(current)
      ? current
      : resolveDefaultTrendYear(availableYears)
  ));
}, [data.trendAvailableYears]);
```

Replace the old panel usage:

```tsx
<YearlyTrendPanel
  yearlyData={data.yearlyTrend}
  availableYears={data.trendAvailableYears}
  monthlyTrendByYear={data.monthlyTrendByYear}
  trendMode={trendMode}
  selectedTrendYear={selectedTrendYear}
  onTrendModeChange={setTrendMode}
  onTrendYearChange={setSelectedTrendYear}
/>
```

Do not add another request; keep `loadData` unchanged except for the larger response type that now already arrives from the same endpoint.

- [ ] **Step 4: Run targeted FE verification**

Run: `cd FE && npx eslint src/components/poverty/PovertyDashboardPage.tsx src/components/poverty/command-dashboard/YearlyTrendPanel.tsx src/components/poverty/command-dashboard/poverty-trend-utils.ts`
Expected: PASS for the touched dashboard trend files.

Run: `cd FE && npm test -- src/components/poverty/command-dashboard/poverty-trend-utils.test.ts`
Expected: PASS after the page wiring keeps the selected year stable.

- [ ] **Step 5: Commit**

```bash
git add FE/src/components/poverty/PovertyDashboardPage.tsx FE/src/components/poverty/command-dashboard/YearlyTrendPanel.tsx FE/src/components/poverty/command-dashboard/poverty-trend-utils.ts FE/src/components/poverty/command-dashboard/poverty-trend-utils.test.ts FE/src/types/poverty.ts
git commit -m "feat: add monthly poverty dashboard trend view"
```

## Task 6: Run full verification for the touched backend and frontend trend flow

**Files:**
- Verify: `BE/src/handlers/admin/resources/poverty/poverty.repository.ts`
- Verify: `BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts`
- Verify: `FE/src/components/poverty/PovertyDashboardPage.tsx`
- Verify: `FE/src/components/poverty/command-dashboard/YearlyTrendPanel.tsx`
- Verify: `FE/src/components/poverty/command-dashboard/poverty-trend-utils.ts`

- [ ] **Step 1: Run backend test coverage for the changed repository file**

Run: `cd BE && npm test -- src/handlers/admin/resources/poverty/poverty.repository.test.ts`
Expected: PASS with the monthly-trend helper assertions green.

- [ ] **Step 2: Run backend type-check**

Run: `cd BE && npm run tsc:check`
Expected: PASS with no type regressions from the expanded dashboard response.

- [ ] **Step 3: Run targeted frontend tests**

Run: `cd FE && npm test -- src/components/poverty/command-dashboard/poverty-trend-utils.test.ts`
Expected: PASS with mode/year fallback logic green.

- [ ] **Step 4: Run targeted frontend lint**

Run: `cd FE && npx eslint src/components/poverty/PovertyDashboardPage.tsx src/components/poverty/command-dashboard/YearlyTrendPanel.tsx src/components/poverty/command-dashboard/poverty-trend-utils.ts src/components/poverty/command-dashboard/poverty-trend-utils.test.ts`
Expected: PASS for all touched trend files.

- [ ] **Step 5: Manual verification in the browser**

Run: `cd FE && npm run dev`
Expected: Next dev server starts.

Then verify on `ho-ngheo/dashboard`:

- default mode is `Theo năm`
- switching to `Theo tháng` shows `Select năm`
- changing the year updates the chart to `T1 ... T12`
- tooltip uses `Năm ...` in yearly mode and `Tháng ...` in monthly mode
- monthly mode falls back to the newest valid year after changing province/ward filters
- empty states are correct when no yearly or monthly trend data exists

## Self-Review

- Spec coverage:
  - backend response extension: covered by Tasks 1 and 2
  - monthly grouping by `decisionDate`: covered by Tasks 1 and 2
  - FE mode/year state and fallback: covered by Tasks 3, 4, and 5
  - one-panel UI with mode switch and year select: covered by Tasks 4 and 5
  - empty states and manual verification: covered by Tasks 4 and 6
- Placeholder scan:
  - no `TODO`, `TBD`, or “similar to Task N” references remain
  - every code-changing step includes concrete snippets
- Type consistency:
  - `trendMode` is consistently `"yearly" | "monthly"`
  - `selectedTrendYear` is consistently optional `number`
  - `trendAvailableYears` and `monthlyTrendByYear` names match across BE types, FE types, helpers, and panel props

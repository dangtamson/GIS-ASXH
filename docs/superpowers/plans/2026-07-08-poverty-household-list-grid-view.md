# Poverty Household List Grid View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `Bảng / Lưới` view toggle to the poverty household admin list so users can switch between the current table and a compact card grid without changing API behavior, filters, pagination, or action flows.

**Architecture:** Keep `PovertyHouseholdListPage.tsx` as the stateful page that owns fetch, filters, pagination, modals, permissions, and action handlers. Extract the new grid presentation into a small `PovertyHouseholdGridView.tsx` component and a tiny pure helper module for shared display text so the new UI can be covered by existing `node:test` patterns without introducing a new FE test framework.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Ant Design 6, `node:test`, Tailwind utility classes, existing poverty admin UI helpers

---

## File Structure

- Create: `FE/src/components/poverty/poverty-household-list-view-utils.ts`
  Responsibility: expose small pure helpers for the list page and grid view, especially the shared area-label formatter and a simple menu-presence check.
- Create: `FE/src/components/poverty/poverty-household-list-view-utils.test.ts`
  Responsibility: lock in fallback and formatting behavior for the shared helpers using the repo’s existing `node:test` pattern.
- Create: `FE/src/components/poverty/PovertyHouseholdGridView.tsx`
  Responsibility: render the compact responsive household cards, primary actions, empty state, and extra-actions dropdown using data and callbacks passed from the page.
- Create: `FE/src/components/poverty/PovertyHouseholdGridView.test.tsx`
  Responsibility: use server-side rendering assertions to verify the grid card content and action visibility rules without adding a browser test framework.
- Modify: `FE/src/components/poverty/PovertyHouseholdListPage.tsx`
  Responsibility: add `viewMode`, render the toggle control, reuse the existing handlers for both modes, and switch between the current table and the new grid view.
- Reuse: `FE/src/components/poverty/poverty-household-action-utils.ts`
  Responsibility: continue to define which extra actions are available based on permissions.
- Reuse: `FE/src/components/poverty/poverty-utils.ts`
  Responsibility: continue to provide household type and status labels plus tag colors.

## Task 1: Add shared view helpers and cover them with pure tests

**Files:**
- Create: `FE/src/components/poverty/poverty-household-list-view-utils.ts`
- Create: `FE/src/components/poverty/poverty-household-list-view-utils.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
    buildHouseholdAreaLabel,
    hasDropdownActions,
} from "./poverty-household-list-view-utils.ts";

test("buildHouseholdAreaLabel joins province ward and area names in display order", () => {
    const label = buildHouseholdAreaLabel({
        provinceName: "Can Tho",
        wardName: "Phuong Tan An",
        areaName: "Khu vuc 1",
    });

    assert.equal(label, "Can Tho / Phuong Tan An / Khu vuc 1");
});

test("buildHouseholdAreaLabel falls back to a dash when no area data exists", () => {
    const label = buildHouseholdAreaLabel({
        provinceName: null,
        wardName: undefined,
        areaName: "",
    });

    assert.equal(label, "-");
});

test("hasDropdownActions returns true only for a non-empty menu item list", () => {
    assert.equal(hasDropdownActions(undefined), false);
    assert.equal(hasDropdownActions([]), false);
    assert.equal(hasDropdownActions([{ key: "map", label: "Xem tren ban do" }]), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd FE && npm test -- src/components/poverty/poverty-household-list-view-utils.test.ts`
Expected: FAIL because `poverty-household-list-view-utils.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { MenuProps } from "antd";
import type { PoorHousehold } from "@/types/poverty";

type HouseholdAreaFields = Pick<PoorHousehold, "provinceName" | "wardName" | "areaName">;

export function buildHouseholdAreaLabel(item: HouseholdAreaFields): string {
    const parts = [item.provinceName, item.wardName, item.areaName]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean);

    return parts.length > 0 ? parts.join(" / ") : "-";
}

export function hasDropdownActions(items: MenuProps["items"] | undefined): boolean {
    return Array.isArray(items) && items.length > 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd FE && npm test -- src/components/poverty/poverty-household-list-view-utils.test.ts`
Expected: PASS with all three helper assertions green.

- [ ] **Step 5: Commit**

```bash
git add FE/src/components/poverty/poverty-household-list-view-utils.ts FE/src/components/poverty/poverty-household-list-view-utils.test.ts
git commit -m "test: add poverty household list view helpers"
```

## Task 2: Build the grid component and cover card rendering rules

**Files:**
- Create: `FE/src/components/poverty/PovertyHouseholdGridView.tsx`
- Create: `FE/src/components/poverty/PovertyHouseholdGridView.test.tsx`
- Reuse: `FE/src/components/poverty/poverty-household-list-view-utils.ts`

- [ ] **Step 1: Write the failing test**

```tsx
import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import PovertyHouseholdGridView from "./PovertyHouseholdGridView.tsx";

const sampleHousehold = {
    id: "household-1",
    code: "HN-001",
    year: 2026,
    povertyType: "POOR",
    status: "ACTIVE",
    provinceName: "Can Tho",
    wardName: "Phuong Tan An",
    areaName: "Khu vuc 1",
    headFullName: "Nguyen Van A",
} as const;

test("grid view renders the compact household fields and actions", () => {
    const html = renderToStaticMarkup(
        <PovertyHouseholdGridView
            items={[sampleHousehold]}
            loading={false}
            canUpdateHousehold={true}
            onViewHousehold={() => undefined}
            onEditHousehold={() => undefined}
            buildExtraActionMenuItems={() => [{ key: "map", label: "Xem tren ban do" }]}
        />
    );

    assert.match(html, /HN-001/);
    assert.match(html, /Nguyen Van A/);
    assert.match(html, /Can Tho \/ Phuong Tan An \/ Khu vuc 1/);
    assert.match(html, /Xem/);
    assert.match(html, /Sua/);
    assert.match(html, /Them thao tac/);
});

test("grid view hides edit and menu buttons when those actions are unavailable", () => {
    const html = renderToStaticMarkup(
        <PovertyHouseholdGridView
            items={[sampleHousehold]}
            loading={false}
            canUpdateHousehold={false}
            onViewHousehold={() => undefined}
            onEditHousehold={() => undefined}
            buildExtraActionMenuItems={() => []}
        />
    );

    assert.match(html, /Xem/);
    assert.doesNotMatch(html, /Sua/);
    assert.doesNotMatch(html, /Them thao tac/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd FE && npm test -- src/components/poverty/PovertyHouseholdGridView.test.tsx`
Expected: FAIL because `PovertyHouseholdGridView.tsx` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { Button, Dropdown, Empty, Spin, Tag } from "antd";
import type { MenuProps } from "antd";

import ActionIcon from "@/components/controller/ActionIcon";
import { buildHouseholdAreaLabel, hasDropdownActions } from "@/components/poverty/poverty-household-list-view-utils";
import {
    householdStatusColor,
    householdStatusLabel,
    povertyTypeColor,
    povertyTypeLabel,
} from "@/components/poverty/poverty-utils";
import type { PoorHousehold } from "@/types/poverty";

type Props = {
    items: PoorHousehold[];
    loading: boolean;
    canUpdateHousehold: boolean;
    onViewHousehold: (record: PoorHousehold) => void;
    onEditHousehold: (record: PoorHousehold) => void;
    buildExtraActionMenuItems: (record: PoorHousehold) => MenuProps["items"];
};

export default function PovertyHouseholdGridView({
    items,
    loading,
    canUpdateHousehold,
    onViewHousehold,
    onEditHousehold,
    buildExtraActionMenuItems,
}: Props) {
    if (loading) {
        return (
            <div className="flex min-h-[220px] items-center justify-center">
                <Spin />
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="px-4 py-10">
                <Empty description="Chua co du lieu ho" />
            </div>
        );
    }

    return (
        <div className="grid gap-4 p-4 sm:grid-cols-2 2xl:grid-cols-3">
            {items.map((record) => {
                const extraMenuItems = buildExtraActionMenuItems(record) ?? [];

                return (
                    <article key={record.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Ma ho</p>
                                <h3 className="truncate text-base font-semibold text-gray-900">{record.code || "-"}</h3>
                                <p className="mt-2 truncate text-sm font-medium text-gray-600">{record.headFullName || "Chua co thong tin chu ho"}</p>
                            </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                            <Tag color={povertyTypeColor(record.povertyType)}>{povertyTypeLabel(record.povertyType)}</Tag>
                            <Tag color={householdStatusColor(record.status)}>{householdStatusLabel(record.status)}</Tag>
                        </div>

                        <div className="mt-3 text-sm text-gray-600">
                            <span className="font-medium text-gray-700">Dia ban:</span> {buildHouseholdAreaLabel(record)}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                            <Button onClick={() => onViewHousehold(record)} icon={<ActionIcon action="view" />}>Xem</Button>
                            {canUpdateHousehold ? (
                                <Button onClick={() => onEditHousehold(record)} icon={<ActionIcon action="edit" />}>Sua</Button>
                            ) : null}
                            {hasDropdownActions(extraMenuItems) ? (
                                <Dropdown menu={{ items: extraMenuItems }} trigger={["click"]} placement="bottomRight">
                                    <Button icon={<ActionIcon action="more" />}>Them thao tac</Button>
                                </Dropdown>
                            ) : null}
                        </div>
                    </article>
                );
            })}
        </div>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd FE && npm test -- src/components/poverty/PovertyHouseholdGridView.test.tsx`
Expected: PASS with both card-rendering assertions green.

- [ ] **Step 5: Commit**

```bash
git add FE/src/components/poverty/PovertyHouseholdGridView.tsx FE/src/components/poverty/PovertyHouseholdGridView.test.tsx
git commit -m "feat: add poverty household grid view component"
```

## Task 3: Wire the view toggle into the household list page

**Files:**
- Modify: `FE/src/components/poverty/PovertyHouseholdListPage.tsx`
- Reuse: `FE/src/components/poverty/PovertyHouseholdGridView.tsx`
- Reuse: `FE/src/components/poverty/poverty-household-list-view-utils.ts`

- [ ] **Step 1: Write the failing integration boundary**

Add the imports and a temporary `viewMode` reference before implementing the state or render branch.

```tsx
import PovertyHouseholdGridView from "@/components/poverty/PovertyHouseholdGridView";
```

```tsx
const [viewMode, setViewMode] = useState<"table" | "grid">("table");
```

```tsx
{viewMode === "grid" ? null : null}
```

- [ ] **Step 2: Run lint to verify the page fails before the render branch is complete**

Run: `cd FE && npm run lint`
Expected: FAIL or warn meaningfully until `viewMode` is fully wired into the page render and imports are used consistently.

- [ ] **Step 3: Add the minimal page implementation**

Update the page imports:

```tsx
import { Alert, App, Button, Col, Dropdown, Form, Input, InputNumber, Modal, Row, Select, Space, Table, Tag } from "antd";
import { LayoutGrid, List } from "lucide-react";
```

Add local state near the other top-level page state:

```tsx
const [viewMode, setViewMode] = useState<"table" | "grid">("table");
```

Extract a shared view handler beside the existing action handlers:

```tsx
const openView = useCallback((record: PoorHousehold) => {
    router.push(`/ho-ngheo/${record.id}`);
}, [router]);
```

Update the table action column to reuse `openView`:

```tsx
<Button type="text" icon={<ActionIcon action="view" />} onClick={() => openView(record)} />
```

Add the view-toggle header above the data renderer:

```tsx
<div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
    <div>
        <h3 className="text-sm font-semibold text-gray-800">Danh sach ho</h3>
        <p className="mt-0.5 text-xs text-gray-500">
            {total.toLocaleString("vi-VN")} ho trong trang du lieu hien tai
        </p>
    </div>
    <Space.Compact>
        <Button
            type={viewMode === "table" ? "primary" : "default"}
            icon={<List size={16} />}
            onClick={() => setViewMode("table")}
        >
            Bang
        </Button>
        <Button
            type={viewMode === "grid" ? "primary" : "default"}
            icon={<LayoutGrid size={16} />}
            onClick={() => setViewMode("grid")}
        >
            Luoi
        </Button>
    </Space.Compact>
</div>
```

Replace the single table renderer with a branch:

```tsx
<div className="min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-800">Danh sach ho</h3>
            <p className="mt-0.5 text-xs text-gray-500">
                {total.toLocaleString("vi-VN")} ho phu hop voi bo loc hien tai
            </p>
        </div>
        <Space.Compact>
            <Button type={viewMode === "table" ? "primary" : "default"} icon={<List size={16} />} onClick={() => setViewMode("table")}>
                Bang
            </Button>
            <Button type={viewMode === "grid" ? "primary" : "default"} icon={<LayoutGrid size={16} />} onClick={() => setViewMode("grid")}>
                Luoi
            </Button>
        </Space.Compact>
    </div>

    {viewMode === "table" ? (
        <Table
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={items}
            pagination={false}
            scroll={{ x: 1820 }}
            size="middle"
        />
    ) : (
        <PovertyHouseholdGridView
            items={items}
            loading={loading}
            canUpdateHousehold={canUpdateHousehold}
            onViewHousehold={openView}
            onEditHousehold={openEdit}
            buildExtraActionMenuItems={buildExtraActionMenuItems}
        />
    )}

    <AppPagination
        currentPage={page}
        totalPages={Math.max(1, Math.ceil(total / limit))}
        totalRows={total}
        rowsPerPage={limit}
        onRowsPerPageChange={(value) => { setLimit(value); setPage(1); }}
        onPageChange={setPage}
    />
</div>
```

- [ ] **Step 4: Run tests and lint to verify the page stays green**

Run: `cd FE && npm test -- src/components/poverty/poverty-household-list-view-utils.test.ts src/components/poverty/PovertyHouseholdGridView.test.tsx src/components/poverty/poverty-household-action-utils.test.ts`
Expected: PASS with the new view helper and grid tests plus the existing action-utils tests green.

Run: `cd FE && npm run lint`
Expected: PASS with no new lint errors in the touched files.

- [ ] **Step 5: Commit**

```bash
git add FE/src/components/poverty/PovertyHouseholdListPage.tsx FE/src/components/poverty/PovertyHouseholdGridView.tsx FE/src/components/poverty/PovertyHouseholdGridView.test.tsx FE/src/components/poverty/poverty-household-list-view-utils.ts FE/src/components/poverty/poverty-household-list-view-utils.test.ts
git commit -m "feat: add poverty household grid list toggle"
```

## Task 4: Manual regression check for both list modes

**Files:**
- Verify: `FE/src/components/poverty/PovertyHouseholdListPage.tsx`
- Verify: `FE/src/components/poverty/PovertyHouseholdGridView.tsx`

- [ ] **Step 1: Start the FE app**

Run: `cd FE && npm run dev`
Expected: Next.js dev server starts without compilation errors.

- [ ] **Step 2: Verify the default table mode**

Check in the browser:

- page opens in `Bang`
- filters still work
- pagination still works
- table actions `Xem`, `Sua`, and the extra-actions dropdown still behave exactly as before

- [ ] **Step 3: Verify the new grid mode**

Check in the browser:

- clicking `Luoi` switches to cards without refetching only because of the mode change
- each card shows `Ma ho`, `Chu ho`, `Loai ho`, `Trang thai`, and `Dia ban`
- cards show `Xem`
- cards show `Sua` only when the current user has update permission
- cards show `Them thao tac` only when at least one extra action is available

- [ ] **Step 4: Verify edge cases**

Check in the browser:

- empty results show a clear empty state in grid mode
- loading state does not collapse the card area
- switching back to `Bang` preserves the current filters, page, and rows-per-page setting
- modal edit flow, map flow, support timeline, assessment timeline, and deactivate flow still work after opening them from the grid

- [ ] **Step 5: Commit the verification note if you keep one**

```bash
# No code changes required in this step.
```

## Self-Review

- Spec coverage check:
  - toggle between `Bang` and `Luoi`: covered in Task 3
  - compact card content: covered in Task 2 and Task 4
  - extra actions inside one menu: covered in Task 2 and Task 3
  - no API/filter/pagination changes: enforced by Task 3 architecture and Task 4 regression checks
- Placeholder scan:
  - no `TODO`, `TBD`, or “similar to Task N” references remain
  - all code-changing steps include concrete snippets
- Type consistency:
  - `viewMode` is consistently `"table" | "grid"`
  - `buildExtraActionMenuItems` is reused as the single menu source for both table and grid
  - `openView`, `openEdit`, and `canUpdateHousehold` names match the component interfaces shown above

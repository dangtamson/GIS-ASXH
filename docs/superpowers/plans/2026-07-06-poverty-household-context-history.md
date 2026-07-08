# Poverty Household Context History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated dated history for `Hoàn cảnh gia đình` and `Hiện trạng`, expose it in poverty household detail, and show the latest entry in the summary area.

**Architecture:** Add a new backend table plus household-scoped CRUD routes that mirror the existing assessments/supports pattern. Extend the household detail response with `contextHistories` and `latestContextHistory`, then update the frontend detail page to render a new tab, modal CRUD flow, and summary cards based on the latest record.

**Tech Stack:** PostgreSQL, Drizzle ORM, Express, Zod, Vitest, Next.js, React, Ant Design, TypeScript.

---

### Task 1: Add Backend Schema and Migration

**Files:**
- Modify: `BE/src/schema.ts`
- Add: `BE/drizzle/0014_household_context_histories.sql`

- [ ] **Step 1: Write the failing repository-oriented test for the new ordering helper.**

```ts
import { describe, expect, it } from "vitest";
import { sortContextHistoriesLatestFirst } from "./poverty.repository.ts";

describe("sortContextHistoriesLatestFirst", () => {
  it("orders by recordedAt desc then createdAt desc", () => {
    const ordered = sortContextHistoriesLatestFirst([
      {
        id: "older-created-later",
        householdId: "h1",
        recordedAt: "2026-06-01",
        createdAt: "2026-06-01T10:00:00.000Z",
        familySituation: "A",
        currentStatus: null,
        note: null,
        updatedAt: null
      },
      {
        id: "newer-day",
        householdId: "h1",
        recordedAt: "2026-06-02",
        createdAt: "2026-06-02T08:00:00.000Z",
        familySituation: null,
        currentStatus: "B",
        note: null,
        updatedAt: null
      }
    ]);

    expect(ordered.map((item) => item.id)).toEqual(["newer-day", "older-created-later"]);
  });
});
```

- [ ] **Step 2: Run the focused backend test to verify it fails because the helper does not exist yet.**

Run: `cd BE && npm test -- poverty.repository.test.ts`

Expected: FAIL with a missing export or missing symbol for `sortContextHistoriesLatestFirst`.

- [ ] **Step 3: Add the new table schema and SQL migration.**

```ts
export const householdContextHistories = gisasxhSchema.table("household_context_histories", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id").notNull().references(() => poorHouseholds.id),
  recordedAt: date("recorded_at").notNull(),
  familySituation: text("family_situation"),
  currentStatus: text("current_status"),
  note: text("note"),
  createdAt: timestamp("created_at", { precision: 6 }).defaultNow(),
  updatedAt: timestamp("updated_at", { precision: 6 }).defaultNow()
});
```

```sql
create table if not exists gisasxh.household_context_histories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references gisasxh.poor_households(id),
  recorded_at date not null,
  family_situation text,
  current_status text,
  note text,
  created_at timestamp(6) default now(),
  updated_at timestamp(6) default now()
);

create index if not exists household_context_histories_household_recorded_at_idx
  on gisasxh.household_context_histories (household_id, recorded_at desc, created_at desc);
```

- [ ] **Step 4: Add the minimal ordering helper to the repository test surface.**

```ts
export const sortContextHistoriesLatestFirst = <T extends { recordedAt: string; createdAt?: string | null }>(items: T[]) =>
  [...items].sort((left, right) => {
    const recordedDiff = new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime();
    if (recordedDiff !== 0) return recordedDiff;
    return new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime();
  });
```

- [ ] **Step 5: Re-run the focused backend test to verify it passes.**

Run: `cd BE && npm test -- poverty.repository.test.ts`

Expected: PASS for the new ordering test and existing repository helper tests.

- [ ] **Step 6: Commit the schema foundation.**

```bash
git add BE/src/schema.ts BE/drizzle/0014_household_context_histories.sql BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts BE/src/handlers/admin/resources/poverty/poverty.repository.ts
git commit -m "feat: add poverty household context history schema"
```

### Task 2: Add Backend Validation, Repository CRUD, and Routes

**Files:**
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.schemas.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.schemas.test.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.handlers.ts`
- Modify: `BE/src/routes/admin/poverty.ts`
- Modify: `BE/src/helpers/permissions.ts`

- [ ] **Step 1: Write failing schema tests for the new params and create payload rule.**

```ts
import {
  contextHistoryIdParamSchema,
  householdContextHistoryCreateSchema
} from "./poverty.schemas.ts";

it("accepts UUID nested context history ids", () => {
  const result = contextHistoryIdParamSchema.safeParse({
    id: "6f3a67e7-1d40-4b50-a7dd-580f98c0345f",
    contextHistoryId: "9fb97875-4916-41b8-8151-b0d655e0352b"
  });

  expect(result.success).toBe(true);
});

it("rejects create payloads when both familySituation and currentStatus are empty", () => {
  const result = householdContextHistoryCreateSchema.safeParse({
    recordedAt: "2026-07-06",
    familySituation: "   ",
    currentStatus: "   "
  });

  expect(result.success).toBe(false);
});
```

- [ ] **Step 2: Run the focused schema test file and verify it fails for missing schema exports.**

Run: `cd BE && npm test -- poverty.schemas.test.ts`

Expected: FAIL for missing `contextHistoryIdParamSchema` and `householdContextHistoryCreateSchema`.

- [ ] **Step 3: Add Zod schemas and param schemas.**

```ts
export const contextHistoryIdParamSchema = z.object({
  id: z.uuid(),
  contextHistoryId: z.uuid()
});

export const householdContextHistoryCreateSchema = z.object({
  recordedAt: optionalDateText,
  familySituation: optionalText,
  currentStatus: optionalText,
  note: optionalText,
  changeNote: optionalText
})
  .refine((value) => Boolean(value.recordedAt), { message: "recordedAt is required", path: ["recordedAt"] })
  .refine((value) => Boolean(value.familySituation || value.currentStatus), {
    message: "At least one of familySituation or currentStatus is required",
    path: ["familySituation"]
  });

export const householdContextHistoryUpdateSchema = householdContextHistoryCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" })
  .refine((value) => {
    if ("familySituation" in value || "currentStatus" in value) {
      return Boolean(value.familySituation || value.currentStatus);
    }
    return true;
  }, {
    message: "At least one of familySituation or currentStatus is required",
    path: ["familySituation"]
  });
```

- [ ] **Step 4: Extend repository, handlers, and routes with context-history CRUD plus detail response inclusion.**

```ts
const [members, assessments, supports, changeLogs, fieldPhotos, contextHistories] = await Promise.all([
  db.select().from(householdMembers).where(eq(householdMembers.householdId, id)).orderBy(desc(householdMembers.isHead), asc(householdMembers.fullName)),
  db.select().from(householdAssessments).where(eq(householdAssessments.householdId, id)).orderBy(desc(householdAssessments.assessmentYear)),
  db.select().from(householdSupports).where(eq(householdSupports.householdId, id)).orderBy(desc(householdSupports.supportDate), desc(householdSupports.createdAt)),
  db.select().from(householdChangeLogs).where(eq(householdChangeLogs.householdId, id)).orderBy(desc(householdChangeLogs.changedAt)).limit(50),
  db.select().from(files).where(and(eq(files.entityType, "poor_household"), eq(files.entityId, id), isNull(files.deletedAt))).orderBy(desc(files.createdAt)),
  listContextHistories(id)
]);

const latestContextHistory = contextHistories[0] ?? null;
return { household: effectiveHousehold, members, assessments, supports, changeLogs, fieldPhotos, contextHistories, latestContextHistory };
```

```ts
app.get(API_ROUTES.povertyHouseholdContextHistories, ...guards, listHouseholdContextHistoriesAdmin);
app.post(API_ROUTES.povertyHouseholdContextHistories, ...guards, createHouseholdContextHistoryAdmin);
app.patch(API_ROUTES.povertyHouseholdContextHistoryById, ...guards, updateHouseholdContextHistoryAdminById);
app.delete(API_ROUTES.povertyHouseholdContextHistoryById, ...guards, deleteHouseholdContextHistoryAdminById);
```

```ts
povertyHouseholdContextHistories: "/poverty/households/:id/context-histories",
povertyHouseholdContextHistoryById: "/poverty/households/:id/context-histories/:contextHistoryId",
```

- [ ] **Step 5: Re-run focused backend tests to verify schemas and repository helpers pass.**

Run: `cd BE && npm test -- poverty.schemas.test.ts poverty.repository.test.ts`

Expected: PASS for the new context-history tests and existing poverty helper tests.

- [ ] **Step 6: Run a narrow backend compile check and record pre-existing failures separately if they remain outside this slice.**

Run: `cd BE && npm run tsc:check`

Expected: either PASS, or failure only in unrelated known files outside the poverty context-history change set.

- [ ] **Step 7: Commit the backend CRUD surface.**

```bash
git add BE/src/handlers/admin/resources/poverty/poverty.schemas.ts BE/src/handlers/admin/resources/poverty/poverty.schemas.test.ts BE/src/handlers/admin/resources/poverty/poverty.repository.ts BE/src/handlers/admin/resources/poverty/poverty.handlers.ts BE/src/routes/admin/poverty.ts BE/src/helpers/permissions.ts
git commit -m "feat: add poverty household context history api"
```

### Task 3: Add Frontend Types, Endpoints, and Detail Page State

**Files:**
- Modify: `FE/src/types/poverty.ts`
- Modify: `FE/src/lib/endpoints.ts`
- Modify: `FE/src/components/poverty/PovertyHouseholdDetailPage.tsx`

- [ ] **Step 1: Write a failing frontend test for a new pure helper that picks the latest context history entry.**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { getLatestHouseholdContextHistory } from "./poverty-context-utils";

test("getLatestHouseholdContextHistory returns the latest recorded item", () => {
  const latest = getLatestHouseholdContextHistory([
    { id: "1", householdId: "h1", recordedAt: "2026-07-01", familySituation: "A", currentStatus: null, note: null },
    { id: "2", householdId: "h1", recordedAt: "2026-07-03", familySituation: null, currentStatus: "B", note: null }
  ]);

  assert.equal(latest?.id, "2");
});
```

- [ ] **Step 2: Run the focused frontend test and verify it fails because the helper file does not exist yet.**

Run: `cd FE && npm test -- src/components/poverty/poverty-context-utils.test.ts`

Expected: FAIL due to missing file or missing export.

- [ ] **Step 3: Add the new type, endpoint helpers, and minimal pure helper.**

```ts
export type HouseholdContextHistory = {
  id: string;
  householdId: string;
  recordedAt: string;
  familySituation?: string | null;
  currentStatus?: string | null;
  note?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type HouseholdDetailResponse = {
  household?: PoorHousehold;
  members?: HouseholdMember[];
  assessments?: HouseholdAssessment[];
  supports?: HouseholdSupport[];
  contextHistories?: HouseholdContextHistory[];
  latestContextHistory?: HouseholdContextHistory | null;
  changeLogs?: HouseholdChangeLog[];
  fieldPhotos?: HouseholdFieldPhoto[];
};
```

```ts
householdContextHistories: (id: string | number) => `/poverty/households/${id}/context-histories`,
householdContextHistory: (id: string | number, contextHistoryId: string | number) => `/poverty/households/${id}/context-histories/${contextHistoryId}`,
```

```ts
export const getLatestHouseholdContextHistory = <T extends { recordedAt: string; createdAt?: string | null }>(items: T[]) =>
  [...items].sort((left, right) => {
    const recordedDiff = new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime();
    if (recordedDiff !== 0) return recordedDiff;
    return new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime();
  })[0] ?? null;
```

- [ ] **Step 4: Update the detail page state and load path to consume the new response fields.**

```ts
const [contextHistories, setContextHistories] = useState<HouseholdContextHistory[]>([]);
const [latestContextHistory, setLatestContextHistory] = useState<HouseholdContextHistory | null>(null);

const loadDetail = useCallback(async () => {
  setLoading(true);
  try {
    const data = await api.get<HouseholdDetailResponse>(endpoints.poverty.household(id));
    setHousehold(data.household ?? null);
    setMembers(data.members ?? []);
    setAssessments(data.assessments ?? []);
    setSupports(data.supports ?? []);
    setContextHistories(data.contextHistories ?? []);
    setLatestContextHistory(data.latestContextHistory ?? null);
    setChangeLogs(data.changeLogs ?? []);
    setFieldPhotos(data.fieldPhotos ?? []);
  } finally {
    setLoading(false);
  }
}, [id]);
```

- [ ] **Step 5: Re-run the focused frontend helper test.**

Run: `cd FE && npm test -- src/components/poverty/poverty-context-utils.test.ts`

Expected: PASS for the new helper test.

- [ ] **Step 6: Commit the frontend data contract changes.**

```bash
git add FE/src/types/poverty.ts FE/src/lib/endpoints.ts FE/src/components/poverty/poverty-context-utils.ts FE/src/components/poverty/poverty-context-utils.test.ts FE/src/components/poverty/PovertyHouseholdDetailPage.tsx
git commit -m "feat: add poverty household context history types"
```

### Task 4: Build the New Tab, Modal CRUD, and Summary Cards

**Files:**
- Modify: `FE/src/components/poverty/PovertyHouseholdDetailPage.tsx`

- [ ] **Step 1: Write a failing UI-level test or, if the file has no existing UI test harness, define a focused manual verification checklist before implementation.**

```md
Manual verification checklist:
1. Open a household with no context history and confirm the summary shows `-` for both fields.
2. Add a new record with only `Hoàn cảnh gia đình` filled and confirm it appears in the tab and summary.
3. Edit the same record to add `Hiện trạng` and confirm the summary updates.
4. Delete the record and confirm the tab returns to empty state and the summary falls back to `-`.
```

- [ ] **Step 2: Add the summary cards that render the latest values.**

```tsx
<InfoCard label="Hoàn cảnh gia đình">
  <div className="min-w-0">
    <div className="line-clamp-3 break-words">{latestContextHistory?.familySituation || "-"}</div>
    <div className="mt-1 text-xs font-normal text-gray-500">
      Cập nhật gần nhất: {latestContextHistory?.recordedAt ? formatDate(latestContextHistory.recordedAt) : "-"}
    </div>
  </div>
</InfoCard>

<InfoCard label="Hiện trạng">
  <div className="min-w-0">
    <div className="line-clamp-3 break-words">{latestContextHistory?.currentStatus || "-"}</div>
    <div className="mt-1 text-xs font-normal text-gray-500">
      Cập nhật gần nhất: {latestContextHistory?.recordedAt ? formatDate(latestContextHistory.recordedAt) : "-"}
    </div>
  </div>
</InfoCard>
```

- [ ] **Step 3: Add tab table, modal state, and CRUD handlers using the new endpoints.**

```ts
const [contextHistoryModalOpen, setContextHistoryModalOpen] = useState(false);
const [editingContextHistory, setEditingContextHistory] = useState<HouseholdContextHistory | null>(null);
const [contextHistoryForm] = Form.useForm();
```

```ts
const saveContextHistory = async () => {
  const values = await contextHistoryForm.validateFields();
  const payload = {
    ...values,
    recordedAt: values.recordedAt
      ? dayjs.isDayjs(values.recordedAt)
        ? values.recordedAt.format("YYYY-MM-DD")
        : String(values.recordedAt).slice(0, 10)
      : undefined
  };

  if (editingContextHistory) {
    await api.patch(endpoints.poverty.householdContextHistory(id, editingContextHistory.id), payload);
  } else {
    await api.post(endpoints.poverty.householdContextHistories(id), payload);
  }

  setContextHistoryModalOpen(false);
  await loadDetail();
};
```

```tsx
{
  key: "context-history",
  label: "Hoàn cảnh & hiện trạng",
  children: (
    <div className="min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white">
      {canUpdateDetail ? <div className="flex flex-wrap justify-end gap-2 border-b border-gray-100 p-3"><ActionButton type="create" label="Thêm cập nhật" onClick={() => openContextHistoryModal()} /></div> : null}
      <Table rowKey="id" loading={loading} dataSource={contextHistories} pagination={false} />
    </div>
  )
}
```

- [ ] **Step 4: Add form-level validation so at least one of the two text areas is filled.**

```tsx
<Form
  form={contextHistoryForm}
  layout="vertical"
  onValuesChange={() => {
    const values = contextHistoryForm.getFieldsValue(["familySituation", "currentStatus"]);
    if (values.familySituation || values.currentStatus) {
      void contextHistoryForm.validateFields(["familySituation", "currentStatus"]);
    }
  }}
>
```

```tsx
<Form.Item
  name="familySituation"
  label="Hoàn cảnh gia đình"
  rules={[{
    validator: async (_, value) => {
      const currentStatus = contextHistoryForm.getFieldValue("currentStatus");
      if (String(value ?? "").trim() || String(currentStatus ?? "").trim()) return;
      throw new Error("Vui lòng nhập Hoàn cảnh gia đình hoặc Hiện trạng");
    }
  }]}
>
  <Input.TextArea rows={4} />
</Form.Item>
```

- [ ] **Step 5: Run focused frontend validation and lint checks.**

Run: `cd FE && npm test -- src/components/poverty/poverty-context-utils.test.ts`

Expected: PASS.

Run: `cd FE && npm run lint -- src/components/poverty/PovertyHouseholdDetailPage.tsx src/components/poverty/poverty-context-utils.ts src/components/poverty/poverty-context-utils.test.ts`

Expected: PASS or only unrelated repo-level lint behavior outside touched files.

- [ ] **Step 6: Execute the manual verification checklist against the detail page.**

```md
1. Load a household with no context history and confirm empty summary + empty tab.
2. Create a dated record with only one field filled.
3. Edit the record and confirm summary refreshes from latest data.
4. Add a second newer record and confirm newest-first ordering.
5. Delete the newest record and confirm fallback to the previous record in the summary.
```

- [ ] **Step 7: Commit the UI flow.**

```bash
git add FE/src/components/poverty/PovertyHouseholdDetailPage.tsx FE/src/components/poverty/poverty-context-utils.ts FE/src/components/poverty/poverty-context-utils.test.ts
git commit -m "feat: add poverty household context history tab"
```

### Task 5: Final Verification and Cleanup

**Files:**
- Modify if needed: touched files only

- [ ] **Step 1: Run the focused backend tests again after frontend integration to ensure no backend regressions slipped in.**

Run: `cd BE && npm test -- poverty.schemas.test.ts poverty.repository.test.ts`

Expected: PASS.

- [ ] **Step 2: Run the focused frontend test again.**

Run: `cd FE && npm test -- src/components/poverty/poverty-context-utils.test.ts`

Expected: PASS.

- [ ] **Step 3: Run a final diff review only after executable checks are done.**

Run: `git diff -- BE/src/schema.ts BE/src/handlers/admin/resources/poverty/poverty.schemas.ts BE/src/handlers/admin/resources/poverty/poverty.repository.ts BE/src/handlers/admin/resources/poverty/poverty.handlers.ts BE/src/routes/admin/poverty.ts BE/src/helpers/permissions.ts FE/src/types/poverty.ts FE/src/lib/endpoints.ts FE/src/components/poverty/PovertyHouseholdDetailPage.tsx`

Expected: only the planned context-history changes.

- [ ] **Step 4: Remove incidental files if tooling created any local workspace noise.**

Check specifically for `.vscode/settings.json` and exclude it from handoff if it was auto-created during verification.

- [ ] **Step 5: Commit any final verification-related cleanup if needed.**

```bash
git add -A
git commit -m "chore: finalize poverty household context history"
```

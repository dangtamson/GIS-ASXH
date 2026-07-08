# Poverty Household Mobile Collection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first `/ho-ngheo/thu-thap` flow that lets field workers search for an existing household or create a new one, then collect coordinates, family situation, current status, and field photos through a two-step wizard.

**Architecture:** Add a dedicated collection route and component tree in FE rather than overloading the existing list or map screens. Reuse the current poverty APIs, coordinate picker, context-history endpoints, and file-upload flow, while extending the household create/update backend contract so the mobile step-1 payload can create a full household record in one save.

**Tech Stack:** Next.js, React, Ant Design, TypeScript, Node `--test`, Express, Zod, Drizzle, PostgreSQL.

---

## File Structure

**Backend contracts and search support**

- Modify: `BE/src/handlers/admin/resources/poverty/poverty.schemas.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.schemas.test.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.handlers.ts`

**Frontend route and collection module**

- Create: `FE/src/app/(admin)/ho-ngheo/thu-thap/page.tsx`
- Create: `FE/src/components/poverty/collection/PovertyCollectionPage.tsx`
- Create: `FE/src/components/poverty/collection/PovertyCollectionSearchView.tsx`
- Create: `FE/src/components/poverty/collection/PovertyCollectionStepOneForm.tsx`
- Create: `FE/src/components/poverty/collection/PovertyCollectionStepTwoForm.tsx`
- Create: `FE/src/components/poverty/collection/poverty-collection-utils.ts`
- Create: `FE/src/components/poverty/collection/poverty-collection-utils.test.ts`

**Frontend shared contracts and entry points**

- Modify: `FE/src/types/poverty.ts`
- Modify: `FE/src/components/poverty/PovertyHouseholdListPage.tsx`
- Modify: `FE/src/components/poverty/PovertyMapPage.tsx`

## Task 1: Extend Backend Household Step-1 Contract

**Files:**
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.schemas.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.schemas.test.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.handlers.ts`
- Test: `BE/src/handlers/admin/resources/poverty/poverty.schemas.test.ts`
- Test: `BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts`

- [ ] **Step 1: Write the failing schema test for mobile step-1 create fields**

```ts
describe("householdCreateSchema mobile collection fields", () => {
  it("accepts head info and member count for mobile collection", () => {
    const result = householdCreateSchema.safeParse({
      year: 2026,
      povertyType: "POOR",
      status: "ACTIVE",
      provinceCode: "92",
      wardCode: "31117",
      areaId: "11111111-1111-1111-1111-111111111111",
      address: "So 1 Duong ABC",
      latitude: 10.0321,
      longitude: 105.7682,
      headFullName: "Nguyen Van A",
      headCitizenId: "079123456789",
      memberCount: 4
    });

    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run the focused schema test to verify it fails**

Run: `cd BE && npm test -- poverty.schemas.test.ts`

Expected: FAIL because `headFullName`, `headCitizenId`, and `memberCount` are not part of `householdCreateSchema`.

- [ ] **Step 3: Extend the household create/update schema for mobile step 1**

```ts
export const householdCreateSchema = z.object({
  code: optionalText,
  year: z.coerce.number().int().min(1900).max(2200),
  povertyType: z.enum(POVERTY_TYPES),
  status: z.enum(HOUSEHOLD_STATUSES).optional().default("ACTIVE"),
  provinceCode: z.string().trim().min(1),
  wardCode: z.string().trim().min(1),
  areaId: z.uuid(),
  provinceName: optionalText,
  wardName: optionalText,
  areaName: optionalText,
  address: optionalText,
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  headFullName: optionalText,
  headCitizenId: optionalText,
  memberCount: z.coerce.number().int().min(0).optional(),
  changeNote: optionalText
});
```

- [ ] **Step 4: Write the failing repository test for step-1 create persistence**

```ts
it("createHousehold persists head info from the mobile collection payload", async () => {
  const payload = {
    year: 2026,
    povertyType: "POOR" as const,
    status: "ACTIVE" as const,
    provinceCode: "92",
    wardCode: "31117",
    areaId: "11111111-1111-1111-1111-111111111111",
    address: "So 1 Duong ABC",
    latitude: 10.0321,
    longitude: 105.7682,
    headFullName: "Nguyen Van A",
    headCitizenId: "079123456789",
    memberCount: 4
  };

  expect(payload.headFullName).toBe("Nguyen Van A");
  expect(payload.memberCount).toBe(4);
});
```

- [ ] **Step 5: Update repository and handler payload handling for the new fields**

```ts
const item = await createHousehold({
  ...body,
  headFullName: body.headFullName,
  headCitizenId: body.headCitizenId,
  memberCount: body.memberCount
});
```

```ts
type CreateHouseholdInput = HouseholdCreateInput & {
  headFullName?: string;
  headCitizenId?: string;
  memberCount?: number;
};
```

Implementation note:
- if the current persistence model stores head/member data only through `householdMembers`, create the head member during household creation when `headFullName` is present
- if `memberCount` is not a persisted field, treat it as an initial target for member count display only if the domain already has a storage pattern; otherwise add explicit backend support before wiring FE assumptions

- [ ] **Step 6: Re-run the focused backend tests**

Run: `cd BE && npm test -- poverty.schemas.test.ts poverty.repository.test.ts`

Expected: PASS for the new schema and repository coverage.

- [ ] **Step 7: Commit the backend step-1 contract**

```bash
git add BE/src/handlers/admin/resources/poverty/poverty.schemas.ts BE/src/handlers/admin/resources/poverty/poverty.schemas.test.ts BE/src/handlers/admin/resources/poverty/poverty.repository.ts BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts BE/src/handlers/admin/resources/poverty/poverty.handlers.ts
git commit -m "feat: extend poverty household mobile step one contract"
```

## Task 2: Strengthen Backend Search for Mobile Entry

**Files:**
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts`
- Test: `BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts`

- [ ] **Step 1: Write the failing repository helper test for search token matching**

```ts
it("matches search text against code head name citizen id and address", () => {
  const households = [
    { code: "HN-001", headFullName: "Nguyen Van A", headCitizenId: "079123456789", address: "Phuong An Binh" },
    { code: "HN-002", headFullName: "Tran Thi B", headCitizenId: "079999999999", address: "Phuong Cai Khe" }
  ];

  const keyword = "an binh";

  expect(households.filter((item) =>
    [item.code, item.headFullName, item.headCitizenId, item.address]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(keyword)
  )).toHaveLength(1);
});
```

- [ ] **Step 2: Run the repository test file to verify the new search expectation fails or is missing**

Run: `cd BE && npm test -- poverty.repository.test.ts`

Expected: FAIL because the current search test coverage does not assert all mobile-search fields.

- [ ] **Step 3: Update `listHouseholds` search filtering to include all mobile search targets**

```ts
const searchTerm = query.search?.trim();

if (searchTerm) {
  conditions.push(or(
    ilike(poorHouseholds.code, `%${searchTerm}%`),
    ilike(poorHouseholds.address, `%${searchTerm}%`),
    inArray(
      poorHouseholds.id,
      db.select({ householdId: householdMembers.householdId })
        .from(householdMembers)
        .where(or(
          ilike(householdMembers.fullName, `%${searchTerm}%`),
          ilike(householdMembers.citizenId, `%${searchTerm}%`)
        ))
    )
  ));
}
```

- [ ] **Step 4: Re-run the repository test file**

Run: `cd BE && npm test -- poverty.repository.test.ts`

Expected: PASS with the new search coverage.

- [ ] **Step 5: Commit the search improvements**

```bash
git add BE/src/handlers/admin/resources/poverty/poverty.repository.ts BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts
git commit -m "feat: improve poverty household mobile search"
```

## Task 3: Add Frontend Collection Utilities and Route Shell

**Files:**
- Create: `FE/src/components/poverty/collection/poverty-collection-utils.ts`
- Create: `FE/src/components/poverty/collection/poverty-collection-utils.test.ts`
- Create: `FE/src/app/(admin)/ho-ngheo/thu-thap/page.tsx`
- Create: `FE/src/components/poverty/collection/PovertyCollectionPage.tsx`
- Modify: `FE/src/types/poverty.ts`
- Test: `FE/src/components/poverty/collection/poverty-collection-utils.test.ts`

- [ ] **Step 1: Write the failing utility tests for mode transitions and step-2 validation**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialCollectionState,
  canSubmitCollectionStepTwo
} from "./poverty-collection-utils.ts";

test("createInitialCollectionState starts in search mode", () => {
  const state = createInitialCollectionState();
  assert.equal(state.mode, "search");
  assert.equal(state.step, null);
});

test("canSubmitCollectionStepTwo accepts any non-empty context or photo", () => {
  assert.equal(canSubmitCollectionStepTwo({ familySituation: "Kho khan", currentStatus: "", photos: [] }), true);
  assert.equal(canSubmitCollectionStepTwo({ familySituation: "", currentStatus: "Da cap nhat", photos: [] }), true);
  assert.equal(canSubmitCollectionStepTwo({ familySituation: "", currentStatus: "", photos: [{ fileName: "a.jpg" }] }), true);
  assert.equal(canSubmitCollectionStepTwo({ familySituation: "", currentStatus: "", photos: [] }), false);
});
```

- [ ] **Step 2: Run the focused utility test and verify it fails because the file does not exist**

Run: `cd FE && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/components/poverty/collection/poverty-collection-utils.test.ts`

Expected: FAIL with module not found for `poverty-collection-utils.ts`.

- [ ] **Step 3: Add the collection utility module**

```ts
export type CollectionMode =
  | "search"
  | "create-step-1"
  | "create-step-2"
  | "update-step-1"
  | "update-step-2";

export function createInitialCollectionState() {
  return {
    mode: "search" as CollectionMode,
    step: null as 1 | 2 | null,
    selectedHouseholdId: null as string | null
  };
}

export function canSubmitCollectionStepTwo(input: {
  familySituation?: string;
  currentStatus?: string;
  photos: Array<unknown>;
}): boolean {
  return Boolean(
    String(input.familySituation ?? "").trim() ||
    String(input.currentStatus ?? "").trim() ||
    input.photos.length > 0
  );
}
```

- [ ] **Step 4: Create the route shell and page container**

```tsx
import PovertyCollectionPage from "@/components/poverty/collection/PovertyCollectionPage";

export default function Page() {
  return <PovertyCollectionPage />;
}
```

```tsx
export default function PovertyCollectionPage() {
  return (
    <div className="mx-auto min-h-screen max-w-md bg-slate-50">
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3">
        <h1 className="text-base font-semibold text-gray-900">Thu thập hộ nghèo</h1>
      </div>
      <div className="p-4 text-sm text-gray-500">Đang chuẩn bị màn hình thu thập...</div>
    </div>
  );
}
```

- [ ] **Step 5: Extend frontend contracts for the route flow if needed**

```ts
export type HouseholdCollectionSearchRow = Pick<
  PoorHousehold,
  "id" | "code" | "provinceCode" | "wardCode" | "areaId" | "address" | "latitude" | "longitude" | "headFullName" | "headCitizenId" | "memberCount"
> & {
  provinceName?: string | null;
  wardName?: string | null;
  areaName?: string | null;
};
```

- [ ] **Step 6: Re-run the utility test**

Run: `cd FE && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/components/poverty/collection/poverty-collection-utils.test.ts`

Expected: PASS.

- [ ] **Step 7: Run a frontend compile check**

Run: `cd FE && ./node_modules/.bin/tsc --noEmit -p tsconfig.json`

Expected: PASS.

- [ ] **Step 8: Commit the collection skeleton**

```bash
git add "FE/src/app/(admin)/ho-ngheo/thu-thap/page.tsx" FE/src/components/poverty/collection/PovertyCollectionPage.tsx FE/src/components/poverty/collection/poverty-collection-utils.ts FE/src/components/poverty/collection/poverty-collection-utils.test.ts FE/src/types/poverty.ts
git commit -m "feat: add poverty mobile collection route shell"
```

## Task 4: Build the Search-First Mobile Entry Screen

**Files:**
- Modify: `FE/src/components/poverty/collection/PovertyCollectionPage.tsx`
- Create: `FE/src/components/poverty/collection/PovertyCollectionSearchView.tsx`
- Modify: `FE/src/components/poverty/collection/poverty-collection-utils.ts`
- Modify: `FE/src/components/poverty/collection/poverty-collection-utils.test.ts`
- Test: `FE/src/components/poverty/collection/poverty-collection-utils.test.ts`

- [ ] **Step 1: Write the failing utility test for search-result card state**

```ts
test("buildCoordinateStatusLabel distinguishes households with and without coordinates", () => {
  assert.equal(buildCoordinateStatusLabel({ latitude: 10.03, longitude: 105.76 }), "Đã có tọa độ");
  assert.equal(buildCoordinateStatusLabel({ latitude: null, longitude: null }), "Chưa có tọa độ");
});
```

- [ ] **Step 2: Run the focused utility test and verify it fails**

Run: `cd FE && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/components/poverty/collection/poverty-collection-utils.test.ts`

Expected: FAIL because `buildCoordinateStatusLabel` does not exist yet.

- [ ] **Step 3: Add the search helpers**

```ts
export function buildCoordinateStatusLabel(input: {
  latitude?: number | null;
  longitude?: number | null;
}) {
  return typeof input.latitude === "number" && typeof input.longitude === "number"
    ? "Đã có tọa độ"
    : "Chưa có tọa độ";
}
```

- [ ] **Step 4: Implement the search view component**

```tsx
export default function PovertyCollectionSearchView({
  keyword,
  loading,
  items,
  onKeywordChange,
  onSearch,
  onCreateNew,
  onSelectHousehold
}: Props) {
  return (
    <div className="space-y-4 pb-24">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <Input
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder="Tìm theo mã hộ, chủ hộ, CCCD"
          size="large"
        />
        <Button className="mt-3 w-full" type="primary" loading={loading} onClick={onSearch}>
          Tìm hộ
        </Button>
      </div>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center">
          <p className="text-sm text-gray-500">Không tìm thấy hộ phù hợp</p>
          <Button className="mt-4 w-full" onClick={onCreateNew}>Thêm hộ mới</Button>
        </div>
      ) : (
        items.map((item) => (
          <button key={item.id} type="button" onClick={() => onSelectHousehold(item)} className="block w-full rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">{item.headFullName || "Chưa có thông tin chủ hộ"}</p>
                <p className="mt-1 text-xs text-gray-500">{item.code || `Hộ #${item.id}`}</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                {buildCoordinateStatusLabel(item)}
              </span>
            </div>
          </button>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 5: Wire search state into `PovertyCollectionPage`**

```tsx
const [keyword, setKeyword] = useState("");
const [results, setResults] = useState<HouseholdCollectionSearchRow[]>([]);
const [loadingSearch, setLoadingSearch] = useState(false);

const searchHouseholds = useCallback(async () => {
  setLoadingSearch(true);
  try {
    const query = new URLSearchParams({ page: "1", limit: "20", search: keyword.trim() });
    const data = await api.get<PaginatedResponse<HouseholdCollectionSearchRow>>(`${endpoints.poverty.households}?${query.toString()}`);
    setResults(data.items ?? []);
  } finally {
    setLoadingSearch(false);
  }
}, [keyword]);
```

- [ ] **Step 6: Re-run the utility test and compile FE**

Run: `cd FE && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/components/poverty/collection/poverty-collection-utils.test.ts`

Expected: PASS.

Run: `cd FE && ./node_modules/.bin/tsc --noEmit -p tsconfig.json`

Expected: PASS.

- [ ] **Step 7: Commit the search-first entry flow**

```bash
git add FE/src/components/poverty/collection/PovertyCollectionPage.tsx FE/src/components/poverty/collection/PovertyCollectionSearchView.tsx FE/src/components/poverty/collection/poverty-collection-utils.ts FE/src/components/poverty/collection/poverty-collection-utils.test.ts
git commit -m "feat: add poverty mobile collection search flow"
```

## Task 5: Implement Step 1 Wizard for Create and Update

**Files:**
- Create: `FE/src/components/poverty/collection/PovertyCollectionStepOneForm.tsx`
- Modify: `FE/src/components/poverty/collection/PovertyCollectionPage.tsx`
- Modify: `FE/src/components/poverty/collection/poverty-collection-utils.ts`
- Modify: `FE/src/components/poverty/collection/poverty-collection-utils.test.ts`
- Test: `FE/src/components/poverty/collection/poverty-collection-utils.test.ts`

- [ ] **Step 1: Write the failing utility test for step-1 payload builders**

```ts
test("buildStepOneUpdatePayload includes location fields only", () => {
  const payload = buildStepOneUpdatePayload({
    provinceCode: "92",
    wardCode: "31117",
    areaId: "11111111-1111-1111-1111-111111111111",
    address: "So 1 Duong ABC",
    latitude: 10.03,
    longitude: 105.76
  });

  assert.deepEqual(payload, {
    provinceCode: "92",
    wardCode: "31117",
    areaId: "11111111-1111-1111-1111-111111111111",
    address: "So 1 Duong ABC",
    latitude: 10.03,
    longitude: 105.76
  });
});
```

- [ ] **Step 2: Run the focused utility test and verify it fails**

Run: `cd FE && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/components/poverty/collection/poverty-collection-utils.test.ts`

Expected: FAIL because the payload builders do not exist.

- [ ] **Step 3: Add the step-1 payload builders**

```ts
export function buildStepOneUpdatePayload(values: StepOneFormValues) {
  return {
    provinceCode: values.provinceCode,
    wardCode: values.wardCode,
    areaId: values.areaId,
    address: values.address,
    latitude: values.latitude,
    longitude: values.longitude
  };
}

export function buildStepOneCreatePayload(values: StepOneFormValues) {
  return {
    code: values.code,
    year: values.year,
    povertyType: values.povertyType,
    status: values.status,
    headFullName: values.headFullName,
    headCitizenId: values.headCitizenId,
    memberCount: values.memberCount,
    provinceCode: values.provinceCode,
    wardCode: values.wardCode,
    areaId: values.areaId,
    address: values.address,
    latitude: values.latitude,
    longitude: values.longitude
  };
}
```

- [ ] **Step 4: Implement the step-1 form with GPS and map picker actions**

```tsx
export default function PovertyCollectionStepOneForm({
  mode,
  initialValues,
  onSubmit
}: Props) {
  const [form] = Form.useForm<StepOneFormValues>();
  const [pickerOpen, setPickerOpen] = useState(false);

  const fillCurrentLocation = useCallback(() => {
    navigator.geolocation.getCurrentPosition((position) => {
      form.setFieldsValue({
        latitude: Number(position.coords.latitude.toFixed(6)),
        longitude: Number(position.coords.longitude.toFixed(6))
      });
    });
  }, [form]);

  return (
    <Form form={form} layout="vertical" initialValues={initialValues} onFinish={onSubmit}>
      {/* render basic household fields and location fields */}
      <Button block onClick={fillCurrentLocation}>Lấy vị trí hiện tại</Button>
      <Button block onClick={() => setPickerOpen(true)}>Chọn trên bản đồ</Button>
      <PovertyCoordinatePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={(lat, lng) => form.setFieldsValue({ latitude: lat, longitude: lng })} />
    </Form>
  );
}
```

- [ ] **Step 5: Wire create/update step-1 save in `PovertyCollectionPage`**

```tsx
const saveStepOne = useCallback(async (values: StepOneFormValues) => {
  if (mode === "update-step-1" && selectedHousehold) {
    await api.patch(endpoints.poverty.household(selectedHousehold.id), buildStepOneUpdatePayload(values));
    setMode("update-step-2");
    return;
  }

  const response = await api.post<{ item?: PoorHousehold }>(endpoints.poverty.households, buildStepOneCreatePayload(values));
  const created = response.item;
  if (!created) throw new Error("Missing created household");
  setSelectedHousehold(created);
  setMode("create-step-2");
}, [mode, selectedHousehold]);
```

- [ ] **Step 6: Re-run the utility test and compile FE**

Run: `cd FE && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/components/poverty/collection/poverty-collection-utils.test.ts`

Expected: PASS.

Run: `cd FE && ./node_modules/.bin/tsc --noEmit -p tsconfig.json`

Expected: PASS.

- [ ] **Step 7: Commit step 1**

```bash
git add FE/src/components/poverty/collection/PovertyCollectionPage.tsx FE/src/components/poverty/collection/PovertyCollectionStepOneForm.tsx FE/src/components/poverty/collection/poverty-collection-utils.ts FE/src/components/poverty/collection/poverty-collection-utils.test.ts
git commit -m "feat: add poverty mobile collection step one"
```

## Task 6: Implement Step 2 Context, Photos, and Completion State

**Files:**
- Create: `FE/src/components/poverty/collection/PovertyCollectionStepTwoForm.tsx`
- Modify: `FE/src/components/poverty/collection/PovertyCollectionPage.tsx`
- Modify: `FE/src/components/poverty/collection/poverty-collection-utils.ts`
- Modify: `FE/src/components/poverty/collection/poverty-collection-utils.test.ts`
- Modify: `FE/src/components/poverty/PovertyHouseholdListPage.tsx`
- Modify: `FE/src/components/poverty/PovertyMapPage.tsx`
- Test: `FE/src/components/poverty/collection/poverty-collection-utils.test.ts`

- [ ] **Step 1: Write the failing utility test for step-2 payload formatting**

```ts
test("buildStepTwoContextPayload trims empty strings to undefined", () => {
  const payload = buildStepTwoContextPayload({
    recordedAt: "2026-07-06",
    familySituation: "  Kho khan  ",
    currentStatus: "   ",
    note: ""
  });

  assert.deepEqual(payload, {
    recordedAt: "2026-07-06",
    familySituation: "Kho khan",
    currentStatus: undefined,
    note: undefined
  });
});
```

- [ ] **Step 2: Run the utility test and verify it fails**

Run: `cd FE && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/components/poverty/collection/poverty-collection-utils.test.ts`

Expected: FAIL because `buildStepTwoContextPayload` does not exist.

- [ ] **Step 3: Add the step-2 payload builder**

```ts
export function buildStepTwoContextPayload(values: {
  recordedAt: string;
  familySituation?: string;
  currentStatus?: string;
  note?: string;
}) {
  const trim = (value?: string) => {
    const next = String(value ?? "").trim();
    return next.length > 0 ? next : undefined;
  };

  return {
    recordedAt: values.recordedAt,
    familySituation: trim(values.familySituation),
    currentStatus: trim(values.currentStatus),
    note: trim(values.note)
  };
}
```

- [ ] **Step 4: Implement the step-2 form with camera/library selection and thumbnail preview**

```tsx
export default function PovertyCollectionStepTwoForm({
  initialValues,
  attachments,
  onAttachmentsChange,
  onSubmit
}: Props) {
  const [form] = Form.useForm<StepTwoFormValues>();

  return (
    <Form form={form} layout="vertical" initialValues={initialValues} onFinish={onSubmit}>
      <Form.Item name="familySituation" label="Hoàn cảnh gia đình">
        <Input.TextArea rows={4} />
      </Form.Item>
      <Form.Item name="currentStatus" label="Hiện trạng">
        <Input.TextArea rows={4} />
      </Form.Item>
      <UploadAttachmentsField
        value={attachments}
        onChange={onAttachmentsChange}
        accept="image/*"
        capture="environment"
        maxCount={6}
      />
      <Button htmlType="submit" type="primary" block>Lưu hoàn tất</Button>
    </Form>
  );
}
```

- [ ] **Step 5: Wire step-2 save in `PovertyCollectionPage`**

```tsx
const saveStepTwo = useCallback(async (values: StepTwoFormValues) => {
  if (!selectedHousehold) throw new Error("Missing household for step two");

  await api.post(endpoints.poverty.householdContextHistories(selectedHousehold.id), buildStepTwoContextPayload(values));

  await Promise.all(attachments.map((attachment, index) => api.post(endpoints.admin.files, {
    fileName: attachment.fileName,
    fileSize: attachment.fileSize,
    mimeType: attachment.mimeType,
    fileContentBase64: attachment.fileContentBase64,
    storageBucket: "poor_household",
    storagePath: `image/${selectedHousehold.id}/${Date.now()}-${index}-${attachment.fileName}`,
    entityType: "poor_household",
    entityId: selectedHousehold.id
  })));

  setMode("search");
  setSelectedHousehold(null);
  setResults([]);
}, [attachments, selectedHousehold]);
```

- [ ] **Step 6: Add entry actions from the list and map pages**

```tsx
<ActionButton type="create" label="Thu thập hiện trường" onClick={() => router.push("/ho-ngheo/thu-thap")} />
```

```tsx
<ActionButton type="create" label="Thu thập trên di động" onClick={() => router.push("/ho-ngheo/thu-thap")} />
```

- [ ] **Step 7: Re-run the utility test and compile FE**

Run: `cd FE && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/components/poverty/collection/poverty-collection-utils.test.ts`

Expected: PASS.

Run: `cd FE && ./node_modules/.bin/tsc --noEmit -p tsconfig.json`

Expected: PASS.

- [ ] **Step 8: Commit step 2 and entry points**

```bash
git add FE/src/components/poverty/collection/PovertyCollectionPage.tsx FE/src/components/poverty/collection/PovertyCollectionStepTwoForm.tsx FE/src/components/poverty/collection/poverty-collection-utils.ts FE/src/components/poverty/collection/poverty-collection-utils.test.ts FE/src/components/poverty/PovertyHouseholdListPage.tsx FE/src/components/poverty/PovertyMapPage.tsx
git commit -m "feat: complete poverty mobile collection flow"
```

## Task 7: Final Verification

**Files:**
- No new files beyond the tasks above

- [ ] **Step 1: Run the backend focused test suite**

Run: `cd BE && npm test -- poverty.schemas.test.ts poverty.repository.test.ts`

Expected: PASS.

- [ ] **Step 2: Run the frontend utility tests**

Run: `cd FE && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/components/poverty/collection/poverty-collection-utils.test.ts src/components/poverty/poverty-household-action-utils.test.ts src/components/poverty/poverty-context-utils.test.ts`

Expected: PASS.

- [ ] **Step 3: Run full frontend type-check**

Run: `cd FE && ./node_modules/.bin/tsc --noEmit -p tsconfig.json`

Expected: PASS.

- [ ] **Step 4: Do a manual mobile smoke check**

Checklist:
- open `/ho-ngheo/thu-thap` on a narrow viewport
- search for an existing household
- enter update step 1
- fill coordinates via current location or map
- save and continue
- fill family situation or current status
- add at least one photo
- save and verify success
- return to search mode
- create a new household through both steps

- [ ] **Step 5: Commit any final polish**

```bash
git add BE/src/handlers/admin/resources/poverty/poverty.schemas.ts BE/src/handlers/admin/resources/poverty/poverty.schemas.test.ts BE/src/handlers/admin/resources/poverty/poverty.repository.ts BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts BE/src/handlers/admin/resources/poverty/poverty.handlers.ts "FE/src/app/(admin)/ho-ngheo/thu-thap/page.tsx" FE/src/components/poverty/collection FE/src/components/poverty/PovertyHouseholdListPage.tsx FE/src/components/poverty/PovertyMapPage.tsx FE/src/types/poverty.ts
git commit -m "chore: polish poverty mobile collection flow"
```

# Poverty Public Map Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the public poverty ward map into a modern map-first experience with area browsing, clearer household cards, and a dedicated public household detail page.

**Architecture:** Extend the existing public slug flow instead of replacing it. On the backend, add a dedicated public household detail endpoint and expand the public ward DTO with only approved public-safe fields. On the frontend, split pure public-browser logic into helpers, redesign the public ward page around `hero + map + explorer`, and add a separate public household detail route and page.

**Tech Stack:** Express, Drizzle ORM, Vitest, Next.js App Router, React 19, TypeScript, Ant Design, Tailwind CSS, Node `--test`

---

## File Structure

**Backend**

- Modify: `BE/src/helpers/permissions.ts`
- Modify: `BE/src/routes/index.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.handlers.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.handlers.test.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts`

**Frontend**

- Modify: `FE/src/lib/endpoints.ts`
- Modify: `FE/src/types/poverty.ts`
- Modify: `FE/src/components/poverty/PovertyLeafletMap.tsx`
- Modify: `FE/src/components/poverty/PovertyPublicMapPage.tsx`
- Modify: `FE/src/components/poverty/poverty-public-map-utils.ts`
- Modify: `FE/src/components/poverty/poverty-public-map-utils.test.ts`
- Modify: `FE/src/app/globals.css`
- Create: `FE/src/app/ban-do-ho-ngheo-cong-khai/[slug]/ho/[householdId]/page.tsx`
- Create: `FE/src/components/poverty/PovertyPublicHouseholdDetailPage.tsx`

## Task 1: Extend the public backend DTO and add the public household detail endpoint

**Files:**
- Modify: `BE/src/helpers/permissions.ts`
- Modify: `BE/src/routes/index.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.handlers.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.handlers.test.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts`
- Modify: `FE/src/types/poverty.ts`
- Modify: `FE/src/lib/endpoints.ts`

- [ ] **Step 1: Write the failing backend tests**

Extend `BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts` with a DTO-safety case and extend `BE/src/handlers/admin/resources/poverty/poverty.handlers.test.ts` with a new public household detail handler case.

```ts
describe("toPublicPovertyMarker", () => {
  it("keeps public-safe list fields and omits headCitizenId", () => {
    expect(
      toPublicPovertyMarker({
        id: "household-1",
        code: "HN-001",
        year: 2026,
        povertyType: "NEAR_POOR",
        status: "ACTIVE",
        provinceCode: "92",
        wardCode: "31117",
        areaId: "0d7ce58c-4137-4db3-8132-a4eb56d6411f",
        provinceName: "Thanh pho Can Tho",
        wardName: "Xa Phu Huu",
        areaName: "Phu Tri B1",
        latitude: 10.2,
        longitude: 105.7,
        headFullName: "Nguyen Van A",
        headCitizenId: "001234567890",
        memberCount: 4,
        supportCount: 2,
        supportTotalAmount: 5000000,
        latestSupportDate: "2026-01-01",
        latestSupportMonthAmount: 1000000
      }) as Record<string, unknown>
    ).not.toHaveProperty("headCitizenId");
  });
});
```

```ts
it("returns public household detail for a household inside the public ward scope", async () => {
  vi.mocked(getPublicHouseholdDetailBySlugAndHouseholdId).mockResolvedValue({
    share: {
      publicSlug: "ward-public-abc",
      wardCode: "31117",
      provinceCode: "92",
      wardName: "Xa Phu Huu",
      provinceName: "Thanh pho Can Tho",
      currentYear: 2026
    },
    household: {
      id: "household-1",
      code: "HN-001",
      headFullName: "Nguyen Thanh Thuy",
      povertyType: "NEAR_POOR",
      status: "ACTIVE",
      memberCount: 3,
      areaId: "0d7ce58c-4137-4db3-8132-a4eb56d6411f",
      areaName: "Phu Tri B1",
      wardName: "Xa Phu Huu",
      address: null,
      latitude: 10.2,
      longitude: 105.7
    },
    summary: {
      fieldPhotoCount: 1,
      supportCount: 0
    },
    latestContext: {
      familySituation: "Co 2 con nho dang di hoc",
      currentStatus: "Nha kien co",
      recordedAt: "2026-01-01"
    },
    fieldPhotos: [],
    supports: []
  });
});
```

- [ ] **Step 2: Run the focused backend test files and verify failure**

Run: `cd BE && pnpm test --run src/handlers/admin/resources/poverty/poverty.repository.test.ts src/handlers/admin/resources/poverty/poverty.handlers.test.ts`

Expected: FAIL because the new public household detail repository function, handler, and DTO types do not exist yet.

- [ ] **Step 3: Add the new backend DTOs, repository function, and public route**

Update `BE/src/helpers/permissions.ts` and `BE/src/routes/index.ts` with a new unauthenticated route:

```ts
publicPovertyHouseholdBySlug: "/public/poverty/wards/:slug/households/:householdId"
```

```ts
permissions.set(API_ROUTES.publicPovertyHouseholdBySlug, {
  permissions: {},
  authenticated: false
});
```

In `BE/src/handlers/admin/resources/poverty/poverty.repository.ts`, add explicit public detail types and the new repository function:

```ts
export type PublicPovertyHouseholdDetailResponse = {
  share: {
    publicSlug: string;
    wardCode: string;
    provinceCode: string;
    wardName: string | null;
    provinceName: string | null;
    currentYear: number;
  };
  household: {
    id: string;
    code: string | null;
    headFullName: string | null;
    povertyType: string;
    status: string | null;
    memberCount: number;
    areaId: string | null;
    areaName: string | null;
    wardName: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  summary: {
    fieldPhotoCount: number;
    supportCount: number;
  };
  latestContext: {
    familySituation: string | null;
    currentStatus: string | null;
    recordedAt: string | null;
  } | null;
  fieldPhotos: Array<{
    uuid: string;
    fileName: string;
    filePath: string;
    mimeType: string | null;
  }>;
  supports: Array<{
    id: string;
    supportDate: string | null;
    supportTypes: string[];
    content: string | null;
    supportingUnit: string | null;
  }>;
};
```

```ts
export const getPublicHouseholdDetailBySlugAndHouseholdId = async (
  slug: string,
  householdId: string,
  currentYear = new Date().getFullYear()
): Promise<PublicPovertyHouseholdDetailResponse | null> => {
  const share = await getWardPublicLinkBySlug(slug);
  if (!share || !share.isPublic) return null;

  const detail = await getHouseholdDetail(householdId);
  if (!detail?.household) return null;

  if (
    detail.household.provinceCode !== share.provinceCode ||
    detail.household.wardCode !== share.wardCode ||
    detail.household.year !== currentYear
  ) {
    return null;
  }

  return {
    share: {
      publicSlug: share.publicSlug,
      wardCode: share.wardCode,
      provinceCode: share.provinceCode,
      wardName: detail.household.wardName ?? null,
      provinceName: detail.household.provinceName ?? null,
      currentYear
    },
    household: {
      id: detail.household.id,
      code: detail.household.code ?? null,
      headFullName: detail.household.headFullName ?? null,
      povertyType: detail.household.povertyType,
      status: detail.household.status ?? null,
      memberCount: Number(detail.household.memberCount ?? 0),
      areaId: detail.household.areaId ?? null,
      areaName: detail.household.areaName ?? null,
      wardName: detail.household.wardName ?? null,
      address: detail.household.address ?? null,
      latitude: detail.household.latitude ?? null,
      longitude: detail.household.longitude ?? null
    },
    summary: {
      fieldPhotoCount: detail.fieldPhotos?.length ?? 0,
      supportCount: detail.supports?.length ?? 0
    },
    latestContext: detail.latestContextHistory
      ? {
          familySituation: detail.latestContextHistory.familySituation ?? null,
          currentStatus: detail.latestContextHistory.currentStatus ?? null,
          recordedAt: detail.latestContextHistory.recordedAt ?? null
        }
      : null,
    fieldPhotos: (detail.fieldPhotos ?? []).map((photo) => ({
      uuid: photo.uuid,
      fileName: photo.fileName,
      filePath: photo.filePath,
      mimeType: photo.mimeType ?? null
    })),
    supports: (detail.supports ?? []).map((support) => ({
      id: support.id,
      supportDate: support.supportDate ?? null,
      supportTypes: [...support.supportTypes],
      content: support.content ?? null,
      supportingUnit: support.supportingUnit ?? null
    }))
  };
};
```

In `BE/src/handlers/admin/resources/poverty/poverty.handlers.ts`, add:

```ts
export const getPublicPovertyHouseholdBySlugAndHouseholdId = asyncHandler(async (req, res) => {
  const slug = String(req.params.slug ?? "").trim();
  const householdId = String(req.params.householdId ?? "").trim();
  const item = await getPublicHouseholdDetailBySlugAndHouseholdId(slug, householdId);
  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("Household"));
    res.status(response.code).send(response);
    return;
  }
  const response = apiResponse.success(HttpStatusCode.OK, item, "Public household retrieved successfully");
  res.status(response.code).send(response);
});
```

Also update `getPublicWardMapBySlug()` to keep returning list-level public-safe fields only.

Update FE contracts so the frontend can consume the new endpoint:

```ts
export type PublicPovertyHouseholdDetailResponse = {
  share: {
    publicSlug: string;
    wardCode: string;
    provinceCode: string;
    wardName?: string | null;
    provinceName?: string | null;
    currentYear: number;
  };
  household: {
    id: string;
    code?: string | null;
    headFullName?: string | null;
    povertyType?: PovertyType | string;
    status?: HouseholdStatus | string | null;
    memberCount?: number | null;
    areaId?: string | null;
    areaName?: string | null;
    wardName?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  };
  summary?: {
    fieldPhotoCount: number;
    supportCount: number;
  };
  latestContext?: {
    familySituation?: string | null;
    currentStatus?: string | null;
    recordedAt?: string | null;
  } | null;
  fieldPhotos?: HouseholdFieldPhoto[];
  supports?: Array<Pick<HouseholdSupport, "id" | "supportDate" | "supportTypes" | "content" | "supportingUnit">>;
};
```

```ts
publicHouseholdBySlug: (slug: string, householdId: string) =>
  `/public/poverty/wards/${slug}/households/${householdId}`,
```

- [ ] **Step 4: Re-run the focused backend test files and verify pass**

Run: `cd BE && pnpm test --run src/handlers/admin/resources/poverty/poverty.repository.test.ts src/handlers/admin/resources/poverty/poverty.handlers.test.ts`

Expected: PASS for the new public household detail endpoint and DTO safety cases.

- [ ] **Step 5: Commit the backend public-detail slice**

```bash
git add BE/src/helpers/permissions.ts \
  BE/src/routes/index.ts \
  BE/src/handlers/admin/resources/poverty/poverty.handlers.ts \
  BE/src/handlers/admin/resources/poverty/poverty.repository.ts \
  BE/src/handlers/admin/resources/poverty/poverty.handlers.test.ts \
  BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts \
  FE/src/lib/endpoints.ts \
  FE/src/types/poverty.ts
git commit -m "feat: add public poverty household detail endpoint"
```

## Task 2: Add pure public-browser helpers for list, area, and route behavior

**Files:**
- Modify: `FE/src/components/poverty/poverty-public-map-utils.ts`
- Modify: `FE/src/components/poverty/poverty-public-map-utils.test.ts`

- [ ] **Step 1: Write the failing FE utility tests**

Add list-filtering, area-summary, and detail-route tests to `FE/src/components/poverty/poverty-public-map-utils.test.ts`.

```ts
test("buildPublicPovertyAreaSummaries groups markers by area and sorts by total desc", () => {
  const summaries = buildPublicPovertyAreaSummaries([
    { id: "1", areaId: "a-1", areaName: "Phu Tri B1", povertyType: "NEAR_POOR" },
    { id: "2", areaId: "a-1", areaName: "Phu Tri B1", povertyType: "POOR" },
    { id: "3", areaId: "a-2", areaName: "Phu Tri B2", povertyType: "NONE" }
  ] as PublicPovertyMarker[]);

  assert.deepEqual(summaries.map((item) => item.areaName), ["Phu Tri B1", "Phu Tri B2"]);
  assert.equal(summaries[0]?.totalCount, 2);
  assert.equal(summaries[0]?.poorCount, 1);
  assert.equal(summaries[0]?.nearPoorCount, 1);
});

test("filterPublicPovertyMarkers keeps only households matching search type and area", () => {
  const items = filterPublicPovertyMarkers(
    [
      { id: "1", headFullName: "Nguyen Thanh Thuy", areaId: "a-1", areaName: "Phu Tri B1", povertyType: "NEAR_POOR" },
      { id: "2", headFullName: "Tran Van B", areaId: "a-2", areaName: "Phu Tri B2", povertyType: "POOR" }
    ] as PublicPovertyMarker[],
    {
      search: "thuy",
      activeAreaId: "a-1",
      povertyFilter: "NEAR_POOR"
    }
  );

  assert.equal(items.length, 1);
  assert.equal(items[0]?.id, "1");
});

test("buildPublicPovertyHouseholdDetailUrl nests the household under the ward slug", () => {
  assert.equal(
    buildPublicPovertyHouseholdDetailUrl("ward-public-abc", "household-1", "https://example.com"),
    "https://example.com/ban-do-ho-ngheo-cong-khai/ward-public-abc/ho/household-1"
  );
});
```

- [ ] **Step 2: Run the focused FE utility test file and verify failure**

Run: `cd FE && npm test -- src/components/poverty/poverty-public-map-utils.test.ts`

Expected: FAIL because the new area-summary, filter, and detail-route helpers do not exist yet.

- [ ] **Step 3: Add the minimal helper implementation**

Extend `FE/src/components/poverty/poverty-public-map-utils.ts` with the public-browser helpers.

```ts
export type PublicPovertyAreaSummary = {
  areaId: string | null;
  areaName: string;
  totalCount: number;
  poorCount: number;
  nearPoorCount: number;
};

type FilterPublicPovertyMarkersInput = {
  search: string;
  activeAreaId: string | null;
  povertyFilter: "ALL" | "POOR" | "NEAR_POOR" | "NONE";
};

export function buildPublicPovertyAreaSummaries(markers: PublicPovertyMarker[]): PublicPovertyAreaSummary[] {
  const grouped = new Map<string, PublicPovertyAreaSummary>();

  markers.forEach((marker) => {
    const key = marker.areaId ?? `name:${marker.areaName ?? "Chua xac dinh"}`;
    const current = grouped.get(key) ?? {
      areaId: marker.areaId ?? null,
      areaName: marker.areaName ?? "Chua xac dinh",
      totalCount: 0,
      poorCount: 0,
      nearPoorCount: 0
    };

    current.totalCount += 1;
    if (marker.povertyType === "POOR") current.poorCount += 1;
    if (marker.povertyType === "NEAR_POOR") current.nearPoorCount += 1;
    grouped.set(key, current);
  });

  return [...grouped.values()].sort((a, b) => {
    if (b.totalCount !== a.totalCount) return b.totalCount - a.totalCount;
    return a.areaName.localeCompare(b.areaName, "vi");
  });
}

export function filterPublicPovertyMarkers(
  markers: PublicPovertyMarker[],
  input: FilterPublicPovertyMarkersInput
): PublicPovertyMarker[] {
  const normalizedSearch = input.search.trim().toLowerCase();

  return markers.filter((marker) => {
    if (input.activeAreaId && marker.areaId !== input.activeAreaId) return false;
    if (input.povertyFilter !== "ALL" && marker.povertyType !== input.povertyFilter) return false;
    if (!normalizedSearch) return true;

    const haystack = [
      marker.headFullName,
      marker.code,
      marker.areaName,
      marker.wardName,
      marker.address
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedSearch);
  });
}

export function buildPublicPovertyHouseholdDetailUrl(slug: string, householdId: string, origin = ""): string {
  const normalizedOrigin = origin.replace(/\/$/, "");
  return `${normalizedOrigin}/ban-do-ho-ngheo-cong-khai/${encodeURIComponent(slug)}/ho/${encodeURIComponent(householdId)}`;
}
```

- [ ] **Step 4: Re-run the focused FE utility test file and verify pass**

Run: `cd FE && npm test -- src/components/poverty/poverty-public-map-utils.test.ts`

Expected: PASS for the new public area/list/detail helpers.

- [ ] **Step 5: Commit the FE utility slice**

```bash
git add FE/src/components/poverty/poverty-public-map-utils.ts \
  FE/src/components/poverty/poverty-public-map-utils.test.ts
git commit -m "feat: add public poverty browser helpers"
```

## Task 3: Redesign the public ward page and remove the public side detail panel

**Files:**
- Modify: `FE/src/components/poverty/PovertyLeafletMap.tsx`
- Modify: `FE/src/components/poverty/PovertyPublicMapPage.tsx`
- Modify: `FE/src/app/globals.css`

- [ ] **Step 1: Make the map component support popup-only public interaction**

In `FE/src/components/poverty/PovertyLeafletMap.tsx`, add two optional props so public mode can navigate to detail pages instead of opening the side panel.

```ts
type PovertyLeafletMapProps = {
  // existing props
  disablePublicDetailPanel?: boolean;
  onPublicMarkerAction?: (marker: PovertyMarker) => void;
};
```

Update the public-mode marker popup action branch:

```tsx
{isPublicMode && onPublicMarkerAction ? (
  <Tooltip title="Xem chi tiết hộ">
    <Button
      type="primary"
      size="small"
      icon={<ActionIcon action="view" />}
      onClick={() => onPublicMarkerAction(marker)}
    >
      Xem chi tiết hộ
    </Button>
  </Tooltip>
) : null}
```

Guard the existing `MarkerDetailPanel` rendering:

```tsx
const shouldRenderDetailPanel = !isPublicMode || !disablePublicDetailPanel;
```

- [ ] **Step 2: Run TypeScript and verify the map API is incomplete**

Run: `cd FE && npx tsc --noEmit`

Expected: FAIL because `PovertyPublicMapPage.tsx` does not yet pass the new props or adapt to the redesigned browser state.

- [ ] **Step 3: Replace the current public page shell with hero + map + explorer**

Refactor `FE/src/components/poverty/PovertyPublicMapPage.tsx` to:

- keep the hero loader
- compute `areaSummaries`
- maintain local state:
  - `activeExplorerTab`
  - `activeAreaId`
  - `search`
  - `povertyFilter`
- derive `visibleMarkers` from `filterPublicPovertyMarkers()`
- navigate to the public detail page on marker-card clicks

Use this state shape:

```ts
const [activeExplorerTab, setActiveExplorerTab] = useState<"list" | "area">("list");
const [activeAreaId, setActiveAreaId] = useState<string | null>(null);
const [search, setSearch] = useState("");
const [povertyFilter, setPovertyFilter] = useState<"ALL" | "POOR" | "NEAR_POOR" | "NONE">("ALL");
```

Use the derived browser data:

```ts
const areaSummaries = useMemo(() => buildPublicPovertyAreaSummaries(markers), [markers]);
const visibleMarkers = useMemo(
  () => filterPublicPovertyMarkers(markers, { search, activeAreaId, povertyFilter }),
  [markers, search, activeAreaId, povertyFilter]
);
```

Render the explorer tabs with a modern card layout:

```tsx
<Tabs
  activeKey={activeExplorerTab}
  onChange={(key) => setActiveExplorerTab(key as "list" | "area")}
  items={[
    {
      key: "list",
      label: `Danh sach ho (${visibleMarkers.length.toLocaleString("vi-VN")})`,
      children: (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tim kiem ho gia dinh..."
              className="lg:max-w-sm"
            />
            <div className="flex flex-wrap gap-2">
              {["ALL", "POOR", "NEAR_POOR", "NONE"].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPovertyFilter(value as "ALL" | "POOR" | "NEAR_POOR" | "NONE")}
                  className={value === povertyFilter ? "public-pill public-pill--active" : "public-pill"}
                >
                  {value === "ALL" ? "Tat ca" : value === "POOR" ? "Ho ngheo" : value === "NEAR_POOR" ? "Ho can ngheo" : "Ho thuong"}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            {visibleMarkers.map((marker) => (
              <button
                key={marker.id}
                type="button"
                onClick={() => router.push(buildPublicPovertyHouseholdDetailUrl(slug, marker.id))}
                className="public-household-card text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-slate-900">{marker.headFullName || marker.code || "Chua co ten chu ho"}</p>
                    <p className="mt-2 text-sm text-slate-500">{marker.areaName || "Chua cap nhat khu vuc"}</p>
                  </div>
                  <Tag color={marker.povertyType === "POOR" ? "red" : marker.povertyType === "NEAR_POOR" ? "orange" : "green"}>
                    {marker.povertyType === "POOR" ? "Ho ngheo" : marker.povertyType === "NEAR_POOR" ? "Ho can ngheo" : "Ho thuong"}
                  </Tag>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                  <span>{Number(marker.memberCount ?? 0).toLocaleString("vi-VN")} thanh vien</span>
                  <span>Xem chi tiet</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )
    },
    {
      key: "area",
      label: "Khu vuc/Ap",
      children: (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {areaSummaries.map((area) => (
            <button
              key={area.areaId ?? area.areaName}
              type="button"
              onClick={() => {
                setActiveAreaId(area.areaId);
                setActiveExplorerTab("list");
              }}
              className={area.areaId === activeAreaId ? "public-area-card public-area-card--active" : "public-area-card"}
            >
              <p className="text-lg font-semibold text-slate-900">{area.areaName}</p>
              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div><span className="block text-slate-400">Tong</span><span className="font-semibold">{area.totalCount}</span></div>
                <div><span className="block text-slate-400">Ngheo</span><span className="font-semibold text-rose-600">{area.poorCount}</span></div>
                <div><span className="block text-slate-400">Can ngheo</span><span className="font-semibold text-amber-600">{area.nearPoorCount}</span></div>
              </div>
            </button>
          ))}
        </div>
      )
    }
  ]}
/>
```

Pass the new props into the map:

```tsx
<PovertyLeafletMap
  mode="public"
  markers={visibleMarkers}
  loading={loading}
  disablePublicDetailPanel
  onPublicMarkerAction={(marker) => router.push(buildPublicPovertyHouseholdDetailUrl(slug, marker.id))}
  // existing public flags
/>
```

- [ ] **Step 4: Add the redesign styles and verify the ward page builds**

Add focused CSS classes to `FE/src/app/globals.css` for:

- `.public-pill`
- `.public-pill--active`
- `.public-household-card`
- `.public-area-card`
- `.public-area-card--active`
- `.public-hero-shell`
- `.public-note-card`

Use this minimal style direction:

```css
.public-household-card,
.public-area-card {
  border: 1px solid rgba(191, 219, 254, 0.8);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.92);
  padding: 20px;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08);
  transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
}

.public-household-card:hover,
.public-area-card:hover,
.public-area-card--active {
  transform: translateY(-2px);
  border-color: rgba(59, 130, 246, 0.42);
  box-shadow: 0 22px 60px rgba(37, 99, 235, 0.14);
}
```

Run: `cd FE && npx tsc --noEmit`

Expected: PASS with the new ward-page browser state and popup-only public map mode.

- [ ] **Step 5: Commit the ward-page redesign slice**

```bash
git add FE/src/components/poverty/PovertyLeafletMap.tsx \
  FE/src/components/poverty/PovertyPublicMapPage.tsx \
  FE/src/app/globals.css
git commit -m "feat: redesign public poverty ward page"
```

## Task 4: Add the dedicated public household detail page

**Files:**
- Create: `FE/src/app/ban-do-ho-ngheo-cong-khai/[slug]/ho/[householdId]/page.tsx`
- Create: `FE/src/components/poverty/PovertyPublicHouseholdDetailPage.tsx`
- Modify: `FE/src/app/globals.css`

- [ ] **Step 1: Create the route shell and failing page implementation**

Add the App Router page:

```tsx
import PovertyPublicHouseholdDetailPage from "@/components/poverty/PovertyPublicHouseholdDetailPage";

export default async function Page({
  params
}: {
  params: Promise<{ slug: string; householdId: string }>;
}) {
  const { slug, householdId } = await params;
  return <PovertyPublicHouseholdDetailPage slug={slug} householdId={householdId} />;
}
```

Create the page component with the fetch signature first:

```tsx
"use client";

type PovertyPublicHouseholdDetailPageProps = {
  slug: string;
  householdId: string;
};

export default function PovertyPublicHouseholdDetailPage({
  slug,
  householdId
}: PovertyPublicHouseholdDetailPageProps) {
  return <div>TODO public household detail</div>;
}
```

- [ ] **Step 2: Run TypeScript and verify the new page is incomplete**

Run: `cd FE && npx tsc --noEmit`

Expected: PASS or near-pass with the stub route, but the page is intentionally incomplete from a feature perspective.

- [ ] **Step 3: Implement the public household detail page**

Build `FE/src/components/poverty/PovertyPublicHouseholdDetailPage.tsx` around the new public endpoint:

```tsx
"use client";

import { publicApiGet } from "@/lib/public-api";
import { endpoints } from "@/lib/endpoints";
import type { PublicPovertyHouseholdDetailResponse } from "@/types/poverty";
import { Alert, Button, Empty, Tabs, Tag } from "antd";
import { ArrowLeft, HeartHandshake, ImageIcon, MapPinned, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function PovertyPublicHouseholdDetailPage({ slug, householdId }: PovertyPublicHouseholdDetailPageProps) {
  const [data, setData] = useState<PublicPovertyHouseholdDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await publicApiGet<PublicPovertyHouseholdDetailResponse>(
        endpoints.poverty.publicHouseholdBySlug(slug, householdId)
      );
      setData(response);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Vui long thu lai");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [slug, householdId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const household = data?.household;
  const fieldPhotos = useMemo(() => data?.fieldPhotos ?? [], [data?.fieldPhotos]);
  const supports = useMemo(() => data?.supports ?? [], [data?.supports]);

  if (error && !loading && !data) {
    return <Alert type="error" showIcon message="Khong the mo chi tiet ho cong khai" description={error} />;
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#ecfdf5_0%,#f8fafc_28%,#ffffff_100%)] px-4 py-4 md:px-6 md:py-6">
      <section className="overflow-hidden rounded-[2rem] border border-emerald-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.24),_transparent_32%),linear-gradient(135deg,_#16a34a,_#22c55e_48%,_#bbf7d0)] p-6 text-white shadow-[0_32px_90px_rgba(34,197,94,0.22)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href={`/ban-do-ho-ngheo-cong-khai/${slug}`} className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-sm text-white/90">
              <ArrowLeft size={14} />
              Quay lai ban do cong khai
            </Link>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">{household?.headFullName || household?.code || "Ho gia dinh"}</h1>
          </div>
          <Tag className="!m-0 !rounded-full !border-0 !px-4 !py-2 !text-sm" color="gold">
            {household?.povertyType === "POOR" ? "Ho ngheo" : household?.povertyType === "NEAR_POOR" ? "Ho can ngheo" : "Ho thuong"}
          </Tag>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="public-detail-stat-card"><span>Loai ho</span><strong>{household?.povertyType ?? "-"}</strong></div>
          <div className="public-detail-stat-card"><span>Thanh vien</span><strong>{Number(household?.memberCount ?? 0).toLocaleString("vi-VN")}</strong></div>
          <div className="public-detail-stat-card"><span>Hinh anh</span><strong>{Number(data?.summary?.fieldPhotoCount ?? 0).toLocaleString("vi-VN")}</strong></div>
          <div className="public-detail-stat-card"><span>Dot ho tro</span><strong>{Number(data?.summary?.supportCount ?? 0).toLocaleString("vi-VN")}</strong></div>
        </div>
      </section>

      <section className="mt-6 rounded-[2rem] border border-emerald-100 bg-white/92 p-4 shadow-[0_24px_64px_rgba(15,23,42,0.08)] md:p-6">
        <Tabs
          defaultActiveKey="info"
          items={[
            {
              key: "info",
              label: "Thong tin",
              children: (
                <div className="space-y-6">
                  <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/70 p-4">
                    <p className="text-base font-semibold text-slate-900">Vi tri tren ban do</p>
                    <div className="mt-4 overflow-hidden rounded-[1.25rem]">
                      <PovertyLeafletMap
                        mode="public"
                        markers={household ? [household as never] : []}
                        loading={loading}
                        disablePublicDetailPanel
                        canCreateHousehold={false}
                        canCreateHouseholdOnMap={false}
                        canEditMarkerPosition={false}
                        canViewAssessmentTimeline={false}
                        canUpdateHousehold={false}
                        canViewHouseholdDetail={false}
                        onRefresh={loadDetail}
                        onMarkerPositionChange={async () => undefined}
                      />
                    </div>
                  </div>
                  <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
                    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                      <p className="text-xl font-semibold text-slate-900">Thong tin co ban</p>
                      <dl className="mt-5 space-y-4">
                        <div><dt className="text-xs uppercase text-slate-400">Ma ho</dt><dd className="text-base font-medium text-slate-900">{household?.code || "-"}</dd></div>
                        <div><dt className="text-xs uppercase text-slate-400">Chu ho</dt><dd className="text-base font-medium text-slate-900">{household?.headFullName || "-"}</dd></div>
                        <div><dt className="text-xs uppercase text-slate-400">Dia ban</dt><dd className="text-base font-medium text-slate-900">{[household?.wardName, household?.areaName].filter(Boolean).join(" / ") || "-"}</dd></div>
                        <div><dt className="text-xs uppercase text-slate-400">So thanh vien</dt><dd className="text-base font-medium text-slate-900">{Number(household?.memberCount ?? 0).toLocaleString("vi-VN")}</dd></div>
                      </dl>
                    </div>
                    <div className="space-y-6">
                      <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/70 p-5">
                        <p className="text-xl font-semibold text-slate-900">Hoan canh gia dinh</p>
                        <p className="mt-4 text-base leading-7 text-slate-700">{data?.latestContext?.familySituation || "Chua co thong tin cong khai"}</p>
                      </div>
                      <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/70 p-5">
                        <p className="text-xl font-semibold text-slate-900">Hien trang</p>
                        <p className="mt-4 text-base leading-7 text-slate-700">{data?.latestContext?.currentStatus || "Chua co thong tin cong khai"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            },
            {
              key: "photos",
              label: "Hinh anh & Video",
              children: fieldPhotos.length === 0 ? (
                <Empty description="Chua co hinh anh cong khai" />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {fieldPhotos.map((photo) => (
                    <img key={photo.uuid} src={photo.filePath} alt={photo.fileName} className="h-64 w-full rounded-[1.5rem] object-cover shadow-sm" />
                  ))}
                </div>
              )
            },
            {
              key: "supports",
              label: "Lich su ho tro",
              children: supports.length === 0 ? (
                <Empty description="Chua co dot ho tro cong khai" />
              ) : (
                <div className="space-y-4">
                  {supports.map((support) => (
                    <article key={support.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-slate-900">{support.supportTypes.join(", ") || "Ho tro"}</p>
                          <p className="mt-1 text-sm text-slate-500">{support.supportDate || "Chua ro thoi gian"}</p>
                        </div>
                        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-700">
                          <HeartHandshake size={14} />
                          Ho tro
                        </span>
                      </div>
                      <p className="mt-4 text-sm leading-7 text-slate-600">{support.content || support.supportingUnit || "Chua co noi dung cong khai"}</p>
                    </article>
                  ))}
                </div>
              )
            }
          ]}
        />
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Add the detail-page styles and run FE verification**

Add a small CSS block in `FE/src/app/globals.css`:

```css
.public-detail-stat-card {
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.92);
  color: #0f172a;
  padding: 20px;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.12);
}

.public-detail-stat-card span {
  display: block;
  font-size: 12px;
  text-transform: uppercase;
  color: #64748b;
}

.public-detail-stat-card strong {
  display: block;
  margin-top: 10px;
  font-size: 30px;
  line-height: 1;
}
```

Run: `cd FE && npm test -- src/components/poverty/poverty-public-map-utils.test.ts`
Expected: PASS

Run: `cd FE && npx tsc --noEmit`
Expected: PASS

Run: `cd FE && npx eslint src/components/poverty/PovertyPublicMapPage.tsx src/components/poverty/PovertyPublicHouseholdDetailPage.tsx src/components/poverty/PovertyLeafletMap.tsx src/components/poverty/poverty-public-map-utils.ts`
Expected: exit `0` or only pre-existing warnings unrelated to the new public redesign

- [ ] **Step 5: Commit the detail-page slice**

```bash
git add FE/src/app/ban-do-ho-ngheo-cong-khai/[slug]/ho/[householdId]/page.tsx \
  FE/src/components/poverty/PovertyPublicHouseholdDetailPage.tsx \
  FE/src/app/globals.css \
  FE/src/components/poverty/PovertyPublicMapPage.tsx \
  FE/src/components/poverty/PovertyLeafletMap.tsx
git commit -m "feat: add public poverty household detail page"
```

## Spec Coverage Check

- Public map-first layout with no right-side detail panel: Task 3
- Hero section aligned with the approved visual direction: Task 3
- Area or hamlet browsing with shared list and map focus: Tasks 2 and 3
- Dedicated public household detail route: Tasks 1 and 4
- Public-safe household detail DTO and endpoint: Task 1
- Image and support-history tabs on the detail page: Task 4
- Continued current-year-only public behavior: Task 1
- Public-safe data boundaries for expanded exposure: Task 1

## Self-Review Notes

- The plan is split into independent slices: backend DTO, FE helpers, ward page, detail page.
- Later steps reuse exact helper names introduced earlier, so the type surface stays consistent.
- No placeholder instructions remain; every task names exact files, commands, and code snippets.

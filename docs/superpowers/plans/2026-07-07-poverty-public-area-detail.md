# Poverty Public Area Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public area-detail route so clicking a `Khu vực/Ấp` card opens a dedicated public page with administrative-geography modal, household list, and a small area-scoped map.

**Architecture:** Extend the existing public-poverty contract end to end: add FE URL builders and response types first, then add a BE public endpoint that resolves `areaSlug` inside a public ward and returns area metadata plus scoped households, and finally build a dedicated FE page and modal that reuse the current public household cards and `PovertyPublicMapStage`. Keep all public-area-specific UI in focused new components so the ward page only changes at the navigation boundary.

**Tech Stack:** Express, TypeScript, Vitest, Next.js 16, React 19, Ant Design, `node:test`, Leaflet

---

## File Structure

- Modify: `FE/src/components/poverty/poverty-public-map-utils.ts`
  Responsibility: build public area URLs and provide deterministic public area-slug helpers for FE navigation.
- Modify: `FE/src/components/poverty/poverty-public-map-utils.test.ts`
  Responsibility: lock in public area URL generation and any FE area slug formatting rules.
- Modify: `FE/src/types/poverty.ts`
  Responsibility: define `PublicPovertyAreaDetailResponse` and nested area metadata types used by FE.
- Modify: `FE/src/lib/endpoints.ts`
  Responsibility: add FE endpoint builder for the new public area-detail API.
- Create: `FE/src/app/ban-do-ho-ngheo-cong-khai/[slug]/khu-vuc/[areaSlug]/page.tsx`
  Responsibility: Next route entrypoint for the new public area-detail page.
- Create: `FE/src/components/poverty/PovertyPublicAreaDetailPage.tsx`
  Responsibility: render hero, stats, note block, household list, map block, and wire modal state plus navigation.
- Create: `FE/src/components/poverty/PovertyPublicAreaAdministrativeModal.tsx`
  Responsibility: render the administrative-geography modal with stable label/value layout.
- Modify: `FE/src/components/poverty/PovertyPublicMapPage.tsx`
  Responsibility: change area-card click behavior from local tab switching to route navigation.
- Modify: `BE/src/helpers/permissions.ts`
  Responsibility: add the new public API route constant and permission entry.
- Modify: `BE/src/routes/index.ts`
  Responsibility: register the new public area-detail route.
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.handlers.ts`
  Responsibility: add the new public handler and map 404/not-found behavior.
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.ts`
  Responsibility: resolve `areaSlug`, load area metadata, summarize households, and return the public area response.
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.handlers.test.ts`
  Responsibility: verify handler behavior for success and not-found cases.
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts`
  Responsibility: verify repository slug resolution, area summary, and scoped household selection.

### Task 1: Extend FE public-poverty utilities, endpoint builders, and types

**Files:**
- Modify: `FE/src/components/poverty/poverty-public-map-utils.ts`
- Modify: `FE/src/components/poverty/poverty-public-map-utils.test.ts`
- Modify: `FE/src/types/poverty.ts`
- Modify: `FE/src/lib/endpoints.ts`

- [ ] **Step 1: Write the failing FE utility tests**

Add these tests to `FE/src/components/poverty/poverty-public-map-utils.test.ts`:

```ts
test("buildPublicPovertyAreaDetailUrl nests the area route under the public ward slug", () => {
    assert.equal(
        buildPublicPovertyAreaDetailUrl("ward-public-abc", "phu-tri-b1--0d7ce58c", "https://example.com"),
        "https://example.com/ban-do-ho-ngheo-cong-khai/ward-public-abc/khu-vuc/phu-tri-b1--0d7ce58c"
    );
});

test("buildPublicAreaSlug creates a readable slug with the shortened area id suffix", () => {
    assert.equal(
        buildPublicAreaSlug("Phu Tri B1", "0d7ce58c-4137-4db3-8132-a4eb56d6411f"),
        "phu-tri-b1--0d7ce58c"
    );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd FE && npm test -- src/components/poverty/poverty-public-map-utils.test.ts`
Expected: FAIL with missing exports `buildPublicPovertyAreaDetailUrl` and `buildPublicAreaSlug`.

- [ ] **Step 3: Write minimal FE utility and type implementation**

Update `FE/src/components/poverty/poverty-public-map-utils.ts` with:

```ts
const slugifyPublicSegment = (value: string): string =>
    value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

export function buildPublicAreaSlug(areaName: string, areaId: string): string {
    const nameSegment = slugifyPublicSegment(areaName || "khu-vuc");
    const suffix = areaId.slice(0, 8).toLowerCase();
    return `${nameSegment || "khu-vuc"}--${suffix}`;
}

export function buildPublicPovertyAreaDetailUrl(slug: string, areaSlug: string, origin = ""): string {
    const normalizedOrigin = origin.replace(/\/$/, "");
    return `${normalizedOrigin}/ban-do-ho-ngheo-cong-khai/${encodeURIComponent(slug)}/khu-vuc/${encodeURIComponent(areaSlug)}`;
}
```

Add the FE endpoint builder in `FE/src/lib/endpoints.ts`:

```ts
publicAreaBySlug: (slug: string, areaSlug: string) => `/public/poverty/wards/${slug}/areas/${areaSlug}`,
```

Add the FE response types in `FE/src/types/poverty.ts`:

```ts
export type PublicPovertyAreaDetailResponse = {
    share: {
        publicSlug: string;
        wardCode: string;
        provinceCode: string;
        wardName?: string | null;
        provinceName?: string | null;
        currentYear: number;
    };
    area: {
        id: string;
        name: string;
        code?: string | null;
        naturalArea?: number | null;
        description?: string | null;
        note?: string | null;
        secretaryName?: string | null;
        secretaryPhone?: string | null;
        hamletHeadName?: string | null;
        hamletHeadPhone?: string | null;
        securityTeamLeaderName?: string | null;
        securityTeamLeaderPhone?: string | null;
    };
    summary: {
        total: number;
        poor: number;
        nearPoor: number;
        normal: number;
    };
    households: PublicPovertyMarker[];
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd FE && npm test -- src/components/poverty/poverty-public-map-utils.test.ts`
Expected: PASS including the two new public area URL/slug assertions.

Run: `cd FE && npx tsc --noEmit`
Expected: PASS because the new endpoint and response types are valid.

- [ ] **Step 5: Commit**

```bash
git add FE/src/components/poverty/poverty-public-map-utils.ts FE/src/components/poverty/poverty-public-map-utils.test.ts FE/src/types/poverty.ts FE/src/lib/endpoints.ts
git commit -m "feat: add public area detail route helpers"
```

### Task 2: Add the backend public area-detail API and tests

**Files:**
- Modify: `BE/src/helpers/permissions.ts`
- Modify: `BE/src/routes/index.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.handlers.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.handlers.test.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts`

- [ ] **Step 1: Write the failing handler test**

Add this test to `BE/src/handlers/admin/resources/poverty/poverty.handlers.test.ts`:

```ts
it("returns public area detail for an area inside the public ward scope", async () => {
  vi.mocked(getPublicAreaDetailBySlugAndAreaSlug).mockResolvedValue({
    share: {
      publicSlug: "ward-public-abc",
      wardCode: "31117",
      provinceCode: "92",
      wardName: "Xa Phu Huu",
      provinceName: "Thanh pho Can Tho",
      currentYear: 2026
    },
    area: {
      id: VALID_AREA_ID,
      name: "Phu Tri B1",
      secretaryName: "Dang Van Dung",
      secretaryPhone: "0975382758",
      hamletHeadName: "Dang Van Dung",
      hamletHeadPhone: "0975382758",
      securityTeamLeaderName: "Pham Vinh Tran",
      securityTeamLeaderPhone: "0981030110",
      naturalArea: 150,
      description: "Ap phia bac xa Phu Huu",
      note: "Dan so khoang 800 nguoi"
    },
    summary: {
      total: 4,
      poor: 0,
      nearPoor: 0,
      normal: 4
    },
    households: []
  } as never);

  const req = {
    params: {
      slug: "ward-public-abc",
      areaSlug: "phu-tri-b1--33333333"
    }
  } as unknown as Request;
  const res = createMockRes();
  const next = vi.fn();

  getPublicPovertyAreaBySlugAndAreaSlug(req, res, next);
  await flushAsync();

  expect(getPublicAreaDetailBySlugAndAreaSlug).toHaveBeenCalledWith("ward-public-abc", "phu-tri-b1--33333333");
  expect(res.status).toHaveBeenCalledWith(200);
  expect(next).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run handler test to verify it fails**

Run: `cd BE && npx vitest --run src/handlers/admin/resources/poverty/poverty.handlers.test.ts`
Expected: FAIL because the new handler and repository export do not exist yet.

- [ ] **Step 3: Write the minimal backend route and handler implementation**

Add the route constant in `BE/src/helpers/permissions.ts`:

```ts
publicPovertyAreaBySlug: "/public/poverty/wards/:slug/areas/:areaSlug",
```

Add the permission entry:

```ts
permissions.set(API_ROUTES.publicPovertyAreaBySlug, {
  permissions: {},
  authenticated: false
});
```

Register the route in `BE/src/routes/index.ts`:

```ts
import {
  getPublicPovertyAreaBySlugAndAreaSlug,
  getPublicPovertyHouseholdBySlugAndHouseholdId,
  getPublicPovertyWardBySlug
} from "@/handlers/admin/resources/poverty/index.ts";

app.get(API_ROUTES.publicPovertyAreaBySlug, isAuthenticated, isAuthorized, getPublicPovertyAreaBySlugAndAreaSlug);
```

Add the handler in `BE/src/handlers/admin/resources/poverty/poverty.handlers.ts`:

```ts
export const getPublicPovertyAreaBySlugAndAreaSlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await getPublicAreaDetailBySlugAndAreaSlug(String(req.params.slug ?? ""), String(req.params.areaSlug ?? ""));
    if (!item) {
      res.status(404).send({
        message: "Không tìm thấy khu vực/ấp công khai"
      });
      return;
    }
    res.status(200).send(item);
  } catch (error) {
    next(error);
  }
};
```

Implement the repository entrypoint in `BE/src/handlers/admin/resources/poverty/poverty.repository.ts`:

```ts
const slugifyPublicSegment = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const buildPublicAreaSlug = (areaName: string, areaId: string): string =>
  `${slugifyPublicSegment(areaName || "khu-vuc") || "khu-vuc"}--${areaId.slice(0, 8).toLowerCase()}`;

export const getPublicAreaDetailBySlugAndAreaSlug = async (slug: string, areaSlug: string) => {
  const wardMap = await getPublicWardMapBySlug(slug);
  if (!wardMap?.share?.wardCode) return null;

  const areaRows = await db
    .select()
    .from(areas)
    .where(eq(areas.wardCode, wardMap.share.wardCode));

  const area = areaRows.find((item) => buildPublicAreaSlug(item.name, item.id) === areaSlug);
  if (!area) return null;

  const households = (wardMap.markers ?? []).filter((item) => item.areaId === area.id);
  const total = households.length;
  const poor = households.filter((item) => item.povertyType === "POOR").length;
  const nearPoor = households.filter((item) => item.povertyType === "NEAR_POOR").length;

  return {
    share: wardMap.share,
    area: {
      id: area.id,
      name: area.name,
      code: area.code ?? null,
      naturalArea: area.naturalArea ?? null,
      description: area.description ?? null,
      note: area.note ?? null,
      secretaryName: area.secretaryName ?? null,
      secretaryPhone: area.secretaryPhone ?? null,
      hamletHeadName: area.hamletHeadName ?? null,
      hamletHeadPhone: area.hamletHeadPhone ?? null,
      securityTeamLeaderName: area.securityTeamLeaderName ?? null,
      securityTeamLeaderPhone: area.securityTeamLeaderPhone ?? null
    },
    summary: {
      total,
      poor,
      nearPoor,
      normal: Math.max(total - poor - nearPoor, 0)
    },
    households
  };
};
```

- [ ] **Step 4: Add the repository tests and verify**

Add repository tests that assert:

```ts
it("builds public area detail from a public ward map and scoped area metadata", async () => {
  const item = await getPublicAreaDetailBySlugAndAreaSlug("ward-public-abc", "phu-tri-b1--0d7ce58c");

  expect(item).toMatchObject({
    share: {
      publicSlug: "ward-public-abc",
      wardCode: "31117"
    },
    area: {
      id: "0d7ce58c-4137-4db3-8132-a4eb56d6411f",
      name: "Phu Tri B1",
      secretaryName: "Dang Van Dung"
    },
    summary: {
      total: 2,
      poor: 1,
      nearPoor: 1,
      normal: 0
    }
  });

  expect(item?.households.map((household) => household.id)).toEqual(["household-1", "household-2"]);
});

it("returns null when the area slug does not belong to the public ward", async () => {
  const item = await getPublicAreaDetailBySlugAndAreaSlug("ward-public-abc", "khu-vuc-khac--aaaaaaaa");

  expect(item).toBeNull();
});
```

Run: `cd BE && npx vitest --run src/handlers/admin/resources/poverty/poverty.repository.test.ts src/handlers/admin/resources/poverty/poverty.handlers.test.ts`
Expected: PASS including the new public area-detail coverage.

- [ ] **Step 5: Commit**

```bash
git add BE/src/helpers/permissions.ts BE/src/routes/index.ts BE/src/handlers/admin/resources/poverty/poverty.handlers.ts BE/src/handlers/admin/resources/poverty/poverty.repository.ts BE/src/handlers/admin/resources/poverty/poverty.handlers.test.ts BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts
git commit -m "feat: add public poverty area detail api"
```

### Task 3: Build the FE area-detail page, administrative modal, and ward-page navigation

**Files:**
- Create: `FE/src/app/ban-do-ho-ngheo-cong-khai/[slug]/khu-vuc/[areaSlug]/page.tsx`
- Create: `FE/src/components/poverty/PovertyPublicAreaDetailPage.tsx`
- Create: `FE/src/components/poverty/PovertyPublicAreaAdministrativeModal.tsx`
- Modify: `FE/src/components/poverty/PovertyPublicMapPage.tsx`
- Reuse: `FE/src/components/poverty/PovertyPublicMapStage.tsx`
- Reuse: `FE/src/components/poverty/poverty-public-map-utils.ts`
- Reuse: `FE/src/types/poverty.ts`

- [ ] **Step 1: Write the failing route wiring**

Change the area-card click handler in `FE/src/components/poverty/PovertyPublicMapPage.tsx` to route navigation:

```tsx
onClick={() => {
    if (!item.areaId) return;
    router.push(buildPublicPovertyAreaDetailUrl(slug, buildPublicAreaSlug(item.areaName, item.areaId)));
}}
```

and add the new page route file:

```tsx
import PovertyPublicAreaDetailPage from "@/components/poverty/PovertyPublicAreaDetailPage";

export default async function Page({
    params,
}: {
    params: Promise<{ slug: string; areaSlug: string }>;
}) {
    const { slug, areaSlug } = await params;

    return <PovertyPublicAreaDetailPage slug={slug} areaSlug={areaSlug} />;
}
```

- [ ] **Step 2: Run type-check to verify it fails**

Run: `cd FE && npx tsc --noEmit`
Expected: FAIL because `PovertyPublicAreaDetailPage`, `buildPublicPovertyAreaDetailUrl`, or `buildPublicAreaSlug` are not fully wired everywhere yet.

- [ ] **Step 3: Write the minimal FE page and modal implementation**

Create `FE/src/components/poverty/PovertyPublicAreaAdministrativeModal.tsx`:

```tsx
import { Button, Modal } from "antd";
import type { PublicPovertyAreaDetailResponse } from "@/types/poverty";

type Props = {
    open: boolean;
    onClose: () => void;
    area: PublicPovertyAreaDetailResponse["area"] | null;
};

export default function PovertyPublicAreaAdministrativeModal({ open, onClose, area }: Props) {
    const rows: Array<[string, string]> = [
        ["Bí thư", area?.secretaryName || "Chưa cập nhật"],
        ["Số điện thoại bí thư", area?.secretaryPhone || "Chưa cập nhật"],
        ["Trưởng ấp", area?.hamletHeadName || "Chưa cập nhật"],
        ["Số điện thoại trưởng ấp", area?.hamletHeadPhone || "Chưa cập nhật"],
        ["Tổ trưởng TANTTCS", area?.securityTeamLeaderName || "Chưa cập nhật"],
        ["Số điện thoại Tổ trưởng TANTTCS", area?.securityTeamLeaderPhone || "Chưa cập nhật"],
        ["Diện tích tự nhiên", area?.naturalArea ? `${area.naturalArea} ha` : "Chưa cập nhật"],
        ["Mô tả", area?.description || "Chưa cập nhật"],
        ["Ghi chú", area?.note || "Chưa cập nhật"],
    ];

    return (
        <Modal open={open} onCancel={onClose} footer={null} title={null}>
            <div>{rows.map(([label, value]) => <div key={label}>{label}: {value}</div>)}</div>
            <div className="mt-6 flex justify-end">
                <Button type="primary" onClick={onClose}>Đóng</Button>
            </div>
        </Modal>
    );
}
```

Render a modal with blue header, label/value rows, and a single `Đóng` button.

Create `FE/src/components/poverty/PovertyPublicAreaDetailPage.tsx` with:

```tsx
const [administrativeModalOpen, setAdministrativeModalOpen] = useState(false);
const [search, setSearch] = useState("");
const [povertyFilter, setPovertyFilter] = useState<PublicPovertyFilter>("ALL");

const filteredHouseholds = useMemo(
    () => filterPublicPovertyMarkers(data?.households ?? [], {
        search,
        activeAreaId: area?.id ?? null,
        povertyFilter,
    }),
    [area?.id, data?.households, povertyFilter, search]
);
```

The page layout should include:
- back button to `/ban-do-ho-ngheo-cong-khai/${slug}`
- hero with breadcrumb and `Thông tin hành chính` button
- four summary cards using `data.summary`
- note block from `area.description || area.note || "Chưa có mô tả công khai cho khu vực này."`
- household list grid reusing the public household-card style
- `PovertyPublicMapStage` at the bottom with `markers={filteredHouseholds}` and `title={`Bản đồ khu vực ${area?.name ?? ""}`}`

Load data with:

```ts
const response = await publicApiGet<PublicPovertyAreaDetailResponse>(endpoints.poverty.publicAreaBySlug(slug, areaSlug));
```

- [ ] **Step 4: Run verification**

Run: `cd FE && npm test -- src/components/poverty/poverty-public-map-utils.test.ts src/components/poverty/poverty-public-map-marker-utils.test.ts`
Expected: PASS

Run: `cd FE && npx tsc --noEmit`
Expected: PASS

Run: `cd FE && npx eslint src/components/poverty/PovertyPublicMapPage.tsx src/components/poverty/PovertyPublicAreaDetailPage.tsx src/components/poverty/PovertyPublicAreaAdministrativeModal.tsx src/components/poverty/poverty-public-map-utils.ts`
Expected: PASS

Manual smoke check:
- open a public ward page and click one `Khu vực/Ấp` card
- verify the browser lands on `/ban-do-ho-ngheo-cong-khai/<slug>/khu-vuc/<areaSlug>`
- open `Thông tin hành chính` and verify all administrative-geography rows render with fallback text where missing
- click one household card and verify it still opens the public household detail page
- verify the bottom map only shows households from the chosen area

- [ ] **Step 5: Commit**

```bash
git add FE/src/app/ban-do-ho-ngheo-cong-khai/[slug]/khu-vuc/[areaSlug]/page.tsx FE/src/components/poverty/PovertyPublicAreaDetailPage.tsx FE/src/components/poverty/PovertyPublicAreaAdministrativeModal.tsx FE/src/components/poverty/PovertyPublicMapPage.tsx FE/src/components/poverty/poverty-public-map-utils.ts FE/src/components/poverty/poverty-public-map-utils.test.ts FE/src/types/poverty.ts FE/src/lib/endpoints.ts
git commit -m "feat: add public poverty area detail page"
```

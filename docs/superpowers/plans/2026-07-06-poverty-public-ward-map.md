# Poverty Public Ward Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fixed public link per `workspace + ward` so admins can publish a read-only poverty map for outside viewers without login.

**Architecture:** Add a dedicated backend share table and public endpoint that resolves access by slug, returns current-year sanitized ward data, and never trusts client-supplied workspace context. On the frontend, extend the ward general-info modal with public-share controls, create a public page with a session-free fetch path, and reuse the map renderer in a strict read-only mode.

**Tech Stack:** Express, Drizzle ORM, Vitest, Next.js App Router, React, Ant Design, TypeScript, Node `--test`.

---

## File Structure

**Backend**

- Create: `BE/drizzle/0019_poverty_ward_public_links.sql`
- Modify: `BE/src/schema.ts`
- Modify: `BE/src/helpers/permissions.ts`
- Modify: `BE/src/routes/index.ts`
- Modify: `BE/src/routes/admin/poverty.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.schemas.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.handlers.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/index.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.handlers.test.ts`

**Frontend**

- Create: `FE/src/app/ban-do-ho-ngheo-cong-khai/[slug]/page.tsx`
- Create: `FE/src/components/poverty/PovertyPublicMapPage.tsx`
- Create: `FE/src/components/poverty/poverty-public-map-utils.ts`
- Create: `FE/src/components/poverty/poverty-public-map-utils.test.ts`
- Create: `FE/src/lib/public-api.ts`
- Modify: `FE/src/lib/endpoints.ts`
- Modify: `FE/src/types/poverty.ts`
- Modify: `FE/src/components/poverty/PovertyAdminGeneralInfoPage.tsx`
- Modify: `FE/src/components/poverty/PovertyLeafletMap.tsx`

### Task 1: Add backend share schema and repository helpers

**Files:**
- Create: `BE/drizzle/0019_poverty_ward_public_links.sql`
- Modify: `BE/src/schema.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.schemas.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts`

- [ ] **Step 1: Write the failing repository tests**

Add focused cases in `BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts` for slug stability, current-year filtering, and public sanitization helpers.

```ts
describe("upsertWardPublicLinkState", () => {
  it("keeps the same slug across disable and re-enable", () => {
    expect("implement-repository-helper").toBe("and-watch-this-test-fail");
  });
});

describe("toPublicPovertyMarker", () => {
  it("omits citizen-id and other sensitive fields", () => {
    expect({
      id: "household-1",
      headCitizenId: "001234567890"
    }).not.toEqual(
      expect.objectContaining({ headCitizenId: expect.anything() })
    );
  });
});
```

- [ ] **Step 2: Run the focused backend test file and verify failure**

Run: `cd BE && pnpm test -- poverty.repository.test.ts`

Expected: FAIL because the new share-link helpers and public DTO helpers do not exist yet.

- [ ] **Step 3: Add the migration and schema table**

Create `BE/drizzle/0019_poverty_ward_public_links.sql` with a new table and indexes.

```sql
CREATE TABLE IF NOT EXISTS gisasxh.poverty_ward_public_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(uuid),
  province_code varchar(20) NOT NULL,
  ward_code varchar(20) NOT NULL,
  public_slug varchar(120) NOT NULL,
  is_public boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_by uuid REFERENCES public.accounts(uuid),
  updated_by uuid REFERENCES public.accounts(uuid),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

Add the Drizzle table in `BE/src/schema.ts`.

```ts
export const povertyWardPublicLinks = gisasxhSchema.table(
  "poverty_ward_public_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.uuid),
    provinceCode: varchar("province_code", { length: 20 }).notNull(),
    wardCode: varchar("ward_code", { length: 20 }).notNull(),
    publicSlug: varchar("public_slug", { length: 120 }).notNull(),
    isPublic: boolean("is_public").notNull().default(false),
    publishedAt: timestamp("published_at", { precision: 6, withTimezone: true }),
    createdBy: uuid("created_by").references(() => accounts.uuid),
    updatedBy: uuid("updated_by").references(() => accounts.uuid),
    createdAt: timestamp("created_at", { precision: 6, withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { precision: 6, withTimezone: true }).defaultNow()
  },
  (table) => ({
    uniqueWardShare: unique("poverty_ward_public_links_workspace_ward_key").on(
      table.workspaceId,
      table.provinceCode,
      table.wardCode
    ),
    uniqueSlug: unique("poverty_ward_public_links_slug_key").on(table.publicSlug)
  })
);
```

- [ ] **Step 4: Add minimal repository and schema support**

Add request schemas in `poverty.schemas.ts` and repository functions in `poverty.repository.ts`.

```ts
export const povertyWardPublicLinkQuerySchema = z.object({
  provinceCode: z.string().trim().min(1),
  wardCode: z.string().trim().min(1)
});

export const povertyWardPublicLinkUpsertSchema = z.object({
  provinceCode: z.string().trim().min(1),
  wardCode: z.string().trim().min(1),
  isPublic: z.coerce.boolean()
});
```

```ts
export const getWardPublicLink = async (
  workspaceId: string,
  provinceCode: string,
  wardCode: string
): Promise<PovertyWardPublicLinkItem | null> => { /* minimal select */ };

export const upsertWardPublicLinkState = async (
  workspaceId: string,
  payload: PovertyWardPublicLinkUpsertInput,
  accountId?: string
): Promise<PovertyWardPublicLinkItem> => { /* create or toggle, preserve slug */ };

export const toPublicPovertyMarker = (marker: PovertyMarkerItem): PublicPovertyMarkerItem => ({
  id: marker.id,
  code: marker.code,
  headFullName: marker.headFullName,
  povertyType: marker.povertyType,
  status: marker.status,
  areaName: marker.areaName,
  wardName: marker.wardName,
  memberCount: marker.memberCount,
  latitude: marker.latitude,
  longitude: marker.longitude
});
```

- [ ] **Step 5: Re-run the focused backend test file and verify pass**

Run: `cd BE && pnpm test -- poverty.repository.test.ts`

Expected: PASS for the new repository helper coverage.

- [ ] **Step 6: Commit the schema/repository slice**

```bash
git add BE/drizzle/0019_poverty_ward_public_links.sql \
  BE/src/schema.ts \
  BE/src/handlers/admin/resources/poverty/poverty.schemas.ts \
  BE/src/handlers/admin/resources/poverty/poverty.repository.ts \
  BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts
git commit -m "feat: add poverty ward public link storage"
```

### Task 2: Expose admin and public backend endpoints

**Files:**
- Modify: `BE/src/helpers/permissions.ts`
- Modify: `BE/src/routes/index.ts`
- Modify: `BE/src/routes/admin/poverty.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.handlers.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/index.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.handlers.test.ts`

- [ ] **Step 1: Write the failing handler tests**

Extend `poverty.handlers.test.ts` for one admin read/update case and one public fetch case.

```ts
it("returns ward public link state for an authorized ward", async () => {
  expect("implement-admin-handler").toBe("and-watch-this-test-fail");
});

it("returns 404 or 403-safe error when a public slug is disabled", async () => {
  expect("implement-public-handler").toBe("and-watch-this-test-fail");
});
```

- [ ] **Step 2: Run the focused handler test file and verify failure**

Run: `cd BE && pnpm test -- poverty.handlers.test.ts`

Expected: FAIL because the new handlers and route metadata do not exist yet.

- [ ] **Step 3: Add permission and route metadata**

Update `BE/src/helpers/permissions.ts` with new route constants and metadata.

```ts
povertyWardPublicLinks: "/poverty/ward-public-links",
publicPovertyWardBySlug: "/public/poverty/wards/:slug"
```

```ts
permissions.set(API_ROUTES.povertyWardPublicLinks, {
  permissions: {
    GET: PERMISSION_CODES.PovertyWardOverviewView,
    PUT: PERMISSION_CODES.PovertyWardOverviewUpdate
  },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.publicPovertyWardBySlug, {
  permissions: {},
  authenticated: false
});
```

- [ ] **Step 4: Implement the minimal admin and public handlers**

Add three handlers in `poverty.handlers.ts`.

```ts
export const getPovertyWardPublicLinkAdmin = asyncHandler(async (req, res) => {
  const query = parseOrSendError(povertyWardPublicLinkQuerySchema, req.query, res);
  if (!query || !req.workspaceId) return;
  const item = await getWardPublicLink(req.workspaceId, query.provinceCode, query.wardCode);
  res.status(200).send(apiResponse.success(200, { item }, "Ward public link retrieved successfully"));
});

export const upsertPovertyWardPublicLinkAdmin = asyncHandler(async (req, res) => {
  const body = parseOrSendError(povertyWardPublicLinkUpsertSchema, req.body, res);
  if (!body || !req.workspaceId) return;
  const item = await upsertWardPublicLinkState(req.workspaceId, body, req.accountId);
  res.status(200).send(apiResponse.success(200, { item }, "Ward public link saved successfully"));
});

export const getPublicPovertyWardBySlug = asyncHandler(async (req, res) => {
  const slug = String(req.params.slug || "").trim();
  const data = await getPublicWardMapBySlug(slug, new Date().getFullYear());
  res.status(200).send(apiResponse.success(200, data, "Public poverty ward retrieved successfully"));
});
```

Wire them in `BE/src/routes/admin/poverty.ts` and `BE/src/routes/index.ts`.

- [ ] **Step 5: Re-run the focused handler test file and verify pass**

Run: `cd BE && pnpm test -- poverty.handlers.test.ts`

Expected: PASS for the new admin/public handler coverage.

- [ ] **Step 6: Commit the backend route slice**

```bash
git add BE/src/helpers/permissions.ts \
  BE/src/routes/index.ts \
  BE/src/routes/admin/poverty.ts \
  BE/src/handlers/admin/resources/poverty/poverty.handlers.ts \
  BE/src/handlers/admin/resources/poverty/index.ts \
  BE/src/handlers/admin/resources/poverty/poverty.handlers.test.ts
git commit -m "feat: add poverty ward public link endpoints"
```

### Task 3: Add frontend public types, endpoints, and share utilities

**Files:**
- Create: `FE/src/lib/public-api.ts`
- Create: `FE/src/components/poverty/poverty-public-map-utils.ts`
- Create: `FE/src/components/poverty/poverty-public-map-utils.test.ts`
- Modify: `FE/src/lib/endpoints.ts`
- Modify: `FE/src/types/poverty.ts`

- [ ] **Step 1: Write the failing frontend utility tests**

Create `FE/src/components/poverty/poverty-public-map-utils.test.ts`.

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { buildPovertyWardPublicUrl } from "./poverty-public-map-utils.ts";

test("buildPovertyWardPublicUrl appends the slug to the public route", () => {
  assert.equal(
    buildPovertyWardPublicUrl("ward-slug-123", "https://example.com"),
    "https://example.com/ban-do-ho-ngheo-cong-khai/ward-slug-123"
  );
});
```

- [ ] **Step 2: Run the focused frontend test file and verify failure**

Run: `cd FE && npm test -- src/components/poverty/poverty-public-map-utils.test.ts`

Expected: FAIL because the new utility file does not exist yet.

- [ ] **Step 3: Add minimal types, endpoints, and public fetch helper**

Extend `FE/src/types/poverty.ts`.

```ts
export type PovertyWardPublicLink = {
  id: string;
  provinceCode: string;
  wardCode: string;
  publicSlug: string;
  isPublic: boolean;
};

export type PublicPovertyWardResponse = {
  share: { wardName?: string | null; provinceName?: string | null; publicSlug: string };
  overview?: PovertyWardOverview | null;
  summary?: { total: number; poor: number; nearPoor: number; active: number };
  markers?: Array<{
    id: string;
    code?: string | null;
    headFullName?: string | null;
    povertyType?: string | null;
    status?: string | null;
    areaName?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  }>;
};
```

Extend `FE/src/lib/endpoints.ts`.

```ts
wardPublicLinks: "/poverty/ward-public-links",
publicWardBySlug: (slug: string) => `/public/poverty/wards/${slug}`
```

Create `FE/src/lib/public-api.ts`.

```ts
export async function publicApiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new ApiError(`Request failed: ${res.status}`, res.status, null);
  const payload = await res.json();
  return payload?.data as T;
}
```

- [ ] **Step 4: Implement the tested utility helpers**

Create `FE/src/components/poverty/poverty-public-map-utils.ts`.

```ts
export function buildPovertyWardPublicUrl(slug: string, origin = ""): string {
  const normalizedOrigin = origin.replace(/\/$/, "");
  return `${normalizedOrigin}/ban-do-ho-ngheo-cong-khai/${encodeURIComponent(slug)}`;
}
```

- [ ] **Step 5: Re-run the focused frontend test file and verify pass**

Run: `cd FE && npm test -- src/components/poverty/poverty-public-map-utils.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the shared frontend contract slice**

```bash
git add FE/src/lib/public-api.ts \
  FE/src/components/poverty/poverty-public-map-utils.ts \
  FE/src/components/poverty/poverty-public-map-utils.test.ts \
  FE/src/lib/endpoints.ts \
  FE/src/types/poverty.ts
git commit -m "feat: add poverty public map frontend contracts"
```

### Task 4: Add admin public-share controls to the ward general-info modal

**Files:**
- Modify: `FE/src/components/poverty/PovertyAdminGeneralInfoPage.tsx`

- [ ] **Step 1: Add local state for ward public sharing**

Introduce state alongside the existing modal state.

```ts
const [publicLinkLoading, setPublicLinkLoading] = useState(false);
const [publicLinkSaving, setPublicLinkSaving] = useState(false);
const [publicLinkError, setPublicLinkError] = useState<string | null>(null);
const [wardPublicLink, setWardPublicLink] = useState<PovertyWardPublicLink | null>(null);
```

- [ ] **Step 2: Load the public-link state when opening the ward modal**

Add a helper that reuses the selected ward context.

```ts
const loadWardPublicLink = useCallback(async (provinceCode: string, wardCode: string) => {
  setPublicLinkLoading(true);
  setPublicLinkError(null);
  try {
    const data = await api.get<{ item?: PovertyWardPublicLink | null }>(
      `${endpoints.poverty.wardPublicLinks}?provinceCode=${provinceCode}&wardCode=${wardCode}`
    );
    setWardPublicLink(data.item ?? null);
  } catch (error) {
    setPublicLinkError(error instanceof ApiError ? error.message : "Vui lòng thử lại");
  } finally {
    setPublicLinkLoading(false);
  }
}, []);
```

- [ ] **Step 3: Add the toggle, readonly URL, copy, and preview UI**

Render a dedicated card above or beside the year-based form/table inside the modal.

```tsx
<div className="rounded-lg border border-sky-200 bg-sky-50/60 p-4">
  <div className="flex items-start justify-between gap-3">
    <div>
      <h3 className="text-sm font-semibold text-slate-900">Công khai bản đồ</h3>
      <p className="mt-1 text-xs text-slate-600">Cho phép người ngoài truy cập trang bản đồ chỉ xem của xã/phường này.</p>
    </div>
    <Switch
      checked={Boolean(wardPublicLink?.isPublic)}
      loading={publicLinkSaving}
      disabled={!canUpdateOverview || publicLinkLoading}
      onChange={(checked) => void saveWardPublicLink(checked)}
    />
  </div>
</div>
```

- [ ] **Step 4: Implement save/copy behavior with rollback**

```ts
const saveWardPublicLink = async (isPublic: boolean) => {
  if (!selectedWard) return;
  const previous = wardPublicLink;
  setPublicLinkSaving(true);
  setWardPublicLink((current) => current ? { ...current, isPublic } : current);
  try {
    const data = await api.put<{ item?: PovertyWardPublicLink }>(endpoints.poverty.wardPublicLinks, {
      provinceCode: selectedProvinceCode,
      wardCode: selectedWard.code,
      isPublic
    });
    setWardPublicLink(data.item ?? null);
  } catch (error) {
    setWardPublicLink(previous);
    throw error;
  } finally {
    setPublicLinkSaving(false);
  }
};
```

- [ ] **Step 5: Verify the admin page compiles cleanly**

Run: `cd FE && npx tsc --noEmit`

Expected: PASS with the new ward public-link state integrated into the modal.

- [ ] **Step 6: Commit the admin UI slice**

```bash
git add FE/src/components/poverty/PovertyAdminGeneralInfoPage.tsx
git commit -m "feat: add ward public share controls"
```

### Task 5: Build the public page and read-only map mode

**Files:**
- Create: `FE/src/app/ban-do-ho-ngheo-cong-khai/[slug]/page.tsx`
- Create: `FE/src/components/poverty/PovertyPublicMapPage.tsx`
- Modify: `FE/src/components/poverty/PovertyLeafletMap.tsx`

- [ ] **Step 1: Add a public/read-only mode to the shared map**

Update `PovertyLeafletMap.tsx` so the mutation and internal-only controls are gated.

```ts
type PovertyLeafletMapProps = {
  markers: PovertyMarker[];
  mode?: "admin" | "public";
  canCreateHousehold?: boolean;
  canCreateHouseholdOnMap?: boolean;
  canEditMarkerPosition?: boolean;
  canViewAssessmentTimeline?: boolean;
  canUpdateHousehold?: boolean;
  canViewHouseholdDetail?: boolean;
  onRefresh?: () => void;
  onMarkerPositionChange?: (...) => Promise<void>;
};

const isPublicMode = mode === "public";
```

- [ ] **Step 2: Add the public page entrypoint**

Create `FE/src/app/ban-do-ho-ngheo-cong-khai/[slug]/page.tsx`.

```ts
import PovertyPublicMapPage from "@/components/poverty/PovertyPublicMapPage";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PovertyPublicMapPage slug={slug} />;
}
```

- [ ] **Step 3: Implement the public page loader and read-only layout**

Create `FE/src/components/poverty/PovertyPublicMapPage.tsx`.

```tsx
const data = await publicApiGet<PublicPovertyWardResponse>(endpoints.poverty.publicWardBySlug(slug));

<PovertyLeafletMap
  mode="public"
  markers={data.markers ?? []}
  loading={loading}
  onRefresh={() => void loadData()}
  canCreateHousehold={false}
  canCreateHouseholdOnMap={false}
  canEditMarkerPosition={false}
  canViewAssessmentTimeline={false}
  canUpdateHousehold={false}
  canViewHouseholdDetail={false}
/>
```

- [ ] **Step 4: Add public empty/error states**

Make sure `PovertyPublicMapPage.tsx` shows dedicated states for invalid slug, disabled share, and no current-year data instead of crashing or redirecting to login.

- [ ] **Step 5: Run frontend verification for the public page**

Run:

```bash
cd FE && npm test -- src/components/poverty/poverty-public-map-utils.test.ts
cd FE && npx tsc --noEmit
cd FE && npx eslint src/components/poverty/PovertyAdminGeneralInfoPage.tsx src/components/poverty/PovertyLeafletMap.tsx src/components/poverty/PovertyPublicMapPage.tsx src/components/poverty/poverty-public-map-utils.ts src/lib/public-api.ts src/lib/endpoints.ts src/types/poverty.ts
```

Expected: all commands PASS.

- [ ] **Step 6: Commit the public page slice**

```bash
git add FE/src/app/ban-do-ho-ngheo-cong-khai/[slug]/page.tsx \
  FE/src/components/poverty/PovertyPublicMapPage.tsx \
  FE/src/components/poverty/PovertyLeafletMap.tsx
git commit -m "feat: add public poverty ward map page"
```

### Task 6: End-to-end verification

**Files:**
- Modify: any files touched above only if verification exposes real issues

- [ ] **Step 1: Run the backend focused verification suite**

Run:

```bash
cd BE && pnpm test -- poverty.repository.test.ts
cd BE && pnpm test -- poverty.handlers.test.ts
cd BE && pnpm tsc:check
cd BE && pnpm lint
```

- [ ] **Step 2: Run the frontend verification suite**

Run:

```bash
cd FE && npm test -- src/components/poverty/poverty-public-map-utils.test.ts
cd FE && npx tsc --noEmit
cd FE && npx eslint src/components/poverty/PovertyAdminGeneralInfoPage.tsx src/components/poverty/PovertyLeafletMap.tsx src/components/poverty/PovertyPublicMapPage.tsx src/components/poverty/poverty-public-map-utils.ts src/lib/public-api.ts src/lib/endpoints.ts src/types/poverty.ts
```

- [ ] **Step 3: Manually verify the admin and public flows**

Check:

- enable public sharing for one ward in the admin modal
- copy the generated link
- open the link in an incognito window
- verify no login is required
- verify the page shows only the selected ward and current year
- verify marker popups do not expose `headCitizenId`
- disable sharing and reload the same public link to confirm it is blocked

- [ ] **Step 4: Commit any verification fixes**

```bash
git add -A
git commit -m "fix: polish poverty public ward map flow"
```

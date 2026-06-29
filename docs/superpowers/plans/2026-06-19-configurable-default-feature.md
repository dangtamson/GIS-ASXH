# Configurable Default Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép cấu hình một chức năng động làm trang mặc định của workspace và tự chuyển hướng `/` đến trang hợp lệ đầu tiên mà người dùng có quyền.

**Architecture:** Lưu UUID feature trong `system_configs.general.defaultFeatureId`, không thay đổi schema database. Frontend dùng một helper thuần để chuẩn hóa feature, kiểm tra internal path và chọn đường dẫn; trang `/` dùng client resolver gọi API cấu hình/feature rồi `router.replace`, còn dashboard tổng quan hiện tại là fallback khi không thể phân giải.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Ant Design, Zustand/auth local storage hiện có, Vitest cho helper thuần.

---

### Task 1: Add Testable Default Feature Resolver

**Files:**
- Modify: `FE/package.json`
- Create: `FE/src/lib/default-feature.ts`
- Create: `FE/src/lib/default-feature.test.ts`

- [ ] **Step 1: Add Vitest test script**

Add the following development dependency and script:

```json
{
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^3.2.4"
  }
}
```

Run:

```bash
cd FE
npm install
```

Expected: `package-lock.json` is updated and Vitest installs successfully.

- [ ] **Step 2: Write failing resolver tests**

Create `FE/src/lib/default-feature.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
    isSafeFeaturePath,
    selectDefaultFeaturePath,
    type AccessibleFeature,
} from "./default-feature";

const features: AccessibleFeature[] = [
    { uuid: "dashboard", name: "Dashboard", path: "/dashboard", enabled: true, orderIndex: 20 },
    { uuid: "poverty", name: "Hộ nghèo", path: "/ho-ngheo", enabled: true, orderIndex: 10 },
];

describe("isSafeFeaturePath", () => {
    it.each(["", "/", "https://example.com", "//example.com"])(
        "rejects unsafe path %s",
        (path) => expect(isSafeFeaturePath(path)).toBe(false)
    );

    it("accepts an internal application path", () => {
        expect(isSafeFeaturePath("/dashboard-ho-ngheo")).toBe(true);
    });
});

describe("selectDefaultFeaturePath", () => {
    it("returns configured feature when accessible", () => {
        expect(selectDefaultFeaturePath(features, "dashboard")).toBe("/dashboard");
    });

    it("falls back to the first accessible feature by orderIndex", () => {
        expect(selectDefaultFeaturePath(features, "missing")).toBe("/ho-ngheo");
    });

    it("ignores disabled and unsafe features", () => {
        expect(selectDefaultFeaturePath([
            { uuid: "root", name: "Root", path: "/", enabled: true, orderIndex: 1 },
            { uuid: "disabled", name: "Disabled", path: "/disabled", enabled: false, orderIndex: 2 },
        ], "root")).toBeNull();
    });
});
```

- [ ] **Step 3: Run tests and verify failure**

Run:

```bash
cd FE
npm test -- src/lib/default-feature.test.ts
```

Expected: FAIL because `default-feature.ts` does not exist.

- [ ] **Step 4: Implement the resolver**

Create `FE/src/lib/default-feature.ts`:

```ts
export type AccessibleFeature = {
    uuid: string;
    name: string;
    path: string;
    enabled: boolean;
    orderIndex?: number;
};

export function isSafeFeaturePath(path?: string | null): path is string {
    const value = String(path ?? "").trim();
    return value.startsWith("/") && !value.startsWith("//") && value !== "/";
}

export function selectDefaultFeaturePath(
    features: AccessibleFeature[],
    defaultFeatureId?: string | null
): string | null {
    const candidates = features
        .filter((feature) => feature.enabled && isSafeFeaturePath(feature.path))
        .sort((first, second) => (first.orderIndex ?? 0) - (second.orderIndex ?? 0));

    const configured = candidates.find((feature) => feature.uuid === defaultFeatureId);
    return configured?.path ?? candidates[0]?.path ?? null;
}
```

- [ ] **Step 5: Run resolver tests**

Run:

```bash
cd FE
npm test -- src/lib/default-feature.test.ts
```

Expected: PASS.

### Task 2: Add Default Feature Selection to System Configuration

**Files:**
- Modify: `FE/src/types/systemConfig.ts`
- Modify: `FE/src/app/(admin)/quan-tri/cau-hinh-he-thong/CauHinhHeThongPage.tsx`

- [ ] **Step 1: Extend the system config type**

Add to `SystemConfig.general`:

```ts
defaultFeatureId?: string | null;
```

- [ ] **Step 2: Add feature option state and response type**

In `CauHinhHeThongPage.tsx`, import `extractList` and define:

```ts
type ConfigurableFeature = {
    uuid: string;
    name: string;
    path: string;
    enabled: boolean;
    orderIndex?: number;
};

const [featureOptions, setFeatureOptions] = useState<
    Array<{ value: string; label: string }>
>([]);
```

- [ ] **Step 3: Load enabled feature options with configuration**

Update `loadConfig` to request both resources:

```ts
const [data, featureData] = await Promise.all([
    api.get<SystemConfigResponse>(endpoints.admin.systemConfig),
    api.get<unknown>(endpoints.admin.features),
]);

const features = extractList<ConfigurableFeature>(featureData)
    .filter((feature) =>
        feature.enabled
        && feature.uuid
        && feature.path.startsWith("/")
        && !feature.path.startsWith("//")
        && feature.path !== "/"
    )
    .sort((first, second) => (first.orderIndex ?? 0) - (second.orderIndex ?? 0));

setFeatureOptions(features.map((feature) => ({
    value: feature.uuid,
    label: `${feature.name} (${feature.path})`,
})));
```

Include the loaded value in `generalForm.setFieldsValue`:

```ts
defaultFeatureId: typeof generalData.defaultFeatureId === "string"
    ? generalData.defaultFeatureId
    : undefined,
```

- [ ] **Step 4: Render the default page selector**

Add to the general configuration form:

```tsx
<Col md={24} lg={12} className="w-full">
    <Form.Item
        label="Trang mặc định"
        name="defaultFeatureId"
        extra="Trang được mở khi người dùng truy cập đường dẫn /."
    >
        <AppSelect
            allowClear
            showSearch
            optionFilterProp="label"
            options={featureOptions}
            placeholder="Giữ trang tổng quan hiện tại"
        />
    </Form.Item>
</Col>
```

- [ ] **Step 5: Verify type and lint**

Run:

```bash
cd FE
npx tsc --noEmit
npx eslint src/types/systemConfig.ts src/app/\(admin\)/quan-tri/cau-hinh-he-thong/CauHinhHeThongPage.tsx
```

Expected: TypeScript passes; no new ESLint errors.

### Task 3: Resolve the Accessible Feature List for the Current User

**Files:**
- Create: `FE/src/lib/default-feature-access.ts`
- Create: `FE/src/lib/default-feature-access.test.ts`

- [ ] **Step 1: Write failing access normalization tests**

Create `FE/src/lib/default-feature-access.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
    getCurrentRoleId,
    normalizeAdminFeatures,
    normalizeRoleFeatures,
} from "./default-feature-access";

describe("getCurrentRoleId", () => {
    it("reads role id from selected workspace membership", () => {
        expect(getCurrentRoleId({
            memberships: [{ workspaceId: "workspace-1", roleId: 7 }],
        }, "workspace-1")).toBe(7);
    });
});

describe("feature normalization", () => {
    it("normalizes enabled admin features", () => {
        expect(normalizeAdminFeatures([
            { uuid: "one", name: "One", path: "/one", enabled: true, orderIndex: 2 },
        ])).toEqual([
            { uuid: "one", name: "One", path: "/one", enabled: true, orderIndex: 2 },
        ]);
    });

    it("extracts nested enabled role features", () => {
        expect(normalizeRoleFeatures([
            { feature: { uuid: "one", name: "One", path: "/one", enabled: true } },
        ])).toHaveLength(1);
    });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
cd FE
npm test -- src/lib/default-feature-access.test.ts
```

Expected: FAIL because the access helper does not exist.

- [ ] **Step 3: Implement account and feature normalization**

Create `FE/src/lib/default-feature-access.ts` with:

```ts
import type { Account } from "@/lib/auth";
import type { AccessibleFeature } from "@/lib/default-feature";

type AccountWithRoles = Account & {
    memberships?: Array<Record<string, unknown>>;
    workspaces?: Array<Record<string, unknown>>;
};

const positiveRoleId = (value: unknown): number | null => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;

export function getCurrentRoleId(account: AccountWithRoles | null, workspaceId?: string | null) {
    if (!account) return null;

    for (const membership of account.memberships ?? []) {
        const nestedWorkspace = asRecord(membership.workspace);
        const membershipWorkspaceId = String(
            membership.workspaceId ?? nestedWorkspace?.id ?? nestedWorkspace?.uuid ?? ""
        );
        if (workspaceId && membershipWorkspaceId !== workspaceId) continue;

        const role = asRecord(membership.role);
        const roleId = positiveRoleId(membership.roleId) ?? positiveRoleId(role?.id);
        if (roleId) return roleId;
    }

    return null;
}

function normalizeFeature(value: unknown): AccessibleFeature | null {
    const feature = asRecord(value);
    if (!feature) return null;

    const uuid = String(feature.uuid ?? "");
    const name = String(feature.name ?? "");
    const path = String(feature.path ?? "");
    if (!uuid || !name || !path) return null;

    return {
        uuid,
        name,
        path,
        enabled: feature.enabled === true,
        orderIndex: typeof feature.orderIndex === "number" ? feature.orderIndex : undefined,
    };
}

export const normalizeAdminFeatures = (items: unknown[]) =>
    items.map(normalizeFeature).filter((item): item is AccessibleFeature => Boolean(item?.enabled));

export const normalizeRoleFeatures = (items: unknown[]) =>
    items
        .map((item) => normalizeFeature(asRecord(item)?.feature))
        .filter((feature): feature is AccessibleFeature => Boolean(feature?.enabled));
```

- [ ] **Step 4: Update the Account type for role fields**

Extend membership objects in `FE/src/lib/auth.ts`:

```ts
roleId?: number;
role?: {
    id?: number;
    code?: string;
    name?: string;
};
```

- [ ] **Step 5: Run access helper tests**

Run:

```bash
cd FE
npm test -- src/lib/default-feature-access.test.ts
```

Expected: PASS.

### Task 4: Add the Root Default Feature Resolver

**Files:**
- Create: `FE/src/components/app/DefaultFeatureRootPage.tsx`
- Modify: `FE/src/app/(admin)/page.tsx`

- [ ] **Step 1: Create the client resolver component**

Create `DefaultFeatureRootPage.tsx`:

```tsx
"use client";

import DashboardOverview from "@/components/app/DashboardOverview";
import { api } from "@/lib/api";
import { getAccount, getWorkspaceId } from "@/lib/auth";
import {
    getCurrentRoleId,
    normalizeAdminFeatures,
    normalizeRoleFeatures,
} from "@/lib/default-feature-access";
import { selectDefaultFeaturePath } from "@/lib/default-feature";
import { extractList } from "@/lib/data-utils";
import { endpoints } from "@/lib/endpoints";
import { Spin } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type SystemConfigResponse = {
    item?: {
        general?: {
            defaultFeatureId?: string | null;
        };
    };
};

export default function DefaultFeatureRootPage() {
    const router = useRouter();
    const [resolving, setResolving] = useState(true);
    const [showFallback, setShowFallback] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const resolveDefaultPage = async () => {
            try {
                const account = getAccount();
                const workspaceId = getWorkspaceId();
                const roleId = getCurrentRoleId(account, workspaceId);
                const isSuperAdmin = Boolean(account?.isSuperAdmin);
                const [configResponse, featureResponse] = await Promise.all([
                    api.get<SystemConfigResponse>(endpoints.admin.systemConfig),
                    isSuperAdmin
                        ? api.get<unknown>(endpoints.admin.features)
                        : roleId
                            ? api.get<unknown>(endpoints.admin.getRoleFeatures(roleId))
                            : Promise.resolve([]),
                ]);

                const rawFeatures = extractList<unknown>(featureResponse);
                const accessibleFeatures = isSuperAdmin
                    ? normalizeAdminFeatures(rawFeatures)
                    : normalizeRoleFeatures(rawFeatures);
                const target = selectDefaultFeaturePath(
                    accessibleFeatures,
                    configResponse.item?.general?.defaultFeatureId
                );

                if (cancelled) return;
                if (target) {
                    router.replace(target);
                    return;
                }

                setShowFallback(true);
            } catch {
                if (!cancelled) setShowFallback(true);
            } finally {
                if (!cancelled) setResolving(false);
            }
        };

        void resolveDefaultPage();
        return () => {
            cancelled = true;
        };
    }, [router]);

    if (resolving && !showFallback) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <Spin tip="Đang mở trang mặc định..." />
            </div>
        );
    }

    return <DashboardOverview />;
}
```

- [ ] **Step 2: Use the resolver at `/`**

Replace the direct dashboard render in `FE/src/app/(admin)/page.tsx`:

```tsx
import type { Metadata } from "next";
import DefaultFeatureRootPage from "@/components/app/DefaultFeatureRootPage";

export const metadata: Metadata = {
    title: "Tổng quan",
};

export default function HomePage() {
    return <DefaultFeatureRootPage />;
}
```

- [ ] **Step 3: Run focused tests and static checks**

Run:

```bash
cd FE
npm test -- src/lib/default-feature.test.ts src/lib/default-feature-access.test.ts
npx tsc --noEmit
npx eslint src/lib/default-feature.ts src/lib/default-feature-access.ts src/components/app/DefaultFeatureRootPage.tsx src/app/\(admin\)/page.tsx
```

Expected: Tests and TypeScript pass; no new ESLint errors.

### Task 5: Verify End-to-End Behavior

**Files:**
- Verify: `FE/src/app/(admin)/quan-tri/cau-hinh-he-thong/CauHinhHeThongPage.tsx`
- Verify: `FE/src/components/app/DefaultFeatureRootPage.tsx`

- [ ] **Step 1: Build the frontend**

Run:

```bash
cd FE
npm run build
```

Expected: Next.js production build completes successfully.

- [ ] **Step 2: Verify configured redirect**

1. Open `/quan-tri/cau-hinh-he-thong`.
2. Select an enabled feature other than `/`.
3. Save configuration.
4. Open `/`.

Expected: Browser replaces `/` with the selected feature path without briefly rendering the old dashboard.

- [ ] **Step 3: Verify permission fallback**

1. Configure a default feature that is not assigned to a test role.
2. Sign in with that role.
3. Open `/`.

Expected: Browser redirects to the assigned enabled feature with the smallest `orderIndex`.

- [ ] **Step 4: Verify invalid configuration fallback**

Set `general.defaultFeatureId` to a missing/disabled feature UUID or clear all accessible features.

Expected: Missing/disabled UUID falls back to the first accessible feature; no accessible feature renders the existing `DashboardOverview`.

- [ ] **Step 5: Verify loop and external URL protection**

Temporarily create feature paths `/`, `//example.com`, and `https://example.com`.

Expected: All are ignored by the resolver; `/` does not loop and no external navigation occurs.

# GIS Sign-In Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `/signin` page into a modern GIS-branded authentication experience while keeping all existing sign-in, validation, session, and SSO behavior unchanged.

**Architecture:** Keep the current auth route structure and sign-in business logic intact, but split the implementation into a pure presentation-config helper plus two UI surfaces: the auth layout shell and the sign-in form card. The helper provides stable GIS copy and stat-card content that can be covered with `node:test`, while the JSX redesign stays focused on composition, responsiveness, and visual hierarchy.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, `node:test`, ESLint 9

---

## File Structure

- Create: `FE/src/components/auth/signin-showcase.ts`
  Responsibility: export the stable GIS visual copy and showcase-card metadata used by the redesigned sign-in page.
- Create: `FE/src/components/auth/signin-showcase.test.ts`
  Responsibility: lock in the showcase-card order, labels, and mobile-safe copy with the existing `node:test` runner.
- Modify: `FE/src/app/(full-width-pages)/(auth)/layout.tsx`
  Responsibility: upgrade the auth shell into a responsive split layout that can host a richer GIS panel without changing route behavior.
- Modify: `FE/src/components/auth/SignInForm.tsx`
  Responsibility: keep the current auth logic intact while rebuilding the rendered structure into the approved `Atlas Control` layout.
- Modify: `FE/src/app/globals.css`
  Responsibility: add any lightweight keyframes or reusable auth-surface styles needed by the GIS presentation without adding dependencies.

## Task 1: Add a pure GIS sign-in showcase helper and cover it with tests

**Files:**
- Create: `FE/src/components/auth/signin-showcase.ts`
- Create: `FE/src/components/auth/signin-showcase.test.ts`

- [ ] **Step 1: Write the failing test**

Create `FE/src/components/auth/signin-showcase.test.ts` with these assertions:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  GIS_SIGNIN_EYEBROW,
  GIS_SIGNIN_DESCRIPTION,
  GIS_SIGNIN_SHOWCASE_CARDS,
  getGisSignInMobileHeroLines,
} from "./signin-showcase";

test("GIS sign-in copy stays short and product-focused", () => {
  assert.equal(GIS_SIGNIN_EYEBROW, "Nền tảng GIS điều hành số");
  assert.match(GIS_SIGNIN_DESCRIPTION, /dữ liệu không gian/i);
  assert.ok(GIS_SIGNIN_DESCRIPTION.length <= 120);
});

test("GIS sign-in showcase cards keep the approved order and labels", () => {
  assert.deepEqual(
    GIS_SIGNIN_SHOWCASE_CARDS.map((card) => card.label),
    ["Điểm dữ liệu", "Kết nối vùng", "Đồng bộ trạng thái"]
  );

  assert.deepEqual(
    GIS_SIGNIN_SHOWCASE_CARDS.map((card) => card.value),
    ["24 lớp", "08 tuyến", "Trực tuyến"]
  );
});

test("mobile hero lines stay concise for small screens", () => {
  assert.deepEqual(getGisSignInMobileHeroLines(), [
    "Điều hành dữ liệu không gian tập trung",
    "Giám sát bản đồ số theo thời gian thực",
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd FE && node --test src/components/auth/signin-showcase.test.ts`
Expected: FAIL because `signin-showcase.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `FE/src/components/auth/signin-showcase.ts` with this content:

```ts
export type GisSignInShowcaseCard = {
  label: string;
  value: string;
  tone: "brand" | "amber" | "slate";
};

export const GIS_SIGNIN_EYEBROW = "Nền tảng GIS điều hành số";

export const GIS_SIGNIN_DESCRIPTION =
  "Đăng nhập để giám sát, khai thác và điều phối dữ liệu không gian tập trung.";

export const GIS_SIGNIN_SHOWCASE_CARDS: GisSignInShowcaseCard[] = [
  {
    label: "Điểm dữ liệu",
    value: "24 lớp",
    tone: "brand",
  },
  {
    label: "Kết nối vùng",
    value: "08 tuyến",
    tone: "amber",
  },
  {
    label: "Đồng bộ trạng thái",
    value: "Trực tuyến",
    tone: "slate",
  },
];

export function getGisSignInMobileHeroLines(): string[] {
  return [
    "Điều hành dữ liệu không gian tập trung",
    "Giám sát bản đồ số theo thời gian thực",
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd FE && node --test src/components/auth/signin-showcase.test.ts`
Expected: PASS with all three sign-in showcase tests green.

- [ ] **Step 5: Commit**

```bash
git add FE/src/components/auth/signin-showcase.ts FE/src/components/auth/signin-showcase.test.ts
git commit -m "test: cover gis sign-in showcase config"
```

## Task 2: Rebuild the auth shell around the GIS split-screen layout

**Files:**
- Modify: `FE/src/app/(full-width-pages)/(auth)/layout.tsx`
- Reuse: `FE/src/components/auth/signin-showcase.ts`

- [ ] **Step 1: Write the failing structure expectation**

Before changing JSX, capture the required shell structure as an implementation note directly in the plan execution branch. Replace the old layout body only after confirming these targets:

```tsx
<div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(245,159,11,0.14),_transparent_32%),linear-gradient(135deg,#fffdf7_0%,#fff7f6_52%,#fcfcfd_100%)]">
  <ThemeProvider>
    <div className="relative flex min-h-screen flex-col lg:flex-row">
      {children}
      <aside className="relative hidden lg:flex lg:w-[54%] xl:w-[58%]">
        {/* GIS visual panel lives here */}
      </aside>
      <div className="fixed bottom-6 right-6 z-50 hidden sm:block">
        <ThemeTogglerTwo />
      </div>
    </div>
  </ThemeProvider>
</div>
```

This step is intentionally the “red” checkpoint for the shell because the current layout still renders a much simpler dark half-panel with only `GridShape` and the logo.

- [ ] **Step 2: Run typecheck on the untouched shell to confirm implementation is still missing**

Run: `cd FE && npx tsc --noEmit`
Expected: PASS, confirming this task is a visual-behavior gap rather than a current type failure.

- [ ] **Step 3: Write minimal implementation**

Update `FE/src/app/(full-width-pages)/(auth)/layout.tsx` so it:

- removes `GridShape`
- keeps `ThemeProvider`, `ThemeTogglerTwo`, `Image`, and `Link`
- imports `GIS_SIGNIN_SHOWCASE_CARDS` from `@/components/auth/signin-showcase`
- renders a richer `aside` panel with:
  - background gradients and subtle grid overlays
  - the auth logo near the top-left of the panel
  - a compact headline block
  - a stack or row of showcase cards built from `GIS_SIGNIN_SHOWCASE_CARDS`
  - 3 to 5 decorative map nodes / route lines as plain divs

Use this card loop in the panel implementation:

```tsx
<div className="grid gap-3 xl:grid-cols-3">
  {GIS_SIGNIN_SHOWCASE_CARDS.map((card) => (
    <div
      key={card.label}
      className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4 backdrop-blur-sm"
    >
      <p className="text-xs uppercase tracking-[0.24em] text-white/55">{card.label}</p>
      <p className="mt-3 text-lg font-semibold text-white">{card.value}</p>
    </div>
  ))}
</div>
```

- [ ] **Step 4: Run focused validation**

Run: `cd FE && npx tsc --noEmit`
Expected: PASS with the updated auth layout imports and JSX structure.

Run: `cd FE && npm run lint -- src/app/'(full-width-pages)'/'(auth)'/layout.tsx`
Expected: PASS or no new lint errors in the touched auth layout file.

- [ ] **Step 5: Commit**

```bash
git add FE/src/app/(full-width-pages)/(auth)/layout.tsx
git commit -m "feat: redesign auth shell for gis sign-in"
```

## Task 3: Rebuild SignInForm into the Atlas Control card without changing auth logic

**Files:**
- Modify: `FE/src/components/auth/SignInForm.tsx`
- Reuse: `FE/src/components/auth/signin-showcase.ts`
- Reuse: `FE/src/components/form/input/InputField.tsx`
- Reuse: `FE/src/components/ui/button/Button.tsx`

- [ ] **Step 1: Write the failing presentation checkpoint**

Use this exact target structure for the new render tree while keeping all existing handlers and state:

```tsx
<div className="relative flex w-full flex-1 items-stretch lg:w-[46%] xl:w-[42%]">
  <div className="flex w-full flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:px-12 xl:px-16">
    <div className="w-full max-w-md rounded-[28px] border border-white/70 bg-white/88 p-6 shadow-[0_32px_80px_-32px_rgba(16,24,40,0.38)] backdrop-blur xl:p-8">
      {/* eyebrow, title, description, form, errors, actions */}
    </div>
  </div>
</div>
```

Inside the card, the new content must include:

```tsx
<p className="mb-3 inline-flex rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-700">
  {GIS_SIGNIN_EYEBROW}
</p>
<h1 className="text-3xl font-semibold text-gray-900 sm:text-[2rem]">Đăng nhập vào hệ thống</h1>
<p className="mt-3 text-sm leading-6 text-gray-600">{GIS_SIGNIN_DESCRIPTION}</p>
```

This step is the “red” checkpoint because the current component still renders a plain column with a basic title and unframed form.

- [ ] **Step 2: Run typecheck before implementation**

Run: `cd FE && npx tsc --noEmit`
Expected: PASS, confirming no logic bug exists yet and that the remaining work is the approved presentation redesign.

- [ ] **Step 3: Write minimal implementation**

Update `FE/src/components/auth/SignInForm.tsx` with these rules:

- keep all current state, `useEffect`, `handleSubmit`, and `handleSsoSignIn` logic unchanged
- import `GIS_SIGNIN_DESCRIPTION`, `GIS_SIGNIN_EYEBROW`, and `getGisSignInMobileHeroLines` from `./signin-showcase`
- wrap the current form in the new card container
- add a small mobile-only hero strip above the card using `getGisSignInMobileHeroLines()`
- pass `error={Boolean(emailError)}` and `error={Boolean(passwordError)}` into `Input`
- make the primary button slightly taller and more prominent by using:

```tsx
<Button className="h-12 w-full rounded-xl" size="sm" disabled={loading}>
  {loading ? "Đang đăng nhập..." : "Đăng nhập"}
</Button>
```

- restyle the SSO button into a secondary surface that matches the card:

```tsx
<button
  type="button"
  onClick={handleSsoSignIn}
  disabled={loading || ssoLoading}
  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 transition hover:border-brand-200 hover:bg-brand-25 disabled:cursor-not-allowed disabled:opacity-50"
>
  {ssoLoading ? "Đang chuyển hướng SSO..." : "Đăng nhập SSO"}
</button>
```

- [ ] **Step 4: Run focused validation**

Run: `cd FE && npx tsc --noEmit`
Expected: PASS with the redesigned `SignInForm` JSX and imported helper tokens.

Run: `cd FE && npm run lint -- src/components/auth/SignInForm.tsx src/components/auth/signin-showcase.ts`
Expected: PASS or no new lint errors in the touched sign-in files.

- [ ] **Step 5: Commit**

```bash
git add FE/src/components/auth/SignInForm.tsx FE/src/components/auth/signin-showcase.ts
git commit -m "feat: redesign gis sign-in form card"
```

## Task 4: Add lightweight GIS motion and finish responsive polish

**Files:**
- Modify: `FE/src/app/globals.css`
- Modify: `FE/src/app/(full-width-pages)/(auth)/layout.tsx`
- Modify: `FE/src/components/auth/SignInForm.tsx`

- [ ] **Step 1: Write the failing style checkpoint**

Add these style targets to the implementation branch as the acceptance delta from the current UI:

```css
@keyframes authMapPulse {
  0%, 100% { transform: scale(1); opacity: 0.55; }
  50% { transform: scale(1.18); opacity: 1; }
}

@keyframes authCardLiftIn {
  from { transform: translateY(14px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
```

The auth shell and form should apply these motions lightly, not continuously across large surfaces.

- [ ] **Step 2: Run lint/typecheck before the CSS change**

Run: `cd FE && npx tsc --noEmit && npm run lint -- src/app/globals.css src/components/auth/SignInForm.tsx src/app/'(full-width-pages)'/'(auth)'/layout.tsx`
Expected: PASS, confirming the pending work is purely the motion/polish layer.

- [ ] **Step 3: Write minimal implementation**

Update `FE/src/app/globals.css` with the two keyframes plus these utility hooks:

```css
@keyframes authMapPulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.55;
  }

  50% {
    transform: scale(1.18);
    opacity: 1;
  }
}

@keyframes authCardLiftIn {
  from {
    transform: translateY(14px);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}
```

Then apply them narrowly:

- on 2 or 3 map nodes inside `layout.tsx`, use `style={{ animation: "authMapPulse 4.8s ease-in-out infinite" }}` with staggered delays
- on the main sign-in card inside `SignInForm.tsx`, use `style={{ animation: "authCardLiftIn 480ms ease-out" }}`
- keep mobile behavior simple by not rendering the full GIS aside below `lg`

- [ ] **Step 4: Run full frontend verification**

Run: `cd FE && node --test src/components/auth/signin-showcase.test.ts`
Expected: PASS.

Run: `cd FE && npx tsc --noEmit`
Expected: PASS.

Run: `cd FE && npm run lint`
Expected: PASS, or only pre-existing unrelated lint issues outside the touched sign-in files.

- [ ] **Step 5: Commit**

```bash
git add FE/src/app/globals.css FE/src/app/(full-width-pages)/(auth)/layout.tsx FE/src/components/auth/SignInForm.tsx FE/src/components/auth/signin-showcase.ts FE/src/components/auth/signin-showcase.test.ts
git commit -m "feat: polish gis sign-in page presentation"
```

## Spec Coverage Check

- Keeps the current auth behaviors unchanged: Task 3 explicitly preserves all sign-in logic and only changes presentation.
- Adds the approved GIS split layout and right-side map panel: Task 2.
- Adds the left-side `Atlas Control` card hierarchy and secondary SSO action: Task 3.
- Preserves mobile usability while keeping a lighter GIS identity: Tasks 3 and 4.
- Uses existing stack only, with lightweight CSS/SVG-free div presentation and no new dependencies: Tasks 1 through 4.
- Covers motion restraint, responsiveness, and verification: Task 4.

## Placeholder Scan

The plan intentionally avoids `TODO`, `TBD`, “similar to”, or unspecified “add error handling” language. Every code-touching step includes the exact file path, target JSX/CSS/code shape, and verification command.

## Type Consistency Check

- `GIS_SIGNIN_EYEBROW`, `GIS_SIGNIN_DESCRIPTION`, `GIS_SIGNIN_SHOWCASE_CARDS`, and `getGisSignInMobileHeroLines` are defined in Task 1 and reused by name consistently in Tasks 2 and 3.
- The helper file path is consistently `FE/src/components/auth/signin-showcase.ts` across all tasks.
- All validation commands use the existing FE toolchain: `node --test`, `npx tsc --noEmit`, and `npm run lint`.
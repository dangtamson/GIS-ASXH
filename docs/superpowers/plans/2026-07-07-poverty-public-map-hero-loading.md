# Poverty Public Map Hero Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-load hero loading overlay to the public poverty ward map page, keep it visible long enough to avoid flash, and skip it on later refetches.

**Architecture:** Keep the data-fetching flow in `PovertyPublicMapPage.tsx`, add a small set of pure loader-state helpers in `poverty-public-map-utils.ts`, and drive a dedicated overlay component from local first-load state. Put animation primitives in `globals.css` so the JSX stays readable and later refetches can continue using the existing local loading behavior.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Ant Design, Node `--test`

---

## File Structure

- Modify: `FE/src/components/poverty/PovertyPublicMapPage.tsx`
- Modify: `FE/src/components/poverty/poverty-public-map-utils.ts`
- Modify: `FE/src/components/poverty/poverty-public-map-utils.test.ts`
- Modify: `FE/src/app/globals.css`

## Task 1: Add first-load loader timing helpers

**Files:**
- Modify: `FE/src/components/poverty/poverty-public-map-utils.ts`
- Modify: `FE/src/components/poverty/poverty-public-map-utils.test.ts`

- [ ] **Step 1: Write the failing utility tests**

Add tests for the loader timing constants and the two pure gating helpers.

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
    PUBLIC_MAP_INITIAL_LOADER_EXIT_MS,
    PUBLIC_MAP_INITIAL_LOADER_MIN_MS,
    shouldShowPublicMapHeroLoader,
    shouldStartPublicMapHeroLoaderExit,
} from "./poverty-public-map-utils.ts";

test("public map hero loader uses the agreed timing budget", () => {
    assert.equal(PUBLIC_MAP_INITIAL_LOADER_MIN_MS, 900);
    assert.equal(PUBLIC_MAP_INITIAL_LOADER_EXIT_MS, 300);
});

test("shouldShowPublicMapHeroLoader keeps the loader visible during the first request", () => {
    assert.equal(
        shouldShowPublicMapHeroLoader({
            loading: true,
            hasLoadedOnce: false,
            hasData: false,
            hasError: false,
            minimumDelayReached: false,
            isExitAnimating: false,
        }),
        true
    );
});

test("shouldShowPublicMapHeroLoader hides the loader when the first request fails", () => {
    assert.equal(
        shouldShowPublicMapHeroLoader({
            loading: false,
            hasLoadedOnce: false,
            hasData: false,
            hasError: true,
            minimumDelayReached: true,
            isExitAnimating: false,
        }),
        false
    );
});

test("shouldStartPublicMapHeroLoaderExit waits for data and the minimum delay", () => {
    assert.equal(
        shouldStartPublicMapHeroLoaderExit({
            loading: false,
            hasLoadedOnce: false,
            hasData: true,
            hasError: false,
            minimumDelayReached: true,
        }),
        true
    );
});

test("shouldStartPublicMapHeroLoaderExit skips exit when later refetches happen", () => {
    assert.equal(
        shouldStartPublicMapHeroLoaderExit({
            loading: false,
            hasLoadedOnce: true,
            hasData: true,
            hasError: false,
            minimumDelayReached: true,
        }),
        false
    );
});
```

- [ ] **Step 2: Run the focused utility test file and verify failure**

Run: `cd FE && npm test -- src/components/poverty/poverty-public-map-utils.test.ts`

Expected: FAIL because the new timing constants and loader-state helpers do not exist yet.

- [ ] **Step 3: Add the minimal helper implementation**

Extend `FE/src/components/poverty/poverty-public-map-utils.ts` with explicit loader timing values and pure gating functions.

```ts
export const PUBLIC_MAP_INITIAL_LOADER_MIN_MS = 900;
export const PUBLIC_MAP_INITIAL_LOADER_EXIT_MS = 300;

type PublicMapHeroLoaderVisibilityInput = {
    loading: boolean;
    hasLoadedOnce: boolean;
    hasData: boolean;
    hasError: boolean;
    minimumDelayReached: boolean;
    isExitAnimating: boolean;
};

type PublicMapHeroLoaderExitInput = {
    loading: boolean;
    hasLoadedOnce: boolean;
    hasData: boolean;
    hasError: boolean;
    minimumDelayReached: boolean;
};

export function shouldShowPublicMapHeroLoader(input: PublicMapHeroLoaderVisibilityInput): boolean {
    if (input.hasLoadedOnce) {
        return false;
    }

    if (input.hasError && !input.hasData) {
        return false;
    }

    if (input.isExitAnimating) {
        return true;
    }

    if (input.loading) {
        return true;
    }

    return input.hasData && !input.minimumDelayReached;
}

export function shouldStartPublicMapHeroLoaderExit(input: PublicMapHeroLoaderExitInput): boolean {
    if (input.hasLoadedOnce) {
        return false;
    }

    if (input.loading) {
        return false;
    }

    if (input.hasError) {
        return false;
    }

    if (!input.hasData) {
        return false;
    }

    return input.minimumDelayReached;
}
```

- [ ] **Step 4: Re-run the focused utility test file and verify pass**

Run: `cd FE && npm test -- src/components/poverty/poverty-public-map-utils.test.ts`

Expected: PASS for the new first-load loader timing helpers.

- [ ] **Step 5: Commit the helper slice**

```bash
git add FE/src/components/poverty/poverty-public-map-utils.ts \
  FE/src/components/poverty/poverty-public-map-utils.test.ts
git commit -m "feat: add public map loader timing helpers"
```

## Task 2: Add the hero loader overlay and first-load state flow

**Files:**
- Modify: `FE/src/components/poverty/PovertyPublicMapPage.tsx`

- [ ] **Step 1: Write the failing loader wiring change**

Replace the current first-load early return with local state that can keep the overlay visible while the real page mounts underneath.

```ts
const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
const [minimumDelayReached, setMinimumDelayReached] = useState(false);
const [isHeroLoaderExiting, setIsHeroLoaderExiting] = useState(false);
```

Import the helper functions and timing constants.

```ts
import {
    PUBLIC_MAP_INITIAL_LOADER_EXIT_MS,
    PUBLIC_MAP_INITIAL_LOADER_MIN_MS,
    shouldShowPublicMapHeroLoader,
    shouldStartPublicMapHeroLoaderExit,
} from "./poverty-public-map-utils";
```

This step is intentionally incomplete so the next TypeScript run should fail until the effects and overlay rendering are added.

- [ ] **Step 2: Run TypeScript to verify the page is incomplete**

Run: `cd FE && npx tsc --noEmit`

Expected: FAIL with missing state usage or incomplete references in `PovertyPublicMapPage.tsx`.

- [ ] **Step 3: Implement the first-load state machine and overlay component**

Update `FE/src/components/poverty/PovertyPublicMapPage.tsx` so the page mounts immediately, starts a minimum-delay timer on first load, and renders a dedicated overlay loader.

```tsx
function PublicMapHeroLoader({ exiting }: { exiting: boolean }) {
    return (
        <div
            className={[
                "public-map-hero-loader fixed inset-0 z-[1200] overflow-hidden bg-slate-950/5 px-4 py-4 md:px-6 md:py-6",
                exiting ? "public-map-hero-loader--exit" : "",
            ].join(" ").trim()}
            aria-hidden="true"
        >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.22),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.16),_transparent_28%),linear-gradient(135deg,_#f8fafc,_#ecfeff_48%,_#eff6ff)]" />
            <div className="absolute inset-0 public-map-hero-loader__grid" />
            <div className="relative mx-auto flex h-full w-full max-w-7xl flex-col gap-4">
                <section className="rounded-3xl border border-white/70 bg-white/75 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl md:p-7">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-4">
                            <div className="h-8 w-40 rounded-full bg-sky-100/90 public-map-hero-loader__shimmer" />
                            <div className="h-10 w-[min(28rem,80vw)] rounded-2xl bg-slate-200/90 public-map-hero-loader__shimmer" />
                            <div className="h-5 w-[min(22rem,70vw)] rounded-full bg-slate-200/70 public-map-hero-loader__shimmer" />
                        </div>
                        <div className="h-14 w-44 rounded-2xl bg-white/85 ring-1 ring-sky-100 public-map-hero-loader__shimmer" />
                    </div>
                    <div className="mt-5 grid gap-3 md:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div key={index} className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
                                <div className="h-3 w-24 rounded-full bg-slate-200/70 public-map-hero-loader__shimmer" />
                                <div className="mt-3 h-8 w-18 rounded-full bg-slate-300/80 public-map-hero-loader__shimmer" />
                            </div>
                        ))}
                    </div>
                </section>
                <section className="relative min-h-[420px] flex-1 overflow-hidden rounded-[2rem] border border-white/70 bg-white/70 shadow-[0_24px_80px_rgba(14,165,233,0.14)] backdrop-blur-xl">
                    <div className="absolute inset-0 public-map-hero-loader__map-surface" />
                    <div className="absolute left-5 top-5 h-10 w-40 rounded-2xl bg-white/90 shadow-sm public-map-hero-loader__shimmer" />
                    <div className="absolute right-5 top-5 flex gap-2">
                        <span className="h-10 w-10 rounded-2xl bg-white/90 shadow-sm public-map-hero-loader__shimmer" />
                        <span className="h-10 w-10 rounded-2xl bg-white/90 shadow-sm public-map-hero-loader__shimmer" />
                    </div>
                    <span className="public-map-hero-loader__marker public-map-hero-loader__marker--poor" style={{ left: "23%", top: "40%" }} />
                    <span className="public-map-hero-loader__marker public-map-hero-loader__marker--near-poor" style={{ left: "52%", top: "55%" }} />
                    <span className="public-map-hero-loader__marker public-map-hero-loader__marker--poor" style={{ left: "68%", top: "32%" }} />
                    <div className="absolute bottom-5 left-5 grid w-[min(20rem,calc(100%-2.5rem))] gap-3 md:grid-cols-2">
                        <div className="h-24 rounded-2xl bg-white/88 shadow-sm public-map-hero-loader__shimmer" />
                        <div className="h-24 rounded-2xl bg-white/88 shadow-sm public-map-hero-loader__shimmer" />
                    </div>
                </section>
            </div>
        </div>
    );
}
```

Add the first-load timing effects and derive the overlay visibility.

```tsx
useEffect(() => {
    if (hasLoadedOnce) {
        return;
    }

    setMinimumDelayReached(false);

    const minimumDelayTimer = window.setTimeout(() => {
        setMinimumDelayReached(true);
    }, PUBLIC_MAP_INITIAL_LOADER_MIN_MS);

    return () => {
        window.clearTimeout(minimumDelayTimer);
    };
}, [hasLoadedOnce, slug]);

const hasData = Boolean(data);
const hasError = Boolean(error);
const shouldExitHeroLoader = shouldStartPublicMapHeroLoaderExit({
    loading,
    hasLoadedOnce,
    hasData,
    hasError,
    minimumDelayReached,
});

useEffect(() => {
    if (!shouldExitHeroLoader) {
        return;
    }

    setIsHeroLoaderExiting(true);

    const exitTimer = window.setTimeout(() => {
        setIsHeroLoaderExiting(false);
        setHasLoadedOnce(true);
    }, PUBLIC_MAP_INITIAL_LOADER_EXIT_MS);

    return () => {
        window.clearTimeout(exitTimer);
    };
}, [shouldExitHeroLoader]);

const showHeroLoader = shouldShowPublicMapHeroLoader({
    loading,
    hasLoadedOnce,
    hasData,
    hasError,
    minimumDelayReached,
    isExitAnimating: isHeroLoaderExiting,
});
```

Render the normal page, keep the existing error branch, and mount the overlay on top instead of returning plain `Skeleton` blocks.

```tsx
if (error && !data && !showHeroLoader) {
    return (
        <div className="mx-auto max-w-4xl p-4 md:p-6">
            <Alert ... />
        </div>
    );
}

return (
    <>
        {showHeroLoader ? <PublicMapHeroLoader exiting={isHeroLoaderExiting} /> : null}
        <div className="min-w-0 space-y-4 bg-slate-50 p-4 md:p-6">
            {/* existing public page content */}
        </div>
    </>
);
```

- [ ] **Step 4: Run TypeScript and verify the page compiles**

Run: `cd FE && npx tsc --noEmit`

Expected: PASS with the new loader state, helper imports, and overlay component wired correctly.

- [ ] **Step 5: Commit the page integration slice**

```bash
git add FE/src/components/poverty/PovertyPublicMapPage.tsx
git commit -m "feat: add public map hero loading overlay"
```

## Task 3: Add the animation styles and verify the user-facing flow

**Files:**
- Modify: `FE/src/app/globals.css`
- Modify: `FE/src/components/poverty/PovertyPublicMapPage.tsx`

- [ ] **Step 1: Add the failing style hooks**

Keep the class names from `PublicMapHeroLoader` in place and add the CSS hooks they depend on.

```css
@keyframes public-map-hero-loader-shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(220%);
  }
}

@keyframes public-map-hero-loader-float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}

@keyframes public-map-hero-loader-exit {
  from {
    opacity: 1;
    filter: blur(0);
  }
  to {
    opacity: 0;
    filter: blur(10px);
  }
}
```

This step is intentionally partial so the loader will still look unfinished until the class selectors are added.

- [ ] **Step 2: Add the minimal loader styles**

Extend `FE/src/app/globals.css` with the loader selectors used by the component.

```css
.public-map-hero-loader {
  opacity: 1;
}

.public-map-hero-loader--exit {
  animation: public-map-hero-loader-exit 300ms ease forwards;
}

.public-map-hero-loader__grid {
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.14) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.14) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: linear-gradient(to bottom, rgba(15, 23, 42, 0.5), transparent 90%);
}

.public-map-hero-loader__shimmer {
  position: relative;
  overflow: hidden;
}

.public-map-hero-loader__shimmer::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent);
  animation: public-map-hero-loader-shimmer 1.8s ease-in-out infinite;
}

.public-map-hero-loader__map-surface {
  background:
    radial-gradient(circle at 18% 24%, rgba(14, 165, 233, 0.18), transparent 18%),
    radial-gradient(circle at 70% 60%, rgba(56, 189, 248, 0.16), transparent 22%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(226, 232, 240, 0.6));
}

.public-map-hero-loader__marker {
  position: absolute;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  animation: public-map-hero-loader-float 2.4s ease-in-out infinite;
  box-shadow: 0 0 0 10px currentColor;
  opacity: 0.82;
}

.public-map-hero-loader__marker::after {
  content: "";
  position: absolute;
  inset: -10px;
  border: 2px solid currentColor;
  border-radius: 999px;
  animation: poverty-marker-pulse 1.5s ease-out infinite;
}

.public-map-hero-loader__marker--poor {
  color: rgba(225, 29, 72, 0.28);
  background: rgb(225, 29, 72);
}

.public-map-hero-loader__marker--near-poor {
  color: rgba(234, 88, 12, 0.24);
  background: rgb(234, 88, 12);
}
```

- [ ] **Step 3: Run the focused frontend verification commands**

Run: `cd FE && npm test -- src/components/poverty/poverty-public-map-utils.test.ts`
Expected: PASS

Run: `cd FE && npx tsc --noEmit`
Expected: PASS

Run: `cd FE && npx eslint src/components/poverty/PovertyPublicMapPage.tsx src/components/poverty/poverty-public-map-utils.ts`
Expected: exit `0` or only pre-existing warnings unrelated to the new loader code

- [ ] **Step 4: Commit the style and verification slice**

```bash
git add FE/src/app/globals.css \
  FE/src/components/poverty/PovertyPublicMapPage.tsx \
  FE/src/components/poverty/poverty-public-map-utils.ts \
  FE/src/components/poverty/poverty-public-map-utils.test.ts
git commit -m "style: polish public map hero loading"
```

## Spec Coverage Check

- Dedicated first-load hero loader: Task 2
- Minimum display duration to avoid flashing: Tasks 1 and 2
- Smooth exit transition: Tasks 2 and 3
- No full-screen hero loader on later refetches: Tasks 1 and 2
- Error-state preservation: Task 2
- Lightweight CSS-based motion consistent with the current public map: Task 3
- Mobile and desktop-safe placeholder structure: Task 2

## Self-Review Notes

- No placeholder steps remain; every code-changing step includes exact snippets.
- Helper names are consistent across tests, utilities, and component wiring.
- The plan stays inside the approved scope and does not alter backend or public-route behavior.

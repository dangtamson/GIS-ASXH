# Poverty Public Map Hero Loading Design

## Goal

Add a polished first-load hero loading experience to the public poverty ward map page so outside viewers see a modern, intentional transition instead of generic skeleton blocks.

## Scope

This design covers:

- The initial loading experience of `FE/src/components/poverty/PovertyPublicMapPage.tsx`.
- The loading transition between first render and first successful public-data render.
- Supporting animation styles needed for the public-facing loader.

This design does not cover:

- Backend API changes.
- Changes to the public route structure or slug behavior.
- New map features, new public data fields, or public interactivity changes.
- Replacing the existing loading behavior for later refetches after the first page load.

## Requirements

### Functional Requirements

- The public page must show a dedicated hero loading state on the first page load.
- The hero loading state must only appear before the first successful data render for a given page visit.
- Once the first load completes, later refreshes must not show the full-page hero loading again.
- The hero loading state must remain visible for a short minimum duration so fast API responses do not cause a flash.
- Existing error handling must remain intact. If the first load fails, the error state must still render instead of the hero.

### UX Requirements

- The loader must feel visually consistent with the public map page, using the same bright public-facing visual language.
- The loader must suggest the final content structure:
  - public readonly badge
  - page title block
  - summary cards
  - large map area
- The map area placeholder should include subtle motion so the page feels alive without becoming distracting.
- The transition out of the loader should be smooth, brief, and modern.
- The layout must remain legible on mobile and desktop.

### Non-Functional Requirements

- The loader must not delay data fetching; it only controls presentation timing.
- The implementation should avoid introducing complex global state.
- Animation should be lightweight and based on CSS where practical.

## Recommended Approach

Render the real page immediately, but cover it during the first load with a dedicated full-page overlay loader that uses a minimum-display timer and a short fade-out transition.

This is the best fit because it preserves the current page architecture, keeps data fetching behavior simple, and creates a more premium public experience without introducing route-level complexity. It also avoids showing a disconnected splash screen that could make the transition feel like a second page navigation.

## Alternatives Considered

### Alternative 1: Keep the current `Skeleton` blocks and restyle them

Reject. This improves appearance only marginally and still feels like a generic admin loading state rather than a public-facing experience.

### Alternative 2: Build a standalone splash screen before rendering the page

Reject. A separate splash screen creates a harder transition, duplicates layout concepts, and is more likely to feel disconnected from the public page.

### Alternative 3: Animate the real page sections progressively without an overlay

Reject for now. This can look good, but it is harder to control during the empty-data phase and provides less protection against first-load layout flashing.

## UI Design

### Overall Structure

Add a `PublicMapHeroLoader` presentation component that covers the public page only during the first load.

The loader should include three visual zones:

- a bright layered background with soft gradients and a faint map/grid atmosphere
- a hero content block with readonly badge and title placeholders
- a large map placeholder with animated marker pulses and card placeholders

### Hero Content

The top portion should mirror the actual page hierarchy:

- readonly badge placeholder
- one main title line
- one secondary text line
- one compact metric pill on the right

This makes the transition feel like the real page is resolving into focus rather than being replaced.

### Summary Card Row

Show four compact summary placeholders matching the real cards:

- poor households
- near-poor households
- total tracked households
- active households

Each card should use subtle shimmer or opacity motion, not harsh color cycling.

### Map Placeholder

The map placeholder should be the visual anchor of the loader:

- large rounded container
- faint grid or contour-like pattern
- several static fake control chips
- a small set of animated marker dots or pulses

The marker pulse rhythm should align visually with the existing poverty map marker pulse language so the public page feels cohesive.

## State and Data Flow Design

### Local State

Extend `PovertyPublicMapPage.tsx` with local first-load presentation state:

- `loading`: existing request state
- `hasLoadedOnce`: whether the page has already completed its first successful load
- `showInitialLoader`: whether the hero loader overlay is currently visible

### First-Load Flow

1. On mount, start the public data request immediately.
2. At the same time, start a minimum-display timer of about `900ms`.
3. When the request succeeds, store data normally.
4. Only hide the hero loader after both conditions are true:
   - data request finished successfully
   - minimum-display timer elapsed
5. Run a short exit animation of about `250-350ms`.
6. Mark `hasLoadedOnce = true` so later refreshes skip the hero loader.

### Failure Handling

- If the first request fails, cancel the hero loader and show the existing error `Alert`.
- If later refetches fail after the first successful load, preserve the current behavior and do not restore the full-screen hero loader.

## Frontend Architecture

Primary implementation file:

- `FE/src/components/poverty/PovertyPublicMapPage.tsx`

Supporting styles:

- `FE/src/app/globals.css`, if custom keyframes are needed beyond utility classes

Recommended structure:

- keep the data-fetching logic in `PovertyPublicMapPage`
- add a focused `PublicMapHeroLoader` component in the same file unless it becomes too large
- keep animation primitives in CSS so JSX remains readable

## Transition Design

- The hero loader should start fully visible on first load.
- On completion, it should fade out and lightly blur while the real page underneath is already mounted.
- The exit should feel quick and clean, not theatrical.
- Later user-initiated refreshes should continue using the existing local loading states for the map and data panels.

## Testing Strategy

### Verification Scenarios

- First visit to a public map link shows the hero loader.
- Fast API responses still keep the loader visible long enough to avoid flashing.
- Successful first load transitions smoothly into the real page.
- Refresh actions after first load do not bring back the full-page hero loader.
- First-load API failures show the existing error state instead of hanging on the loader.
- Empty public datasets still reach the normal empty state after the loader exits.

### Verification Commands

- `cd FE && npx tsc --noEmit`
- targeted lint or file-level checks for touched frontend files if needed

## Risks and Mitigations

- Risk: the loader may feel slow if the minimum-display time is too long.
  Mitigation: keep the minimum at about `900ms` and the exit animation short.

- Risk: overly strong animation could feel distracting on a government/public-information page.
  Mitigation: use restrained shimmer and marker pulse motion with a bright, clean palette.

- Risk: refetch paths could accidentally reuse the first-load overlay.
  Mitigation: gate the overlay behind an explicit first-success lifecycle flag instead of raw `loading`.

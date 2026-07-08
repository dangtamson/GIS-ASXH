# Poverty Map Area Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `Danh sách` and `Khu vực` tabs to the poverty map left panel, with area summary cards that filter both the map and the list by the current page-filtered dataset.

**Architecture:** Keep API behavior unchanged and derive area summaries from the existing `markers` prop inside the poverty map flow. Move aggregation and area-key filtering into pure helpers in `poverty-location-utils.ts`, then wire those helpers into `PovertyLeafletMap.tsx` with a small amount of new UI state.

**Tech Stack:** React, Next.js, Ant Design, TypeScript, Node `--test`.

---

### Task 1: Add pure area summary helpers

**Files:**
- Modify: `FE/src/components/poverty/poverty-location-utils.ts`
- Modify: `FE/src/components/poverty/poverty-location-utils.test.ts`

- [ ] Write failing tests for area grouping, sorting, and area-key filtering.
- [ ] Run `cd FE && npm test -- src/components/poverty/poverty-location-utils.test.ts` and verify failure.
- [ ] Implement the minimal helper functions and types in `poverty-location-utils.ts`.
- [ ] Re-run the focused test file and verify pass.

### Task 2: Wire area filtering into the map screen

**Files:**
- Modify: `FE/src/components/poverty/PovertyLeafletMap.tsx`

- [ ] Add `activeLeftTab` and `selectedAreaKey` local state.
- [ ] Derive area summaries, selected-area markers, visible markers, and list markers from the new helpers.
- [ ] Reset invalid area selection when top-level page filters replace the dataset.
- [ ] Keep marker focus, detail, and edit behavior unchanged.

### Task 3: Render the new `Khu vực` tab UI

**Files:**
- Modify: `FE/src/components/poverty/PovertyLeafletMap.tsx`

- [ ] Replace the current single left-panel body with `Tabs`.
- [ ] Keep the existing `Danh sách` tab layout and search behavior, but scope it to the selected area.
- [ ] Add the `Khu vực` tab with `Tất cả khu vực` and per-area summary cards.
- [ ] Highlight the active area card and make click reset/filter behavior explicit.

### Task 4: Verify the integrated screen

**Files:**
- Modify: `FE/src/components/poverty/PovertyLeafletMap.tsx`
- Modify: `FE/src/components/poverty/poverty-location-utils.ts`
- Modify: `FE/src/components/poverty/poverty-location-utils.test.ts`

- [ ] Run `cd FE && npm test -- src/components/poverty/poverty-location-utils.test.ts`.
- [ ] Run `cd FE && npx tsc --noEmit`.
- [ ] Run `cd FE && npx eslint src/components/poverty/PovertyLeafletMap.tsx src/components/poverty/poverty-location-utils.ts src/components/poverty/poverty-location-utils.test.ts`.
- [ ] Manually confirm the area tab filters both the left list and the visible map markers.

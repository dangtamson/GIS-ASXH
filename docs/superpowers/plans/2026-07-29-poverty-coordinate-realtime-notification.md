# Thông báo realtime cập nhật tọa độ hộ nghèo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phát thông báo Supabase Realtime tới tất cả người đang mở bản đồ trong cùng workspace khi luồng thu thập cập nhật tọa độ hộ nghèo.

**Architecture:** Backend phát Supabase Broadcast sau khi PATCH hộ thành công, chỉ khi `changeSource` là `COLLECTION` và tọa độ thực sự thay đổi. Frontend tạo channel theo workspace hiện tại, lắng nghe event và hiển thị toast mà không thay đổi marker hoặc tải lại dữ liệu.

**Tech Stack:** Express/TypeScript, Drizzle ORM, `@supabase/supabase-js`, Next.js/React, Ant Design notification, Vitest/Node test.

---

## Files and responsibilities

- Modify `BE/src/handlers/admin/resources/poverty/poverty.schemas.ts`: validate optional `changeSource`.
- Modify `BE/src/handlers/admin/resources/poverty/poverty.repository.ts`: exclude `changeSource` from database update payload and expose actor display name lookup.
- Create `BE/src/services/povertyRealtime.ts`: publish typed workspace-scoped Broadcast and swallow/log transport failures.
- Modify `BE/src/handlers/admin/resources/poverty/poverty.handlers.ts`: compare coordinates, load actor name, publish only collection coordinate changes.
- Modify `FE/src/components/poverty/collection/poverty-collection-utils.ts`: include `changeSource: "COLLECTION"` in step-one update payload.
- Modify `FE/src/components/poverty/collection/poverty-collection-utils.test.ts`: test source marker in update payload.
- Create `FE/src/lib/poverty-realtime.ts`: browser Supabase client, channel name/event constants, payload type and time/message formatter.
- Create `FE/src/hooks/usePovertyCoordinateRealtime.ts`: subscribe/unsubscribe hook per workspace.
- Create `FE/src/lib/poverty-realtime.test.ts`: test channel/payload/message helpers without a browser connection.
- Modify `FE/src/components/poverty/PovertyMapPage.tsx`: subscribe on mount and show the requested notification only.
- Modify `FE/package.json` and `FE/pnpm-lock.yaml`: add `@supabase/supabase-js`.
- Modify `FE/.env.example`: document public Supabase URL and publishable key.

### Task 1: Add source metadata and backend coordinate-change detection

**Files:**
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.schemas.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.ts`
- Test: `BE/src/handlers/admin/resources/poverty/poverty.schemas.test.ts`

- [ ] **Step 1: Add failing schema tests.**

  Add tests asserting `householdUpdateSchema.safeParse({ latitude: 10, longitude: 105, changeSource: "COLLECTION" })` succeeds, `"MAP"` succeeds, and `"OTHER"` fails.

- [ ] **Step 2: Run the focused schema test.**

  ```bash
  cd BE
  npm test -- poverty.schemas.test.ts
  ```

  Expected: the new `changeSource` assertion fails before the schema change.

- [ ] **Step 3: Add the optional schema field and strip it before persistence.**

  Add `changeSource: z.enum(["COLLECTION", "MAP"]).optional()` to `householdCreateSchema`. Update the existing payload cleanup helper so it removes both `changeNote` and `changeSource` before `poorHouseholds` insert/update. The value is request metadata, not a database column.

- [ ] **Step 4: Run the focused schema tests.**

  ```bash
  npm test -- poverty.schemas.test.ts
  ```

  Expected: PASS for the new assertions and all existing schema tests, subject to any pre-existing environment failures.

- [ ] **Step 5: Commit schema metadata.**

  ```bash
  git add BE/src/handlers/admin/resources/poverty/poverty.schemas.ts BE/src/handlers/admin/resources/poverty/poverty.repository.ts BE/src/handlers/admin/resources/poverty/poverty.schemas.test.ts
  git commit -m "feat: mark poverty coordinate update source"
  ```

### Task 2: Implement Supabase Broadcast publisher

**Files:**
- Create: `BE/src/services/povertyRealtime.ts`
- Test: `BE/src/services/povertyRealtime.test.ts`

- [ ] **Step 1: Write failing publisher tests with a mocked Supabase admin client.**

  Cover:

  ```ts
  expect(buildPovertyCoordinateChannel("workspace-1")).toBe(
    "poverty-household-coordinate-updates:workspace-1"
  );
  const payload = {
    householdId: "household-1",
    householdHeadName: "Trần Văn B",
    actorName: "Nguyễn Văn A",
    updatedAt: "2026-07-29T03:30:00.000Z"
  };

  expect(buildPovertyCoordinateEvent(payload)).toEqual({
    type: "broadcast",
    event: "poverty_coordinate_updated",
    payload
  });
  ```

  Mock the client so a successful send resolves and a rejected/errored send does not throw from `broadcastPovertyCoordinateUpdate`.

- [ ] **Step 2: Run the focused publisher test and verify it fails because the module is missing.**

  ```bash
  cd BE
  npm test -- povertyRealtime.test.ts
  ```

  Expected: FAIL with module/function not found.

- [ ] **Step 3: Add the typed publisher.**

  Export `PovertyCoordinateUpdateEvent`, `POVERTY_COORDINATE_UPDATE_EVENT`, `buildPovertyCoordinateChannel`, `buildPovertyCoordinateEvent`, and `broadcastPovertyCoordinateUpdate(workspaceId, payload)`. Use `getSupabaseAdmin()`, subscribe a channel, send the broadcast, remove the channel in `finally`, and catch/log all Supabase failures so the caller's successful API response is never changed.

- [ ] **Step 4: Run publisher tests and verify they pass.**

  ```bash
  npm test -- povertyRealtime.test.ts
  ```

  Expected: PASS.

- [ ] **Step 5: Commit the publisher.**

  ```bash
  git add BE/src/services/povertyRealtime.ts BE/src/services/povertyRealtime.test.ts
  git commit -m "feat: publish poverty coordinate realtime events"
  ```

### Task 3: Wire backend handler to publish collection updates

**Files:**
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.handlers.ts`
- Test: `BE/src/handlers/admin/resources/poverty/poverty.handlers.test.ts`

- [ ] **Step 1: Add a repository helper test for actor display name.**

  Extend the existing repository mock coverage for a helper that selects `accounts.fullName` by account UUID and returns the name or `null`. Keep the helper read-only.

- [ ] **Step 2: Add failing handler tests for publish conditions.**

  Mock `broadcastPovertyCoordinateUpdate` and the repository update/read helpers. Assert it is called exactly once with workspace ID, household ID, actor name, head name, and updated timestamp when old/new coordinates differ and `changeSource` is `COLLECTION`.

  Add negative cases for unchanged coordinates, `changeSource: "MAP"`, missing workspace ID, failed update, and validation failure; all must avoid publishing.

- [ ] **Step 3: Run the focused handler test and verify new assertions fail before wiring.**

  ```bash
  cd BE
  npm test -- poverty.handlers.test.ts
  ```

  Expected: existing baseline issues may prevent collection; once imports run, new publish assertions fail until the handler is wired.

- [ ] **Step 4: Implement the handler wiring.**

  In `updateHouseholdAdminById`, retain the pre-update household already loaded for scope validation. After a successful update, check:

  ```ts
  const coordinatesChanged =
    household.latitude !== item.latitude || household.longitude !== item.longitude;
  const isCollectionCoordinateUpdate = body.changeSource === "COLLECTION";
  ```

  If both are true and `req.workspaceId` exists, read the actor's `fullName`, build the event from `item`, and call `broadcastPovertyCoordinateUpdate`. Do not await a failure in a way that changes the HTTP result; the publisher already absorbs transport errors. Keep existing audit-log behavior intact.

- [ ] **Step 5: Run backend focused checks.**

  ```bash
  npm test -- povertyRealtime.test.ts poverty.schemas.test.ts poverty.handlers.test.ts
  npx eslint src/services/povertyRealtime.ts src/handlers/admin/resources/poverty/poverty.handlers.ts src/handlers/admin/resources/poverty/poverty.repository.ts
  ```

  Expected: new pure/publisher/schema tests pass; report any pre-existing handler/repository environment failures separately.

- [ ] **Step 6: Commit backend integration.**

  ```bash
  git add BE/src/handlers/admin/resources/poverty/poverty.handlers.ts BE/src/handlers/admin/resources/poverty/poverty.repository.ts BE/src/handlers/admin/resources/poverty/poverty.handlers.test.ts
  git commit -m "feat: notify workspace on collected coordinate updates"
  ```

### Task 4: Add frontend Supabase realtime client and message helpers

**Files:**
- Modify: `FE/package.json`
- Modify: `FE/pnpm-lock.yaml`
- Modify: `FE/.env.example`
- Create: `FE/src/lib/poverty-realtime.ts`
- Create: `FE/src/lib/poverty-realtime.test.ts`

- [ ] **Step 1: Add the frontend dependency and environment documentation.**

  ```bash
  cd FE
  pnpm add @supabase/supabase-js
  ```

  Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to `.env.example`; never expose the backend secret key.

- [ ] **Step 2: Write failing pure helper tests.**

  Test channel naming, event name, invalid payload rejection, and this exact Vietnamese message shape:

  ```ts
  formatPovertyCoordinateNotification({
    actorName: "Nguyễn Văn A",
    householdHeadName: "Trần Văn B",
    updatedAt: "2026-07-29T03:30:00.000Z"
  })
  // "Nguyễn Văn A đã thu thập cập nhật hộ: Trần Văn B lúc 10:30 29/07/2026"
  ```

- [ ] **Step 3: Run the focused frontend test and verify it fails because the helper is missing.**

  ```bash
  pnpm test -- src/lib/poverty-realtime.test.ts
  ```

  Expected: FAIL with module not found.

- [ ] **Step 4: Implement the client and pure helpers.**

  Create a browser-safe singleton Supabase client only when both public env values exist. Export the channel/event constants, payload parser, message formatter, and `formatPovertyCoordinateNotification` using `Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" })` or an equivalent deterministic formatter.

- [ ] **Step 5: Run the focused frontend test and verify it passes.**

  ```bash
  pnpm test -- src/lib/poverty-realtime.test.ts
  ```

  Expected: PASS.

- [ ] **Step 6: Commit frontend client/helpers.**

  ```bash
  git add FE/package.json FE/pnpm-lock.yaml FE/.env.example FE/src/lib/poverty-realtime.ts FE/src/lib/poverty-realtime.test.ts
  git commit -m "feat: add poverty realtime client helpers"
  ```

### Task 5: Subscribe the poverty map and show toast

**Files:**
- Create: `FE/src/hooks/usePovertyCoordinateRealtime.ts`
- Test: `FE/src/hooks/usePovertyCoordinateRealtime.test.ts` (if hook test setup supports mocked Supabase)
- Modify: `FE/src/components/poverty/PovertyMapPage.tsx`

- [ ] **Step 1: Add a hook contract test or mocked-client test.**

  Assert that a workspace ID creates one channel subscription, forwards only valid `poverty_coordinate_updated` payloads to the callback, and calls `removeChannel` on cleanup.

- [ ] **Step 2: Implement `usePovertyCoordinateRealtime(workspaceId, onUpdate)`.**

  Create the channel from `buildPovertyCoordinateChannel(workspaceId)`, register the broadcast event, subscribe, and remove it in the effect cleanup. Do nothing when workspace ID or public Supabase env values are missing. Keep callback dependencies stable with `useCallback` in the page.

- [ ] **Step 3: Integrate the hook into `PovertyMapPage`.**

  Read the current workspace with `getWorkspaceId()`. Pass a stable callback that calls:

  ```ts
  notification.info({
    message: "Cập nhật tọa độ hộ nghèo",
    description: formatPovertyCoordinateNotification(event)
  });
  ```

  Do not call `loadMarkers`, `setMarkers`, or router navigation from the callback. Keep the existing map notification behavior unchanged.

- [ ] **Step 4: Run frontend checks.**

  ```bash
  cd FE
  pnpm test -- src/lib/poverty-realtime.test.ts
  pnpm exec eslint src/lib/poverty-realtime.ts src/hooks/usePovertyCoordinateRealtime.ts src/components/poverty/PovertyMapPage.tsx
  pnpm exec tsc -p tsconfig.json --noEmit
  ```

  Expected: new tests pass and changed files have no lint/type errors; report unrelated existing failures separately.

- [ ] **Step 5: Commit map integration.**

  ```bash
  git add FE/src/hooks/usePovertyCoordinateRealtime.ts FE/src/hooks/usePovertyCoordinateRealtime.test.ts FE/src/components/poverty/PovertyMapPage.tsx
  git commit -m "feat: show realtime poverty coordinate notifications on map"
  ```

### Task 6: Final verification

**Files:** No further source changes expected.

- [ ] **Step 1: Run focused BE and FE tests together.**

  ```bash
  cd BE
  npm test -- povertyRealtime.test.ts poverty.schemas.test.ts
  cd ../FE
  pnpm test -- src/lib/poverty-realtime.test.ts
  ```

- [ ] **Step 2: Run formatting and inspect the diff.**

  ```bash
  git diff --check HEAD~4..HEAD
  git status --short
  ```

  Expected: only planned BE/FE source, lockfile, environment example, test, spec, and plan files are changed; no generated API files or map data are modified.

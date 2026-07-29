# Theo dõi thay đổi hộ nghèo trong nhật ký hệ thống Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ghi các thay đổi hộ nghèo, thành viên, đánh giá, hoàn cảnh và hỗ trợ vào bảng audit log hiện có mà không thay đổi giao diện nhật ký hệ thống.

**Architecture:** Giữ `household_change_logs` làm lịch sử chi tiết nghiệp vụ. Sau mỗi thao tác CRUD thành công trong poverty admin handler, gọi `createAuditLog` với action/entity riêng, request context và chi tiết lấy từ bản ghi thay đổi gần nhất; audit failure không làm hỏng thao tác chính theo chính sách hiện tại.

**Tech Stack:** Express, TypeScript, Drizzle ORM, Zod, Vitest, Next.js/React (không thay đổi frontend trong phạm vi này).

---

## Files and responsibilities

- Modify `BE/src/services/auditLog.ts`: thêm action/entity constants và helper typed cho audit sự kiện hộ nghèo.
- Modify `BE/src/handlers/admin/resources/poverty/poverty.handlers.ts`: phát audit log sau các thao tác thành công trong 5 nhóm nghiệp vụ, truyền request context.
- Modify `BE/src/handlers/admin/resources/poverty/poverty.repository.ts`: expose/read dữ liệu change log gần nhất nếu handler cần chi tiết old/new mà không lặp logic nghiệp vụ.
- Modify or create `BE/src/services/auditLog.test.ts` and/or `BE/src/handlers/admin/resources/poverty/poverty.handlers.test.ts`: kiểm tra mapping và đảm bảo thành công/thất bại tạo log đúng điều kiện.
- Do not modify `FE/src/app/(admin)/quan-tri/log-he-thong/LogHeThongPage.tsx`: endpoint và bảng hiện tại đã hiển thị được các audit record mới.

### Task 1: Add poverty audit vocabulary and typed payload helper

**Files:**
- Modify: `BE/src/services/auditLog.ts`
- Test: `BE/src/services/auditLog.test.ts` (create if absent)

- [ ] **Step 1: Write failing unit tests for action/entity constants and details shape.**

  Test the constants for all required operations:

  ```ts
  expect(AUDIT_ACTIONS.POVERTY_HOUSEHOLD_CREATED).toBe("poverty_household_created");
  expect(AUDIT_ACTIONS.POVERTY_MEMBER_DELETED).toBe("poverty_member_deleted");
  expect(AUDIT_ACTIONS.POVERTY_ASSESSMENT_UPDATED).toBe("poverty_assessment_updated");
  expect(AUDIT_ACTIONS.POVERTY_CONTEXT_HISTORY_UPDATED).toBe("poverty_context_history_updated");
  expect(AUDIT_ACTIONS.POVERTY_SUPPORT_CREATED).toBe("poverty_support_created");
  expect(ENTITY_TYPES.POVERTY_HOUSEHOLD).toBe("poverty_household");
  ```

- [ ] **Step 2: Run the focused test and verify it fails because constants are missing.**

  Run from `BE`:

  ```bash
  npm test -- auditLog.test.ts
  ```

  Expected: FAIL with missing exported constant/property errors.

- [ ] **Step 3: Add the constants and a small helper for consistent poverty details.**

  Add constants to the existing `AUDIT_ACTIONS` and `ENTITY_TYPES` objects. Add a helper with this contract:

  ```ts
  export type PovertyAuditDetails = {
    householdId: string;
    objectType: string;
    objectId: string;
    changeNote?: string | null;
    oldData?: Record<string, unknown> | null;
    newData?: Record<string, unknown> | null;
  };

  export const createPovertyAuditLog = async (
    action: string,
    entityType: string,
    actorId: string,
    entityId: string,
    details: PovertyAuditDetails,
    req: Request
  ): Promise<void> => {
    await createAuditLog({ action, entityType, entityId, actorId, details }, req);
  };
  ```

  Preserve the existing non-throwing behavior of `createAuditLog`.

- [ ] **Step 4: Run the focused test and verify it passes.**

  ```bash
  npm test -- auditLog.test.ts
  ```

  Expected: PASS.

- [ ] **Step 5: Commit the audit vocabulary.**

  ```bash
  git add BE/src/services/auditLog.ts BE/src/services/auditLog.test.ts
  git commit -m "feat: add poverty audit log vocabulary"
  ```

### Task 2: Add a repository accessor for the latest household change record

**Files:**
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.ts`
- Test: `BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts`

- [ ] **Step 1: Add a failing repository unit test for latest change-log mapping.**

  Extend the existing repository test mocks to assert that the accessor returns the newest row mapped with `householdId`, `objectType`, `objectId`, `oldData`, `newData`, and `changeNote`. Cover the empty result as `null`.

- [ ] **Step 2: Run the focused repository test and verify it fails because the accessor is missing.**

  ```bash
  npm test -- poverty.repository.test.ts
  ```

  Expected: FAIL on the new accessor import/call.

- [ ] **Step 3: Implement `getLatestChangeLog(householdId)` beside `listChangeLogs`.**

  Query `householdChangeLogs`, left join `accounts`, filter by household ID, order by `changedAt DESC`, limit 1, and return the existing `mapHouseholdChangeLogRow` result or `null`. Do not change `insertChangeLog` or existing history behavior.

- [ ] **Step 4: Run the repository test suite.**

  ```bash
  npm test -- poverty.repository.test.ts
  ```

  Expected: PASS, including all existing repository tests.

- [ ] **Step 5: Commit the accessor.**

  ```bash
  git add BE/src/handlers/admin/resources/poverty/poverty.repository.ts BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts
  git commit -m "feat: expose latest poverty household change log"
  ```

### Task 3: Audit household, member, assessment, context, and support handlers

**Files:**
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.handlers.ts`
- Test: `BE/src/handlers/admin/resources/poverty/poverty.handlers.test.ts`

- [ ] **Step 1: Write failing handler tests for successful events.**

  Mock `createPovertyAuditLog`, repository CRUD functions, and scope checks. Assert one audit call after each of these successful handlers:

  - `createHouseholdAdmin`
  - `updateHouseholdAdminById`
  - `deleteHouseholdAdminById`
  - `createHouseholdMemberAdmin`
  - `updateHouseholdMemberAdminById`
  - `deleteHouseholdMemberAdminById`
  - `createHouseholdAssessmentAdmin`
  - `updateHouseholdAssessmentAdminById`
  - `updateHouseholdContextHistoryAdminById`
  - `createHouseholdSupportAdmin`
  - `updateHouseholdSupportAdminById`
  - `deleteHouseholdSupportAdminById`

  Assert action, entity type, direct object ID, `req`, and details from the latest change record. For household deletion, assert `poverty_household_deleted` even though repository behavior is deactivation.

- [ ] **Step 2: Add failing handler tests for unsuccessful events.**

  Assert that validation failure, scope denial, and repository `null`/not-found results do not call `createPovertyAuditLog`.

- [ ] **Step 3: Run the focused handler tests and verify they fail before implementation.**

  ```bash
  npm test -- poverty.handlers.test.ts
  ```

  Expected: FAIL because the handlers do not yet invoke the audit helper.

- [ ] **Step 4: Import the audit constants/helper and latest change accessor in the poverty handlers.**

  Add:

  ```ts
  import {
    AUDIT_ACTIONS,
    ENTITY_TYPES,
    createPovertyAuditLog
  } from "@/services/auditLog.ts";
  ```

  Add a local helper that reads `getLatestChangeLog(householdId)` after a successful repository call and invokes `createPovertyAuditLog` using `req.accountId`. If `req.accountId` is absent, skip the audit call because `AuditLogData.actorId` is required. Keep HTTP success behavior unchanged.

- [ ] **Step 5: Add calls to every successful mutation path.**

  Use the direct target record ID and corresponding constants. The call must happen after the repository result has been checked and before sending the success response. For the context-history scope, add only the update event requested by the user; leave existing create/delete handlers without system audit events.

- [ ] **Step 6: Run focused handler tests and verify they pass.**

  ```bash
  npm test -- poverty.handlers.test.ts
  ```

  Expected: PASS.

- [ ] **Step 7: Commit handler integration.**

  ```bash
  git add BE/src/handlers/admin/resources/poverty/poverty.handlers.ts BE/src/handlers/admin/resources/poverty/poverty.handlers.test.ts
  git commit -m "feat: audit poverty household changes"
  ```

### Task 4: Verify full affected surface and unchanged frontend

**Files:**
- No source changes expected unless verification finds a type error.

- [ ] **Step 1: Run backend tests covering poverty and audit behavior.**

  ```bash
  cd BE
  npm test -- auditLog.test.ts poverty.repository.test.ts poverty.handlers.test.ts
  ```

  Expected: PASS.

- [ ] **Step 2: Run backend typecheck/lint commands defined in `BE/package.json`.**

  ```bash
  cd BE
  npm run tsc:check
  npm run lint
  ```

  Expected: exit code 0.

- [ ] **Step 3: Verify the frontend remains unchanged and builds/typechecks.**

  ```bash
  git diff -- FE/src/app/'(admin)'/quan-tri/log-he-thong/LogHeThongPage.tsx
  cd FE
  npm run lint
  npx tsc -p tsconfig.json --noEmit
  ```

  Expected: no diff for the log page and successful frontend checks, or report an existing unrelated failure separately.

- [ ] **Step 4: Review the final diff and status.**

  ```bash
  git diff --check HEAD~3..HEAD
  git status --short
  ```

  Expected: only the planned backend files and test/spec/plan documentation are changed; no generated API/frontend files are modified.

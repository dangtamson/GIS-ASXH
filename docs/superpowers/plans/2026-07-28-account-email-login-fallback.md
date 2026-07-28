# Account Alias Login Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let login resolve an alias against `@cantho.gov.vn`, then `@vnpt.vn`, while preserving full-email behavior.

**Architecture:** Keep frontend input handling unchanged. Add a backend helper that produces ordered candidate emails for aliases, then make the login handler select the first existing account before running its existing lock, Supabase, audit, and response flow.

**Tech Stack:** TypeScript, Express, Drizzle ORM, Zod, Vitest.

---

### Task 1: Add the ordered candidate helper and failing tests

**Files:**
- Modify: `BE/src/helpers/accountEmail.ts`
- Modify: `BE/src/helpers/accountEmail.test.ts`

- [ ] **Step 1: Add tests describing the new behavior**

Add tests asserting `getAccountEmailCandidates("nguyenvana")` returns
`["nguyenvana@cantho.gov.vn", "nguyenvana@vnpt.vn"]`, while a full email
returns a single lowercased email and an empty input returns an empty list.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `cd BE && pnpm vitest run src/helpers/accountEmail.test.ts`

Expected: FAIL because `getAccountEmailCandidates` does not exist.

- [ ] **Step 3: Implement the minimal helper**

Export `getAccountEmailCandidates(value: string): string[]`. Trim and lowercase
the input; return `[]` for empty input; return `[trimmed]` when the input
contains `@`; otherwise map `DEFAULT_ACCOUNT_EMAIL_DOMAIN` to alias candidates.
Reuse `normalizeAccountEmail` for domain formatting where appropriate and do not
change its existing single-email return behavior.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `cd BE && pnpm vitest run src/helpers/accountEmail.test.ts`

Expected: PASS.

### Task 2: Resolve aliases in the login handler

**Files:**
- Modify: `BE/src/handlers/auth/auth.handlers.ts`

- [ ] **Step 1: Replace the direct email lookup with ordered candidate lookup**

Import `getAccountEmailCandidates` and `inArray` from the existing modules.
Build candidates from `validation.data.email`, query accounts with
`inArray(accounts.email, candidates)`, and select the first returned account in
candidate order. Keep the selected account email in a `resolvedEmail` value.

- [ ] **Step 2: Use the resolved email throughout authentication**

Use `resolvedEmail` for the lock log, `supabase.auth.signInWithPassword`, failed
login recording, and successful login recording. Keep the generic unauthorized
response when no candidate account exists. Do not attempt a second password
verification after a candidate account has been found; domain fallback is based
on account existence and happens in one request.

- [ ] **Step 3: Add a focused login resolution test or testable extraction**

If the existing handler test setup can exercise the database boundary, add cases
for Can Tho priority, VNPT fallback, and full-email preservation. Otherwise,
extract a pure `resolveAccountEmail` helper accepting the ordered candidates and
matching account emails, test that helper, and keep the handler integration
logic limited to using its result.

- [ ] **Step 4: Run backend focused tests**

Run: `cd BE && pnpm vitest run src/helpers/accountEmail.test.ts`

Expected: PASS, including the new candidate-order coverage.

### Task 3: Verify the complete change

**Files:**
- No additional files.

- [ ] **Step 1: Run backend type checking**

Run: `cd BE && pnpm tsc:check`

Expected: PASS with no TypeScript errors.

- [ ] **Step 2: Run backend linting**

Run: `cd BE && pnpm lint`

Expected: PASS with zero warnings.

- [ ] **Step 3: Run the backend test suite**

Run: `cd BE && pnpm test`

Expected: PASS with no regressions.

- [ ] **Step 4: Review the final diff**

Run: `git diff --check && git status --short`

Expected: only the intended helper, login handler, test, and plan changes are
present; no formatting or whitespace errors remain.

- [ ] **Step 5: Commit the implementation**

Run: `git add BE/src/helpers/accountEmail.ts BE/src/helpers/accountEmail.test.ts BE/src/handlers/auth/auth.handlers.ts docs/superpowers/plans/2026-07-28-account-email-login-fallback.md && git commit -m "fix: resolve account aliases across email domains"`


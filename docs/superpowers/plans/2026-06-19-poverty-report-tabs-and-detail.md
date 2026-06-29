# Poverty Report Tabs And Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add summary/detail report tabs for poverty reporting, include richer columns, and export Excel by currently active tab.

**Architecture:** Extend existing poverty report backend with separate summary/detail listing and export endpoints. Keep FE filters shared, render two independent tables in tabs, and switch export endpoint by active tab.

**Tech Stack:** Next.js + Ant Design (FE), Express + Drizzle + XLSX (BE), TypeScript.

---

### Task 1: Extend Backend DTO/Schema/Routes

**Files:**
- Modify: `BE/src/helpers/permissions.ts`
- Modify: `BE/src/routes/admin/poverty.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.schemas.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.handlers.ts`

- [ ] Add report detail query schema with `page` and `limit` default 20
- [ ] Register new endpoints for report detail list and report detail export
- [ ] Wire new handlers using existing guard chain and response pattern

### Task 2: Implement Backend Repository + Excel

**Files:**
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.repository.ts`
- Modify: `BE/src/handlers/admin/resources/poverty/poverty.excel.ts`

- [ ] Extend summary rows with `year` and `poorRatePercent`
- [ ] Add report detail repository query with pagination (`items`, `total`, `page`, `limit`)
- [ ] Add detail Excel workbook builder with requested household columns

### Task 3: Update Frontend Types/Endpoints + Report Page

**Files:**
- Modify: `FE/src/lib/endpoints.ts`
- Modify: `FE/src/types/poverty.ts`
- Modify: `FE/src/components/poverty/PovertyReportPage.tsx`

- [ ] Add FE endpoint constants for detail list/export
- [ ] Add FE types for summary row additions and detail row + pagination meta
- [ ] Add tabs for summary/detail, detail pagination default 20, and per-tab export behavior

### Task 4: Verify Build/Type Safety

**Files:**
- No code changes unless needed by checks

- [ ] Run targeted type checks/tests for FE and BE
- [ ] Fix any regressions introduced by new fields/endpoints
- [ ] Confirm export behavior routes to active tab endpoint

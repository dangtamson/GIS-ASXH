# Poverty Household Context History Design

## Goal

Add a dedicated time-based history for two new poverty-household information fields, `Hoàn cảnh gia đình` and `Hiện trạng`, and expose that history in the household detail page through a new `Hoàn cảnh & hiện trạng` tab. The household summary must also show the latest recorded values.

## Scope

This design covers:

- Backend schema changes for a dedicated context-history table.
- Backend CRUD APIs for context-history records under a household.
- Extending the existing household detail API so the detail page can load the latest context entry and the full context history in one request.
- Frontend updates to the household detail page to show the latest values in the summary area and provide a new tab for managing the history.
- Validation and tests for the new behavior.

This design does not cover:

- Backfilling old data.
- Adding the new fields to list pages, reports, exports, or map popups.
- Bulk import/export for the new history records.

## Requirements

### Functional Requirements

- Users can create, edit, and delete historical records for `Hoàn cảnh gia đình` and `Hiện trạng` per household.
- Each history record is independent from poverty assessments.
- Each history record stores a user-selected full date.
- Each history record may contain either field individually, but at least one of the two fields must be filled.
- The household detail page shows the latest history values in the top summary section.
- The household detail page contains a new `Hoàn cảnh & hiện trạng` tab for viewing and updating the full history.
- Household change logs must capture create, update, and delete actions for this new record type.

### UX Requirements

- The new tab follows the same visual and interaction pattern as the existing `Đánh giá` and `Hỗ trợ` tabs.
- The create/edit interaction uses a modal dialog, consistent with the rest of the page.
- Records are ordered with the newest date first.
- Long text is readable in the tab table and safely truncated in the summary area.

### Non-Functional Requirements

- The existing household detail page remains backward compatible for households without any context-history records.
- The added backend and frontend changes should reuse existing patterns to minimize regression risk.
- A single detail-page request should provide all information needed to render the summary and the new tab.

## Recommended Approach

Create a dedicated history table and a dedicated CRUD surface for household context history.

This is the best fit because the user explicitly wants a separate time-based history, not a variation of assessments. Reusing `household_assessments` would couple unrelated business concepts. Storing the fields directly on `poor_households` would lose the required time history and make later reporting or auditing difficult. A dedicated table keeps the domain clean, keeps the UI behavior explicit, and matches the existing repo pattern of one business concept per table and per CRUD surface.

## Alternatives Considered

### Alternative 1: Store the fields directly on `poor_households`

Reject. This would only support the latest value, not historical tracking.

### Alternative 2: Add the fields to `household_assessments`

Reject. The user wants a separate history stream, and these fields are not part of poverty classification logic.

### Alternative 3: Infer history only from `household_change_logs`

Reject. Change logs are audit artifacts, not a primary read model. Querying current and historical state from diffs would be fragile and expensive.

## Data Model Design

Add a new table, tentatively named `household_context_histories`.

Proposed columns:

- `id`: UUID primary key
- `household_id`: UUID foreign key to `poor_households.id`
- `recorded_at`: date, required
- `family_situation`: text, optional
- `current_status`: text, optional
- `note`: text, optional
- `created_at`: timestamp, default now
- `updated_at`: timestamp, default now

Business rules:

- At least one of `family_situation` or `current_status` must be present.
- Sorting for display and `latest` selection is `recorded_at desc`, then `created_at desc`.
- Multiple records on the same date are allowed unless product rules later require uniqueness.

## Backend API Design

Add a new household-scoped CRUD surface following existing route patterns:

- `GET /poverty/households/:id/context-histories`
- `POST /poverty/households/:id/context-histories`
- `PATCH /poverty/households/:id/context-histories/:contextHistoryId`
- `DELETE /poverty/households/:id/context-histories/:contextHistoryId`

Validation rules:

- `recordedAt`: required, `YYYY-MM-DD`
- `familySituation`: optional trimmed text
- `currentStatus`: optional trimmed text
- `note`: optional trimmed text
- `changeNote`: optional trimmed text
- create/update payloads must fail if both `familySituation` and `currentStatus` are empty after trimming

Extend the existing household detail response returned by `GET /poverty/households/:id` with:

- `contextHistories`: ordered list of all records for the household
- `latestContextHistory`: the newest record or `null`

This keeps the detail page as a single-load surface for summary cards and tab content.

## Repository and Change Log Design

The poverty repository layer should gain:

- `listContextHistories(householdId)`
- `createContextHistory(householdId, payload)`
- `updateContextHistory(householdId, contextHistoryId, payload)`
- `deleteContextHistory(householdId, contextHistoryId, changeNote?)`
- logic inside `getHouseholdDetail(id)` to fetch both the full list and the latest entry

Change-log behavior:

- use `objectType: "CONTEXT_HISTORY"`
- log create/update/delete with old/new payloads, matching existing member/assessment/support patterns

## Frontend Data Contract

Extend the poverty frontend types with a new model, for example:

- `HouseholdContextHistory`

Proposed fields:

- `id`
- `householdId`
- `recordedAt`
- `familySituation`
- `currentStatus`
- `note`
- `createdAt`
- `updatedAt`

Extend `HouseholdDetailResponse` with:

- `contextHistories?: HouseholdContextHistory[]`
- `latestContextHistory?: HouseholdContextHistory | null`

## Frontend Page Design

Target page: the existing household detail page.

### Summary Area

Add two new summary cards or information blocks to the top section:

- `Hoàn cảnh gia đình`
- `Hiện trạng`

Display rules:

- values come from `latestContextHistory`
- if missing, show `-`
- if available, show a secondary line with `Cập nhật gần nhất: dd/mm/yyyy`
- long text is truncated in summary layout to avoid stretching the page

### New Tab

Add a new tab labeled `Hoàn cảnh & hiện trạng`.

Tab layout:

- top action row with `Thêm cập nhật` button when the user has update permission
- a latest-first summary strip above the table, following the same spirit as the assessment/support tabs
- a table listing all records

Table columns:

- `Ngày cập nhật`
- `Hoàn cảnh gia đình`
- `Hiện trạng`
- `Ghi chú`
- `Thao tác`

Records should render newest first.

### Modal Design

Add a dedicated create/edit modal.

Fields:

- `Ngày cập nhật`: DatePicker, required
- `Hoàn cảnh gia đình`: TextArea
- `Hiện trạng`: TextArea
- `Ghi chú`: TextArea

The UI does not need a dedicated `Ghi chú thay đổi` field for this feature. Backend change-log support should still accept `changeNote` when provided by future callers, but the household detail page can omit that input and rely on the standard create/update/delete audit pattern already used in this module.

Validation:

- date is required
- at least one of the two main text fields is required

Behavior:

- submit uses create or update endpoint depending on editing state
- delete uses confirm flow consistent with other tabs
- after create/update/delete, reload the household detail so summary and tab stay in sync

## Error Handling

Backend:

- reject invalid payloads with the same validation response style used elsewhere in poverty handlers
- return not found when household or history record does not exist

Frontend:

- reuse current `ApiError` notification pattern for load, save, and delete failures
- show empty state for households without any context-history records
- keep the detail page usable even when the new tab has no data

## Testing Strategy

### Backend

Add tests for:

- create/update schema validation, especially the “at least one of two fields” rule
- repository list ordering by `recorded_at desc`, then `created_at desc`
- detail response includes both `contextHistories` and `latestContextHistory`
- create/update/delete produce change-log entries with `CONTEXT_HISTORY`

### Frontend

Add tests for:

- type handling of the extended detail response
- rendering summary values from `latestContextHistory`
- empty-state rendering when no context-history exists
- modal validation for required date and one-of-two text fields
- refresh behavior after save/delete

## Migration Strategy

Add one new database migration for `household_context_histories`.

No backfill is required. Existing households will simply return:

- `contextHistories: []`
- `latestContextHistory: null`

The UI should render `-` in summary fields and an empty state inside the tab.

## Risks and Mitigations

### Risk: detail page grows more crowded

Mitigation: keep the summary display compact and reuse existing tab/modal layout patterns.

### Risk: duplicate or noisy records on the same day

Mitigation: allow them for now because the requirement did not define a uniqueness rule. If needed later, uniqueness can be added as a follow-up business rule.

### Risk: divergence from existing patterns

Mitigation: mirror the existing assessments/supports CRUD structure in routes, handlers, repositories, form state, and notifications.

## Implementation Notes

Expected touched areas:

- database schema and migration files in the backend
- poverty schemas, handlers, repository, routes, and detail response assembly
- frontend poverty types, endpoints, and household detail page

No changes are required to map panels, poverty list pages, or reporting in this scope.

## Open Decisions Resolved

The following product choices are now fixed for implementation:

- history is separate from assessments
- each history record uses a full user-selected date
- the top summary shows the latest history values
- the management surface is a new tab in the household detail page

## Approval Outcome

This design reflects the approved direction gathered during brainstorming and is ready for implementation planning after user review.

# Poverty Organization Location Scope Design

## Goal

Allow organization records to store standardized poverty-management locations by management level, then use the current organization tree plus those location assignments to scope all poverty data so users only see the province, ward, or area they manage.

## Scope

This design covers:

- Adding standardized poverty location fields to `organizations`.
- Extending organization admin CRUD to capture and validate those fields.
- Defining how a poverty scope is derived from an account's organization membership.
- Applying that scope to poverty households, maps, reports, ward overviews, and ward areas.
- Updating the organization master-data UI to manage location assignments.
- Updating poverty UIs to consume already-scoped location options and data.

This design does not cover:

- Multi-location assignment for one organization.
- Replacing the current organization tree visibility rules.
- Reworking workspace membership or RBAC concepts beyond using the existing `isAdmin` flag.
- Backfilling organization locations automatically from free-text addresses.

## Confirmed Decisions

- Use the management-level model:
  - province-level organizations store only `provinceCode`
  - ward-level organizations store `provinceCode + wardCode`
  - area-level organizations store `provinceCode + wardCode + areaId`
- Keep `address` as the free-text detailed address field.
- Store standardized location fields directly on `organizations`, not in a separate mapping table.
- Existing organization tree visibility stays as-is: users see their assigned organization and descendants only.
- Poverty module visibility adds location scoping on top of the organization-tree rule.
- Organization admins (`workspaceMemberships.isAdmin = true`) can see all poverty data covered by their organization branch, including descendant organizations' wards and areas.
- If an account has no valid organization location scope, poverty data APIs should fail closed instead of exposing workspace-wide data.

## Requirements

### Functional Requirements

- Admin users can create and update organizations with:
  - `provinceCode`
  - `wardCode`
  - `areaId`
- The chosen values must follow the management-level hierarchy:
  - province only
  - province + ward
  - province + ward + area
- `wardCode` must belong to `provinceCode`.
- `areaId` must belong to `wardCode`.
- A child organization cannot be assigned outside its parent's location scope.
- Organization list and detail APIs should return readable location labels alongside the standardized keys.
- Poverty users only see households, maps, reports, ward overviews, and ward areas inside their allowed location scope.
- Direct access by ID must also respect the same scope.
- Organization admins can access the union of poverty scopes across their whole descendant branch.
- Non-admin members are limited to the exact assigned organization's poverty scope.

### UX Requirements

- The organization master-data form should add dependent selects for province, ward, and area.
- The UI should infer the management level from the deepest selected location instead of introducing a separate level field.
- The organization list should show a readable "Địa bàn quản lý" value such as:
  - `Cần Thơ`
  - `Cần Thơ / Phường An Bình`
  - `Cần Thơ / Phường An Bình / Khu vực 3`
- Poverty screens should not show out-of-scope location options.
- If the account has no valid poverty scope, poverty screens should show an explicit empty-state message instead of broad filters.

### Non-Functional Requirements

- The design must fail closed for poverty access control.
- Scope checks must run in backend handlers or repository boundaries, not only in frontend filtering.
- Changes should preserve current organization tree behavior and existing poverty permissions.
- The first rollout must tolerate existing organizations with null location fields.

## Recommended Approach

Add `provinceCode`, `wardCode`, and `areaId` directly to `organizations`, derive the effective poverty scope from the assigned organization branch, and apply that scope consistently across all poverty read and write paths.

This is the best fit because it matches the confirmed management-level data model, keeps the implementation local to the existing organization entity, and reuses the current descendant-expansion behavior already used for organization visibility.

## Alternatives Considered

### Alternative 1: Separate `organization_locations` mapping table

Reject for now. It adds flexibility for multiple managed locations per organization, but the current requirement is one location hierarchy per organization. The extra table would complicate CRUD, validation, and scope aggregation without immediate product value.

### Alternative 2: Infer poverty scope from free-text `address`

Reject. Free-text addresses are not reliable for authorization and cannot guarantee safe backend filtering.

### Alternative 3: Frontend-only location restriction

Reject. This would not protect direct API access and would leak data through non-UI paths.

## Data Model Design

### Changes to `organizations`

Add nullable fields:

- `provinceCode: varchar(...), nullable`
- `wardCode: varchar(...), nullable`
- `areaId: uuid, nullable`

The initial migration keeps all three nullable so existing records remain valid during rollout.

### Stored Meaning

- `provinceCode` only: organization manages one province or city.
- `provinceCode + wardCode`: organization manages one ward.
- `provinceCode + wardCode + areaId`: organization manages one area.

No other combination is valid.

### Display Labels

Organization APIs should enrich returned rows with:

- `provinceName`
- `wardName`
- `areaName`

These are read-time labels derived from the standardized keys, not new persisted snapshot fields.

### Parent/Child Location Constraint

Each child organization's location must stay within the parent's location scope.

Examples:

- Province parent:
  - child may stay at the same province level
  - child may narrow to a ward in that province
  - child may narrow to an area in a ward inside that province
- Ward parent:
  - child may stay at the same ward level
  - child may narrow to an area inside that ward
- Area parent:
  - child may only stay inside that same area

This constraint should be enforced in backend create and update validation.

## Scope Resolution Design

### Inputs

Resolve scope from:

- `req.accountId`
- `req.workspaceId`
- the caller's `workspaceMemberships.organizationId`
- the caller's `workspaceMemberships.isAdmin`

### Branch Expansion Rule

- Non-admin member:
  - use only the assigned organization
- Organization admin:
  - expand to the assigned organization plus all descendants using the existing descendant-expansion helper

### Scope Extraction Rule

From the selected organization set:

- if an organization has `areaId`, add an area scope
- else if it has `wardCode`, add a ward scope
- else if it has `provinceCode`, add a province scope
- else add nothing

The effective poverty scope is the union of all collected location scopes.

### Effective Matching Rule

Apply the narrowest available key per organization:

- area scope matches households or area data by `areaId`
- ward scope matches by `wardCode`
- province scope matches by `provinceCode`

This avoids accidentally broadening an area-level assignment to the whole ward or province.

### Fail-Closed Rule

If no valid poverty scope can be resolved:

- list-style poverty APIs return empty results
- create or update operations return a validation or authorization error
- direct item reads by ID return not found

Using not found for out-of-scope direct access is preferred because it avoids leaking record existence.

## Backend API Design

### Organization CRUD Changes

Extend organization create and update payloads with:

- `provinceCode`
- `wardCode`
- `areaId`

Validation rules:

- `wardCode` requires `provinceCode`
- `areaId` requires both `provinceCode` and `wardCode`
- the province/ward/area relationship must be valid against master data
- the location must stay within the parent's location scope if `parentId` is set

Extend organization responses with:

- `provinceName`
- `wardName`
- `areaName`

### Poverty APIs That Must Apply Scope

At minimum, apply poverty scope to:

- `GET /poverty/households`
- `POST /poverty/households`
- `GET /poverty/households/:id`
- `PATCH /poverty/households/:id`
- `DELETE /poverty/households/:id`
- child household detail routes under `/poverty/households/:id/*`
- `GET /poverty/gis/markers`
- `GET /poverty/dashboard`
- `GET /poverty/reports/summary`
- `GET /poverty/reports/detail`
- export variants for poverty reports and households
- `GET /poverty/locations/provinces`
- `GET /poverty/locations/wards`
- `GET /poverty/locations/areas`
- `GET /poverty/ward-overviews`
- `PUT /poverty/ward-overviews`
- `DELETE /poverty/ward-overviews/:id`
- `GET /poverty/wards/:wardCode/areas`
- `POST /poverty/wards/:wardCode/areas`
- `PATCH /poverty/wards/:wardCode/areas/:areaId`
- `DELETE /poverty/wards/:wardCode/areas/:areaId`

### Location Option APIs

Location-option APIs should return only selectable values inside the effective poverty scope.

Expected behavior:

- province-level user sees allowed province options only
- ward-level user sees the assigned ward only
- area-level user sees the assigned area only, with its parent ward and province constrained accordingly

This keeps frontend behavior simple and consistent across screens.

## Repository and Query Design

### Shared Helper

Introduce a shared backend helper for poverty scope resolution that returns:

- whether the caller is branch-admin
- resolved organization ids used for scope
- allowed province codes
- allowed ward codes
- allowed area ids

This helper should be reusable across poverty repository functions and handlers.

### Household Queries

Household list and detail queries should add scope predicates on top of existing filters:

- `areaId in (...)`
- or `wardCode in (...)`
- or `provinceCode in (...)`

The generated predicate should union the allowed branches safely while avoiding duplicate broad matches.

### Write Validation

For create and update flows:

- validate the target `provinceCode`, `wardCode`, and `areaId` are inside the caller's allowed scope
- reject writes when the payload is outside scope even if the user has the RBAC permission code

### Ward Overview and Area Queries

Ward overview and ward area reads and writes should use the same scope helper:

- ward-level scope grants access to that ward
- area-level scope grants access only if the overview or area belongs to the assigned area's ward where the operation still makes sense

Because ward overviews and ward-area master data are ward-admin surfaces, area-level users should be treated conservatively.

For the first rollout:

- province-scoped and ward-scoped users may access ward overview and ward-area admin endpoints if RBAC allows it
- area-scoped users must not access ward overview or ward-area admin endpoints, even if they can access operational poverty data for their own area

This keeps administrative ward-wide data from being exposed to the narrowest management level while preserving the existing RBAC model as an additional gate.

## Frontend Design

### Organization Master-Data Page

Update the `slug === "don-vi"` form to include dependent location selects:

- `Tỉnh/Thành phố`
- `Xã/Phường`
- `Khu vực`

Behavior:

- changing province clears ward and area
- changing ward clears area
- the deepest selected field defines the management level

The page should continue to use the existing organization tree UI and parent selection flow.

### Organization List

Add a readable "Địa bàn quản lý" column or equivalent display field using:

- `provinceName`
- `wardName`
- `areaName`

This should make it obvious which organizations are province, ward, or area scoped.

### Poverty Screens

Affected screens include:

- household list
- household detail
- map
- report pages
- admin general information page
- ward area management page

Frontend should not reimplement authorization rules. It should:

- request options and data from backend
- render only returned scoped options
- show empty-state messaging when no location scope is assigned

### Empty-State Behavior

Use a short explicit message such as:

- `Tài khoản chưa được gán địa bàn quản lý trong đơn vị`

This is better than showing global filters and failing only on submit.

## Error Handling

### Organization Validation Errors

Return clear validation errors for:

- ward not belonging to province
- area not belonging to ward
- child location outside parent scope
- unsupported location combination

### Poverty Authorization Errors

Use not-found behavior for direct record access outside scope.

Use empty lists for collection reads without scope.

Use a clear authorization or validation error for writes attempted outside scope.

## Migration and Rollout

### Schema Migration

Add the three new nullable organization fields first.

No automatic backfill from `address` should be attempted.

### Rollout Strategy

1. Deploy schema and backend validation support.
2. Deploy organization UI changes.
3. Populate location fields for organizations that participate in poverty management.
4. Enable poverty scope filtering in backend paths.

If the team prefers a safer rollout, step 4 can be feature-flagged or released after organization data is populated.

## Testing Strategy

### Backend Tests

- organization payload validation for:
  - province-only
  - province + ward
  - province + ward + area
  - invalid combinations
- parent-child scope validation
- poverty scope resolution for:
  - non-admin user at province level
  - non-admin user at ward level
  - non-admin user at area level
  - organization admin with descendant organizations
- collection reads returning only in-scope results
- direct reads by ID rejecting out-of-scope records
- writes rejecting out-of-scope province, ward, or area assignments

### Frontend Tests

- organization form resets dependent selects correctly
- organization list displays readable location scope
- poverty screens render only scoped location options
- empty-state message appears when no scope is available

## Open Design Guardrails

- One organization manages one standardized location hierarchy only.
- Null organization location fields are allowed during rollout, but they produce no poverty scope.
- Backend scope enforcement is mandatory even if frontend is already restricted.
- Organization-tree visibility and poverty location visibility are related but separate concerns; both must remain in effect.

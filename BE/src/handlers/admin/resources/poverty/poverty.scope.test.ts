import { db } from "@/services/db/drizzle.ts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  collapseOrganizationLocationScopes,
  isLocationWithinScope,
  resolvePovertyAccessScope
} from "./poverty.scope.ts";

vi.mock("@/services/db/drizzle.ts", () => ({
  db: {
    select: vi.fn()
  }
}));

vi.mock("@/handlers/report/common.ts", () => ({
  expandOrganizationDescendants: vi.fn(),
  getAccountOrganizationIds: vi.fn()
}));

import { expandOrganizationDescendants } from "@/handlers/report/common.ts";

const VALID_WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const VALID_ACCOUNT_ID = "22222222-2222-4222-8222-222222222222";
const VALID_ORG_ID = "33333333-3333-4333-8333-333333333333";
const VALID_CHILD_ORG_ID = "44444444-4444-4444-8444-444444444444";
const VALID_AREA_ID = "55555555-5555-4555-8555-555555555555";

describe("collapseOrganizationLocationScopes", () => {
  it("keeps only area ids for area-level organizations", () => {
    const scope = collapseOrganizationLocationScopes([
      { provinceCode: "92", wardCode: "31117", areaId: VALID_AREA_ID }
    ]);

    expect(scope.areaIds).toEqual([VALID_AREA_ID]);
    expect(scope.wardCodes).toEqual([]);
    expect(scope.provinceCodes).toEqual([]);
  });

  it("keeps ward scope when no area is assigned", () => {
    const scope = collapseOrganizationLocationScopes([
      { provinceCode: "92", wardCode: "31117", areaId: null }
    ]);

    expect(scope.areaIds).toEqual([]);
    expect(scope.wardCodes).toEqual(["31117"]);
    expect(scope.provinceCodes).toEqual([]);
  });

  it("keeps province scope when only province is assigned", () => {
    const scope = collapseOrganizationLocationScopes([
      { provinceCode: "92", wardCode: null, areaId: null }
    ]);

    expect(scope.areaIds).toEqual([]);
    expect(scope.wardCodes).toEqual([]);
    expect(scope.provinceCodes).toEqual(["92"]);
  });
});

describe("resolvePovertyAccessScope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty scope when the membership has no organization", async () => {
    vi.mocked(db.select).mockImplementationOnce(
      () =>
        ({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  organizationId: null,
                  isAdmin: false
                }
              ])
            })
          })
        }) as never
    );

    const scope = await resolvePovertyAccessScope(VALID_ACCOUNT_ID, VALID_WORKSPACE_ID);

    expect(scope.hasScope).toBe(false);
    expect(scope.organizationIds).toEqual([]);
    expect(scope.isSuperAdmin).toBe(false);
  });

  it("uses only the assigned organization for non-admin memberships", async () => {
    vi.mocked(db.select)
      .mockImplementationOnce(
        () =>
          ({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  {
                    organizationId: VALID_ORG_ID,
                    isAdmin: false
                  }
                ])
              })
            })
          }) as never
      )
      .mockImplementationOnce(
        () =>
          ({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                {
                  uuid: VALID_ORG_ID,
                  provinceCode: "92",
                  wardCode: "31117",
                  areaId: null
                }
              ])
            })
          }) as never
      );

    const scope = await resolvePovertyAccessScope(VALID_ACCOUNT_ID, VALID_WORKSPACE_ID);

    expect(scope.hasScope).toBe(true);
    expect(scope.isBranchAdmin).toBe(false);
    expect(scope.isSuperAdmin).toBe(false);
    expect(scope.organizationIds).toEqual([VALID_ORG_ID]);
    expect(scope.wardCodes).toEqual(["31117"]);
    expect(vi.mocked(expandOrganizationDescendants)).not.toHaveBeenCalled();
  });

  it("expands descendants for organization admins and unions their scopes", async () => {
    vi.mocked(db.select)
      .mockImplementationOnce(
        () =>
          ({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  {
                    organizationId: VALID_ORG_ID,
                    isAdmin: true
                  }
                ])
              })
            })
          }) as never
      )
      .mockImplementationOnce(
        () =>
          ({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                {
                  uuid: VALID_ORG_ID,
                  provinceCode: "92",
                  wardCode: "31117",
                  areaId: null
                },
                {
                  uuid: VALID_CHILD_ORG_ID,
                  provinceCode: "92",
                  wardCode: "31117",
                  areaId: VALID_AREA_ID
                }
              ])
            })
          }) as never
      );
    vi.mocked(expandOrganizationDescendants).mockResolvedValue([VALID_ORG_ID, VALID_CHILD_ORG_ID]);

    const scope = await resolvePovertyAccessScope(VALID_ACCOUNT_ID, VALID_WORKSPACE_ID);

    expect(scope.hasScope).toBe(true);
    expect(scope.isBranchAdmin).toBe(true);
    expect(scope.isSuperAdmin).toBe(false);
    expect(scope.organizationIds).toEqual([VALID_ORG_ID, VALID_CHILD_ORG_ID]);
    expect(scope.areaIds).toEqual([VALID_AREA_ID]);
    expect(scope.wardCodes).toEqual(["31117"]);
  });
});

describe("isLocationWithinScope", () => {
  it("requires exact area match when area scope exists", () => {
    const allowed = isLocationWithinScope(
      {
        organizationIds: [VALID_ORG_ID],
        provinceCodes: [],
        wardCodes: [],
        areaIds: [VALID_AREA_ID],
        isBranchAdmin: false,
        isSuperAdmin: false,
        hasScope: true
      },
      {
        provinceCode: "92",
        wardCode: "31117",
        areaId: VALID_AREA_ID
      }
    );

    expect(allowed).toBe(true);
  });

  it("allows ward-scoped access when ward matches", () => {
    const allowed = isLocationWithinScope(
      {
        organizationIds: [VALID_ORG_ID],
        provinceCodes: [],
        wardCodes: ["31117"],
        areaIds: [],
        isBranchAdmin: false,
        isSuperAdmin: false,
        hasScope: true
      },
      {
        provinceCode: "92",
        wardCode: "31117",
        areaId: "66666666-6666-4666-8666-666666666666"
      }
    );

    expect(allowed).toBe(true);
  });

  it("rejects locations outside all scope buckets", () => {
    const allowed = isLocationWithinScope(
      {
        organizationIds: [VALID_ORG_ID],
        provinceCodes: ["92"],
        wardCodes: [],
        areaIds: [],
        isBranchAdmin: false,
        isSuperAdmin: false,
        hasScope: true
      },
      {
        provinceCode: "93",
        wardCode: "31117",
        areaId: VALID_AREA_ID
      }
    );

    expect(allowed).toBe(false);
  });
});

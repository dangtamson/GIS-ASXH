import { describe, expect, it } from "vitest";
import { API_ROUTES, PERMISSION_CODES, permissions } from "./permissions.ts";

describe("poverty ward admin permissions", () => {
  it("defines dedicated permission codes for ward overviews and ward areas", () => {
    expect(PERMISSION_CODES.PovertyWardOverviewView).toBe("poverty.ward_overview.view");
    expect(PERMISSION_CODES.PovertyWardOverviewUpdate).toBe("poverty.ward_overview.update");
    expect(PERMISSION_CODES.PovertyWardOverviewDelete).toBe("poverty.ward_overview.delete");
    expect(PERMISSION_CODES.PovertyWardAreaView).toBe("poverty.ward_area.view");
    expect(PERMISSION_CODES.PovertyWardAreaCreate).toBe("poverty.ward_area.create");
    expect(PERMISSION_CODES.PovertyWardAreaUpdate).toBe("poverty.ward_area.update");
    expect(PERMISSION_CODES.PovertyWardAreaDelete).toBe("poverty.ward_area.delete");
  });

  it("maps ward overview routes to dedicated route permissions", () => {
    expect(permissions.get(API_ROUTES.povertyWardOverviews)?.permissions.GET).toBe(
      PERMISSION_CODES.PovertyWardOverviewView
    );
    expect(permissions.get(API_ROUTES.povertyWardOverviews)?.permissions.PUT).toBe(
      PERMISSION_CODES.PovertyWardOverviewUpdate
    );
    expect(permissions.get(API_ROUTES.povertyWardOverviewById)?.permissions.DELETE).toBe(
      PERMISSION_CODES.PovertyWardOverviewDelete
    );
  });

  it("maps ward area routes to dedicated route permissions", () => {
    expect(permissions.get(API_ROUTES.povertyWardAreas)?.permissions.GET).toBe(
      PERMISSION_CODES.PovertyWardAreaView
    );
    expect(permissions.get(API_ROUTES.povertyWardAreas)?.permissions.POST).toBe(
      PERMISSION_CODES.PovertyWardAreaCreate
    );
    expect(permissions.get(API_ROUTES.povertyWardAreaById)?.permissions.PATCH).toBe(
      PERMISSION_CODES.PovertyWardAreaUpdate
    );
    expect(permissions.get(API_ROUTES.povertyWardAreaById)?.permissions.DELETE).toBe(
      PERMISSION_CODES.PovertyWardAreaDelete
    );
  });
});

import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createHouseholdAdmin,
  getPovertyWardPublicLinkAdmin,
  getPublicPovertyAreaBySlugAndAreaSlug,
  getPublicPovertyHouseholdBySlugAndHouseholdId,
  getPublicPovertyWardBySlug,
  listPovertyLocationProvincesAdmin
} from "./poverty.handlers.ts";

vi.mock("./poverty.repository.ts", async () => {
  const actual = await vi.importActual<typeof import("./poverty.repository.ts")>("./poverty.repository.ts");

  return {
    ...actual,
    listLocationProvinces: vi.fn(),
    createHousehold: vi.fn(),
    getWardPublicLink: vi.fn(),
    getPublicAreaDetailBySlugAndAreaSlug: vi.fn(),
    getPublicWardMapBySlug: vi.fn(),
    getPublicHouseholdDetailBySlugAndHouseholdId: vi.fn()
  };
});

vi.mock("./poverty.scope.ts", async () => {
  const actual = await vi.importActual<typeof import("./poverty.scope.ts")>("./poverty.scope.ts");

  return {
    ...actual,
    resolvePovertyAccessScope: vi.fn()
  };
});

import {
  createHousehold,
  getPublicAreaDetailBySlugAndAreaSlug,
  getPublicHouseholdDetailBySlugAndHouseholdId,
  getPublicWardMapBySlug,
  getWardPublicLink,
  listLocationProvinces
} from "./poverty.repository.ts";
import { resolvePovertyAccessScope } from "./poverty.scope.ts";

const VALID_WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const VALID_ACCOUNT_ID = "22222222-2222-4222-8222-222222222222";
const VALID_AREA_ID = "33333333-3333-4333-8333-333333333333";

const flushAsync = async (): Promise<void> => {
  await new Promise((resolve) => setImmediate(resolve));
};

const createMockRes = (): Response => {
  const res = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn()
  };

  return res as unknown as Response;
};

describe("poverty handlers superadmin scope bypass", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows superadmin to list provinces without requiring assigned poverty scope", async () => {
    vi.mocked(resolvePovertyAccessScope).mockResolvedValue({
      organizationIds: [],
      provinceCodes: [],
      wardCodes: [],
      areaIds: [],
      isBranchAdmin: false,
      isSuperAdmin: false,
      hasScope: false
    });
    vi.mocked(listLocationProvinces).mockResolvedValue([
      {
        code: "92",
        name: "Can Tho",
        fullName: "Thanh pho Can Tho"
      }
    ]);

    const req = {
      accountId: VALID_ACCOUNT_ID,
      workspaceId: VALID_WORKSPACE_ID,
      user: {
        id: VALID_ACCOUNT_ID,
        isSuperAdmin: true
      },
      query: {}
    } as unknown as Request;
    const res = createMockRes();
    const next = vi.fn();

    listPovertyLocationProvincesAdmin(req, res, next);
    await flushAsync();

    expect(resolvePovertyAccessScope).not.toHaveBeenCalled();
    expect(listLocationProvinces).toHaveBeenCalledWith(
      expect.objectContaining({
        isSuperAdmin: true,
        hasScope: true
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows superadmin to create households without requiring assigned poverty scope", async () => {
    vi.mocked(resolvePovertyAccessScope).mockResolvedValue({
      organizationIds: [],
      provinceCodes: [],
      wardCodes: [],
      areaIds: [],
      isBranchAdmin: false,
      isSuperAdmin: false,
      hasScope: false
    });
    vi.mocked(createHousehold).mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
      code: "HN-001",
      year: 2026,
      povertyType: "POOR",
      status: "ACTIVE",
      provinceCode: "92",
      wardCode: "31117",
      areaId: VALID_AREA_ID
    } as never);

    const req = {
      accountId: VALID_ACCOUNT_ID,
      workspaceId: VALID_WORKSPACE_ID,
      user: {
        id: VALID_ACCOUNT_ID,
        isSuperAdmin: true
      },
      body: {
        code: "HN-001",
        year: 2026,
        povertyType: "POOR",
        status: "ACTIVE",
        provinceCode: "92",
        wardCode: "31117",
        areaId: VALID_AREA_ID
      }
    } as unknown as Request;
    const res = createMockRes();
    const next = vi.fn();

    createHouseholdAdmin(req, res, next);
    await flushAsync();

    expect(resolvePovertyAccessScope).not.toHaveBeenCalled();
    expect(createHousehold).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "HN-001",
        provinceCode: "92",
        wardCode: "31117",
        areaId: VALID_AREA_ID
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns ward public-link state for superadmin without resolving poverty scope", async () => {
    vi.mocked(getWardPublicLink).mockResolvedValue({
      id: "public-link-1",
      workspaceId: VALID_WORKSPACE_ID,
      provinceCode: "92",
      wardCode: "31117",
      publicSlug: "ward-public-abc",
      isPublic: true,
      publishedAt: null,
      createdBy: null,
      updatedBy: null,
      createdAt: null,
      updatedAt: null
    });

    const req = {
      accountId: VALID_ACCOUNT_ID,
      workspaceId: VALID_WORKSPACE_ID,
      user: {
        id: VALID_ACCOUNT_ID,
        isSuperAdmin: true
      },
      query: {
        provinceCode: "92",
        wardCode: "31117"
      }
    } as unknown as Request;
    const res = createMockRes();
    const next = vi.fn();

    getPovertyWardPublicLinkAdmin(req, res, next);
    await flushAsync();

    expect(resolvePovertyAccessScope).not.toHaveBeenCalled();
    expect(getWardPublicLink).toHaveBeenCalledWith(VALID_WORKSPACE_ID, "92", "31117");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns not found when a public ward slug is unavailable", async () => {
    vi.mocked(getPublicWardMapBySlug).mockResolvedValue(null);

    const req = {
      params: {
        slug: "ward-public-disabled"
      }
    } as unknown as Request;
    const res = createMockRes();
    const next = vi.fn();

    getPublicPovertyWardBySlug(req, res, next);
    await flushAsync();

    expect(getPublicWardMapBySlug).toHaveBeenCalledWith("ward-public-disabled");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns public household detail for a household inside the public ward scope", async () => {
    vi.mocked(getPublicHouseholdDetailBySlugAndHouseholdId).mockResolvedValue({
      share: {
        publicSlug: "ward-public-abc",
        wardCode: "31117",
        provinceCode: "92",
        wardName: "Xa Phu Huu",
        provinceName: "Thanh pho Can Tho",
        currentYear: 2026
      },
      household: {
        id: "household-1",
        code: "HN-001",
        headFullName: "Nguyen Thanh Thuy",
        povertyType: "NEAR_POOR",
        status: "ACTIVE",
        memberCount: 3,
        areaId: VALID_AREA_ID,
        areaName: "Phu Tri B1",
        wardName: "Xa Phu Huu",
        address: null,
        latitude: 10.2,
        longitude: 105.7
      },
      summary: {
        fieldPhotoCount: 1,
        supportCount: 0
      },
      latestContext: {
        familySituation: "Co 2 con nho dang di hoc",
        currentStatus: "Nha kien co",
        recordedAt: "2026-01-01"
      },
      fieldPhotos: [],
      supports: []
    });

    const req = {
      params: {
        slug: "ward-public-abc",
        householdId: "household-1"
      }
    } as unknown as Request;
    const res = createMockRes();
    const next = vi.fn();

    getPublicPovertyHouseholdBySlugAndHouseholdId(req, res, next);
    await flushAsync();

    expect(getPublicHouseholdDetailBySlugAndHouseholdId).toHaveBeenCalledWith("ward-public-abc", "household-1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns public area detail for an area inside the public ward scope", async () => {
    vi.mocked(getPublicAreaDetailBySlugAndAreaSlug).mockResolvedValue({
      share: {
        publicSlug: "ward-public-abc",
        wardCode: "31117",
        provinceCode: "92",
        wardName: "Xa Phu Huu",
        provinceName: "Thanh pho Can Tho",
        currentYear: 2026
      },
      area: {
        id: VALID_AREA_ID,
        name: "Phu Tri B1",
        code: null,
        secretaryName: "Dang Van Dung",
        secretaryPhone: "0975382758",
        hamletHeadName: "Dang Van Dung",
        hamletHeadPhone: "0975382758",
        securityTeamLeaderName: "Pham Vinh Tran",
        securityTeamLeaderPhone: "0981030110",
        naturalArea: 150,
        description: "Ap phia bac xa Phu Huu",
        note: "Dan so khoang 800 nguoi"
      },
      summary: {
        total: 4,
        poor: 0,
        nearPoor: 0,
        normal: 4
      },
      households: []
    });

    const req = {
      params: {
        slug: "ward-public-abc",
        areaSlug: "phu-tri-b1--33333333"
      }
    } as unknown as Request;
    const res = createMockRes();
    const next = vi.fn();

    getPublicPovertyAreaBySlugAndAreaSlug(req, res, next);
    await flushAsync();

    expect(getPublicAreaDetailBySlugAndAreaSlug).toHaveBeenCalledWith("ward-public-abc", "phu-tri-b1--33333333");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });
});

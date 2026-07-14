import { poorHouseholds } from "@/schema.ts";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  aggregateWardOverviewRows,
  buildDashboardMemberTotals,
  attachHeadMemberSummaries,
  attachMemberCounts,
  buildDashboardMonthlyTrend,
  buildDashboardTrendAvailableYears,
  buildPublicAreaSlug,
  buildBackfillException,
  deriveHouseholdLocationNames,
  findLatestWardOverviewYear,
  gisMarkerFilters,
  mapHouseholdChangeLogRow,
  normalizeLocationText,
  shouldClearOtherHeadMembers,
  sortContextHistoriesLatestFirst,
  toPublicPovertyMarker
} from "./poverty.repository.ts";

describe("poorHouseholds table schema", () => {
  it("does not include the deprecated districtName column", () => {
    expect(Object.keys(getTableColumns(poorHouseholds))).not.toContain("districtName");
  });
});

describe("attachHeadMemberSummaries", () => {
  it("adds head full name and citizen id to matching households", () => {
    const households = [
      { id: "household-1", code: "HN-001" },
      { id: "household-2", code: "HN-002" }
    ];
    const heads = [
      { householdId: "household-2", fullName: "Tran Thi B", citizenId: "002" },
      { householdId: "household-1", fullName: "Nguyen Van A", citizenId: "001" }
    ];

    expect(attachHeadMemberSummaries(households, heads)).toEqual([
      { id: "household-1", code: "HN-001", headFullName: "Nguyen Van A", headCitizenId: "001" },
      { id: "household-2", code: "HN-002", headFullName: "Tran Thi B", headCitizenId: "002" }
    ]);
  });

  it("keeps null head fields when household has no head member", () => {
    const households = [{ id: "household-1", code: "HN-001" }];

    expect(attachHeadMemberSummaries(households, [])).toEqual([
      { id: "household-1", code: "HN-001", headFullName: null, headCitizenId: null }
    ]);
  });

  it("falls back to household snapshot values when no head member exists", () => {
    const households = [
      { id: "household-1", code: "HN-001", headFullName: "Nguyen Van A", headCitizenId: "001234567890" }
    ];

    expect(attachHeadMemberSummaries(households, [])).toEqual([
      { id: "household-1", code: "HN-001", headFullName: "Nguyen Van A", headCitizenId: "001234567890" }
    ]);
  });
});

describe("gisMarkerFilters", () => {
  it("does not exclude households without coordinates", () => {
    expect(gisMarkerFilters({})).toHaveLength(0);
  });
});

describe("findLatestWardOverviewYear", () => {
  it("returns the newest available ward overview year", () => {
    expect(findLatestWardOverviewYear([
      { year: 2024 },
      { year: 2026 },
      { year: 2025 }
    ])).toBe(2026);
  });

  it("returns null when there are no ward overviews", () => {
    expect(findLatestWardOverviewYear([])).toBeNull();
  });
});

describe("buildPublicAreaSlug", () => {
  it("creates a readable slug with an area id suffix", () => {
    expect(
      buildPublicAreaSlug("Phu Tri B1", "0d7ce58c-4137-4db3-8132-a4eb56d6411f")
    ).toBe("phu-tri-b1--0d7ce58c");
  });

  it("falls back to khu-vuc when the name is empty", () => {
    expect(
      buildPublicAreaSlug("", "0d7ce58c-4137-4db3-8132-a4eb56d6411f")
    ).toBe("khu-vuc--0d7ce58c");
  });
});

describe("aggregateWardOverviewRows", () => {
  it("sums ward overview totals for the same year", () => {
    expect(
      aggregateWardOverviewRows([
        {
          id: "overview-1",
          provinceCode: "92",
          wardCode: "31117",
          year: 2026,
          population: 1000,
          totalHouseholds: 250,
          totalMembers: 1100,
          naturalArea: 12.5,
          note: "Ward 1",
          createdAt: null,
          updatedAt: null
        },
        {
          id: "overview-2",
          provinceCode: "92",
          wardCode: "31120",
          year: 2026,
          population: 1500,
          totalHouseholds: 350,
          totalMembers: 1600,
          naturalArea: 18.25,
          note: "Ward 2",
          createdAt: null,
          updatedAt: null
        }
      ])
    ).toEqual({
      year: 2026,
      population: 2500,
      totalHouseholds: 600,
      totalMembers: 2700,
      naturalArea: 30.75,
      note: null,
      provinceCode: null,
      wardCode: null,
      createdAt: null,
      updatedAt: null
    });
  });
});

describe("buildDashboardMonthlyTrend", () => {
  it("groups assessment counts by month, keeps the latest record per household-year, and ignores invalid decision dates", () => {
    expect(
      buildDashboardMonthlyTrend([
        {
          householdId: "household-2",
          assessmentYear: 2026,
          povertyType: "NEAR_POOR",
          decisionDate: "2026-01-10",
          createdAt: "2026-01-11T08:00:00.000Z"
        },
        {
          householdId: "household-1",
          assessmentYear: 2026,
          povertyType: "POOR",
          decisionDate: "2026-01-15",
          createdAt: "2026-01-15T08:00:00.000Z"
        },
        {
          householdId: "household-1",
          assessmentYear: 2026,
          povertyType: "NEAR_POOR",
          decisionDate: "2026-01-25",
          createdAt: "2026-01-26T08:00:00.000Z"
        },
        {
          householdId: "household-3",
          assessmentYear: 2026,
          povertyType: "POOR",
          decisionDate: "2026-02-05",
          createdAt: "2026-02-06T08:00:00.000Z"
        },
        {
          householdId: "household-4",
          assessmentYear: 2025,
          povertyType: "POOR",
          decisionDate: "2024-12-31",
          createdAt: "2025-01-02T08:00:00.000Z"
        },
        {
          householdId: "household-5",
          assessmentYear: 2025,
          povertyType: "POOR",
          decisionDate: null,
          createdAt: "2025-03-01T08:00:00.000Z"
        }
      ])
    ).toEqual([
      {
        year: 2026,
        months: [
          { month: 1, poor: 0, nearPoor: 2, total: 2 },
          { month: 2, poor: 1, nearPoor: 0, total: 1 }
        ]
      }
    ]);
  });
});

describe("mapHouseholdChangeLogRow", () => {
  it("attaches the linked account to each household change log", () => {
    expect(
      mapHouseholdChangeLogRow({
        id: "log-1",
        householdId: "household-1",
        actionType: "UPDATE",
        objectType: "HOUSEHOLD",
        objectId: "household-1",
        changedBy: "account-1",
        oldData: { status: "ACTIVE" },
        newData: { status: "INACTIVE" },
        changeNote: "Ngưng hoạt động hộ",
        changedAt: new Date("2026-07-14T08:00:00.000Z"),
        changedByUuid: "account-1",
        changedByFullName: "Nguyen Van A",
        changedByEmail: "a@example.com"
      })
    ).toEqual({
      id: "log-1",
      householdId: "household-1",
      actionType: "UPDATE",
      objectType: "HOUSEHOLD",
      objectId: "household-1",
      changedBy: "account-1",
      oldData: { status: "ACTIVE" },
      newData: { status: "INACTIVE" },
      changeNote: "Ngưng hoạt động hộ",
      changedAt: new Date("2026-07-14T08:00:00.000Z"),
      changedByAccount: {
        uuid: "account-1",
        fullName: "Nguyen Van A",
        email: "a@example.com"
      }
    });
  });
});

describe("buildDashboardTrendAvailableYears", () => {
  it("deduplicates and sorts available trend years", () => {
    expect(
      buildDashboardTrendAvailableYears([
        { year: 2026, months: [{ month: 1, poor: 1, nearPoor: 0, total: 1 }] },
        { year: 2024, months: [{ month: 2, poor: 0, nearPoor: 1, total: 1 }] },
        { year: 2026, months: [{ month: 3, poor: 1, nearPoor: 1, total: 2 }] },
        { year: 2025, months: [] }
      ])
    ).toEqual([2024, 2025, 2026]);
  });
});

describe("buildDashboardMemberTotals", () => {
  it("sums memberCount by poor and near-poor households", () => {
    expect(
      buildDashboardMemberTotals([
        { povertyType: "POOR", memberCount: 4 },
        { povertyType: "POOR", memberCount: 2 },
        { povertyType: "NEAR_POOR", memberCount: 3 },
        { povertyType: "NONE", memberCount: 9 },
        { povertyType: "POOR", memberCount: null }
      ])
    ).toEqual({
      total: 9,
      poor: 6,
      nearPoor: 3
    });
  });

  it("falls back to actual member counts when the household snapshot is empty", () => {
    expect(
      buildDashboardMemberTotals([
        { povertyType: "POOR", memberCount: null, actualMemberCount: 5 },
        { povertyType: "NEAR_POOR", memberCount: 3, actualMemberCount: 7 },
        { povertyType: "NEAR_POOR", memberCount: null, actualMemberCount: 4 }
      ])
    ).toEqual({
      total: 12,
      poor: 5,
      nearPoor: 7
    });
  });

  it("falls back to actual member counts when blank snapshot values were coerced to zero", () => {
    expect(
      buildDashboardMemberTotals([
        { povertyType: "POOR", memberCount: 0, actualMemberCount: 5 },
        { povertyType: "NEAR_POOR", memberCount: 0, actualMemberCount: 4 }
      ])
    ).toEqual({
      total: 9,
      poor: 5,
      nearPoor: 4
    });
  });
});

describe("attachMemberCounts", () => {
  it("adds member count to households and defaults missing counts to zero", () => {
    const households = [
      { id: "household-1", code: "HN-001" },
      { id: "household-2", code: "HN-002" }
    ];

    expect(attachMemberCounts(households, [{ householdId: "household-1", memberCount: 4 }])).toEqual([
      { id: "household-1", code: "HN-001", memberCount: 4 },
      { id: "household-2", code: "HN-002", memberCount: 0 }
    ]);
  });

  it("falls back to snapshot member count when member rows are not available yet", () => {
    const households = [
      { id: "household-1", code: "HN-001", memberCount: 5 },
      { id: "household-2", code: "HN-002", memberCount: null }
    ];

    expect(attachMemberCounts(households, [])).toEqual([
      { id: "household-1", code: "HN-001", memberCount: 5 },
      { id: "household-2", code: "HN-002", memberCount: 0 }
    ]);
  });
});

describe("shouldClearOtherHeadMembers", () => {
  it("only clears existing heads when a member is saved as household head", () => {
    expect(shouldClearOtherHeadMembers({ isHead: true, fullName: "Nguyen Van A" })).toBe(true);
    expect(shouldClearOtherHeadMembers({ isHead: false, fullName: "Nguyen Van A" })).toBe(false);
    expect(shouldClearOtherHeadMembers({ fullName: "Nguyen Van A" })).toBe(false);
  });
});

describe("sortContextHistoriesLatestFirst", () => {
  it("orders by recordedAt desc then createdAt desc", () => {
    const ordered = sortContextHistoriesLatestFirst([
      {
        id: "same-day-earlier-create",
        householdId: "household-1",
        recordedAt: "2026-06-01",
        createdAt: "2026-06-01T08:00:00.000Z",
        familySituation: "Hoan canh 1",
        currentStatus: null,
        note: null,
        updatedAt: null
      },
      {
        id: "newer-day",
        householdId: "household-1",
        recordedAt: "2026-06-02",
        createdAt: "2026-06-02T07:00:00.000Z",
        familySituation: null,
        currentStatus: "Hien trang 2",
        note: null,
        updatedAt: null
      },
      {
        id: "same-day-later-create",
        householdId: "household-1",
        recordedAt: "2026-06-01",
        createdAt: "2026-06-01T10:00:00.000Z",
        familySituation: "Hoan canh 3",
        currentStatus: "Hien trang 3",
        note: null,
        updatedAt: null
      }
    ]);

    expect(ordered.map((item) => item.id)).toEqual([
      "newer-day",
      "same-day-later-create",
      "same-day-earlier-create"
    ]);
  });
});

describe("normalizeLocationText", () => {
  it("removes accents, punctuation, and duplicate spaces", () => {
    expect(normalizeLocationText("  Phường An Khánh,  ")).toBe("phuong an khanh");
    expect(normalizeLocationText("Khu vực 1")).toBe("khu vuc 1");
  });
});

describe("deriveHouseholdLocationNames", () => {
  it("prefers standardized labels and falls back to snapshots", () => {
    expect(
      deriveHouseholdLocationNames({
        provinceName: "Can Tho cu",
        wardName: "An Khanh cu",
        areaName: "Khu vuc cu"
      }, {
        provinceName: "Thanh pho Can Tho",
        wardName: "Phuong An Khanh",
        areaName: "Khu vuc 1"
      })
    ).toEqual({
      provinceName: "Thanh pho Can Tho",
      wardName: "Phuong An Khanh",
      areaName: "Khu vuc 1"
    });
  });

  it("keeps snapshot text when standardized labels are missing", () => {
    expect(
      deriveHouseholdLocationNames({
        provinceName: "Can Tho cu",
        wardName: "An Khanh cu",
        areaName: "Khu vuc cu"
      }, {})
    ).toEqual({
      provinceName: "Can Tho cu",
      wardName: "An Khanh cu",
      areaName: "Khu vuc cu"
    });
  });
});

describe("buildBackfillException", () => {
  it("captures the household context needed for manual review", () => {
    expect(
      buildBackfillException(
        {
          id: "household-1",
          code: "HN-001",
          provinceName: "Can Tho",
          wardName: "An Khanh",
          areaName: "Khu vuc 1"
        },
        "ward_not_found"
      )
    ).toEqual({
      householdId: "household-1",
      code: "HN-001",
      provinceName: "Can Tho",
      wardName: "An Khanh",
      areaName: "Khu vuc 1",
      reason: "ward_not_found"
    });
  });
});

describe("toPublicPovertyMarker", () => {
  it("omits sensitive household fields from the public marker payload", () => {
    expect(
      toPublicPovertyMarker({
        id: "household-1",
        code: "HN-001",
        year: 2026,
        povertyType: "POOR",
        status: "ACTIVE",
        provinceCode: "92",
        wardCode: "31117",
        areaId: "area-1",
        provinceName: "Thanh pho Can Tho",
        wardName: "Phuong An Khanh",
        areaName: "Khu vuc 1",
        address: "12 Duong A",
        latitude: 10.0321,
        longitude: 105.7512,
        headFullName: "Nguyen Van A",
        headCitizenId: "001234567890",
        memberCount: 4,
        supportCount: 2,
        supportTotalAmount: 1500000,
        latestSupportDate: "2026-06-12",
        latestSupportMonthAmount: 1000000
      })
    ).toEqual({
      id: "household-1",
      code: "HN-001",
      year: 2026,
      povertyType: "POOR",
      status: "ACTIVE",
      provinceCode: "92",
      wardCode: "31117",
      areaId: "area-1",
      provinceName: "Thanh pho Can Tho",
      wardName: "Phuong An Khanh",
      areaName: "Khu vuc 1",
      address: "12 Duong A",
      latitude: 10.0321,
      longitude: 105.7512,
      headFullName: "Nguyen Van A",
      memberCount: 4,
      fieldPhotoCount: 0,
      supportCount: 2,
      supportTotalAmount: 1500000,
      latestSupportDate: "2026-06-12",
      latestSupportMonthAmount: 1000000
    });
  });

  it("keeps public-safe list fields and omits headCitizenId", () => {
    expect(
      toPublicPovertyMarker({
        id: "household-1",
        code: "HN-001",
        year: 2026,
        povertyType: "NEAR_POOR",
        status: "ACTIVE",
        provinceCode: "92",
        wardCode: "31117",
        areaId: "0d7ce58c-4137-4db3-8132-a4eb56d6411f",
        provinceName: "Thanh pho Can Tho",
        wardName: "Xa Phu Huu",
        areaName: "Phu Tri B1",
        latitude: 10.2,
        longitude: 105.7,
        headFullName: "Nguyen Van A",
        headCitizenId: "001234567890",
        memberCount: 4,
        supportCount: 2,
        supportTotalAmount: 5000000,
        latestSupportDate: "2026-01-01",
        latestSupportMonthAmount: 1000000
      }) as Record<string, unknown>
    ).not.toHaveProperty("headCitizenId");
  });
});

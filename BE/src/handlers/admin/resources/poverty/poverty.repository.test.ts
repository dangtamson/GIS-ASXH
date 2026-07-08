import { poorHouseholds } from "@/schema.ts";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  aggregateWardOverviewRows,
  attachHeadMemberSummaries,
  attachMemberCounts,
  buildPublicAreaSlug,
  buildBackfillException,
  deriveHouseholdLocationNames,
  findLatestWardOverviewYear,
  gisMarkerFilters,
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

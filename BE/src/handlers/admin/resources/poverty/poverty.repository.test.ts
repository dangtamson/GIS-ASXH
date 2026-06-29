import { describe, expect, it } from "vitest";
import { attachHeadMemberSummaries, attachMemberCounts, gisMarkerFilters, shouldClearOtherHeadMembers } from "./poverty.repository.ts";

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
});

describe("gisMarkerFilters", () => {
  it("does not exclude households without coordinates", () => {
    expect(gisMarkerFilters({})).toHaveLength(0);
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
});

describe("shouldClearOtherHeadMembers", () => {
  it("only clears existing heads when a member is saved as household head", () => {
    expect(shouldClearOtherHeadMembers({ isHead: true, fullName: "Nguyen Van A" })).toBe(true);
    expect(shouldClearOtherHeadMembers({ isHead: false, fullName: "Nguyen Van A" })).toBe(false);
    expect(shouldClearOtherHeadMembers({ fullName: "Nguyen Van A" })).toBe(false);
  });
});

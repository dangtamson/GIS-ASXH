import { describe, expect, it } from "vitest";
import {
  areaCreateSchema,
  contextHistoryIdParamSchema,
  householdContextHistoryCreateSchema,
  householdCreateSchema,
  householdIdParamSchema,
  memberIdParamSchema,
  povertyWardOverviewUpsertSchema
} from "./poverty.schemas.ts";

describe("poverty route parameter schemas", () => {
  it("accepts UUID household ids", () => {
    const result = householdIdParamSchema.safeParse({ id: "6f3a67e7-1d40-4b50-a7dd-580f98c0345f" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe("6f3a67e7-1d40-4b50-a7dd-580f98c0345f");
    }
  });

  it("accepts UUID nested member ids", () => {
    const result = memberIdParamSchema.safeParse({
      id: "6f3a67e7-1d40-4b50-a7dd-580f98c0345f",
      memberId: "9fb97875-4916-41b8-8151-b0d655e0352b"
    });

    expect(result.success).toBe(true);
  });

  it("rejects legacy numeric ids", () => {
    const result = householdIdParamSchema.safeParse({ id: "123" });

    expect(result.success).toBe(false);
  });

  it("accepts UUID nested context history ids", () => {
    const result = contextHistoryIdParamSchema.safeParse({
      id: "6f3a67e7-1d40-4b50-a7dd-580f98c0345f",
      contextHistoryId: "9fb97875-4916-41b8-8151-b0d655e0352b"
    });

    expect(result.success).toBe(true);
  });
});

describe("householdContextHistoryCreateSchema", () => {
  it("rejects payloads when both familySituation and currentStatus are empty", () => {
    const result = householdContextHistoryCreateSchema.safeParse({
      recordedAt: "2026-07-06",
      familySituation: "   ",
      currentStatus: "   "
    });

    expect(result.success).toBe(false);
  });

  it("accepts payloads when at least one of the two fields has content", () => {
    const result = householdContextHistoryCreateSchema.safeParse({
      recordedAt: "2026-07-06",
      familySituation: "Gia dinh kho khan"
    });

    expect(result.success).toBe(true);
  });
});

describe("povertyWardOverviewUpsertSchema", () => {
  it("accepts a ward overview payload with required yearly fields", () => {
    const result = povertyWardOverviewUpsertSchema.safeParse({
      provinceCode: "92",
      wardCode: "31117",
      year: 2026,
      population: 1200,
      totalHouseholds: 320,
      totalMembers: 1500,
      naturalArea: 12.5,
      note: "Cap nhat dau nam"
    });

    expect(result.success).toBe(true);
  });

  it("rejects negative natural area values", () => {
    const result = povertyWardOverviewUpsertSchema.safeParse({
      provinceCode: "92",
      wardCode: "31117",
      year: 2026,
      population: 1200,
      totalHouseholds: 320,
      totalMembers: 1500,
      naturalArea: -1
    });

    expect(result.success).toBe(false);
  });
});

describe("areaCreateSchema", () => {
  it("requires a ward area name", () => {
    const result = areaCreateSchema.safeParse({
      provinceCode: "92",
      wardCode: "31117",
      code: "KV01",
      name: "   "
    });

    expect(result.success).toBe(false);
  });

  it("accepts full ward area contact details", () => {
    const result = areaCreateSchema.safeParse({
      provinceCode: "92",
      wardCode: "31117",
      code: "KV01",
      name: "Khu vuc 1",
      secretaryName: "Nguyen Van A",
      secretaryPhone: "0909123456",
      hamletHeadName: "Tran Van B",
      hamletHeadPhone: "0909222333",
      securityTeamLeaderName: "Le Van C",
      securityTeamLeaderPhone: "0909444555",
      naturalArea: 4.2,
      description: "Mo ta",
      note: "Ghi chu",
      status: true
    });

    expect(result.success).toBe(true);
  });
});

describe("householdCreateSchema standardized location keys", () => {
  it("requires standardized province, ward, and area keys", () => {
    const result = householdCreateSchema.safeParse({
      year: 2026,
      povertyType: "POOR",
      provinceName: "Can Tho",
      wardName: "Phuong An Khanh",
      areaName: "Khu vuc 1"
    });

    expect(result.success).toBe(false);
  });

  it("accepts a household payload with standardized location keys", () => {
    const result = householdCreateSchema.safeParse({
      year: 2026,
      povertyType: "POOR",
      provinceCode: "92",
      wardCode: "31117",
      areaId: "9fb97875-4916-41b8-8151-b0d655e0352b",
      address: "123 duong ABC"
    });

    expect(result.success).toBe(true);
  });

  it("accepts mobile collection head info and member count", () => {
    const result = householdCreateSchema.safeParse({
      year: 2026,
      povertyType: "POOR",
      provinceCode: "92",
      wardCode: "31117",
      areaId: "9fb97875-4916-41b8-8151-b0d655e0352b",
      address: "123 duong ABC",
      headFullName: "Nguyen Van A",
      headCitizenId: "079123456789",
      memberCount: 4
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.headFullName).toBe("Nguyen Van A");
      expect(result.data.headCitizenId).toBe("079123456789");
      expect(result.data.memberCount).toBe(4);
    }
  });

  it("keeps blank member count empty instead of coercing it to zero", () => {
    const result = householdCreateSchema.safeParse({
      year: 2026,
      povertyType: "POOR",
      provinceCode: "92",
      wardCode: "31117",
      areaId: "9fb97875-4916-41b8-8151-b0d655e0352b",
      address: "123 duong ABC",
      memberCount: ""
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.memberCount).toBeUndefined();
    }
  });
});

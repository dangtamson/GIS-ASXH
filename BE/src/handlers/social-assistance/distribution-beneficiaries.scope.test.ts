import { describe, expect, it, vi } from "vitest";
import type { PovertyAccessScope } from "@/handlers/admin/resources/poverty/poverty.scope.ts";

vi.mock("@/services/db/drizzle.ts", () => ({ db: { select: vi.fn() } }));
vi.mock("@/handlers/report/common.ts", () => ({ expandOrganizationDescendants: vi.fn() }));

import { canAccessDistributionBeneficiary } from "./distribution-beneficiaries.scope.ts";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";
const scope: PovertyAccessScope = {
    organizationIds: [organizationId],
    provinceCodes: [],
    wardCodes: ["31348"],
    areaIds: [],
    isBranchAdmin: false,
    isSuperAdmin: false,
    hasScope: true
};

describe("distribution beneficiary scope", () => {
    it("requires matching workspace even for super administrators", () => {
        const admin = { ...scope, isSuperAdmin: true };
        expect(canAccessDistributionBeneficiary(workspaceId, admin, {
            workspaceId: "33333333-3333-4333-8333-333333333333",
            provinceCode: "92",
            wardCode: "31348"
        })).toBe(false);
    });

    it("allows matching wards and denies other wards", () => {
        expect(canAccessDistributionBeneficiary(workspaceId, scope, { workspaceId, provinceCode: "92", wardCode: "31348" })).toBe(true);
        expect(canAccessDistributionBeneficiary(workspaceId, scope, { workspaceId, provinceCode: "92", wardCode: "31135" })).toBe(false);
    });

    it("allows an assigned organization even when no geographic scope is assigned", () => {
        const organizationScope = { ...scope, wardCodes: [], hasScope: false };
        expect(canAccessDistributionBeneficiary(workspaceId, organizationScope, { workspaceId, organizationId })).toBe(true);
        expect(canAccessDistributionBeneficiary(workspaceId, organizationScope, { workspaceId, organizationId: "33333333-3333-4333-8333-333333333333" })).toBe(false);
    });

    it("requires both scopes when a beneficiary has both an organization and a locality", () => {
        expect(canAccessDistributionBeneficiary(workspaceId, scope, { workspaceId, organizationId, provinceCode: "92", wardCode: "31135" })).toBe(false);
        expect(canAccessDistributionBeneficiary(workspaceId, scope, { workspaceId, organizationId, provinceCode: "92", wardCode: "31348" })).toBe(true);
    });

    it("denies missing or incomplete target data", () => {
        expect(canAccessDistributionBeneficiary(workspaceId, scope, { workspaceId })).toBe(false);
        expect(canAccessDistributionBeneficiary(workspaceId, scope, { workspaceId, provinceCode: "92" })).toBe(false);
    });
});
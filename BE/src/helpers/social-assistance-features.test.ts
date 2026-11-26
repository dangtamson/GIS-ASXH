import { describe, expect, it } from "vitest";
import { SOCIAL_ASSISTANCE_FEATURES, SOCIAL_ASSISTANCE_PERMISSIONS } from "@/social-assistance/features.ts";

describe("social assistance feature catalog", () => {
    it("declares the remaining allocation workflows", () => {
        expect(SOCIAL_ASSISTANCE_FEATURES).toContainEqual(expect.objectContaining({
            code: "social_assistance_distribution_orders",
            requiredPermissionCode: "social_assistance.distribution_batch.view",
            path: "/an-sinh/phan-bo"
        }));
        expect(SOCIAL_ASSISTANCE_FEATURES).toContainEqual(expect.objectContaining({
            code: "social_assistance_beneficiaries",
            requiredPermissionCode: "social_assistance.beneficiary.view",
            path: "/an-sinh/phan-bo"
        }));
    });

    it("declares private beneficiary permissions separately", () => {
        expect(SOCIAL_ASSISTANCE_PERMISSIONS).toContainEqual([
            "social_assistance.beneficiary.view",
            "View private social assistance beneficiaries"
        ]);
        expect(SOCIAL_ASSISTANCE_PERMISSIONS).toContainEqual([
            "social_assistance.beneficiary.manage",
            "Manage private social assistance beneficiaries"
        ]);
    });
});

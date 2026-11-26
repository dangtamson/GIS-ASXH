import { describe, expect, it } from "vitest";
import { API_ROUTES, PERMISSION_CODES, permissions } from "./permissions.ts";

describe("social-assistance permission codes", () => {
    it("defines a dedicated permission for each new workflow", () => {
        expect(PERMISSION_CODES.SocialAssistanceRequestView).toBe("social_assistance.request.view");
        expect(PERMISSION_CODES.SocialAssistanceRequestCreate).toBe("social_assistance.request.create");
        expect(PERMISSION_CODES.SocialAssistanceRequestReview).toBe("social_assistance.request.review");
        expect(PERMISSION_CODES.SocialAssistanceProgramView).toBe("social_assistance.program.view");
        expect(PERMISSION_CODES.SocialAssistanceProgramManage).toBe("social_assistance.program.manage");
        expect(PERMISSION_CODES.SocialAssistancePledgeView).toBe("social_assistance.pledge.view");
        expect(PERMISSION_CODES.SocialAssistancePledgeReconcile).toBe("social_assistance.pledge.reconcile");
        expect(PERMISSION_CODES.SocialAssistanceAllocationView).toBe("social_assistance.allocation.view");
        expect(PERMISSION_CODES.SocialAssistanceAllocationManage).toBe("social_assistance.allocation.manage");
        expect(PERMISSION_CODES.SocialAssistanceReportView).toBe("social_assistance.report.read");
        expect(PERMISSION_CODES.SocialAssistancePublicationManage).toBe("social_assistance.publication.manage");
        expect(PERMISSION_CODES.SocialAssistancePortalManage).toBe("social_assistance.portal.manage");
    });

    it("requires dedicated beneficiary permissions and leaves public aggregate orders anonymous", () => {
        expect(permissions.get(API_ROUTES.socialAssistanceDistributionBeneficiaries)).toMatchObject({
            authenticated: true,
            workspaceScoped: true,
            permissions: {
                GET: "social_assistance.beneficiary.view",
                POST: "social_assistance.beneficiary.manage"
            }
        });
        expect(permissions.get(API_ROUTES.publicSocialAssistanceDistributionOrders)).toMatchObject({
            authenticated: false,
            permissions: {}
        });
    });
});
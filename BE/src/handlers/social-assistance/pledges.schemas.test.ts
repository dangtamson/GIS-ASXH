import { describe, expect, it } from "vitest";
import {
    canTransitionSocialAssistancePledge,
    isPledgeReceiptComplete,
    publicSocialAssistancePledgeSchema,
    socialAssistancePledgeListQuerySchema,
    socialAssistancePledgeReconciliationSchema
} from "./pledges.schemas.ts";

const validPledge = {
    programId: "11111111-1111-4111-8111-111111111111",
    donorType: "ORGANIZATION",
    donorName: "Doanh nghiep A",
    contactPhone: "0909123456",
    pledgeType: "CASH",
    pledgedAmount: 5000000,
    consent: true
};

describe("public social assistance pledge schema", () => {
    it("accepts a program-level cash pledge", () => {
        expect(publicSocialAssistancePledgeSchema.safeParse(validPledge).success).toBe(true);
    });

    it("requires an item description for in-kind pledges", () => {
        expect(publicSocialAssistancePledgeSchema.safeParse({ ...validPledge, pledgeType: "IN_KIND" }).success).toBe(false);
        expect(publicSocialAssistancePledgeSchema.safeParse({
            ...validPledge,
            pledgeType: "IN_KIND",
            pledgedAmount: undefined,
            itemDescription: "20 bo sach"
        }).success).toBe(true);
    });

    it("rejects non-positive cash values and recipient-specific fields", () => {
        expect(publicSocialAssistancePledgeSchema.safeParse({ ...validPledge, pledgedAmount: 0 }).success).toBe(false);
        expect(publicSocialAssistancePledgeSchema.safeParse({ ...validPledge, householdId: "recipient-id" }).success).toBe(false);
    });
});

describe("social assistance pledge reconciliation", () => {
    it("validates the optional staff status filter", () => {
        expect(socialAssistancePledgeListQuerySchema.safeParse({ status: "RECEIVED" }).success).toBe(true);
        expect(socialAssistancePledgeListQuerySchema.safeParse({ status: "UNKNOWN" }).success).toBe(false);
    });

    it("allows manual review and receipt transitions only", () => {
        expect(canTransitionSocialAssistancePledge("PENDING_REVIEW", "REVIEWED")).toBe(true);
        expect(canTransitionSocialAssistancePledge("REVIEWED", "RECEIVED")).toBe(true);
        expect(canTransitionSocialAssistancePledge("RECEIVED", "RECONCILED")).toBe(true);
        expect(canTransitionSocialAssistancePledge("PENDING_REVIEW", "RECONCILED")).toBe(false);
        expect(canTransitionSocialAssistancePledge("RECONCILED", "REVIEWED")).toBe(false);
    });

    it("requires actual cash or item receipt details", () => {
        const cash = socialAssistancePledgeReconciliationSchema.safeParse({ status: "RECEIVED", receivedAmount: 1000 });
        const inKind = socialAssistancePledgeReconciliationSchema.safeParse({ status: "RECEIVED", receivedDescription: "10 bo sach" });

        expect(cash.success && isPledgeReceiptComplete("CASH", cash.data)).toBe(true);
        expect(inKind.success && isPledgeReceiptComplete("IN_KIND", inKind.data)).toBe(true);
        expect(isPledgeReceiptComplete("CASH", { status: "RECEIVED" })).toBe(false);
        expect(isPledgeReceiptComplete("IN_KIND", { status: "RECEIVED" })).toBe(false);
    });
});
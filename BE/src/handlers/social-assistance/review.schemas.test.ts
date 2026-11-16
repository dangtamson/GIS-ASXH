import { describe, expect, it } from "vitest";
import {
    canTransitionSocialAssistanceRequest,
    socialAssistanceRequestIdParamSchema
} from "./review.schemas.ts";

describe("social assistance review route parameters", () => {
    it("accepts UUID request ids and rejects malformed ids", () => {
        expect(socialAssistanceRequestIdParamSchema.safeParse({ id: "11111111-1111-4111-8111-111111111111" }).success).toBe(
            true
        );
        expect(socialAssistanceRequestIdParamSchema.safeParse({ id: "not-a-uuid" }).success).toBe(false);
    });
});

describe("social assistance request status transitions", () => {
    it("allows review and information-request transitions", () => {
        expect(canTransitionSocialAssistanceRequest("RECEIVED", "IN_REVIEW")).toBe(true);
        expect(canTransitionSocialAssistanceRequest("IN_REVIEW", "NEEDS_INFORMATION")).toBe(true);
        expect(canTransitionSocialAssistanceRequest("NEEDS_INFORMATION", "IN_REVIEW")).toBe(true);
    });

    it("only allows verification or rejection after review starts", () => {
        expect(canTransitionSocialAssistanceRequest("IN_REVIEW", "VERIFIED")).toBe(true);
        expect(canTransitionSocialAssistanceRequest("IN_REVIEW", "REJECTED")).toBe(true);
        expect(canTransitionSocialAssistanceRequest("RECEIVED", "VERIFIED")).toBe(false);
    });

    it("keeps verified and rejected requests terminal", () => {
        expect(canTransitionSocialAssistanceRequest("VERIFIED", "IN_REVIEW")).toBe(false);
        expect(canTransitionSocialAssistanceRequest("REJECTED", "IN_REVIEW")).toBe(false);
    });
});
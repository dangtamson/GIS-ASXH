import { describe, expect, it } from "vitest";
import {
    publicSocialAssistanceRequestSchema,
    publicSocialAssistanceWardQuerySchema
} from "./requests.schemas.ts";

const validRequest = {
    contactName: "Nguyen Van A",
    phone: "0909123456",
    needCategory: "FOOD",
    needDescription: "Can ho tro luong thuc",
    address: "Phuong An Khanh, Can Tho",
    provinceCode: "92",
    wardCode: "31117",
    consent: true,
    source: "MAP"
};

describe("publicSocialAssistanceRequestSchema", () => {
    it("accepts a valid public request without coordinates", () => {
        expect(publicSocialAssistanceRequestSchema.safeParse(validRequest).success).toBe(true);
    });

    it("requires contact details, a need, and consent", () => {
        expect(publicSocialAssistanceRequestSchema.safeParse({ ...validRequest, phone: "" }).success).toBe(false);
        expect(publicSocialAssistanceRequestSchema.safeParse({ ...validRequest, needDescription: " " }).success).toBe(false);
        expect(publicSocialAssistanceRequestSchema.safeParse({ ...validRequest, consent: false }).success).toBe(false);
    });

    it("requires standardized province and ward codes for geographic scoping", () => {
        expect(publicSocialAssistanceRequestSchema.safeParse({ ...validRequest, wardCode: "" }).success).toBe(false);
        expect(publicSocialAssistanceRequestSchema.safeParse({ ...validRequest, provinceCode: "" }).success).toBe(false);
    });

    it("requires coordinates as a valid pair", () => {
        expect(publicSocialAssistanceRequestSchema.safeParse({ ...validRequest, latitude: 10.1 }).success).toBe(false);
        expect(
            publicSocialAssistanceRequestSchema.safeParse({ ...validRequest, latitude: 10.1, longitude: 105.8 }).success
        ).toBe(true);
        expect(
            publicSocialAssistanceRequestSchema.safeParse({ ...validRequest, latitude: 91, longitude: 105.8 }).success
        ).toBe(false);
    });

    it("rejects unknown public source channels", () => {
        expect(publicSocialAssistanceRequestSchema.safeParse({ ...validRequest, source: "UNTRUSTED" }).success).toBe(false);
    });
});

describe("publicSocialAssistanceWardQuerySchema", () => {
    it("requires a province code for public ward lookup", () => {
        expect(publicSocialAssistanceWardQuerySchema.safeParse({ provinceCode: "92" }).success).toBe(true);
        expect(publicSocialAssistanceWardQuerySchema.safeParse({ provinceCode: " " }).success).toBe(false);
        expect(publicSocialAssistanceWardQuerySchema.safeParse({}).success).toBe(false);
    });
});
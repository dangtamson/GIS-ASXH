import { describe, expect, it } from "vitest";
import {
    canTransitionSocialAssistanceAllocation,
    socialAssistanceAllocationCreateSchema,
    socialAssistanceAllocationIdParamSchema,
    socialAssistanceAllocationUpdateSchema
} from "./allocations.schemas.ts";

const validAllocation = {
    programId: "11111111-1111-4111-8111-111111111111",
    requestId: "22222222-2222-4222-8222-222222222222",
    plannedCashAmount: 2500000,
    internalNote: "Ho tro dot 1"
};

describe("social assistance allocation schema", () => {
    it("requires a UUID allocation id", () => {
        expect(socialAssistanceAllocationIdParamSchema.safeParse({ id: "11111111-1111-4111-8111-111111111111" }).success).toBe(true);
        expect(socialAssistanceAllocationIdParamSchema.safeParse({ id: "invalid" }).success).toBe(false);
    });

    it("accepts a staff allocation to a program and verified request", () => {
        expect(socialAssistanceAllocationCreateSchema.safeParse(validAllocation).success).toBe(true);
    });

    it("requires a positive cash amount or an item description", () => {
        expect(socialAssistanceAllocationCreateSchema.safeParse({ ...validAllocation, plannedCashAmount: 0 }).success).toBe(false);
        expect(socialAssistanceAllocationCreateSchema.safeParse({
            programId: validAllocation.programId,
            requestId: validAllocation.requestId,
            plannedItemDescription: "Bo sach"
        }).success).toBe(true);
    });

    it("only allows forward allocation lifecycle transitions", () => {
        expect(canTransitionSocialAssistanceAllocation("PLANNED", "APPROVED")).toBe(true);
        expect(canTransitionSocialAssistanceAllocation("APPROVED", "DELIVERED")).toBe(true);
        expect(canTransitionSocialAssistanceAllocation("DELIVERED", "RECONCILED")).toBe(true);
        expect(canTransitionSocialAssistanceAllocation("PLANNED", "DELIVERED")).toBe(false);
        expect(canTransitionSocialAssistanceAllocation("RECONCILED", "APPROVED")).toBe(false);
    });

    it("requires a delivery date when support is marked delivered", () => {
        expect(socialAssistanceAllocationUpdateSchema.safeParse({
            status: "DELIVERED",
            deliveredCashAmount: 100
        }).success).toBe(false);
        expect(socialAssistanceAllocationUpdateSchema.safeParse({
            status: "DELIVERED",
            deliveredCashAmount: 100,
            deliveryDate: "2026-11-20"
        }).success).toBe(true);
    });
});
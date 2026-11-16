import { describe, expect, it } from "vitest";
import { socialAssistanceProgramCreateSchema, socialAssistanceProgramListQuerySchema } from "./programs.schemas.ts";

describe("social assistance program schema", () => {
    it("accepts a program with public description and lifecycle dates", () => {
        const result = socialAssistanceProgramCreateSchema.safeParse({
            title: "Nha o an toan",
            publicDescription: "Ho tro sua chua nha cho ho co hoan canh kho khan.",
            category: "HOUSING",
            eligibilitySummary: "Ho da duoc xac minh tai dia phuong.",
            startDate: "2026-11-01",
            endDate: "2026-12-31",
            status: "DRAFT"
        });

        expect(result.success).toBe(true);
    });

    it("rejects an end date before the start date", () => {
        expect(socialAssistanceProgramCreateSchema.safeParse({
            title: "Nha o an toan",
            publicDescription: "Mo ta cong khai",
            category: "HOUSING",
            eligibilitySummary: "Tieu chi",
            startDate: "2026-12-31",
            endDate: "2026-11-01",
            status: "DRAFT"
        }).success).toBe(false);
    });

    it("accepts an optional lifecycle status filter", () => {
        expect(socialAssistanceProgramListQuerySchema.safeParse({ status: "PUBLISHED" }).success).toBe(true);
        expect(socialAssistanceProgramListQuerySchema.safeParse({ status: "UNKNOWN" }).success).toBe(false);
    });
});
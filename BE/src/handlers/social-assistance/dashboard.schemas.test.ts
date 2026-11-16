import { describe, expect, it } from "vitest";
import { socialAssistanceDashboardQuerySchema } from "./dashboard.schemas.ts";

describe("social assistance dashboard filters", () => {
    it("accepts bounded period, geography, program, and request status filters", () => {
        expect(socialAssistanceDashboardQuerySchema.safeParse({
            from: "2026-01-01",
            to: "2026-12-31",
            provinceCode: "92",
            wardCode: "31117",
            programId: "11111111-1111-4111-8111-111111111111",
            requestStatus: "VERIFIED"
        }).success).toBe(true);
    });

    it("rejects invalid dates, reversed periods, and unknown filters", () => {
        expect(socialAssistanceDashboardQuerySchema.safeParse({ from: "2026-13-01" }).success).toBe(false);
        expect(socialAssistanceDashboardQuerySchema.safeParse({ from: "2026-12-31", to: "2026-01-01" }).success).toBe(false);
        expect(socialAssistanceDashboardQuerySchema.safeParse({ workspaceId: "other-workspace" }).success).toBe(false);
    });
});
import { describe, expect, it } from "vitest";
import { socialAssistancePublicationFiltersSchema } from "./publications.schemas.ts";

describe("social assistance publication filters", () => {
    it("accepts a period with optional program and geography scope", () => {
        expect(socialAssistancePublicationFiltersSchema.safeParse({
            periodStart: "2026-01-01",
            periodEnd: "2026-12-31",
            programId: "11111111-1111-4111-8111-111111111111",
            provinceCode: "92",
            wardCode: "31117"
        }).success).toBe(true);
    });

    it("rejects reversed or invalid periods and unknown fields", () => {
        expect(socialAssistancePublicationFiltersSchema.safeParse({ periodStart: "2026-12-31", periodEnd: "2026-01-01" }).success).toBe(false);
        expect(socialAssistancePublicationFiltersSchema.safeParse({ periodStart: "2026-02-30", periodEnd: "2026-03-01" }).success).toBe(false);
        expect(socialAssistancePublicationFiltersSchema.safeParse({ periodStart: "2026-01-01", periodEnd: "2026-12-31", workspaceId: "other" }).success).toBe(false);
    });
});
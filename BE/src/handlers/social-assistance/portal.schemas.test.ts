import { describe, expect, it } from "vitest";
import { socialAssistancePublicPortalUpdateSchema } from "./portal.schemas.ts";

describe("social assistance public portal update schema", () => {
    it("accepts an explicit feature enablement change", () => {
        expect(socialAssistancePublicPortalUpdateSchema.safeParse({ intakeEnabled: true }).success).toBe(true);
    });

    it("rejects empty and unknown-field updates", () => {
        expect(socialAssistancePublicPortalUpdateSchema.safeParse({}).success).toBe(false);
        expect(socialAssistancePublicPortalUpdateSchema.safeParse({ workspaceId: "workspace-1" }).success).toBe(false);
        expect(socialAssistancePublicPortalUpdateSchema.safeParse({ publicAlias: "can-tho" }).success).toBe(false);
    });
});
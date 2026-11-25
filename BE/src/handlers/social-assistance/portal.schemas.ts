import { z } from "zod";

export const socialAssistancePublicPortalUpdateSchema = z
    .object({
        intakeEnabled: z.boolean().optional(),
        programsEnabled: z.boolean().optional(),
        resultsEnabled: z.boolean().optional(),
        allocationsEnabled: z.boolean().optional()
    })
    .strict()
    .refine((value) => Object.keys(value).length > 0, { message: "At least one portal setting is required" });
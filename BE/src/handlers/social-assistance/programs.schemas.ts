import { z } from "zod";

export const SOCIAL_ASSISTANCE_PROGRAM_CATEGORIES = [
    "FOOD",
    "HEALTHCARE",
    "HOUSING",
    "EDUCATION",
    "LIVELIHOOD",
    "CASH",
    "OTHER"
] as const;

export const SOCIAL_ASSISTANCE_PROGRAM_STATUSES = ["DRAFT", "PUBLISHED", "CLOSED"] as const;

export const socialAssistanceProgramListQuerySchema = z.object({
    status: z.enum(SOCIAL_ASSISTANCE_PROGRAM_STATUSES).optional()
});

const programBaseSchema = z.object({
    title: z.string().trim().min(1).max(255),
    publicDescription: z.string().trim().min(1).max(5000),
    category: z.enum(SOCIAL_ASSISTANCE_PROGRAM_CATEGORIES),
    eligibilitySummary: z.string().trim().min(1).max(2000),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    status: z.enum(SOCIAL_ASSISTANCE_PROGRAM_STATUSES).default("DRAFT")
});

export const socialAssistanceProgramCreateSchema = programBaseSchema
    .strict()
    .refine((value) => value.endDate >= value.startDate, {
        message: "End date must not be before start date",
        path: ["endDate"]
    });

export const socialAssistanceProgramUpdateSchema = programBaseSchema
    .partial()
    .strict()
    .refine((value) => Object.keys(value).length > 0, { message: "At least one program field is required" })
    .refine((value) => !value.startDate || !value.endDate || value.endDate >= value.startDate, {
        message: "End date must not be before start date",
        path: ["endDate"]
    });

export const socialAssistanceProgramIdParamSchema = z.object({
    id: z.uuid()
});

export type SocialAssistanceProgramCreateInput = z.infer<typeof socialAssistanceProgramCreateSchema>;
export type SocialAssistanceProgramUpdateInput = z.infer<typeof socialAssistanceProgramUpdateSchema>;
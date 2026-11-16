import { z } from "zod";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Date must be a valid calendar date");

export const socialAssistancePublicationFiltersSchema = z
    .object({
        periodStart: isoDateSchema,
        periodEnd: isoDateSchema,
        programId: z.uuid().optional(),
        provinceCode: z.string().trim().min(1).max(20).optional(),
        wardCode: z.string().trim().min(1).max(20).optional(),
        areaId: z.uuid().optional()
    })
    .strict()
    .refine((filters) => filters.periodStart <= filters.periodEnd, {
        message: "Period start must not be after period end",
        path: ["periodEnd"]
    });

export const socialAssistancePublicationBatchIdSchema = z.object({
    batchId: z.uuid()
});

export type SocialAssistancePublicationFilters = z.infer<typeof socialAssistancePublicationFiltersSchema>;
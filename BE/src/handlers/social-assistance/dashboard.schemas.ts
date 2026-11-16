import { z } from "zod";
import { socialAssistanceRequestStatusSchema } from "./requests.schemas.ts";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Date must be a valid calendar date");

export const socialAssistanceDashboardQuerySchema = z
    .object({
        from: isoDateSchema.optional(),
        to: isoDateSchema.optional(),
        provinceCode: z.string().trim().min(1).max(20).optional(),
        wardCode: z.string().trim().min(1).max(20).optional(),
        areaId: z.uuid().optional(),
        programId: z.uuid().optional(),
        requestStatus: socialAssistanceRequestStatusSchema.optional()
    })
    .strict()
    .refine((filters) => !filters.from || !filters.to || filters.from <= filters.to, {
        message: "Start date must not be after end date",
        path: ["to"]
    });

export type SocialAssistanceDashboardFilters = z.infer<typeof socialAssistanceDashboardQuerySchema>;
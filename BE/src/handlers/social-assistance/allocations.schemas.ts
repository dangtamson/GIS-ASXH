import { z } from "zod";

export const SOCIAL_ASSISTANCE_ALLOCATION_STATUSES = ["PLANNED", "APPROVED", "DELIVERED", "RECONCILED"] as const;

export const socialAssistanceAllocationCreateSchema = z
    .object({
        programId: z.uuid(),
        requestId: z.uuid(),
        plannedCashAmount: z.coerce.number().positive().max(1_000_000_000_000).optional(),
        plannedItemDescription: z.string().trim().min(1).max(2000).optional(),
        internalNote: z.string().trim().max(2000).optional()
    })
    .strict()
    .refine((value) => typeof value.plannedCashAmount === "number" || Boolean(value.plannedItemDescription), {
        message: "An allocation needs a positive cash amount or item description",
        path: ["plannedCashAmount"]
    });

export const socialAssistanceAllocationUpdateSchema = z
    .object({
        status: z.enum(SOCIAL_ASSISTANCE_ALLOCATION_STATUSES),
        deliveredCashAmount: z.coerce.number().positive().max(1_000_000_000_000).optional(),
        deliveredItemDescription: z.string().trim().min(1).max(2000).optional(),
        deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        internalNote: z.string().trim().max(2000).optional()
    })
    .strict()
    .refine((value) => value.status !== "DELIVERED" || Boolean(value.deliveryDate), {
        message: "Delivery date is required when support is marked delivered",
        path: ["deliveryDate"]
    });

export const socialAssistanceAllocationIdParamSchema = z.object({
    id: z.uuid()
});

export type SocialAssistanceAllocationCreateInput = z.infer<typeof socialAssistanceAllocationCreateSchema>;
export type SocialAssistanceAllocationUpdateInput = z.infer<typeof socialAssistanceAllocationUpdateSchema>;

const ALLOCATION_TRANSITIONS: Record<(typeof SOCIAL_ASSISTANCE_ALLOCATION_STATUSES)[number], readonly string[]> = {
    PLANNED: ["APPROVED"],
    APPROVED: ["DELIVERED"],
    DELIVERED: ["RECONCILED"],
    RECONCILED: []
};

export const canTransitionSocialAssistanceAllocation = (current: string, next: string): boolean =>
    ALLOCATION_TRANSITIONS[current as keyof typeof ALLOCATION_TRANSITIONS]?.includes(next) ?? false;
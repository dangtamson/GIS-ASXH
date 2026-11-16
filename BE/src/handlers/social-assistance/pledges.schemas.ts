import { z } from "zod";

export const SOCIAL_ASSISTANCE_PLEDGE_TYPES = ["CASH", "IN_KIND"] as const;
export const SOCIAL_ASSISTANCE_DONOR_TYPES = ["INDIVIDUAL", "ORGANIZATION"] as const;
export const SOCIAL_ASSISTANCE_PLEDGE_STATUSES = ["PENDING_REVIEW", "REVIEWED", "RECEIVED", "RECONCILED", "REJECTED"] as const;

export const socialAssistancePledgeListQuerySchema = z.object({
    status: z.enum(SOCIAL_ASSISTANCE_PLEDGE_STATUSES).optional()
});

export const socialAssistancePledgeIdParamSchema = z.object({
    id: z.uuid()
});

export const publicSocialAssistancePledgeSchema = z
    .object({
        programId: z.uuid(),
        donorType: z.enum(SOCIAL_ASSISTANCE_DONOR_TYPES),
        donorName: z.string().trim().min(1).max(255),
        contactPhone: z.string().trim().min(8).max(20).regex(/^\+?[0-9][0-9\s().-]*$/),
        contactEmail: z.string().trim().email().max(255).optional(),
        pledgeType: z.enum(SOCIAL_ASSISTANCE_PLEDGE_TYPES),
        pledgedAmount: z.coerce.number().positive().max(1_000_000_000_000).optional(),
        itemDescription: z.string().trim().min(1).max(2000).optional(),
        consent: z.literal(true)
    })
    .strict()
    .refine(
        (value) => value.pledgeType === "CASH"
            ? typeof value.pledgedAmount === "number"
            : Boolean(value.itemDescription),
        {
            message: "Cash pledges need a positive amount and in-kind pledges need an item description",
            path: ["pledgeType"]
        }
    );

export type PublicSocialAssistancePledgeInput = z.infer<typeof publicSocialAssistancePledgeSchema>;

export const socialAssistancePledgeReconciliationSchema = z
    .object({
        status: z.enum(SOCIAL_ASSISTANCE_PLEDGE_STATUSES),
        receivedAmount: z.coerce.number().positive().max(1_000_000_000_000).optional(),
        receivedDescription: z.string().trim().min(1).max(2000).optional(),
        internalNote: z.string().trim().max(2000).optional()
    })
    .strict();

export type SocialAssistancePledgeReconciliationInput = z.infer<typeof socialAssistancePledgeReconciliationSchema>;

const PLEDGE_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
    PENDING_REVIEW: ["REVIEWED", "REJECTED"],
    REVIEWED: ["RECEIVED", "REJECTED"],
    RECEIVED: ["RECONCILED"],
    RECONCILED: [],
    REJECTED: []
};

export const canTransitionSocialAssistancePledge = (current: string, next: string): boolean =>
    PLEDGE_STATUS_TRANSITIONS[current]?.includes(next) ?? false;

export const isPledgeReceiptComplete = (
    pledgeType: (typeof SOCIAL_ASSISTANCE_PLEDGE_TYPES)[number],
    input: Pick<SocialAssistancePledgeReconciliationInput, "receivedAmount" | "receivedDescription" | "status">
): boolean => {
    if (input.status !== "RECEIVED" && input.status !== "RECONCILED") return true;
    return pledgeType === "CASH" ? typeof input.receivedAmount === "number" : Boolean(input.receivedDescription);
};
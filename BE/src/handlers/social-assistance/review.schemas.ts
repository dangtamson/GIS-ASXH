import { z } from "zod";
import type { SocialAssistanceRequestStatus } from "./requests.schemas.ts";
import { socialAssistanceRequestStatusSchema } from "./requests.schemas.ts";

const REQUEST_STATUS_TRANSITIONS: Record<SocialAssistanceRequestStatus, readonly SocialAssistanceRequestStatus[]> = {
    RECEIVED: ["IN_REVIEW"],
    IN_REVIEW: ["NEEDS_INFORMATION", "VERIFIED", "REJECTED"],
    NEEDS_INFORMATION: ["IN_REVIEW"],
    VERIFIED: [],
    REJECTED: []
};

export const canTransitionSocialAssistanceRequest = (
    current: SocialAssistanceRequestStatus,
    next: SocialAssistanceRequestStatus
): boolean => REQUEST_STATUS_TRANSITIONS[current].includes(next);

export const socialAssistanceRequestReviewQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    status: socialAssistanceRequestStatusSchema.optional(),
    provinceCode: z.string().trim().min(1).optional(),
    wardCode: z.string().trim().min(1).optional(),
    areaId: z.uuid().optional()
});

export const socialAssistanceRequestIdParamSchema = z.object({
    id: z.uuid()
});

export const socialAssistanceRequestStatusUpdateSchema = z
    .object({
        status: socialAssistanceRequestStatusSchema,
        internalReason: z.string().trim().max(2000).optional()
    })
    .strict()
    .refine((value) => value.status !== "REJECTED" || Boolean(value.internalReason), {
        message: "A reason is required when rejecting a request",
        path: ["internalReason"]
    });
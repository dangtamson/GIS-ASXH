import { z } from "zod";

export const SOCIAL_ASSISTANCE_REQUEST_STATUSES = [
    "RECEIVED",
    "IN_REVIEW",
    "NEEDS_INFORMATION",
    "VERIFIED",
    "REJECTED"
] as const;

export const SOCIAL_ASSISTANCE_SOURCES = ["MAP", "WEBSITE", "FACEBOOK", "ZALO_OA", "STAFF", "OTHER"] as const;
export const PUBLIC_SOCIAL_ASSISTANCE_SOURCES = ["MAP", "WEBSITE", "FACEBOOK", "ZALO_OA", "OTHER"] as const;
export const SOCIAL_ASSISTANCE_NEED_CATEGORIES = [
    "FOOD",
    "HEALTHCARE",
    "HOUSING",
    "EDUCATION",
    "LIVELIHOOD",
    "CASH",
    "OTHER"
] as const;

export const socialAssistanceRequestStatusSchema = z.enum(SOCIAL_ASSISTANCE_REQUEST_STATUSES);
export const socialAssistanceSourceSchema = z.enum(SOCIAL_ASSISTANCE_SOURCES);
export const publicSocialAssistanceWardQuerySchema = z.object({
    provinceCode: z.string().trim().min(1).max(20)
});

const optionalCoordinate = (minimum: number, maximum: number) =>
    z.preprocess(
        (value) => (value === null || value === "" ? undefined : value),
        z.coerce.number().min(minimum).max(maximum).optional()
    );

export const publicSocialAssistanceRequestSchema = z
    .object({
        contactName: z.string().trim().min(1).max(255),
        phone: z
            .string()
            .trim()
            .min(8)
            .max(20)
            .regex(/^\+?[0-9][0-9\s().-]*$/),
        needCategory: z.enum(SOCIAL_ASSISTANCE_NEED_CATEGORIES),
        needDescription: z.string().trim().min(1).max(4000),
        address: z.string().trim().min(1).max(1000),
        provinceCode: z.string().trim().min(1).max(20),
        wardCode: z.string().trim().min(1).max(20),
        areaId: z.uuid().optional(),
        latitude: optionalCoordinate(-90, 90),
        longitude: optionalCoordinate(-180, 180),
        consent: z.literal(true),
        source: z.enum(PUBLIC_SOCIAL_ASSISTANCE_SOURCES)
    })
    .strict()
    .refine((value) => (value.latitude === undefined) === (value.longitude === undefined), {
        message: "Latitude and longitude must be provided together",
        path: ["latitude"]
    });

export type SocialAssistanceRequestStatus = z.infer<typeof socialAssistanceRequestStatusSchema>;
export type SocialAssistanceSource = z.infer<typeof socialAssistanceSourceSchema>;
export type PublicSocialAssistanceRequestInput = z.infer<typeof publicSocialAssistanceRequestSchema>;
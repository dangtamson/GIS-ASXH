import type {
    PublicSocialAssistanceRequestInput,
    SocialAssistanceProgram,
    SocialAssistancePublicMapItem,
    SocialAssistanceRequestSource
} from "@/types/social-assistance";

const REQUEST_STATUS_LABELS: Record<string, string> = {
    RECEIVED: "Mới tiếp nhận",
    IN_REVIEW: "Đang rà soát",
    NEEDS_INFORMATION: "Cần bổ sung thông tin",
    VERIFIED: "Đã xác minh",
    REJECTED: "Từ chối"
};

export type SocialAssistanceDashboardFilters = {
    from?: string;
    to?: string;
    provinceCode?: string;
    wardCode?: string;
    programId?: string;
    requestStatus?: string;
};

export const getSocialAssistanceRequestStatusLabel = (status: string): string => REQUEST_STATUS_LABELS[status] ?? status;

const CATEGORY_LABELS: Record<string, string> = {
    FOOD: "Lương thực, thực phẩm",
    HEALTHCARE: "Y tế",
    HOUSING: "Nhà ở",
    EDUCATION: "Giáo dục",
    LIVELIHOOD: "Sinh kế",
    CASH: "Tiền mặt",
    OTHER: "Khác"
};

export const getSocialAssistanceCategoryLabel = (category: string): string => CATEGORY_LABELS[category] ?? category;

export const createSocialAssistanceIdempotencyKey = (): string => globalThis.crypto.randomUUID();

export const buildSocialAssistanceDashboardQuery = (filters: SocialAssistanceDashboardFilters): string => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
        if (value) params.set(key, value);
    }
    return params.toString();
};

export const buildPublicSocialAssistanceRequestPayload = (
    values: PublicSocialAssistanceRequestInput,
    source: Exclude<SocialAssistanceRequestSource, "STAFF">
): PublicSocialAssistanceRequestInput => ({ ...values, source });

export const getPublicSocialAssistancePortalSummary = (
    programs: Array<Pick<SocialAssistanceProgram, "id">>,
    items: Array<Pick<SocialAssistancePublicMapItem, "recipientCount" | "deliveredCashAmount" | "deliveredItemCount">>
) => items.reduce((summary, item) => ({
    supportCount: summary.supportCount + item.recipientCount,
    programCount: summary.programCount,
    deliveredCashAmount: summary.deliveredCashAmount + item.deliveredCashAmount,
    deliveredItemCount: summary.deliveredItemCount + item.deliveredItemCount
}), {
    supportCount: 0,
    programCount: programs.length,
    deliveredCashAmount: 0,
    deliveredItemCount: 0
});

export const buildPublicSocialAssistanceWardSummary = (
    items: SocialAssistancePublicMapItem[]
) => {
    const wards = new Map<string, {
        provinceCode: string;
        wardCode: string;
        recipientCount: number;
        deliveredCashAmount: number;
        deliveredItemCount: number;
        programIds: Set<string>;
    }>();

    for (const item of items) {
        const key = `${item.provinceCode}:${item.wardCode}`;
        const ward = wards.get(key) ?? {
            provinceCode: item.provinceCode,
            wardCode: item.wardCode,
            recipientCount: 0,
            deliveredCashAmount: 0,
            deliveredItemCount: 0,
            programIds: new Set<string>()
        };
        ward.recipientCount += item.recipientCount;
        ward.deliveredCashAmount += item.deliveredCashAmount;
        ward.deliveredItemCount += item.deliveredItemCount;
        ward.programIds.add(item.programId);
        wards.set(key, ward);
    }

    return [...wards.values()]
        .map(({ programIds, ...ward }) => ({ ...ward, programCount: programIds.size }))
        .sort((left, right) => left.provinceCode.localeCompare(right.provinceCode)
            || left.wardCode.localeCompare(right.wardCode));
};

export type SocialAssistanceMapMeasure = "recipients" | "cash" | "items";

type SocialAssistanceMeasureValues = Pick<
    SocialAssistancePublicMapItem,
    "recipientCount" | "deliveredCashAmount" | "deliveredItemCount"
>;

export const getPublicSocialAssistanceMapMeasureValue = (
    item: SocialAssistanceMeasureValues,
    measure: SocialAssistanceMapMeasure
): number => {
    if (measure === "cash") return item.deliveredCashAmount;
    if (measure === "items") return item.deliveredItemCount;
    return item.recipientCount;
};

type PublicSocialAssistanceWardSummary = ReturnType<typeof buildPublicSocialAssistanceWardSummary>[number];

export const sortPublicSocialAssistanceWardSummary = (
    rows: PublicSocialAssistanceWardSummary[],
    measure: SocialAssistanceMapMeasure
): PublicSocialAssistanceWardSummary[] => [...rows].sort((left, right) =>
    getPublicSocialAssistanceMapMeasureValue(right, measure) - getPublicSocialAssistanceMapMeasureValue(left, measure)
    || left.provinceCode.localeCompare(right.provinceCode)
    || left.wardCode.localeCompare(right.wardCode)
);

export const getPublicSocialAssistanceProgramSummary = (
    programs: Array<Pick<SocialAssistanceProgram, "id">>,
    items: SocialAssistancePublicMapItem[]
) => {
    const geographies = new Set(items.map((item) => `${item.provinceCode}:${item.wardCode}`));
    return items.reduce((summary, item) => ({
        programCount: summary.programCount,
        supportInstances: summary.supportInstances + item.recipientCount,
        deliveredCashAmount: summary.deliveredCashAmount + item.deliveredCashAmount,
        deliveredItemCount: summary.deliveredItemCount + item.deliveredItemCount,
        geographyCount: summary.geographyCount
    }), {
        programCount: programs.length,
        supportInstances: 0,
        deliveredCashAmount: 0,
        deliveredItemCount: 0,
        geographyCount: geographies.size
    });
};

export type SocialAssistanceRequestStatus =
    | "RECEIVED"
    | "IN_REVIEW"
    | "NEEDS_INFORMATION"
    | "VERIFIED"
    | "REJECTED";

export type SocialAssistanceRequestSource = "MAP" | "WEBSITE" | "FACEBOOK" | "ZALO_OA" | "STAFF" | "OTHER";

export type SocialAssistanceNeedCategory =
    | "FOOD"
    | "HEALTHCARE"
    | "HOUSING"
    | "EDUCATION"
    | "LIVELIHOOD"
    | "CASH"
    | "OTHER";

export type PublicLocationOption = {
    code: string;
    name: string;
    fullName?: string | null;
};

export type PublicSocialAssistanceRequestInput = {
    contactName: string;
    phone: string;
    needCategory: SocialAssistanceNeedCategory;
    needDescription: string;
    address: string;
    provinceCode: string;
    wardCode: string;
    areaId?: string;
    latitude?: number;
    longitude?: number;
    consent: true;
    source: Exclude<SocialAssistanceRequestSource, "STAFF">;
};

export type SocialAssistanceRequest = {
    id: string;
    receiptCode: string;
    source: SocialAssistanceRequestSource;
    contactName: string;
    phone: string;
    needCategory: SocialAssistanceNeedCategory;
    needDescription: string;
    address: string;
    provinceCode: string;
    wardCode: string;
    areaId: string | null;
    latitude: number | null;
    longitude: number | null;
    status: SocialAssistanceRequestStatus;
    internalReason: string | null;
    createdAt: string | null;
};

export type SocialAssistanceRequestList = {
    items: SocialAssistanceRequest[];
    hasMore: boolean;
    page: number;
    limit: number;
};

export type PotentialSocialAssistanceDuplicate = Pick<
    SocialAssistanceRequest,
    "id" | "receiptCode" | "status" | "needCategory" | "createdAt"
>;

export type SocialAssistancePublicPortal = {
    id: string;
    workspaceId: string;
    publicSlug: string;
    publicAlias?: string | null;
    intakeEnabled: boolean;
    programsEnabled: boolean;
    resultsEnabled: boolean;
};

export type SocialAssistanceProgramStatus = "DRAFT" | "PUBLISHED" | "CLOSED";

export type SocialAssistanceProgram = {
    id: string;
    title: string;
    publicDescription: string;
    category: SocialAssistanceNeedCategory;
    eligibilitySummary: string;
    startDate: string;
    endDate: string;
    status: SocialAssistanceProgramStatus;
};

export type SocialAssistancePledgeType = "CASH" | "IN_KIND";
export type SocialAssistancePledgeStatus = "PENDING_REVIEW" | "REVIEWED" | "RECEIVED" | "RECONCILED" | "REJECTED";

export type SocialAssistancePledge = {
    id: string;
    programId: string;
    programTitle?: string;
    donorType: "INDIVIDUAL" | "ORGANIZATION";
    donorName: string;
    contactPhone: string;
    contactEmail?: string | null;
    pledgeType: SocialAssistancePledgeType;
    pledgedAmount: number | null;
    itemDescription: string | null;
    receivedAmount: number | null;
    receivedDescription: string | null;
    status: SocialAssistancePledgeStatus;
    internalNote: string | null;
    createdAt: string | null;
};

export type SocialAssistanceDashboard = {
    summary: {
        requestsReceived: number;
        requestsVerified: number;
        awaitingAllocation: number;
        allocatedCases: number;
        completedCases: number;
        openReviewBacklog: number;
        duplicateReviewCount: number;
        pledgeCount: number;
        inKindPledgeCount: number;
        pledgedCashAmount: number;
        receivedCashAmount: number;
        allocatedCashAmount: number;
        deliveredCashAmount: number;
    };
    byProgram: Array<{
        programId: string;
        pledgeCount: number;
        pledgedCashAmount: number;
        receivedCashAmount: number;
        allocatedCashAmount: number;
        deliveredCashAmount: number;
    }>;
    byGeography: Array<{
        provinceCode: string;
        wardCode: string;
        requestsReceived: number;
        requestsVerified: number;
        allocatedCashAmount: number;
        deliveredCashAmount: number;
    }>;
    programOptions: Array<{ id: string; title: string }>;
};

export type SocialAssistancePublicMapItem = {
    periodStart: string;
    periodEnd: string;
    programId: string;
    programTitle: string;
    provinceCode: string;
    wardCode: string;
    recipientCount: number;
    deliveredCashAmount: number;
    deliveredItemCount: number;
};

export type SocialAssistancePublicationItem = {
    id: string;
    publicationBatchId: string;
    periodStart: string;
    periodEnd: string;
    programId: string;
    provinceCode: string;
    wardCode: string;
    areaId: string | null;
    recipientCount: number;
    deliveredCashAmount: number;
    deliveredItemCount: number;
    status: "DRAFT" | "PUBLISHED" | "SUPERSEDED";
};
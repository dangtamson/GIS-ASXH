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
    allocationsEnabled: boolean;
};

export type DistributionBatchStatus = "DRAFT" | "PUBLISHED" | "CLOSED";

export type DistributionBatchLineInput = {
    provinceCode: string;
    wardCode: string;
    allocatedQuantity: number;
};

export type DistributionBatchLine = DistributionBatchLineInput & {
    batchId: string;
    workspaceId: string;
};

export type DistributionBatchCreateInput = {
    programId?: string | null;
    supersedesBatchId?: string | null;
    documentNumber: string;
    documentDate: string;
    title: string;
    fundingSourceText: string;
    supportItemName: string;
    unitLabel: string;
    unitAmount: number;
    declaredTotalQuantity: number;
    declaredTotalAmount: number;
    eligibilitySummary: string;
    eligibilityApprovalYear?: number | null;
    submissionDeadline?: string | null;
    completionDeadline?: string | null;
    lines: DistributionBatchLineInput[];
};

export type SocialAssistanceDistributionBatch = DistributionBatchCreateInput & {
    id: string;
    workspaceId: string;
    status: DistributionBatchStatus;
    createdBy: string | null;
    updatedBy: string | null;
    publishedBy: string | null;
    publishedAt: string | null;
    closedBy: string | null;
    closedAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};

export type PublicSocialAssistanceDistributionBatch = Omit<DistributionBatchCreateInput, "programId" | "supersedesBatchId" | "lines"> & {
    programTitle: string | null;
    status: Exclude<DistributionBatchStatus, "DRAFT">;
    publishedAt: string | null;
    lines: Array<DistributionBatchLineInput & { provinceName?: string | null; wardName?: string | null }>;
};

export type DistributionOrderStatus = "DRAFT" | "PUBLISHED" | "CLOSED";
export type DistributionOrderPeriod = "ONCE" | "MONTHLY";
export type DistributionOrderTargetInput =
    | { type: "LOCALITY"; provinceCode: string; wardCode: string; allocatedQuantity: number }
    | { type: "ORGANIZATION"; organizationId: string; allocatedQuantity: number };
export type DistributionOrderComponentInput = {
    name: string;
    unitLabel: string;
    unitAmount: number;
    period: DistributionOrderPeriod;
    periodCount: number;
    periodStart?: string | null;
    periodEnd?: string | null;
    declaredTotalQuantity: number;
    declaredTotalAmount?: number | null;
    eligibilitySummary: string;
    allocations: DistributionOrderTargetInput[];
};
export type DistributionOrderCreateInput = {
    programId?: string | null;
    legacyBatchId?: string | null;
    supersedesOrderId?: string | null;
    documentNumber: string;
    documentDate: string;
    title: string;
    fundingSourceText: string;
    submissionDeadline?: string | null;
    submissionDeadlineExclusive?: boolean;
    completionDeadline?: string | null;
    completionDeadlineExclusive?: boolean;
    components: DistributionOrderComponentInput[];
};
export type DistributionOrderTarget = DistributionOrderTargetInput & {
    id: string;
    workspaceId: string;
    orderId: string;
    componentId: string;
};
export type DistributionOrderComponent = Omit<DistributionOrderComponentInput, "allocations"> & {
    id: string;
    workspaceId: string;
    orderId: string;
    targets: DistributionOrderTarget[];
};
export type DistributionOrder = Omit<DistributionOrderCreateInput, "components"> & {
    id: string;
    workspaceId: string;
    status: DistributionOrderStatus;
    publishedBy: string | null;
    publishedAt: string | null;
    closedBy: string | null;
    closedAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    components: DistributionOrderComponent[];
};
export type DistributionBeneficiaryStatus = "PROPOSED" | "APPROVED" | "REJECTED";
export type DistributionBeneficiaryCreateInput = {
    componentId: string;
    targetId: string;
    fullName: string;
    birthYear?: number;
    householdId?: string;
    localityDetails?: string;
    eligibilityDetails?: string;
    notes?: string;
    status?: DistributionBeneficiaryStatus;
};
export type DistributionBeneficiary = DistributionBeneficiaryCreateInput & {
    id: string;
    workspaceId: string;
    orderId: string;
    status: DistributionBeneficiaryStatus;
    createdAt: string | null;
    updatedAt: string | null;
};
export type PublicDistributionOrder = Omit<DistributionOrderCreateInput, "programId" | "legacyBatchId" | "supersedesOrderId" | "components"> & {
    programTitle: string | null;
    status: Exclude<DistributionOrderStatus, "DRAFT">;
    publishedAt: string;
    components: Array<Omit<DistributionOrderComponentInput, "allocations"> & {
        projectedTotalAmount: number;
        targets: Array<{
            type: "LOCALITY" | "ORGANIZATION";
            provinceCode: string | null;
            wardCode: string | null;
            provinceName: string | null;
            wardName: string | null;
            organizationName: string | null;
            allocatedQuantity: number;
        }>;
    }>;
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
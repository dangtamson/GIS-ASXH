export type PovertyType = "POOR" | "NEAR_POOR" | "NONE";
export type HouseholdStatus = "ACTIVE" | "INACTIVE";

export type PoorHousehold = {
    id: string;
    code?: string | null;
    year: number;
    povertyType: PovertyType | string;
    status?: HouseholdStatus | string | null;
    provinceName?: string | null;
    wardName?: string | null;
    areaName?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    headFullName?: string | null;
    headCitizenId?: string | null;
    memberCount?: number | null;
    createdAt?: string | null;
    updatedAt?: string | null;
};

export type HouseholdMember = {
    id: string;
    householdId: string;
    fullName: string;
    relationship?: string | null;
    gender?: string | null;
    dateOfBirth?: string | null;
    ethnicity?: string | null;
    citizenId?: string | null;
    phone?: string | null;
    isHead?: boolean | null;
    occupation?: string | null;
    note?: string | null;
};

export type HouseholdAssessment = {
    id: string;
    householdId: string;
    assessmentYear: number;
    povertyType: PovertyType | string;
    scoreB1?: number | null;
    scoreB2?: number | null;
    decisionNo?: string | null;
    decisionDate?: string | null;
    approvedBy?: string | null;
    note?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
};

export type HouseholdSupportType = "HOUSING" | "CASH" | "HEALTHCARE" | "EDUCATION" | "FOOD" | "OTHER";

export type HouseholdSupport = {
    id: string;
    householdId: string;
    supportDate: string;
    supportTypes: HouseholdSupportType[] | string[];
    amounts?: Partial<Record<HouseholdSupportType | string, number | null>> | null;
    content?: string | null;
    supportingUnit?: string | null;
    note?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
};

export type HouseholdChangeLog = {
    id: string;
    householdId?: string | null;
    actionType: string;
    objectType: string;
    objectId?: string | null;
    oldData?: Record<string, unknown> | null;
    newData?: Record<string, unknown> | null;
    changeNote?: string | null;
    changedAt?: string | null;
};

export type HouseholdFieldPhoto = {
    uuid: string;
    fileName: string;
    filePath: string;
    fileSize?: number | null;
    mimeType?: string | null;
    entityType: string;
    entityId: string;
    uploadedBy?: string | null;
    createdAt?: string | null;
};

export type PovertyMarker = Pick<
    PoorHousehold,
    "id" | "code" | "year" | "povertyType" | "status" | "provinceName" | "wardName" | "areaName" | "address" | "latitude" | "longitude" | "headFullName" | "headCitizenId" | "memberCount"
> & {
    fieldPhotos?: HouseholdFieldPhoto[];
    supportCount?: number;
    supportTotalAmount?: number;
    latestSupportDate?: string | null;
    latestSupportMonthAmount?: number;
};

export type PovertyReportRow = {
    area: string;
    year: number | null;
    poorCount: number;
    nearPoorCount: number;
    total: number;
    totalHouseholds: number;
    poorRatePercent: number;
    nearPoorRatePercent: number;
};

export type PovertyYearOverview = {
    id: string;
    year: number;
    population: number;
    totalHouseholds: number;
    totalMembers: number;
    note?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
};

export type PovertyReportDetailRow = {
    code?: string | null;
    headFullName?: string | null;
    povertyType?: PovertyType | string | null;
    address?: string | null;
    memberCount?: number | null;
    status?: HouseholdStatus | string | null;
    year: number;
};

export type PovertyDashboard = {
    totals?: {
        total?: number;
        poor?: number;
        nearPoor?: number;
        active?: number;
    };
    overview?: PovertyYearOverview | null;
    byArea?: PovertyReportRow[];
    yearlyTrend?: {
        year: number;
        poor: number;
        nearPoor: number;
        total: number;
    }[];
};

export type PaginationMeta = {
    page: number;
    limit: number;
    total: number;
    pages: number;
};

export type PaginatedResponse<T> = {
    items?: T[];
    pagination?: PaginationMeta;
};

export type HouseholdDetailResponse = {
    household?: PoorHousehold;
    members?: HouseholdMember[];
    assessments?: HouseholdAssessment[];
    supports?: HouseholdSupport[];
    changeLogs?: HouseholdChangeLog[];
    fieldPhotos?: HouseholdFieldPhoto[];
};

export type ExcelPayload = {
    fileName: string;
    mimeType: string;
    fileContentBase64: string;
};

export type PovertyReportDetailResponse = {
    items?: PovertyReportDetailRow[];
    pagination?: PaginationMeta;
};

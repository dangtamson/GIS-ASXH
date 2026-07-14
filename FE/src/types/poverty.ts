export type PovertyType = "POOR" | "NEAR_POOR" | "NONE";
export type HouseholdStatus = "ACTIVE" | "INACTIVE";

export type PoorHousehold = {
    id: string;
    code?: string | null;
    year: number;
    povertyType: PovertyType | string;
    status?: HouseholdStatus | string | null;
    provinceCode?: string | null;
    wardCode?: string | null;
    areaId?: string | null;
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

export type PoorHouseholdCreatePayload = {
    code?: string;
    year: number;
    povertyType: PovertyType | string;
    status?: HouseholdStatus | string;
    provinceCode: string;
    wardCode: string;
    areaId: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    headFullName?: string;
    headCitizenId?: string;
    memberCount?: number;
};

export type PoorHouseholdUpdatePayload = Partial<PoorHouseholdCreatePayload>;

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

export type HouseholdContextHistory = {
    id: string;
    householdId: string;
    recordedAt: string;
    familySituation?: string | null;
    currentStatus?: string | null;
    note?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
};

export type HouseholdHistoryPayload = {
    recordedAt: string;
    familySituation?: string;
    currentStatus?: string;
    note?: string;
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
    changedBy?: string | null;
    changedByAccount?: {
        uuid: string;
        fullName?: string | null;
        email?: string | null;
    } | null;
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
    "id" | "code" | "year" | "povertyType" | "status" | "provinceCode" | "wardCode" | "areaId" | "provinceName" | "wardName" | "areaName" | "address" | "latitude" | "longitude" | "headFullName" | "headCitizenId" | "memberCount"
> & {
    fieldPhotos?: HouseholdFieldPhoto[];
    supportCount?: number;
    supportTotalAmount?: number;
    latestSupportDate?: string | null;
    latestSupportMonthAmount?: number;
};

export type PublicPovertyMarker = Omit<PovertyMarker, "headCitizenId" | "fieldPhotos"> & {
    fieldPhotoCount?: number;
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

export type PovertyDashboardOverview = {
    year: number;
    population: number;
    totalHouseholds: number;
    totalMembers: number;
    naturalArea?: number | null;
    provinceCode?: string | null;
    wardCode?: string | null;
    note?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
};

export type ProvinceOption = {
    code: string;
    name: string;
    fullName?: string | null;
    administrativeUnitName?: string | null;
    administrativeRegionName?: string | null;
};

export type WardOption = {
    code: string;
    name: string;
    fullName?: string | null;
    administrativeUnitName?: string | null;
};

export type PovertyArea = {
    id: string;
    provinceCode: string;
    wardCode: string;
    code?: string | null;
    name: string;
    secretaryName?: string | null;
    secretaryPhone?: string | null;
    hamletHeadName?: string | null;
    hamletHeadPhone?: string | null;
    securityTeamLeaderName?: string | null;
    securityTeamLeaderPhone?: string | null;
    naturalArea?: number | null;
    description?: string | null;
    note?: string | null;
    status?: boolean;
    createdAt?: string | null;
    updatedAt?: string | null;
};

export type PovertyWardOverview = {
    id: string;
    provinceCode: string;
    wardCode: string;
    year: number;
    population: number;
    totalHouseholds: number;
    totalMembers: number;
    naturalArea: number;
    note?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
};

export type PovertyWardPublicLink = {
    id: string;
    workspaceId: string;
    provinceCode: string;
    wardCode: string;
    publicSlug: string;
    isPublic: boolean;
    publishedAt?: string | null;
    createdBy?: string | null;
    updatedBy?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
};

export type PublicPovertyWardResponse = {
    share: {
        publicSlug: string;
        wardCode: string;
        provinceCode: string;
        wardName?: string | null;
        provinceName?: string | null;
        currentYear: number;
    };
    overview?: PovertyDashboardOverview | null;
    summary?: {
        total: number;
        poor: number;
        nearPoor: number;
        active: number;
    };
    markers?: PublicPovertyMarker[];
};

export type PublicPovertyAreaDetailResponse = {
    share: {
        publicSlug: string;
        wardCode: string;
        provinceCode: string;
        wardName?: string | null;
        provinceName?: string | null;
        currentYear: number;
    };
    area: {
        id: string;
        name: string;
        code?: string | null;
        naturalArea?: number | null;
        description?: string | null;
        note?: string | null;
        secretaryName?: string | null;
        secretaryPhone?: string | null;
        hamletHeadName?: string | null;
        hamletHeadPhone?: string | null;
        securityTeamLeaderName?: string | null;
        securityTeamLeaderPhone?: string | null;
    };
    summary: {
        total: number;
        poor: number;
        nearPoor: number;
        normal: number;
    };
    households: PublicPovertyMarker[];
};

export type PublicHouseholdFieldPhoto = {
    uuid: string;
    fileName: string;
    filePath: string;
    mimeType?: string | null;
};

export type PublicHouseholdSupportItem = {
    id: string;
    supportDate?: string | null;
    supportTypes: string[];
    content?: string | null;
    supportingUnit?: string | null;
};

export type PublicPovertyHouseholdDetailResponse = {
    share: {
        publicSlug: string;
        wardCode: string;
        provinceCode: string;
        wardName?: string | null;
        provinceName?: string | null;
        currentYear: number;
    };
    household: {
        id: string;
        code?: string | null;
        headFullName?: string | null;
        povertyType?: PovertyType | string;
        status?: HouseholdStatus | string | null;
        memberCount?: number | null;
        areaId?: string | null;
        areaName?: string | null;
        wardName?: string | null;
        address?: string | null;
        latitude?: number | null;
        longitude?: number | null;
    };
    summary?: {
        fieldPhotoCount: number;
        supportCount: number;
    };
    latestContext?: {
        familySituation?: string | null;
        currentStatus?: string | null;
        recordedAt?: string | null;
    } | null;
    fieldPhotos?: PublicHouseholdFieldPhoto[];
    supports?: PublicHouseholdSupportItem[];
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
    memberTotals?: {
        total?: number;
        poor?: number;
        nearPoor?: number;
    };
    overview?: PovertyDashboardOverview | null;
    byArea?: PovertyReportRow[];
    yearlyTrend?: {
        year: number;
        poor: number;
        nearPoor: number;
        total: number;
    }[];
    monthlyTrendByYear?: {
        year: number;
        months: {
            month: number;
            poor: number;
            nearPoor: number;
            total: number;
        }[];
    }[];
    trendAvailableYears?: number[];
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
    contextHistories?: HouseholdContextHistory[];
    latestContextHistory?: HouseholdContextHistory | null;
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

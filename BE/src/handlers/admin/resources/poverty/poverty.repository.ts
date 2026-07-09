import { randomBytes } from "node:crypto";
import {
  administrativeUnits,
  areas,
  householdAssessments,
  householdChangeLogs,
  householdContextHistories,
  householdMembers,
  householdSupports,
  povertyWardPublicLinks,
  povertyWardOverviews,
  provinces,
  poorHouseholds,
  wards,
  files
} from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import type { SQL } from "drizzle-orm";
import { and, asc, count, desc, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import type {
  AreaCreateInput,
  HouseholdAssessmentCreateInput,
  HouseholdCreateInput,
  HouseholdContextHistoryCreateInput,
  HouseholdMemberCreateInput,
  HouseholdSupportCreateInput,
  HouseholdUpdateInput,
  ImportedHouseholdInput,
  PovertyWardPublicLinkUpsertInput,
  PovertyWardOverviewUpsertInput
} from "./poverty.schemas.ts";
import type { PovertyAccessScope } from "./poverty.scope.ts";

type ListHouseholdsFilters = {
  page: number;
  limit: number;
  search?: string;
  year?: number;
  povertyType?: string;
  status?: string;
  provinceCode?: string;
  wardCode?: string;
  areaId?: string;
  provinceName?: string;
  wardName?: string;
  areaName?: string;
  sortBy: "createdAt" | "updatedAt" | "code" | "year" | "povertyType";
  sortOrder: "asc" | "desc";
};

type ReportFilters = Omit<ListHouseholdsFilters, "page" | "limit" | "sortBy" | "sortOrder">;
type ReportDetailFilters = ReportFilters & {
  page: number;
  limit: number;
};

export type PovertyReportDetailItem = {
  code: string | null;
  headFullName: string | null;
  povertyType: string | null;
  address: string | null;
  memberCount: number;
  status: string | null;
  year: number;
};

export type PovertyWardOverviewItem = {
  id: string;
  provinceCode: string;
  wardCode: string;
  year: number;
  population: number;
  totalHouseholds: number;
  totalMembers: number;
  naturalArea: number;
  note: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type PovertyWardPublicLinkItem = {
  id: string;
  workspaceId: string;
  provinceCode: string;
  wardCode: string;
  publicSlug: string;
  isPublic: boolean;
  publishedAt: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type PublicPovertyMarkerItem = {
  id: string;
  code: string | null;
  year: number;
  povertyType: string;
  status: string | null;
  provinceCode: string | null;
  wardCode: string | null;
  areaId: string | null;
  provinceName: string | null;
  wardName: string | null;
  areaName: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  headFullName: string | null;
  memberCount: number;
  fieldPhotoCount: number;
  supportCount: number;
  supportTotalAmount: number;
  latestSupportDate: string | null;
  latestSupportMonthAmount: number;
};

export type PublicPovertyHouseholdDetailResponse = {
  share: {
    publicSlug: string;
    wardCode: string;
    provinceCode: string;
    wardName: string | null;
    provinceName: string | null;
    currentYear: number;
  };
  household: {
    id: string;
    code: string | null;
    headFullName: string | null;
    povertyType: string;
    status: string | null;
    memberCount: number;
    areaId: string | null;
    areaName: string | null;
    wardName: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  summary: {
    fieldPhotoCount: number;
    supportCount: number;
  };
  latestContext: {
    familySituation: string | null;
    currentStatus: string | null;
    recordedAt: string | null;
  } | null;
  fieldPhotos: Array<{
    uuid: string;
    fileName: string;
    filePath: string;
    mimeType: string | null;
  }>;
  supports: Array<{
    id: string;
    supportDate: string | null;
    supportTypes: string[];
    content: string | null;
    supportingUnit: string | null;
  }>;
};

export type PublicPovertyWardMapResponse = {
  share: {
    publicSlug: string;
    wardCode: string;
    provinceCode: string;
    wardName: string | null;
    provinceName: string | null;
    currentYear: number;
  };
  overview: PovertyDashboardOverviewItem | null;
  summary: {
    total: number;
    poor: number;
    nearPoor: number;
    active: number;
  };
  markers: PublicPovertyMarkerItem[];
};

export type PovertyDashboardOverviewItem = {
  year: number;
  population: number;
  totalHouseholds: number;
  totalMembers: number;
  naturalArea: number;
  note: string | null;
  provinceCode: string | null;
  wardCode: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type LocationOption = {
  code: string;
  name: string;
  fullName: string | null;
  administrativeUnitName?: string | null;
  administrativeRegionName?: string | null;
};

export type AreaItem = {
  id: string;
  provinceCode: string;
  wardCode: string;
  code: string | null;
  name: string;
  secretaryName: string | null;
  secretaryPhone: string | null;
  hamletHeadName: string | null;
  hamletHeadPhone: string | null;
  securityTeamLeaderName: string | null;
  securityTeamLeaderPhone: string | null;
  naturalArea: number | null;
  description: string | null;
  note: string | null;
  status: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type PovertyLocationLabels = {
  provinceName?: string | null;
  wardName?: string | null;
  areaName?: string | null;
};

export type PovertyHouseholdBackfillException = {
  householdId: string;
  code: string | null;
  provinceName: string | null;
  wardName: string | null;
  areaName: string | null;
  reason: string;
};

type ChangeLogPayload = {
  householdId?: string;
  actionType: "CREATE" | "UPDATE" | "DELETE" | "IMPORT";
  objectType: "HOUSEHOLD" | "MEMBER" | "ASSESSMENT" | "SUPPORT" | "CONTEXT_HISTORY";
  objectId?: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  changeNote?: string;
};

type HouseholdWithId = {
  id: string;
  headFullName?: string | null;
  headCitizenId?: string | null;
  memberCount?: number | null;
};

type HeadMemberSummary = {
  householdId: string;
  fullName: string | null;
  citizenId: string | null;
};

type MemberCountSummary = {
  householdId: string;
  memberCount: number;
};

type LatestAssessmentSummary = {
  householdId: string;
  povertyType: string;
};

type SupportSummary = {
  householdId: string;
  supportCount: number;
  supportTotalAmount: number;
  latestSupportDate: string | null;
  latestSupportMonthAmount: number;
};

type ContextHistoryWithRecordedAt = {
  recordedAt: string | Date;
  createdAt?: string | Date | null;
};

type DashboardMonthlyAssessmentRow = {
  householdId: string;
  assessmentYear: number;
  povertyType: string | null;
  decisionDate: string | Date | null;
  createdAt?: string | Date | null;
};

type DashboardMemberTotalsRow = {
  povertyType: string | null;
  memberCount: number | null;
  actualMemberCount?: number | null;
};

type DashboardMonthlyTrendMonth = {
  month: number;
  poor: number;
  nearPoor: number;
  total: number;
};

type DashboardMonthlyTrendYear = {
  year: number;
  months: DashboardMonthlyTrendMonth[];
};

export const normalizeLocationText = (value: string | null | undefined): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const deriveHouseholdLocationNames = (
  snapshots: PovertyLocationLabels,
  standardized: PovertyLocationLabels
): Required<PovertyLocationLabels> => ({
  provinceName: standardized.provinceName ?? snapshots.provinceName ?? null,
  wardName: standardized.wardName ?? snapshots.wardName ?? null,
  areaName: standardized.areaName ?? snapshots.areaName ?? null
});

export const buildBackfillException = (
  household: Pick<InferImportedHouseholdLike, "id" | "code" | "provinceName" | "wardName" | "areaName">,
  reason: string
): PovertyHouseholdBackfillException => ({
  householdId: household.id,
  code: household.code ?? null,
  provinceName: household.provinceName ?? null,
  wardName: household.wardName ?? null,
  areaName: household.areaName ?? null,
  reason
});

type InferImportedHouseholdLike = {
  id: string;
  code?: string | null;
  provinceName?: string | null;
  wardName?: string | null;
  areaName?: string | null;
};

const effectivePovertyTypeSql = sql<string>`coalesce(
  (
    select ${householdAssessments.povertyType}
    from ${householdAssessments}
    where ${householdAssessments.householdId} = ${poorHouseholds.id}
    order by ${householdAssessments.assessmentYear} desc, ${householdAssessments.createdAt} desc
    limit 1
  ),
  ${poorHouseholds.povertyType}
)`;

export const attachHeadMemberSummaries = <T extends HouseholdWithId>(
  households: T[],
  headMembers: HeadMemberSummary[]
): (T & { headFullName: string | null; headCitizenId: string | null })[] => {
  const headsByHouseholdId = new Map<string, HeadMemberSummary>();
  headMembers.forEach((head) => {
    if (!headsByHouseholdId.has(head.householdId)) {
      headsByHouseholdId.set(head.householdId, head);
    }
  });

  return households.map((household) => {
    const head = headsByHouseholdId.get(household.id);
    return {
      ...household,
      headFullName: head?.fullName ?? household.headFullName ?? null,
      headCitizenId: head?.citizenId ?? household.headCitizenId ?? null
    };
  });
};

export const attachMemberCounts = <T extends HouseholdWithId>(
  households: T[],
  memberCounts: MemberCountSummary[]
): (T & { memberCount: number })[] => {
  const countsByHouseholdId = new Map<string, number>();
  memberCounts.forEach((item) => {
    countsByHouseholdId.set(item.householdId, Number(item.memberCount ?? 0));
  });

  return households.map((household) => ({
    ...household,
    memberCount: countsByHouseholdId.get(household.id) ?? Number(household.memberCount ?? 0)
  }));
};

export const attachEffectivePovertyTypes = <T extends HouseholdWithId & { povertyType: string }>(
  households: T[],
  latestAssessments: LatestAssessmentSummary[]
): T[] => {
  const latestByHouseholdId = new Map<string, string>();
  latestAssessments.forEach((assessment) => {
    if (!latestByHouseholdId.has(assessment.householdId)) {
      latestByHouseholdId.set(assessment.householdId, assessment.povertyType);
    }
  });

  return households.map((household) => ({
    ...household,
    povertyType: latestByHouseholdId.get(household.id) ?? household.povertyType
  }));
};

export const attachSupportSummaries = <T extends HouseholdWithId>(
  households: T[],
  supportSummaries: SupportSummary[]
): (T & { supportCount: number; supportTotalAmount: number; latestSupportDate: string | null; latestSupportMonthAmount: number })[] => {
  const supportsByHouseholdId = new Map<string, SupportSummary>();
  supportSummaries.forEach((summary) => {
    supportsByHouseholdId.set(summary.householdId, summary);
  });

  return households.map((household) => {
    const summary = supportsByHouseholdId.get(household.id);
    return {
      ...household,
      supportCount: summary?.supportCount ?? 0,
      supportTotalAmount: summary?.supportTotalAmount ?? 0,
      latestSupportDate: summary?.latestSupportDate ?? null,
      latestSupportMonthAmount: summary?.latestSupportMonthAmount ?? 0
    };
  });
};

export const sortContextHistoriesLatestFirst = <T extends ContextHistoryWithRecordedAt>(items: T[]): T[] => {
  return [...items].sort((left, right) => {
    const recordedDiff = new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime();
    if (recordedDiff !== 0) return recordedDiff;
    return new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime();
  });
};

const getLatestAssessmentSummaries = async (householdIds: string[]): Promise<LatestAssessmentSummary[]> => {
  if (householdIds.length === 0) return [];

  return db
    .select({
      householdId: householdAssessments.householdId,
      povertyType: householdAssessments.povertyType
    })
    .from(householdAssessments)
    .where(inArray(householdAssessments.householdId, householdIds))
    .orderBy(desc(householdAssessments.assessmentYear), desc(householdAssessments.createdAt));
};

const withoutChangeNote = <T extends { changeNote?: string }>(payload: T): Omit<T, "changeNote"> => {
  const { changeNote: _changeNote, ...data } = payload;
  return data;
};

const compact = <T extends Record<string, unknown>>(payload: T): Partial<T> => {
  const result: Partial<T> = {};
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined) {
      result[key as keyof T] = value as T[keyof T];
    }
  });
  return result;
};

const householdFilters = (filters: Partial<ReportFilters>): SQL<unknown>[] => {
  const conditions: SQL<unknown>[] = [];
  if (filters.search) {
    const like = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(poorHouseholds.code, like),
        ilike(poorHouseholds.address, like),
        ilike(poorHouseholds.headFullName, like),
        ilike(poorHouseholds.headCitizenId, like),
        ilike(poorHouseholds.provinceName, like),
        ilike(poorHouseholds.wardName, like),
        ilike(poorHouseholds.areaName, like),
        inArray(
          poorHouseholds.id,
          db
            .select({ householdId: householdMembers.householdId })
            .from(householdMembers)
            .where(or(
              ilike(householdMembers.fullName, like),
              ilike(householdMembers.citizenId, like)
            ))
        )
      ) as SQL<unknown>
    );
  }
  if (filters.year) conditions.push(eq(poorHouseholds.year, filters.year));
  if (filters.povertyType) conditions.push(sql`${effectivePovertyTypeSql} = ${filters.povertyType}`);
  if (filters.status) conditions.push(eq(poorHouseholds.status, filters.status));
  if (filters.provinceCode) conditions.push(eq(poorHouseholds.provinceCode, filters.provinceCode));
  if (filters.wardCode) conditions.push(eq(poorHouseholds.wardCode, filters.wardCode));
  if (filters.areaId) conditions.push(eq(poorHouseholds.areaId, filters.areaId));
  if (filters.provinceName) conditions.push(ilike(poorHouseholds.provinceName, `%${filters.provinceName}%`));
  if (filters.wardName) conditions.push(ilike(poorHouseholds.wardName, `%${filters.wardName}%`));
  if (filters.areaName) conditions.push(ilike(poorHouseholds.areaName, `%${filters.areaName}%`));
  return conditions;
};

const whereFromConditions = (conditions: SQL<unknown>[]): SQL<unknown> | undefined => {
  if (conditions.length === 0) return undefined;
  return conditions.length === 1 ? conditions[0] : and(...conditions);
};

const falseCondition = sql`1 = 0`;

const buildHouseholdScopeCondition = (scope?: PovertyAccessScope): SQL<unknown> | undefined => {
  if (!scope) return undefined;
  if (scope.isSuperAdmin) return undefined;

  const conditions: SQL<unknown>[] = [];
  if (scope.areaIds.length > 0) conditions.push(inArray(poorHouseholds.areaId, scope.areaIds));
  if (scope.wardCodes.length > 0) conditions.push(inArray(poorHouseholds.wardCode, scope.wardCodes));
  if (scope.provinceCodes.length > 0) conditions.push(inArray(poorHouseholds.provinceCode, scope.provinceCodes));

  if (conditions.length === 0) return falseCondition;
  return conditions.length === 1 ? conditions[0] : (or(...conditions) as SQL<unknown>);
};

const appendHouseholdScope = (conditions: SQL<unknown>[], scope?: PovertyAccessScope): SQL<unknown>[] => {
  const scopeCondition = buildHouseholdScopeCondition(scope);
  return scopeCondition ? [...conditions, scopeCondition] : conditions;
};

const buildWardOverviewScopeCondition = async (scope?: PovertyAccessScope): Promise<SQL<unknown> | undefined> => {
  if (!scope) return undefined;
  if (scope.isSuperAdmin) return undefined;
  if (!scope.hasScope) return falseCondition;

  const provinceCodes = new Set(scope.provinceCodes);
  const wardCodes = new Set(scope.wardCodes);

  if (scope.areaIds.length > 0) {
    const areaRows = await db
      .select({ provinceCode: areas.provinceCode, wardCode: areas.wardCode })
      .from(areas)
      .where(inArray(areas.id, scope.areaIds));

    areaRows.forEach((item) => {
      provinceCodes.add(item.provinceCode);
      wardCodes.add(item.wardCode);
    });
  }

  const conditions: SQL<unknown>[] = [];
  if (wardCodes.size > 0) {
    conditions.push(inArray(povertyWardOverviews.wardCode, [...wardCodes]));
  }
  if (provinceCodes.size > 0) {
    conditions.push(inArray(povertyWardOverviews.provinceCode, [...provinceCodes]));
  }

  if (conditions.length === 0) return falseCondition;
  return conditions.length === 1 ? conditions[0] : (or(...conditions) as SQL<unknown>);
};

const appendWardOverviewScope = async (
  conditions: SQL<unknown>[],
  scope?: PovertyAccessScope
): Promise<SQL<unknown>[]> => {
  const scopeCondition = await buildWardOverviewScopeCondition(scope);
  return scopeCondition ? [...conditions, scopeCondition] : conditions;
};

const resolveWardOverviewLocationFilters = async (
  filters: Partial<ReportFilters>
): Promise<{ provinceCode?: string; wardCode?: string }> => {
  const location = {
    provinceCode: filters.provinceCode,
    wardCode: filters.wardCode
  };

  if (!filters.areaId) {
    return location;
  }

  const [area] = await db
    .select({ provinceCode: areas.provinceCode, wardCode: areas.wardCode })
    .from(areas)
    .where(eq(areas.id, filters.areaId))
    .limit(1);

  if (!area) {
    return location;
  }

  return {
    provinceCode: location.provinceCode ?? area.provinceCode,
    wardCode: location.wardCode ?? area.wardCode
  };
};

export type PublicPovertyAreaDetailResponse = {
  share: {
    publicSlug: string;
    wardCode: string;
    provinceCode: string;
    wardName: string | null;
    provinceName: string | null;
    currentYear: number;
  };
  area: {
    id: string;
    name: string;
    code: string | null;
    naturalArea: number | null;
    description: string | null;
    note: string | null;
    secretaryName: string | null;
    secretaryPhone: string | null;
    hamletHeadName: string | null;
    hamletHeadPhone: string | null;
    securityTeamLeaderName: string | null;
    securityTeamLeaderPhone: string | null;
  };
  summary: {
    total: number;
    poor: number;
    nearPoor: number;
    normal: number;
  };
  households: PublicPovertyMarkerItem[];
};

const resolveScopedProvinceCodes = async (scope?: PovertyAccessScope): Promise<string[] | null> => {
  if (!scope) return null;
  if (scope.isSuperAdmin) return null;
  if (!scope.hasScope) return [];

  const provinceCodes = new Set(scope.provinceCodes);

  if (scope.wardCodes.length > 0) {
    const wardRows = await db
      .select({ provinceCode: wards.provinceCode })
      .from(wards)
      .where(inArray(wards.code, scope.wardCodes));

    wardRows.forEach((item) => provinceCodes.add(item.provinceCode));
  }

  if (scope.areaIds.length > 0) {
    const areaRows = await db
      .select({ provinceCode: areas.provinceCode })
      .from(areas)
      .where(inArray(areas.id, scope.areaIds));

    areaRows.forEach((item) => provinceCodes.add(item.provinceCode));
  }

  return [...provinceCodes];
};

const resolveScopedWardCodes = async (scope: PovertyAccessScope, provinceCode: string): Promise<string[] | null> => {
  if (scope.isSuperAdmin) return null;
  if (!scope.hasScope) return [];
  if (scope.provinceCodes.includes(provinceCode)) return null;

  const wardCodes = new Set<string>();

  if (scope.wardCodes.length > 0) {
    const wardRows = await db
      .select({ code: wards.code })
      .from(wards)
      .where(and(eq(wards.provinceCode, provinceCode), inArray(wards.code, scope.wardCodes)));

    wardRows.forEach((item) => wardCodes.add(item.code));
  }

  if (scope.areaIds.length > 0) {
    const areaRows = await db
      .select({ wardCode: areas.wardCode })
      .from(areas)
      .where(and(eq(areas.provinceCode, provinceCode), inArray(areas.id, scope.areaIds)));

    areaRows.forEach((item) => wardCodes.add(item.wardCode));
  }

  return [...wardCodes];
};

const resolveScopedAreaIds = async (scope: PovertyAccessScope, wardCode: string): Promise<string[] | null> => {
  if (scope.isSuperAdmin) return null;
  if (!scope.hasScope) return [];
  if (scope.wardCodes.includes(wardCode)) return null;

  const [ward] = await db
    .select({ provinceCode: wards.provinceCode })
    .from(wards)
    .where(eq(wards.code, wardCode))
    .limit(1);

  if (!ward) return [];
  if (scope.provinceCodes.includes(ward.provinceCode)) return null;
  if (scope.areaIds.length === 0) return [];

  const areaRows = await db
    .select({ id: areas.id })
    .from(areas)
    .where(and(eq(areas.wardCode, wardCode), inArray(areas.id, scope.areaIds)));

  return areaRows.map((item) => item.id);
};

export const gisMarkerFilters = (filters: Partial<ReportFilters>): SQL<unknown>[] => householdFilters(filters);

export const findLatestWardOverviewYear = <T extends { year: number }>(rows: T[]): number | null =>
  rows.reduce<number | null>((latestYear, row) => {
    if (latestYear === null || row.year > latestYear) {
      return row.year;
    }
    return latestYear;
  }, null);

export const aggregateWardOverviewRows = <
  T extends {
    year: number;
    population: number;
    totalHouseholds: number;
    totalMembers: number;
    naturalArea: number;
    note?: string | null;
    provinceCode?: string | null;
    wardCode?: string | null;
    createdAt?: Date | null;
    updatedAt?: Date | null;
  }
>(rows: T[]): PovertyDashboardOverviewItem | null => {
  if (rows.length === 0) return null;

  const firstRow = rows[0];
  if (!firstRow) return null;
  const isSingleRow = rows.length === 1;

  return rows.reduce<PovertyDashboardOverviewItem>(
    (summary, row) => ({
      ...summary,
      population: summary.population + Number(row.population ?? 0),
      totalHouseholds: summary.totalHouseholds + Number(row.totalHouseholds ?? 0),
      totalMembers: summary.totalMembers + Number(row.totalMembers ?? 0),
      naturalArea: summary.naturalArea + Number(row.naturalArea ?? 0)
    }),
    {
      year: firstRow.year,
      population: 0,
      totalHouseholds: 0,
      totalMembers: 0,
      naturalArea: 0,
      note: isSingleRow ? (firstRow.note ?? null) : null,
      provinceCode: isSingleRow ? (firstRow.provinceCode ?? null) : null,
      wardCode: isSingleRow ? (firstRow.wardCode ?? null) : null,
      createdAt: isSingleRow ? (firstRow.createdAt ?? null) : null,
      updatedAt: isSingleRow ? (firstRow.updatedAt ?? null) : null
    }
  );
};

const coerceTrendDateMeta = (
  value: string | Date | null | undefined
): { year: number; month: number; timestamp: number } | null => {
  if (!value) return null;

  if (value instanceof Date) {
    const timestamp = value.getTime();
    if (Number.isNaN(timestamp)) return null;
    return {
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + 1,
      timestamp
    };
  }

  const normalized = value.trim();
  const year = Number(normalized.slice(0, 4));
  const month = Number(normalized.slice(5, 7));
  const parsed = new Date(normalized);
  const timestamp = parsed.getTime();

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || Number.isNaN(timestamp)) {
    return null;
  }

  return { year, month, timestamp };
};

const isDashboardAssessmentRowMoreRecent = (
  candidate: DashboardMonthlyAssessmentRow,
  current: DashboardMonthlyAssessmentRow
): boolean => {
  const candidateCreatedAt = new Date(candidate.createdAt ?? 0).getTime();
  const currentCreatedAt = new Date(current.createdAt ?? 0).getTime();
  if (candidateCreatedAt !== currentCreatedAt) {
    return candidateCreatedAt > currentCreatedAt;
  }

  const candidateDecision = coerceTrendDateMeta(candidate.decisionDate);
  const currentDecision = coerceTrendDateMeta(current.decisionDate);
  return (candidateDecision?.timestamp ?? 0) > (currentDecision?.timestamp ?? 0);
};

export const buildDashboardMonthlyTrend = (
  rows: DashboardMonthlyAssessmentRow[]
): DashboardMonthlyTrendYear[] => {
  const latestByHouseholdYear = new Map<string, DashboardMonthlyAssessmentRow>();

  rows.forEach((row) => {
    const decisionDate = coerceTrendDateMeta(row.decisionDate);
    if (!decisionDate) return;
    if (decisionDate.year !== row.assessmentYear) return;

    const key = `${row.householdId}:${row.assessmentYear}`;
    const current = latestByHouseholdYear.get(key);
    if (!current || isDashboardAssessmentRowMoreRecent(row, current)) {
      latestByHouseholdYear.set(key, row);
    }
  });

  const countsByYear = new Map<number, Map<number, DashboardMonthlyTrendMonth>>();

  latestByHouseholdYear.forEach((row) => {
    const decisionDate = coerceTrendDateMeta(row.decisionDate);
    if (!decisionDate) return;

    const monthsByYear = countsByYear.get(row.assessmentYear) ?? new Map<number, DashboardMonthlyTrendMonth>();
    const currentMonth = monthsByYear.get(decisionDate.month) ?? {
      month: decisionDate.month,
      poor: 0,
      nearPoor: 0,
      total: 0
    };

    currentMonth.total += 1;
    if (row.povertyType === "POOR") currentMonth.poor += 1;
    if (row.povertyType === "NEAR_POOR") currentMonth.nearPoor += 1;

    monthsByYear.set(decisionDate.month, currentMonth);
    countsByYear.set(row.assessmentYear, monthsByYear);
  });

  return [...countsByYear.entries()]
    .sort(([leftYear], [rightYear]) => leftYear - rightYear)
    .map(([year, monthsByYear]) => ({
      year,
      months: [...monthsByYear.values()].sort((left, right) => left.month - right.month)
    }));
};

export const buildDashboardTrendAvailableYears = (
  rows: DashboardMonthlyTrendYear[]
): number[] => [...new Set(rows.map((row) => row.year))].sort((left, right) => left - right);

export const buildDashboardMemberTotals = (
  rows: DashboardMemberTotalsRow[]
): { total: number; poor: number; nearPoor: number } =>
  rows.reduce(
    (summary, row) => {
      const snapshotMemberCount = Number(row.memberCount ?? 0);
      const actualMemberCount = Number(row.actualMemberCount ?? 0);
      const memberCount = snapshotMemberCount > 0 ? snapshotMemberCount : actualMemberCount;

      if (row.povertyType === "POOR") {
        summary.poor += memberCount;
        summary.total += memberCount;
      }

      if (row.povertyType === "NEAR_POOR") {
        summary.nearPoor += memberCount;
        summary.total += memberCount;
      }

      return summary;
    },
    { total: 0, poor: 0, nearPoor: 0 }
  );

export const shouldClearOtherHeadMembers = (payload: Partial<HouseholdMemberCreateInput>): boolean => payload.isHead === true;

const toAreaItem = (row: typeof areas.$inferSelect): AreaItem => ({
  id: row.id,
  provinceCode: row.provinceCode,
  wardCode: row.wardCode,
  code: row.code ?? null,
  name: row.name,
  secretaryName: row.secretaryName ?? null,
  secretaryPhone: row.secretaryPhone ?? null,
  hamletHeadName: row.hamletHeadName ?? null,
  hamletHeadPhone: row.hamletHeadPhone ?? null,
  securityTeamLeaderName: row.securityTeamLeaderName ?? null,
  securityTeamLeaderPhone: row.securityTeamLeaderPhone ?? null,
  naturalArea: row.naturalArea ?? null,
  description: row.description ?? null,
  note: row.note ?? null,
  status: row.status,
  createdAt: row.createdAt ?? null,
  updatedAt: row.updatedAt ?? null
});

const toWardOverviewItem = (row: typeof povertyWardOverviews.$inferSelect): PovertyWardOverviewItem => ({
  id: row.id,
  provinceCode: row.provinceCode,
  wardCode: row.wardCode,
  year: row.year,
  population: Number(row.population ?? 0),
  totalHouseholds: Number(row.totalHouseholds ?? 0),
  totalMembers: Number(row.totalMembers ?? 0),
  naturalArea: Number(row.naturalArea ?? 0),
  note: row.note ?? null,
  createdAt: row.createdAt ?? null,
  updatedAt: row.updatedAt ?? null
});

const toWardPublicLinkItem = (row: typeof povertyWardPublicLinks.$inferSelect): PovertyWardPublicLinkItem => ({
  id: row.id,
  workspaceId: row.workspaceId,
  provinceCode: row.provinceCode,
  wardCode: row.wardCode,
  publicSlug: row.publicSlug,
  isPublic: Boolean(row.isPublic),
  publishedAt: row.publishedAt ?? null,
  createdBy: row.createdBy ?? null,
  updatedBy: row.updatedBy ?? null,
  createdAt: row.createdAt ?? null,
  updatedAt: row.updatedAt ?? null
});

export const toPublicPovertyMarker = (marker: {
  id: string;
  code?: string | null;
  year: number;
  povertyType: string;
  status?: string | null;
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
  memberCount?: number | null;
  fieldPhotos?: Array<{ uuid: string }>;
  supportCount?: number | null;
  supportTotalAmount?: number | null;
  latestSupportDate?: string | null;
  latestSupportMonthAmount?: number | null;
}): PublicPovertyMarkerItem => ({
  id: marker.id,
  code: marker.code ?? null,
  year: marker.year,
  povertyType: marker.povertyType,
  status: marker.status ?? null,
  provinceCode: marker.provinceCode ?? null,
  wardCode: marker.wardCode ?? null,
  areaId: marker.areaId ?? null,
  provinceName: marker.provinceName ?? null,
  wardName: marker.wardName ?? null,
  areaName: marker.areaName ?? null,
  address: marker.address ?? null,
  latitude: marker.latitude ?? null,
  longitude: marker.longitude ?? null,
  headFullName: marker.headFullName ?? null,
  memberCount: Number(marker.memberCount ?? 0),
  fieldPhotoCount: Number(marker.fieldPhotos?.length ?? 0),
  supportCount: Number(marker.supportCount ?? 0),
  supportTotalAmount: Number(marker.supportTotalAmount ?? 0),
  latestSupportDate: marker.latestSupportDate ?? null,
  latestSupportMonthAmount: Number(marker.latestSupportMonthAmount ?? 0)
});

export const listLocationProvinces = async (scope?: PovertyAccessScope): Promise<LocationOption[]> => {
  const allowedProvinceCodes = await resolveScopedProvinceCodes(scope);
  if (allowedProvinceCodes && allowedProvinceCodes.length === 0) return [];

  const unitMap = new Map<number, string>(
    (await db.select().from(administrativeUnits)).map((item) => [item.id, item.fullName])
  );
  let query = db.select().from(provinces).$dynamic();
  if (allowedProvinceCodes) {
    query = query.where(inArray(provinces.code, allowedProvinceCodes));
  }
  const items = await query.orderBy(asc(provinces.name));
  return items.map((item) => ({
    code: item.code,
    name: item.name,
    fullName: item.fullName ?? null,
    administrativeUnitName: item.administrativeUnitId ? (unitMap.get(item.administrativeUnitId) ?? null) : null,
    administrativeRegionName: null
  }));
};

export const listLocationWards = async (provinceCode: string, scope?: PovertyAccessScope): Promise<LocationOption[]> => {
  if (scope && !scope.hasScope) return [];

  const allowedWardCodes = scope ? await resolveScopedWardCodes(scope, provinceCode) : null;
  if (allowedWardCodes && allowedWardCodes.length === 0) return [];

  const unitMap = new Map<number, string>(
    (await db.select().from(administrativeUnits)).map((item) => [item.id, item.fullName])
  );
  const conditions: SQL<unknown>[] = [eq(wards.provinceCode, provinceCode)];
  if (allowedWardCodes) {
    conditions.push(inArray(wards.code, allowedWardCodes));
  }
  const items = await db
    .select()
    .from(wards)
    .where(whereFromConditions(conditions))
    .orderBy(asc(wards.name));

  return items.map((item) => ({
    code: item.code,
    name: item.name,
    fullName: item.fullName ?? null,
    administrativeUnitName: item.administrativeUnitId ? (unitMap.get(item.administrativeUnitId) ?? null) : null
  }));
};

export const listLocationAreas = async (wardCode: string, scope?: PovertyAccessScope): Promise<AreaItem[]> => {
  if (scope && !scope.hasScope) return [];

  const allowedAreaIds = scope ? await resolveScopedAreaIds(scope, wardCode) : null;
  if (allowedAreaIds && allowedAreaIds.length === 0) return [];

  const conditions: SQL<unknown>[] = [eq(areas.wardCode, wardCode)];
  if (allowedAreaIds) {
    conditions.push(inArray(areas.id, allowedAreaIds));
  }

  const items = await db
    .select()
    .from(areas)
    .where(whereFromConditions(conditions))
    .orderBy(asc(areas.name));
  return items.map(toAreaItem);
};

const getStandardizedLocationLabels = async (input: {
  provinceCode?: string | null;
  wardCode?: string | null;
  areaId?: string | null;
}): Promise<PovertyLocationLabels> => {
  const [province, ward, area] = await Promise.all([
    input.provinceCode
      ? db.select().from(provinces).where(eq(provinces.code, input.provinceCode)).limit(1).then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    input.wardCode
      ? db.select().from(wards).where(eq(wards.code, input.wardCode)).limit(1).then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    input.areaId
      ? db.select().from(areas).where(eq(areas.id, input.areaId)).limit(1).then((rows) => rows[0] ?? null)
      : Promise.resolve(null)
  ]);

  return {
    provinceName: province?.fullName ?? province?.name ?? null,
    wardName: ward?.fullName ?? ward?.name ?? null,
    areaName: area?.name ?? null
  };
};

const hydrateHouseholdLocationLabels = async <
  T extends {
    provinceCode?: string | null;
    wardCode?: string | null;
    areaId?: string | null;
    provinceName?: string | null;
    wardName?: string | null;
    areaName?: string | null;
  }
>(items: T[]): Promise<(T & Required<PovertyLocationLabels>)[]> => {
  if (items.length === 0) return [];

  const provinceCodes = Array.from(new Set(items.map((item) => item.provinceCode).filter((value): value is string => Boolean(value))));
  const wardCodes = Array.from(new Set(items.map((item) => item.wardCode).filter((value): value is string => Boolean(value))));
  const areaIds = Array.from(new Set(items.map((item) => item.areaId).filter((value): value is string => Boolean(value))));

  const [provinceRows, wardRows, areaRows] = await Promise.all([
    provinceCodes.length > 0 ? db.select().from(provinces).where(inArray(provinces.code, provinceCodes)) : [],
    wardCodes.length > 0 ? db.select().from(wards).where(inArray(wards.code, wardCodes)) : [],
    areaIds.length > 0 ? db.select().from(areas).where(inArray(areas.id, areaIds)) : []
  ]);

  const provinceMap = new Map(provinceRows.map((item) => [item.code, item.fullName ?? item.name]));
  const wardMap = new Map(wardRows.map((item) => [item.code, item.fullName ?? item.name]));
  const areaMap = new Map(areaRows.map((item) => [item.id, item.name]));

  return items.map((item) => ({
    ...item,
    ...deriveHouseholdLocationNames(
      {
        provinceName: item.provinceName,
        wardName: item.wardName,
        areaName: item.areaName
      },
      {
        provinceName: item.provinceCode ? (provinceMap.get(item.provinceCode) ?? null) : null,
        wardName: item.wardCode ? (wardMap.get(item.wardCode) ?? null) : null,
        areaName: item.areaId ? (areaMap.get(item.areaId) ?? null) : null
      }
    )
  }));
};

const clearOtherHeadMembers = async (householdId: string, exceptMemberId?: string): Promise<void> => {
  const conditions: SQL<unknown>[] = [eq(householdMembers.householdId, householdId), eq(householdMembers.isHead, true)];
  if (exceptMemberId) conditions.push(ne(householdMembers.id, exceptMemberId));

  await db
    .update(householdMembers)
    .set({ isHead: false, updatedAt: new Date() })
    .where(and(...conditions));
};

const getHeadMemberByHouseholdId = async (householdId: string) => {
  const [headMember] = await db
    .select()
    .from(householdMembers)
    .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.isHead, true)))
    .orderBy(desc(householdMembers.updatedAt), desc(householdMembers.createdAt))
    .limit(1);

  return headMember ?? null;
};

const syncHeadMemberSnapshot = async (
  householdId: string,
  payload: {
    headFullName?: string | null;
    headCitizenId?: string | null;
  }
) => {
  const trimmedName = String(payload.headFullName ?? "").trim();
  const trimmedCitizenId = String(payload.headCitizenId ?? "").trim();
  const hasName = trimmedName.length > 0;
  const hasCitizenId = trimmedCitizenId.length > 0;

  if (!hasName && !hasCitizenId) return;

  const existingHeadMember = await getHeadMemberByHouseholdId(householdId);

  if (existingHeadMember) {
    await db
      .update(householdMembers)
      .set(compact({
        fullName: hasName ? trimmedName : undefined,
        citizenId: hasCitizenId ? trimmedCitizenId : undefined,
        isHead: true,
        updatedAt: new Date()
      }))
      .where(eq(householdMembers.id, existingHeadMember.id));
    return;
  }

  if (!hasName) return;

  await clearOtherHeadMembers(householdId);
  await db.insert(householdMembers).values({
    householdId,
    fullName: trimmedName,
    citizenId: hasCitizenId ? trimmedCitizenId : undefined,
    isHead: true
  });
};

export const listHouseholds = async (filters: ListHouseholdsFilters, scope?: PovertyAccessScope) => {
  const offset = (filters.page - 1) * filters.limit;
  const conditions = appendHouseholdScope(householdFilters(filters), scope);
  const whereClause = whereFromConditions(conditions);

  const [totalResult] = whereClause
    ? await db.select({ count: count() }).from(poorHouseholds).where(whereClause)
    : await db.select({ count: count() }).from(poorHouseholds);

  const sortColumn =
    filters.sortBy === "code"
      ? poorHouseholds.code
      : filters.sortBy === "year"
        ? poorHouseholds.year
        : filters.sortBy === "povertyType"
          ? effectivePovertyTypeSql
          : filters.sortBy === "updatedAt"
            ? poorHouseholds.updatedAt
            : poorHouseholds.createdAt;
  const orderByClause = filters.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  const households = whereClause
    ? await db.select().from(poorHouseholds).where(whereClause).orderBy(orderByClause).limit(filters.limit).offset(offset)
    : await db.select().from(poorHouseholds).orderBy(orderByClause).limit(filters.limit).offset(offset);

  const householdIds = households.map((item) => item.id);
  const headMembers =
    householdIds.length > 0
      ? await db
        .select({
          householdId: householdMembers.householdId,
          fullName: householdMembers.fullName,
          citizenId: householdMembers.citizenId
        })
        .from(householdMembers)
        .where(and(inArray(householdMembers.householdId, householdIds), eq(householdMembers.isHead, true)))
        .orderBy(asc(householdMembers.fullName))
      : [];
  const [memberCounts, latestAssessments] = await Promise.all([
    householdIds.length > 0
      ? db
        .select({
          householdId: householdMembers.householdId,
          memberCount: count(householdMembers.id)
        })
        .from(householdMembers)
        .where(inArray(householdMembers.householdId, householdIds))
        .groupBy(householdMembers.householdId)
      : [],
    getLatestAssessmentSummaries(householdIds)
  ]);

  const items = await hydrateHouseholdLocationLabels(attachEffectivePovertyTypes(
    attachMemberCounts(attachHeadMemberSummaries(households, headMembers), memberCounts),
    latestAssessments
  ));

  const total = totalResult?.count ?? 0;
  return {
    items,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      pages: Math.ceil(total / filters.limit)
    }
  };
};

export const getHouseholdById = async (id: string, scope?: PovertyAccessScope) => {
  const conditions = appendHouseholdScope([eq(poorHouseholds.id, id)], scope);
  const [item] = await db.select().from(poorHouseholds).where(whereFromConditions(conditions)).limit(1);
  return item;
};

export const getHouseholdDetail = async (id: string, scope?: PovertyAccessScope) => {
  const household = await getHouseholdById(id, scope);
  if (!household) return null;

  const [members, assessments, supports, changeLogs, fieldPhotos, contextHistories] = await Promise.all([
    db.select().from(householdMembers).where(eq(householdMembers.householdId, id)).orderBy(desc(householdMembers.isHead), asc(householdMembers.fullName)),
    db.select().from(householdAssessments).where(eq(householdAssessments.householdId, id)).orderBy(desc(householdAssessments.assessmentYear)),
    db.select().from(householdSupports).where(eq(householdSupports.householdId, id)).orderBy(desc(householdSupports.supportDate), desc(householdSupports.createdAt)),
    db.select().from(householdChangeLogs).where(eq(householdChangeLogs.householdId, id)).orderBy(desc(householdChangeLogs.changedAt)).limit(50),
    db.select().from(files).where(and(eq(files.entityType, "poor_household"), eq(files.entityId, id), isNull(files.deletedAt))).orderBy(desc(files.createdAt)),
    listContextHistories(id)
  ]);

  const [effectiveHousehold] = await hydrateHouseholdLocationLabels(
    attachEffectivePovertyTypes([household], assessments)
  );
  return {
    household: effectiveHousehold,
    members,
    assessments,
    supports,
    contextHistories,
    latestContextHistory: contextHistories[0] ?? null,
    changeLogs,
    fieldPhotos
  };
};

export const insertChangeLog = async (payload: ChangeLogPayload) => {
  const [created] = await db
    .insert(householdChangeLogs)
    .values({
      householdId: payload.householdId,
      actionType: payload.actionType,
      objectType: payload.objectType,
      objectId: payload.objectId,
      oldData: payload.oldData,
      newData: payload.newData,
      changeNote: payload.changeNote
    })
    .returning();
  return created;
};

export const createHousehold = async (payload: HouseholdCreateInput) => {
  const labels = await getStandardizedLocationLabels(payload);
  const data = {
    ...withoutChangeNote(payload),
    ...labels
  };
  const [created] = await db.insert(poorHouseholds).values(data).returning();
  if (created) {
    await syncHeadMemberSnapshot(created.id, {
      headFullName: created.headFullName,
      headCitizenId: created.headCitizenId
    });
    await insertChangeLog({
      householdId: created.id,
      actionType: "CREATE",
      objectType: "HOUSEHOLD",
      objectId: created.id,
      newData: created,
      changeNote: payload.changeNote
    });
  }
  return created;
};

export const updateHousehold = async (id: string, payload: HouseholdUpdateInput) => {
  const existing = await getHouseholdById(id);
  if (!existing) return null;

  const labels = (payload.provinceCode || payload.wardCode || payload.areaId)
    ? await getStandardizedLocationLabels({
      provinceCode: payload.provinceCode ?? existing.provinceCode,
      wardCode: payload.wardCode ?? existing.wardCode,
      areaId: payload.areaId ?? existing.areaId
    })
    : {};

  const data = compact({ ...withoutChangeNote(payload), ...labels, updatedAt: new Date() });
  const [updated] = await db.update(poorHouseholds).set(data).where(eq(poorHouseholds.id, id)).returning();
  if (!updated) {
    throw new Error("Không tìm thấy bản ghi để cập nhật");
  }

  if ("headFullName" in payload || "headCitizenId" in payload) {
    await syncHeadMemberSnapshot(id, {
      headFullName: updated.headFullName,
      headCitizenId: updated.headCitizenId
    });
  }

  await insertChangeLog({
    householdId: id,
    actionType: "UPDATE",
    objectType: "HOUSEHOLD",
    objectId: id,
    oldData: existing,
    newData: updated,
    changeNote: payload.changeNote
  });

  return updated;
};

export const deactivateHousehold = async (id: string, changeNote?: string) => {
  return updateHousehold(id, { status: "INACTIVE", changeNote });
};

export const listMembers = async (householdId: string) =>
  db.select().from(householdMembers).where(eq(householdMembers.householdId, householdId)).orderBy(desc(householdMembers.isHead), asc(householdMembers.fullName));

export const createMember = async (householdId: string, payload: HouseholdMemberCreateInput) => {
  if (shouldClearOtherHeadMembers(payload)) {
    await clearOtherHeadMembers(householdId);
  }

  const [created] = await db
    .insert(householdMembers)
    .values({ ...withoutChangeNote(payload), householdId })
    .returning();
  if (created) {
    await insertChangeLog({
      householdId,
      actionType: "CREATE",
      objectType: "MEMBER",
      objectId: created.id,
      newData: created,
      changeNote: payload.changeNote
    });
  }
  return created;
};

export const updateMember = async (householdId: string, memberId: string, payload: Partial<HouseholdMemberCreateInput>) => {
  const [existing] = await db
    .select()
    .from(householdMembers)
    .where(and(eq(householdMembers.id, memberId), eq(householdMembers.householdId, householdId)))
    .limit(1);
  if (!existing) return null;

  if (shouldClearOtherHeadMembers(payload)) {
    await clearOtherHeadMembers(householdId, memberId);
  }

  const [updated] = await db
    .update(householdMembers)
    .set(compact({ ...withoutChangeNote(payload), updatedAt: new Date() }))
    .where(and(eq(householdMembers.id, memberId), eq(householdMembers.householdId, householdId)))
    .returning();
  if (updated) {
    await insertChangeLog({
      householdId,
      actionType: "UPDATE",
      objectType: "MEMBER",
      objectId: memberId,
      oldData: existing,
      newData: updated,
      changeNote: payload.changeNote
    });
  }
  return updated;
};

export const deleteMember = async (householdId: string, memberId: string, changeNote?: string) => {
  const [existing] = await db
    .select()
    .from(householdMembers)
    .where(and(eq(householdMembers.id, memberId), eq(householdMembers.householdId, householdId)))
    .limit(1);
  if (!existing) return null;
  const [deleted] = await db
    .delete(householdMembers)
    .where(and(eq(householdMembers.id, memberId), eq(householdMembers.householdId, householdId)))
    .returning();
  await insertChangeLog({
    householdId,
    actionType: "DELETE",
    objectType: "MEMBER",
    objectId: memberId,
    oldData: existing,
    changeNote
  });
  return deleted;
};

export const listAssessments = async (householdId: string) =>
  db.select().from(householdAssessments).where(eq(householdAssessments.householdId, householdId)).orderBy(desc(householdAssessments.assessmentYear));

export const createAssessment = async (householdId: string, payload: HouseholdAssessmentCreateInput) => {
  const [created] = await db
    .insert(householdAssessments)
    .values({ ...withoutChangeNote(payload), householdId })
    .returning();
  if (created) {
    await insertChangeLog({
      householdId,
      actionType: "CREATE",
      objectType: "ASSESSMENT",
      objectId: created.id,
      newData: created,
      changeNote: payload.changeNote
    });
  }
  return created;
};

export const updateAssessment = async (
  householdId: string,
  assessmentId: string,
  payload: Partial<HouseholdAssessmentCreateInput>
) => {
  const [existing] = await db
    .select()
    .from(householdAssessments)
    .where(and(eq(householdAssessments.id, assessmentId), eq(householdAssessments.householdId, householdId)))
    .limit(1);
  if (!existing) return null;
  const [updated] = await db
    .update(householdAssessments)
    .set(compact(withoutChangeNote(payload)))
    .where(and(eq(householdAssessments.id, assessmentId), eq(householdAssessments.householdId, householdId)))
    .returning();
  if (updated) {
    await insertChangeLog({
      householdId,
      actionType: "UPDATE",
      objectType: "ASSESSMENT",
      objectId: assessmentId,
      oldData: existing,
      newData: updated,
      changeNote: payload.changeNote
    });
  }
  return updated;
};

export const deleteAssessment = async (householdId: string, assessmentId: string, changeNote?: string) => {
  const [existing] = await db
    .select()
    .from(householdAssessments)
    .where(and(eq(householdAssessments.id, assessmentId), eq(householdAssessments.householdId, householdId)))
    .limit(1);
  if (!existing) return null;
  const [deleted] = await db
    .delete(householdAssessments)
    .where(and(eq(householdAssessments.id, assessmentId), eq(householdAssessments.householdId, householdId)))
    .returning();
  await insertChangeLog({
    householdId,
    actionType: "DELETE",
    objectType: "ASSESSMENT",
    objectId: assessmentId,
    oldData: existing,
    changeNote
  });
  return deleted;
};

export const listSupports = async (householdId: string) =>
  db
    .select()
    .from(householdSupports)
    .where(eq(householdSupports.householdId, householdId))
    .orderBy(desc(householdSupports.supportDate), desc(householdSupports.createdAt));

export const createSupport = async (householdId: string, payload: HouseholdSupportCreateInput) => {
  const [created] = await db
    .insert(householdSupports)
    .values({ ...withoutChangeNote(payload), householdId, supportDate: payload.supportDate as string })
    .returning();
  if (created) {
    await insertChangeLog({
      householdId,
      actionType: "CREATE",
      objectType: "SUPPORT",
      objectId: created.id,
      newData: created,
      changeNote: payload.changeNote
    });
  }
  return created;
};

export const listContextHistories = async (householdId: string) => {
  const items = await db
    .select()
    .from(householdContextHistories)
    .where(eq(householdContextHistories.householdId, householdId))
    .orderBy(desc(householdContextHistories.recordedAt), desc(householdContextHistories.createdAt));

  return sortContextHistoriesLatestFirst(items);
};

export const createContextHistory = async (householdId: string, payload: HouseholdContextHistoryCreateInput) => {
  const [created] = await db
    .insert(householdContextHistories)
    .values({
      ...withoutChangeNote(payload),
      householdId,
      recordedAt: payload.recordedAt as string
    })
    .returning();
  if (created) {
    await insertChangeLog({
      householdId,
      actionType: "CREATE",
      objectType: "CONTEXT_HISTORY",
      objectId: created.id,
      newData: created,
      changeNote: payload.changeNote
    });
  }
  return created;
};

export const updateContextHistory = async (
  householdId: string,
  contextHistoryId: string,
  payload: Partial<HouseholdContextHistoryCreateInput>
) => {
  const [existing] = await db
    .select()
    .from(householdContextHistories)
    .where(and(eq(householdContextHistories.id, contextHistoryId), eq(householdContextHistories.householdId, householdId)))
    .limit(1);
  if (!existing) return null;

  const data = compact({ ...withoutChangeNote(payload), updatedAt: new Date() });
  const [updated] = await db
    .update(householdContextHistories)
    .set(data)
    .where(and(eq(householdContextHistories.id, contextHistoryId), eq(householdContextHistories.householdId, householdId)))
    .returning();
  if (updated) {
    await insertChangeLog({
      householdId,
      actionType: "UPDATE",
      objectType: "CONTEXT_HISTORY",
      objectId: contextHistoryId,
      oldData: existing,
      newData: updated,
      changeNote: payload.changeNote
    });
  }
  return updated;
};

export const deleteContextHistory = async (householdId: string, contextHistoryId: string, changeNote?: string) => {
  const [existing] = await db
    .select()
    .from(householdContextHistories)
    .where(and(eq(householdContextHistories.id, contextHistoryId), eq(householdContextHistories.householdId, householdId)))
    .limit(1);
  if (!existing) return null;
  const [deleted] = await db
    .delete(householdContextHistories)
    .where(and(eq(householdContextHistories.id, contextHistoryId), eq(householdContextHistories.householdId, householdId)))
    .returning();
  await insertChangeLog({
    householdId,
    actionType: "DELETE",
    objectType: "CONTEXT_HISTORY",
    objectId: contextHistoryId,
    oldData: existing,
    changeNote
  });
  return deleted;
};

export const updateSupport = async (
  householdId: string,
  supportId: string,
  payload: Partial<HouseholdSupportCreateInput>
) => {
  const [existing] = await db
    .select()
    .from(householdSupports)
    .where(and(eq(householdSupports.id, supportId), eq(householdSupports.householdId, householdId)))
    .limit(1);
  if (!existing) return null;

  const data = compact({ ...withoutChangeNote(payload), updatedAt: new Date() });
  const [updated] = await db
    .update(householdSupports)
    .set(data)
    .where(and(eq(householdSupports.id, supportId), eq(householdSupports.householdId, householdId)))
    .returning();
  if (updated) {
    await insertChangeLog({
      householdId,
      actionType: "UPDATE",
      objectType: "SUPPORT",
      objectId: supportId,
      oldData: existing,
      newData: updated,
      changeNote: payload.changeNote
    });
  }
  return updated;
};

export const deleteSupport = async (householdId: string, supportId: string, changeNote?: string) => {
  const [existing] = await db
    .select()
    .from(householdSupports)
    .where(and(eq(householdSupports.id, supportId), eq(householdSupports.householdId, householdId)))
    .limit(1);
  if (!existing) return null;
  const [deleted] = await db
    .delete(householdSupports)
    .where(and(eq(householdSupports.id, supportId), eq(householdSupports.householdId, householdId)))
    .returning();
  await insertChangeLog({
    householdId,
    actionType: "DELETE",
    objectType: "SUPPORT",
    objectId: supportId,
    oldData: existing,
    changeNote
  });
  return deleted;
};

export const listChangeLogs = async (householdId: string) =>
  db.select().from(householdChangeLogs).where(eq(householdChangeLogs.householdId, householdId)).orderBy(desc(householdChangeLogs.changedAt));

export const importHouseholdRow = async (row: ImportedHouseholdInput) => {
  const [existing] = await db.select().from(poorHouseholds).where(eq(poorHouseholds.code, row.code)).limit(1);
  if (existing) {
    const [updated] = await db
      .update(poorHouseholds)
      .set({ ...row, updatedAt: new Date() })
      .where(eq(poorHouseholds.id, existing.id))
      .returning();
    if (updated) {
      await insertChangeLog({
        householdId: updated.id,
        actionType: "IMPORT",
        objectType: "HOUSEHOLD",
        objectId: updated.id,
        oldData: existing,
        newData: updated,
        changeNote: "Import Excel cập nhật hộ"
      });
    }
    return { action: "updated" as const, item: updated };
  }

  const [created] = await db.insert(poorHouseholds).values(row).returning();
  if (created) {
    await insertChangeLog({
      householdId: created.id,
      actionType: "IMPORT",
      objectType: "HOUSEHOLD",
      objectId: created.id,
      newData: created,
      changeNote: "Import Excel thêm mới hộ"
    });
  }
  return { action: "created" as const, item: created };
};

export const listGisMarkers = async (filters: ReportFilters, scope?: PovertyAccessScope) => {
  const conditions = appendHouseholdScope(gisMarkerFilters(filters), scope);
  const whereClause = whereFromConditions(conditions);
  let query = db
    .select({
      id: poorHouseholds.id,
      code: poorHouseholds.code,
      year: poorHouseholds.year,
      povertyType: effectivePovertyTypeSql,
      status: poorHouseholds.status,
      provinceCode: poorHouseholds.provinceCode,
      wardCode: poorHouseholds.wardCode,
      areaId: poorHouseholds.areaId,
      provinceName: poorHouseholds.provinceName,
      wardName: poorHouseholds.wardName,
      areaName: poorHouseholds.areaName,
      address: poorHouseholds.address,
      latitude: poorHouseholds.latitude,
      longitude: poorHouseholds.longitude
    })
    .from(poorHouseholds)
    .$dynamic();
  if (whereClause) query = query.where(whereClause);
  const households = await query.orderBy(desc(poorHouseholds.updatedAt));
  const ids = households.map((item) => item.id);

  if (ids.length === 0) return [];

  const [headMembers, memberCounts, fieldPhotos, supports] = await Promise.all([
    db
      .select({
        householdId: householdMembers.householdId,
        fullName: householdMembers.fullName,
        citizenId: householdMembers.citizenId
      })
      .from(householdMembers)
      .where(and(inArray(householdMembers.householdId, ids), eq(householdMembers.isHead, true)))
      .orderBy(asc(householdMembers.fullName)),
    db
      .select({
        householdId: householdMembers.householdId,
        memberCount: count()
      })
      .from(householdMembers)
      .where(inArray(householdMembers.householdId, ids))
      .groupBy(householdMembers.householdId),
    db
      .select()
      .from(files)
      .where(and(eq(files.entityType, "poor_household"), inArray(files.entityId, ids), isNull(files.deletedAt)))
      .orderBy(desc(files.createdAt)),
    db
      .select({
        householdId: householdSupports.householdId,
        supportDate: householdSupports.supportDate,
        amounts: householdSupports.amounts
      })
      .from(householdSupports)
      .where(inArray(householdSupports.householdId, ids))
  ]);

  const photosByHouseholdId = new Map<string, typeof fieldPhotos>();
  fieldPhotos.forEach((photo) => {
    const existing = photosByHouseholdId.get(photo.entityId) ?? [];
    existing.push(photo);
    photosByHouseholdId.set(photo.entityId, existing);
  });

  const supportsByHouseholdId = new Map<string, SupportSummary>();
  const supportsByHouseholdMonth = new Map<string, Map<string, number>>();
  supports.forEach((support) => {
    const totalAmount = Object.values(support.amounts ?? {}).reduce<number>((sum, value) => {
      const amount = Number(value ?? 0);
      return Number.isFinite(amount) ? sum + amount : sum;
    }, 0);

    const supportDateText = String(support.supportDate ?? "").slice(0, 10);
    const supportDateTimestamp = Date.parse(supportDateText);
    const supportDate = Number.isNaN(supportDateTimestamp) ? null : supportDateText;
    const supportMonth = supportDate ? supportDate.slice(0, 7) : null;

    const current = supportsByHouseholdId.get(support.householdId) ?? {
      householdId: support.householdId,
      supportCount: 0,
      supportTotalAmount: 0,
      latestSupportDate: null,
      latestSupportMonthAmount: 0
    };

    current.supportCount += 1;
    current.supportTotalAmount += totalAmount;

    if (supportDate) {
      if (!current.latestSupportDate || Date.parse(current.latestSupportDate) < supportDateTimestamp) {
        current.latestSupportDate = supportDate;
      }
    }

    if (supportMonth) {
      const monthlyAmounts = supportsByHouseholdMonth.get(support.householdId) ?? new Map<string, number>();
      monthlyAmounts.set(supportMonth, (monthlyAmounts.get(supportMonth) ?? 0) + totalAmount);
      supportsByHouseholdMonth.set(support.householdId, monthlyAmounts);
    }

    supportsByHouseholdId.set(support.householdId, current);
  });

  supportsByHouseholdId.forEach((summary, householdId) => {
    if (!summary.latestSupportDate) return;
    const latestMonth = summary.latestSupportDate.slice(0, 7);
    const monthlyAmounts = supportsByHouseholdMonth.get(householdId);
    summary.latestSupportMonthAmount = monthlyAmounts?.get(latestMonth) ?? 0;
  });

  return attachSupportSummaries(
    attachMemberCounts(attachHeadMemberSummaries(households, headMembers), memberCounts),
    [...supportsByHouseholdId.values()]
  ).map((household) => ({
    ...household,
    fieldPhotos: photosByHouseholdId.get(household.id) ?? []
  }));
};

const createWardPublicSlug = async (): Promise<string> => {
  while (true) {
    const slug = `ward-${randomBytes(12).toString("hex")}`;
    const [existing] = await db
      .select({ id: povertyWardPublicLinks.id })
      .from(povertyWardPublicLinks)
      .where(eq(povertyWardPublicLinks.publicSlug, slug))
      .limit(1);

    if (!existing) return slug;
  }
};

export const getWardPublicLink = async (
  workspaceId: string,
  provinceCode: string,
  wardCode: string
): Promise<PovertyWardPublicLinkItem | null> => {
  const [row] = await db
    .select()
    .from(povertyWardPublicLinks)
    .where(and(
      eq(povertyWardPublicLinks.workspaceId, workspaceId),
      eq(povertyWardPublicLinks.provinceCode, provinceCode),
      eq(povertyWardPublicLinks.wardCode, wardCode)
    ))
    .limit(1);

  return row ? toWardPublicLinkItem(row) : null;
};

export const getWardPublicLinkBySlug = async (slug: string): Promise<PovertyWardPublicLinkItem | null> => {
  const [row] = await db
    .select()
    .from(povertyWardPublicLinks)
    .where(eq(povertyWardPublicLinks.publicSlug, slug))
    .limit(1);

  return row ? toWardPublicLinkItem(row) : null;
};

export const buildPublicAreaSlug = (areaName: string, areaId: string): string =>
  `${String(areaName ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "khu-vuc"}--${String(areaId).slice(0, 8).toLowerCase()}`;

export const upsertWardPublicLinkState = async (
  workspaceId: string,
  payload: PovertyWardPublicLinkUpsertInput,
  accountId?: string
): Promise<PovertyWardPublicLinkItem> => {
  const existing = await getWardPublicLink(workspaceId, payload.provinceCode, payload.wardCode);
  const now = new Date();

  if (existing) {
    const [updated] = await db
      .update(povertyWardPublicLinks)
      .set({
        isPublic: payload.isPublic,
        publishedAt: payload.isPublic ? (existing.publishedAt ?? now) : existing.publishedAt,
        updatedBy: accountId ?? null,
        updatedAt: now
      })
      .where(eq(povertyWardPublicLinks.id, existing.id))
      .returning();

    if (!updated) {
      throw new Error("Không thể cập nhật liên kết công khai xã/phường");
    }

    return toWardPublicLinkItem(updated);
  }

  const [created] = await db
    .insert(povertyWardPublicLinks)
    .values({
      workspaceId,
      provinceCode: payload.provinceCode,
      wardCode: payload.wardCode,
      publicSlug: await createWardPublicSlug(),
      isPublic: payload.isPublic,
      publishedAt: payload.isPublic ? now : null,
      createdBy: accountId ?? null,
      updatedBy: accountId ?? null,
      updatedAt: now
    })
    .returning();

  if (!created) {
    throw new Error("Không thể tạo liên kết công khai xã/phường");
  }

  return toWardPublicLinkItem(created);
};

export const listPovertyWardOverviews = async (
  provinceCode: string,
  wardCode: string,
  scope?: PovertyAccessScope
): Promise<PovertyWardOverviewItem[]> => {
  const conditions = await appendWardOverviewScope([
    eq(povertyWardOverviews.provinceCode, provinceCode),
    eq(povertyWardOverviews.wardCode, wardCode)
  ], scope);

  const rows = await db
    .select()
    .from(povertyWardOverviews)
    .where(whereFromConditions(conditions))
    .orderBy(desc(povertyWardOverviews.year));

  return rows.map(toWardOverviewItem);
};

export const getPovertyWardOverviewById = async (id: string): Promise<PovertyWardOverviewItem | null> => {
  const [row] = await db.select().from(povertyWardOverviews).where(eq(povertyWardOverviews.id, id)).limit(1);
  return row ? toWardOverviewItem(row) : null;
};

export const upsertPovertyWardOverview = async (
  payload: PovertyWardOverviewUpsertInput
): Promise<PovertyWardOverviewItem> => {
  const [existing] = await db
    .select()
    .from(povertyWardOverviews)
    .where(
      and(
        eq(povertyWardOverviews.provinceCode, payload.provinceCode),
        eq(povertyWardOverviews.wardCode, payload.wardCode),
        eq(povertyWardOverviews.year, payload.year)
      )
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(povertyWardOverviews)
      .set({
        population: payload.population,
        totalHouseholds: payload.totalHouseholds,
        totalMembers: payload.totalMembers,
        naturalArea: payload.naturalArea,
        note: payload.note,
        updatedAt: new Date()
      })
      .where(eq(povertyWardOverviews.id, existing.id))
      .returning();

    if (!updated) {
      throw new Error("Không tìm thấy bản ghi thông tin chung xã/phường để cập nhật");
    }

    return toWardOverviewItem(updated);
  }

  const [created] = await db
    .insert(povertyWardOverviews)
    .values({
      provinceCode: payload.provinceCode,
      wardCode: payload.wardCode,
      year: payload.year,
      population: payload.population,
      totalHouseholds: payload.totalHouseholds,
      totalMembers: payload.totalMembers,
      naturalArea: payload.naturalArea,
      note: payload.note
    })
    .returning();

  if (!created) {
    throw new Error("Không thể tạo bản ghi thông tin chung xã/phường");
  }

  return toWardOverviewItem(created);
};

export const deletePovertyWardOverviewById = async (id: string): Promise<PovertyWardOverviewItem | null> => {
  const [deleted] = await db.delete(povertyWardOverviews).where(eq(povertyWardOverviews.id, id)).returning();
  return deleted ? toWardOverviewItem(deleted) : null;
};

export const listAreas = async (wardCode: string, scope?: PovertyAccessScope): Promise<AreaItem[]> =>
  listLocationAreas(wardCode, scope);

export const getAreaById = async (wardCode: string, areaId: string): Promise<AreaItem | null> => {
  const [row] = await db
    .select()
    .from(areas)
    .where(and(eq(areas.id, areaId), eq(areas.wardCode, wardCode)))
    .limit(1);

  return row ? toAreaItem(row) : null;
};

export const createArea = async (wardCode: string, payload: AreaCreateInput): Promise<AreaItem> => {
  const [created] = await db
    .insert(areas)
    .values({
      ...payload,
      wardCode,
      updatedAt: new Date()
    })
    .returning();

  if (!created) {
    throw new Error("Không thể tạo khu vực/ấp");
  }

  return toAreaItem(created);
};

export const updateArea = async (wardCode: string, areaId: string, payload: Partial<AreaCreateInput>): Promise<AreaItem | null> => {
  const [updated] = await db
    .update(areas)
    .set(compact({ ...payload, wardCode, updatedAt: new Date() }))
    .where(and(eq(areas.id, areaId), eq(areas.wardCode, wardCode)))
    .returning();

  return updated ? toAreaItem(updated) : null;
};

export const deleteArea = async (wardCode: string, areaId: string): Promise<AreaItem | null> => {
  const [deleted] = await db
    .delete(areas)
    .where(and(eq(areas.id, areaId), eq(areas.wardCode, wardCode)))
    .returning();

  return deleted ? toAreaItem(deleted) : null;
};

const getDashboardOverview = async (
  filters: ReportFilters,
  scope?: PovertyAccessScope
): Promise<PovertyDashboardOverviewItem | null> => {
  const location = await resolveWardOverviewLocationFilters(filters);
  const conditions = await appendWardOverviewScope(
    [
      ...(location.provinceCode ? [eq(povertyWardOverviews.provinceCode, location.provinceCode)] : []),
      ...(location.wardCode ? [eq(povertyWardOverviews.wardCode, location.wardCode)] : [])
    ],
    scope
  );

  const targetYear = filters.year ?? (
    await db
      .select({ year: povertyWardOverviews.year })
      .from(povertyWardOverviews)
      .where(whereFromConditions(conditions))
      .orderBy(desc(povertyWardOverviews.year))
      .limit(1)
      .then((rows) => rows[0]?.year ?? null)
  );

  if (!targetYear) {
    return null;
  }

  const rows = await db
    .select()
    .from(povertyWardOverviews)
    .where(whereFromConditions([...conditions, eq(povertyWardOverviews.year, targetYear)]));

  return aggregateWardOverviewRows(rows.map(toWardOverviewItem));
};

const getWardOverviewTotalHouseholdMap = async (
  years: number[],
  filters: ReportFilters,
  scope?: PovertyAccessScope
): Promise<Map<number, number>> => {
  if (years.length === 0) return new Map<number, number>();

  const location = await resolveWardOverviewLocationFilters(filters);
  const conditions = await appendWardOverviewScope(
    [
      inArray(povertyWardOverviews.year, years),
      ...(location.provinceCode ? [eq(povertyWardOverviews.provinceCode, location.provinceCode)] : []),
      ...(location.wardCode ? [eq(povertyWardOverviews.wardCode, location.wardCode)] : [])
    ],
    scope
  );

  const rows = await db
    .select({
      year: povertyWardOverviews.year,
      totalHouseholds: sql<number>`coalesce(sum(${povertyWardOverviews.totalHouseholds}), 0)`
    })
    .from(povertyWardOverviews)
    .where(whereFromConditions(conditions))
    .groupBy(povertyWardOverviews.year);

  return new Map<number, number>(
    rows.map((row) => [row.year, Number(row.totalHouseholds ?? 0)])
  );
};

export const getDashboard = async (filters: ReportFilters, scope?: PovertyAccessScope) => {
  const conditions = appendHouseholdScope(householdFilters(filters), scope);
  const whereClause = whereFromConditions(conditions);

  let totalsQuery = db
    .select({
      total: count(),
      poor: sql<number>`count(*) filter (where ${effectivePovertyTypeSql} = 'POOR')`,
      nearPoor: sql<number>`count(*) filter (where ${effectivePovertyTypeSql} = 'NEAR_POOR')`,
      active: sql<number>`count(*) filter (where ${poorHouseholds.status} = 'ACTIVE')`
    })
    .from(poorHouseholds)
    .$dynamic();
  if (whereClause) totalsQuery = totalsQuery.where(whereClause);
  const [totals] = await totalsQuery;

  const byArea = await getReportSummary(filters, scope);
  const overview = await getDashboardOverview(filters, scope);
  let yearlyQuery = db
    .select({
      year: poorHouseholds.year,
      poor: sql<number>`count(*) filter (where ${effectivePovertyTypeSql} = 'POOR')`,
      nearPoor: sql<number>`count(*) filter (where ${effectivePovertyTypeSql} = 'NEAR_POOR')`,
      total: count()
    })
    .from(poorHouseholds)
    .$dynamic();
  if (whereClause) yearlyQuery = yearlyQuery.where(whereClause);
  const yearlyTrend = await yearlyQuery
    .groupBy(poorHouseholds.year)
    .orderBy(asc(poorHouseholds.year));

  const memberCountsByHousehold = db
    .select({
      householdId: householdMembers.householdId,
      actualMemberCount: count(householdMembers.id).as("actual_member_count")
    })
    .from(householdMembers)
    .groupBy(householdMembers.householdId)
    .as("member_counts");

  let memberTotalsQuery = db
    .select({
      povertyType: effectivePovertyTypeSql,
      memberCount: poorHouseholds.memberCount,
      actualMemberCount: sql<number>`coalesce(${memberCountsByHousehold.actualMemberCount}, 0)`
    })
    .from(poorHouseholds)
    .leftJoin(
      memberCountsByHousehold,
      eq(poorHouseholds.id, memberCountsByHousehold.householdId)
    )
    .$dynamic();
  if (whereClause) memberTotalsQuery = memberTotalsQuery.where(whereClause);
  const memberTotalRows = await memberTotalsQuery;
  const memberTotals = buildDashboardMemberTotals(memberTotalRows);

  let monthlyTrendQuery = db
    .select({
      householdId: householdAssessments.householdId,
      assessmentYear: householdAssessments.assessmentYear,
      povertyType: householdAssessments.povertyType,
      decisionDate: householdAssessments.decisionDate,
      createdAt: householdAssessments.createdAt
    })
    .from(householdAssessments)
    .innerJoin(poorHouseholds, eq(householdAssessments.householdId, poorHouseholds.id))
    .$dynamic();
  if (whereClause) monthlyTrendQuery = monthlyTrendQuery.where(whereClause);
  const monthlyTrendRows = await monthlyTrendQuery;
  const monthlyTrendByYear = buildDashboardMonthlyTrend(monthlyTrendRows);
  const trendAvailableYears = buildDashboardTrendAvailableYears(monthlyTrendByYear);

  return {
    totals,
    memberTotals,
    byArea,
    yearlyTrend,
    monthlyTrendByYear,
    trendAvailableYears,
    overview: overview ?? null
  };
};

const getDashboardTotals = async (
  filters: ReportFilters,
  scope?: PovertyAccessScope
): Promise<PublicPovertyWardMapResponse["summary"]> => {
  const conditions = appendHouseholdScope(householdFilters(filters), scope);
  const whereClause = whereFromConditions(conditions);

  let query = db
    .select({
      total: count(),
      poor: sql<number>`count(*) filter (where ${effectivePovertyTypeSql} = 'POOR')`,
      nearPoor: sql<number>`count(*) filter (where ${effectivePovertyTypeSql} = 'NEAR_POOR')`,
      active: sql<number>`count(*) filter (where ${poorHouseholds.status} = 'ACTIVE')`
    })
    .from(poorHouseholds)
    .$dynamic();

  if (whereClause) {
    query = query.where(whereClause);
  }

  const [totals] = await query;
  return {
    total: Number(totals?.total ?? 0),
    poor: Number(totals?.poor ?? 0),
    nearPoor: Number(totals?.nearPoor ?? 0),
    active: Number(totals?.active ?? 0)
  };
};

export const getPublicWardMapBySlug = async (
  slug: string,
  currentYear = new Date().getFullYear()
): Promise<PublicPovertyWardMapResponse | null> => {
  const share = await getWardPublicLinkBySlug(slug);
  if (!share || !share.isPublic) return null;

  const [ward, province, overview, summary, markers] = await Promise.all([
    db.select().from(wards).where(eq(wards.code, share.wardCode)).limit(1).then((rows) => rows[0] ?? null),
    db.select().from(provinces).where(eq(provinces.code, share.provinceCode)).limit(1).then((rows) => rows[0] ?? null),
    getDashboardOverview({
      year: currentYear,
      provinceCode: share.provinceCode,
      wardCode: share.wardCode
    }),
    getDashboardTotals({
      year: currentYear,
      provinceCode: share.provinceCode,
      wardCode: share.wardCode
    }),
    listGisMarkers({
      year: currentYear,
      provinceCode: share.provinceCode,
      wardCode: share.wardCode
    })
  ]);

  return {
    share: {
      publicSlug: share.publicSlug,
      wardCode: share.wardCode,
      provinceCode: share.provinceCode,
      wardName: ward?.fullName ?? ward?.name ?? null,
      provinceName: province?.fullName ?? province?.name ?? null,
      currentYear
    },
    overview,
    summary,
    markers: markers.map(toPublicPovertyMarker)
  };
};

export const getPublicAreaDetailBySlugAndAreaSlug = async (
  slug: string,
  areaSlug: string,
  currentYear = new Date().getFullYear()
): Promise<PublicPovertyAreaDetailResponse | null> => {
  const wardMap = await getPublicWardMapBySlug(slug, currentYear);
  if (!wardMap?.share?.wardCode) return null;

  const areaRows = await db
    .select()
    .from(areas)
    .where(eq(areas.wardCode, wardMap.share.wardCode));

  const area = areaRows
    .map((row) => toAreaItem(row))
    .find((item) => buildPublicAreaSlug(item.name, item.id) === areaSlug);

  if (!area) return null;

  const households = (wardMap.markers ?? []).filter((item) => item.areaId === area.id);
  const total = households.length;
  const poor = households.filter((item) => item.povertyType === "POOR").length;
  const nearPoor = households.filter((item) => item.povertyType === "NEAR_POOR").length;

  return {
    share: wardMap.share,
    area: {
      id: area.id,
      name: area.name,
      code: area.code ?? null,
      naturalArea: area.naturalArea ?? null,
      description: area.description ?? null,
      note: area.note ?? null,
      secretaryName: area.secretaryName ?? null,
      secretaryPhone: area.secretaryPhone ?? null,
      hamletHeadName: area.hamletHeadName ?? null,
      hamletHeadPhone: area.hamletHeadPhone ?? null,
      securityTeamLeaderName: area.securityTeamLeaderName ?? null,
      securityTeamLeaderPhone: area.securityTeamLeaderPhone ?? null
    },
    summary: {
      total,
      poor,
      nearPoor,
      normal: Math.max(total - poor - nearPoor, 0)
    },
    households
  };
};

export const getPublicHouseholdDetailBySlugAndHouseholdId = async (
  slug: string,
  householdId: string,
  currentYear = new Date().getFullYear()
): Promise<PublicPovertyHouseholdDetailResponse | null> => {
  const share = await getWardPublicLinkBySlug(slug);
  if (!share || !share.isPublic) return null;

  const detail = await getHouseholdDetail(householdId);
  if (!detail?.household) return null;

  if (
    detail.household.provinceCode !== share.provinceCode ||
    detail.household.wardCode !== share.wardCode ||
    detail.household.year !== currentYear
  ) {
    return null;
  }

  return {
    share: {
      publicSlug: share.publicSlug,
      wardCode: share.wardCode,
      provinceCode: share.provinceCode,
      wardName: detail.household.wardName ?? null,
      provinceName: detail.household.provinceName ?? null,
      currentYear
    },
    household: {
      id: detail.household.id,
      code: detail.household.code ?? null,
      headFullName: detail.household.headFullName ?? null,
      povertyType: detail.household.povertyType,
      status: detail.household.status ?? null,
      memberCount: Number(detail.household.memberCount ?? 0),
      areaId: detail.household.areaId ?? null,
      areaName: detail.household.areaName ?? null,
      wardName: detail.household.wardName ?? null,
      address: detail.household.address ?? null,
      latitude: detail.household.latitude ?? null,
      longitude: detail.household.longitude ?? null
    },
    summary: {
      fieldPhotoCount: detail.fieldPhotos?.length ?? 0,
      supportCount: detail.supports?.length ?? 0
    },
    latestContext: detail.latestContextHistory
      ? {
        familySituation: detail.latestContextHistory.familySituation ?? null,
        currentStatus: detail.latestContextHistory.currentStatus ?? null,
        recordedAt: detail.latestContextHistory.recordedAt ?? null
      }
      : null,
    fieldPhotos: (detail.fieldPhotos ?? []).map((photo) => ({
      uuid: photo.uuid,
      fileName: photo.fileName,
      filePath: photo.filePath,
      mimeType: photo.mimeType ?? null
    })),
    supports: (detail.supports ?? []).map((support) => ({
      id: support.id,
      supportDate: support.supportDate ?? null,
      supportTypes: [...support.supportTypes],
      content: support.content ?? null,
      supportingUnit: support.supportingUnit ?? null
    }))
  };
};

export const getReportSummary = async (filters: ReportFilters, scope?: PovertyAccessScope) => {
  const conditions = appendHouseholdScope(householdFilters(filters), scope);
  const whereClause = whereFromConditions(conditions);
  const areaExpr = sql<string>`coalesce(${poorHouseholds.areaName}, ${poorHouseholds.wardName}, ${poorHouseholds.provinceName}, 'Chưa xác định')`;

  let query = db
    .select({
      area: areaExpr,
      year: poorHouseholds.year,
      poorCount: sql<number>`count(*) filter (where ${effectivePovertyTypeSql} = 'POOR')`,
      nearPoorCount: sql<number>`count(*) filter (where ${effectivePovertyTypeSql} = 'NEAR_POOR')`,
      total: count()
    })
    .from(poorHouseholds)
    .$dynamic();
  if (whereClause) query = query.where(whereClause);
  const rows = await query
    .groupBy(areaExpr, poorHouseholds.year)
    .orderBy(desc(poorHouseholds.year), desc(count()));

  const yearOverviewMap = await getWardOverviewTotalHouseholdMap(
    Array.from(new Set(rows.map((row) => row.year).filter((value): value is number => typeof value === "number"))),
    filters,
    scope
  );

  return rows.map((row) => {
    const denominator = row.year ? (yearOverviewMap.get(row.year) ?? row.total) : row.total;
    const poorRatePercent = denominator > 0 ? Number(((row.poorCount * 100) / denominator).toFixed(2)) : 0;
    const nearPoorRatePercent = denominator > 0 ? Number(((row.nearPoorCount * 100) / denominator).toFixed(2)) : 0;
    return {
      ...row,
      totalHouseholds: denominator,
      poorRatePercent,
      nearPoorRatePercent
    };
  });
};

const toReportDetailAddress = (item: {
  address?: string | null;
  areaName?: string | null;
  wardName?: string | null;
  provinceName?: string | null;
}): string | null => {
  if (item.address) return item.address;
  const fallback = [item.areaName, item.wardName, item.provinceName].filter((value): value is string => Boolean(value && value.trim()));
  return fallback.length > 0 ? fallback.join(", ") : null;
};

const toReportDetailItem = (item: {
  code?: string | null;
  headFullName?: string | null;
  povertyType?: string | null;
  address?: string | null;
  areaName?: string | null;
  wardName?: string | null;
  provinceName?: string | null;
  memberCount?: number | null;
  status?: string | null;
  year: number;
}): PovertyReportDetailItem => ({
  code: item.code ?? null,
  headFullName: item.headFullName ?? null,
  povertyType: item.povertyType ?? null,
  address: toReportDetailAddress(item),
  memberCount: Number(item.memberCount ?? 0),
  status: item.status ?? null,
  year: item.year
});

export const getReportDetail = async (filters: ReportDetailFilters, scope?: PovertyAccessScope) => {
  const result = await listHouseholds({
    ...filters,
    sortBy: "updatedAt",
    sortOrder: "desc"
  }, scope);

  return {
    items: result.items.map((item) => toReportDetailItem(item)),
    pagination: result.pagination
  };
};

export const getReportDetailForExport = async (
  filters: ReportFilters,
  scope?: PovertyAccessScope
): Promise<PovertyReportDetailItem[]> => {
  const households = await listHouseholdsForExport(filters, scope);
  const householdIds = households.map((item) => item.id);

  if (householdIds.length === 0) return [];

  const [headMembers, memberCounts] = await Promise.all([
    db
      .select({
        householdId: householdMembers.householdId,
        fullName: householdMembers.fullName
      })
      .from(householdMembers)
      .where(and(inArray(householdMembers.householdId, householdIds), eq(householdMembers.isHead, true)))
      .orderBy(asc(householdMembers.fullName)),
    db
      .select({
        householdId: householdMembers.householdId,
        memberCount: count(householdMembers.id)
      })
      .from(householdMembers)
      .where(inArray(householdMembers.householdId, householdIds))
      .groupBy(householdMembers.householdId)
  ]);

  return attachMemberCounts(
    attachHeadMemberSummaries(households, headMembers.map((item) => ({ householdId: item.householdId, fullName: item.fullName, citizenId: null }))),
    memberCounts
  ).map((item) => toReportDetailItem(item));
};

export const listHouseholdsForExport = async (filters: ReportFilters, scope?: PovertyAccessScope) => {
  const conditions = appendHouseholdScope(householdFilters(filters), scope);
  const whereClause = whereFromConditions(conditions);
  let query = db.select().from(poorHouseholds).$dynamic();
  if (whereClause) query = query.where(whereClause);
  const households = await query.orderBy(desc(poorHouseholds.updatedAt));
  const latestAssessments = await getLatestAssessmentSummaries(households.map((item) => item.id));
  return hydrateHouseholdLocationLabels(attachEffectivePovertyTypes(households, latestAssessments));
};

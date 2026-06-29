import {
  householdAssessments,
  householdChangeLogs,
  householdMembers,
  householdSupports,
  povertyYearOverviews,
  poorHouseholds,
  files
} from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import type { SQL } from "drizzle-orm";
import { and, asc, count, desc, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import type {
  HouseholdAssessmentCreateInput,
  HouseholdCreateInput,
  HouseholdMemberCreateInput,
  PovertyYearOverviewUpsertInput,
  HouseholdSupportCreateInput,
  HouseholdUpdateInput,
  ImportedHouseholdInput
} from "./poverty.schemas.ts";

type ListHouseholdsFilters = {
  page: number;
  limit: number;
  search?: string;
  year?: number;
  povertyType?: string;
  status?: string;
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

export type PovertyYearOverviewItem = {
  id: string;
  year: number;
  population: number;
  totalHouseholds: number;
  totalMembers: number;
  note: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type ChangeLogPayload = {
  householdId?: string;
  actionType: "CREATE" | "UPDATE" | "DELETE" | "IMPORT";
  objectType: "HOUSEHOLD" | "MEMBER" | "ASSESSMENT" | "SUPPORT";
  objectId?: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  changeNote?: string;
};

type HouseholdWithId = {
  id: string;
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
      headFullName: head?.fullName ?? null,
      headCitizenId: head?.citizenId ?? null
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
    memberCount: countsByHouseholdId.get(household.id) ?? 0
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
        ilike(poorHouseholds.provinceName, like),
        ilike(poorHouseholds.wardName, like),
        ilike(poorHouseholds.areaName, like)
      ) as SQL<unknown>
    );
  }
  if (filters.year) conditions.push(eq(poorHouseholds.year, filters.year));
  if (filters.povertyType) conditions.push(sql`${effectivePovertyTypeSql} = ${filters.povertyType}`);
  if (filters.status) conditions.push(eq(poorHouseholds.status, filters.status));
  if (filters.provinceName) conditions.push(ilike(poorHouseholds.provinceName, `%${filters.provinceName}%`));
  if (filters.wardName) conditions.push(ilike(poorHouseholds.wardName, `%${filters.wardName}%`));
  if (filters.areaName) conditions.push(ilike(poorHouseholds.areaName, `%${filters.areaName}%`));
  return conditions;
};

const whereFromConditions = (conditions: SQL<unknown>[]): SQL<unknown> | undefined => {
  if (conditions.length === 0) return undefined;
  return conditions.length === 1 ? conditions[0] : and(...conditions);
};

export const gisMarkerFilters = (filters: Partial<ReportFilters>): SQL<unknown>[] => householdFilters(filters);

export const shouldClearOtherHeadMembers = (payload: Partial<HouseholdMemberCreateInput>): boolean => payload.isHead === true;

const clearOtherHeadMembers = async (householdId: string, exceptMemberId?: string): Promise<void> => {
  const conditions: SQL<unknown>[] = [eq(householdMembers.householdId, householdId), eq(householdMembers.isHead, true)];
  if (exceptMemberId) conditions.push(ne(householdMembers.id, exceptMemberId));

  await db
    .update(householdMembers)
    .set({ isHead: false, updatedAt: new Date() })
    .where(and(...conditions));
};

export const listHouseholds = async (filters: ListHouseholdsFilters) => {
  const offset = (filters.page - 1) * filters.limit;
  const conditions = householdFilters(filters);
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

  const items = attachEffectivePovertyTypes(
    attachMemberCounts(attachHeadMemberSummaries(households, headMembers), memberCounts),
    latestAssessments
  );

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

export const getHouseholdById = async (id: string) => {
  const [item] = await db.select().from(poorHouseholds).where(eq(poorHouseholds.id, id)).limit(1);
  return item;
};

export const getHouseholdDetail = async (id: string) => {
  const household = await getHouseholdById(id);
  if (!household) return null;

  const [members, assessments, supports, changeLogs, fieldPhotos] = await Promise.all([
    db.select().from(householdMembers).where(eq(householdMembers.householdId, id)).orderBy(desc(householdMembers.isHead), asc(householdMembers.fullName)),
    db.select().from(housegroundAssessments).where(eq(householdAssessments.householdId, id)).orderBy(desc(householdAssessments.assessmentYear)),
    db.select().from(householdSupports).where(eq(householdSupports.householdId, id)).orderBy(desc(householdSupports.supportDate), desc(householdSupports.createdAt)),
    db.select().from(householdChangeLogs).where(eq(householdChangeLogs.householdId, id)).orderBy(desc(householdChangeLogs.changedAt)).limit(50),
    db.select().from(files).where(and(eq(files.entityType, "poor_household"), eq(files.entityId, id), isNull(files.deletedAt))).orderBy(desc(files.createdAt))
  ]);

  const [effectiveHousehold] = attachEffectivePovertyTypes([household], assessments);
  return { household: effectiveHousehold, members, assessments, supports, changeLogs, fieldPhotos };
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
  const data = withoutChangeNote(payload);
  const [created] = await db.insert(poorHouseholds).values(data).returning();
  if (created) {
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

  const data = compact({ ...withoutChangeNote(payload), updatedAt: new Date() });
  const [updated] = await db.update(poorHouseholds).set(data).where(eq(poorHouseholds.id, id)).returning();
  if (!updated) {
    throw new Error("Không tìm thấy bản ghi để cập nhật");
  }

  return {
    id: updated.id,
    year: updated.year,
    population: Number(updated.population ?? 0),
    totalHouseholds: Number(updated.totalHouseholds ?? 0),
    totalMembers: Number(updated.totalMembers ?? 0),
    note: updated.note ?? null,
    createdAt: updated.createdAt ?? null,
    updatedAt: updated.updatedAt ?? null,
  };
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

export const listGisMarkers = async (filters: ReportFilters) => {
  const conditions = gisMarkerFilters(filters);
  const whereClause = whereFromConditions(conditions);
  let query = db
    .select({
      id: poorHouseholds.id,
      code: poorHouseholds.code,
      year: poorHouseholds.year,
      povertyType: effectivePovertyTypeSql,
      status: poorHouseholds.status,
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

export const listPovertyYearOverviews = async (year?: number): Promise<PovertyYearOverviewItem[]> => {
  let query = db
    .select()
    .from(povertyYearOverviews)
    .$dynamic();

  if (year) {
    query = query.where(eq(povertyYearOverviews.year, year));
  }

  const rows = await query.orderBy(desc(povertyYearOverviews.year));
  return rows.map((row) => ({
    id: row.id,
    year: row.year,
    population: Number(row.population ?? 0),
    totalHouseholds: Number(row.totalHouseholds ?? 0),
    totalMembers: Number(row.totalMembers ?? 0),
    note: row.note ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null
  }));
};

export const upsertPovertyYearOverview = async (payload: PovertyYearOverviewUpsertInput): Promise<PovertyYearOverviewItem> => {
  const [existing] = await db
    .select()
    .from(povertyYearOverviews)
    .where(eq(povertyYearOverviews.year, payload.year))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(povertyYearOverviews)
      .set({
        population: payload.population,
        totalHouseholds: payload.totalHouseholds,
        totalMembers: payload.totalMembers,
        note: payload.note,
        updatedAt: new Date()
      })
      .where(eq(povertyYearOverviews.id, existing.id))
      .returning();

    if (!updated) {
      throw new Error("Không tìm thấy bản ghi để cập nhật");
    }

    return {
      id: updated.id,
      year: updated.year,
      population: Number(updated.population ?? 0),
      totalHouseholds: Number(updated.totalHouseholds ?? 0),
      totalMembers: Number(updated.totalMembers ?? 0),
      note: updated.note ?? null,
      createdAt: updated.createdAt ?? null,
      updatedAt: updated.updatedAt ?? null,
    };
  }

  const [created] = await db
    .insert(povertyYearOverviews)
    .values({
      year: payload.year,
      population: payload.population,
      totalHouseholds: payload.totalHouseholds,
      totalMembers: payload.totalMembers,
      note: payload.note
    })
    .returning();

  if (!created) {
    throw new Error("Không thể tạo bản ghi mới");
  }

  return {
    id: created.id,
    year: created.year,
    population: Number(created.population ?? 0),
    totalHouseholds: Number(created.totalHouseholds ?? 0),
    totalMembers: Number(created.totalMembers ?? 0),
    note: created.note ?? null,
    createdAt: created.createdAt ?? null,
    updatedAt: created.updatedAt ?? null,
  };
};

export const deletePovertyYearOverviewById = async (id: string): Promise<PovertyYearOverviewItem | null> => {
  const [deleted] = await db
    .delete(povertyYearOverviews)
    .where(eq(povertyYearOverviews.id, id))
    .returning();

  if (!deleted) return null;

  return {
    id: deleted.id,
    year: deleted.year,
    population: Number(deleted.population ?? 0),
    totalHouseholds: Number(deleted.totalHouseholds ?? 0),
    totalMembers: Number(deleted.totalMembers ?? 0),
    note: deleted.note ?? null,
    createdAt: deleted.createdAt ?? null,
    updatedAt: deleted.updatedAt ?? null,
  };
};

const getYearOverviewMap = async (years: number[]): Promise<Map<number, PovertyYearOverviewItem>> => {
  if (years.length === 0) return new Map<number, PovertyYearOverviewItem>();

  const overviewRows = await db
    .select()
    .from(povertyYearOverviews)
    .where(inArray(povertyYearOverviews.year, years));

  return new Map<number, PovertyYearOverviewItem>(
    overviewRows.map((row) => [
      row.year,
      {
        id: row.id,
        year: row.year,
        population: Number(row.population ?? 0),
        totalHouseholds: Number(row.totalHouseholds ?? 0),
        totalMembers: Number(row.totalMembers ?? 0),
        note: row.note ?? null,
        createdAt: row.createdAt ?? null,
        updatedAt: row.updatedAt ?? null
      }
    ])
  );
};

export const getDashboard = async (filters: ReportFilters) => {
  const conditions = householdFilters(filters);
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

  const byArea = await getReportSummary(filters);
  const [overview] = filters.year
    ? await listPovertyYearOverviews(filters.year)
    : await listPovertyYearOverviews();
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

  return { totals, byArea, yearlyTrend, overview: overview ?? null };
};

export const getReportSummary = async (filters: ReportFilters) => {
  const conditions = householdFilters(filters);
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

  const yearOverviewMap = await getYearOverviewMap(
    Array.from(new Set(rows.map((row) => row.year).filter((value): value is number => typeof value === "number")))
  );

  return rows.map((row) => {
    const denominator = row.year ? (yearOverviewMap.get(row.year)?.totalHouseholds ?? row.total) : row.total;
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

export const getReportDetail = async (filters: ReportDetailFilters) => {
  const result = await listHouseholds({
    ...filters,
    sortBy: "updatedAt",
    sortOrder: "desc"
  });

  return {
    items: result.items.map((item) => toReportDetailItem(item)),
    pagination: result.pagination
  };
};

export const getReportDetailForExport = async (filters: ReportFilters): Promise<PovertyReportDetailItem[]> => {
  const households = await listHouseholdsForExport(filters);
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

export const listHouseholdsForExport = async (filters: ReportFilters) => {
  const conditions = householdFilters(filters);
  const whereClause = whereFromConditions(conditions);
  let query = db.select().from(poorHouseholds).$dynamic();
  if (whereClause) query = query.where(whereClause);
  const households = await query.orderBy(desc(poorHouseholds.updatedAt));
  const latestAssessments = await getLatestAssessmentSummaries(households.map((item) => item.id));
  return attachEffectivePovertyTypes(households, latestAssessments);
};

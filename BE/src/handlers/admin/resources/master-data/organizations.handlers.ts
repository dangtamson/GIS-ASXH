import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import { accounts, areas, organizations, provinces, wards, workspaceMemberships } from "@/schema.ts";
import { auditHelpers } from "@/services/auditLog.ts";
import { db } from "@/services/db/drizzle.ts";
import type { SQL } from "drizzle-orm";
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import type { Request, Response } from "express";
import { z } from "zod";
import { expandOrganizationDescendants, getAccountOrganizationIds } from "@/handlers/report/common.ts";
import { sanitizeUpdatePayload } from "../shared/updatePayload.ts";

const optionalEmailSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  },
  z.email().optional()
);

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(1000),
  parentId: z.uuid().optional(),
  status: z.coerce.boolean().optional(),
  search: z.string().trim().optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "name", "code", "sortOrder"]).default("sortOrder"),
  sortOrder: z.enum(["asc", "desc"]).default("asc")
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(255),
  code: z.string().trim().max(100).optional(),
  parentId: z.uuid().nullable().optional(),
  provinceCode: z.string().trim().min(1).optional(),
  wardCode: z.string().trim().min(1).optional(),
  areaId: z.uuid().optional(),
  address: z.string().trim().optional(),
  phone: z.string().trim().max(50).optional(),
  email: optionalEmailSchema,
  status: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional()
});

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    code: z.string().trim().max(100).optional(),
    parentId: z.uuid().nullable().optional(),
    provinceCode: z.string().trim().min(1).nullable().optional(),
    wardCode: z.string().trim().min(1).nullable().optional(),
    areaId: z.uuid().nullable().optional(),
    address: z.string().trim().optional(),
    phone: z.string().trim().max(50).optional(),
    email: optionalEmailSchema,
    status: z.boolean().optional(),
    sortOrder: z.coerce.number().int().optional()
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required"
  });

export const ensureManagementLevelCombination = (payload: {
  provinceCode?: string | null;
  wardCode?: string | null;
  areaId?: string | null;
}): void => {
  if (payload.areaId && !payload.wardCode) {
    throw HttpErrors.ValidationFailed("areaId requires wardCode");
  }

  if (payload.wardCode && !payload.provinceCode) {
    throw HttpErrors.ValidationFailed("wardCode requires provinceCode");
  }
};

export const ensureWithinParentScope = (
  parent: {
    provinceCode?: string | null;
    wardCode?: string | null;
    areaId?: string | null;
  } | null,
  child: {
    provinceCode?: string | null;
    wardCode?: string | null;
    areaId?: string | null;
  }
): void => {
  if (!parent) return;

  if (parent.areaId && parent.areaId !== child.areaId) {
    throw HttpErrors.ValidationFailed("Child organization must stay inside the parent area");
  }

  if (parent.wardCode && parent.wardCode !== child.wardCode) {
    throw HttpErrors.ValidationFailed("Child organization must stay inside the parent ward");
  }

  if (parent.provinceCode && parent.provinceCode !== child.provinceCode) {
    throw HttpErrors.ValidationFailed("Child organization must stay inside the parent province");
  }
};

type OrganizationWithLocationFields = typeof organizations.$inferSelect;
type OrganizationParentSummary = {
  id: string;
  uuid: string;
  name: string;
  code: string | null;
};

const attachOrganizationLocationLabels = async <T extends OrganizationWithLocationFields>(
  items: T[]
): Promise<
  Array<
    T & {
      provinceName: string | null;
      wardName: string | null;
      areaName: string | null;
      parent: OrganizationParentSummary | null;
    }
  >
> => {
  if (items.length === 0) {
    return [];
  }

  const provinceCodes = Array.from(
    new Set(items.map((item) => item.provinceCode).filter((value): value is string => Boolean(value)))
  );
  const wardCodes = Array.from(
    new Set(items.map((item) => item.wardCode).filter((value): value is string => Boolean(value)))
  );
  const areaIds = Array.from(
    new Set(items.map((item) => item.areaId).filter((value): value is string => Boolean(value)))
  );
  const parentIds = Array.from(
    new Set(items.map((item) => item.parentId).filter((value): value is string => Boolean(value)))
  );

  const [provinceRows, wardRows, areaRows, parentRows] = await Promise.all([
    provinceCodes.length > 0 ? db.select().from(provinces).where(inArray(provinces.code, provinceCodes)) : [],
    wardCodes.length > 0 ? db.select().from(wards).where(inArray(wards.code, wardCodes)) : [],
    areaIds.length > 0 ? db.select().from(areas).where(inArray(areas.id, areaIds)) : [],
    parentIds.length > 0
      ? db
        .select({
          uuid: organizations.uuid,
          name: organizations.name,
          code: organizations.code
        })
        .from(organizations)
        .where(inArray(organizations.uuid, parentIds))
      : []
  ]);

  const provinceMap = new Map(provinceRows.map((item) => [item.code, item.fullName ?? item.name]));
  const wardMap = new Map(wardRows.map((item) => [item.code, item.fullName ?? item.name]));
  const areaMap = new Map(areaRows.map((item) => [item.id, item.name]));
  const parentMap = new Map(
    parentRows.map((item) => [
      item.uuid,
      {
        id: item.uuid,
        uuid: item.uuid,
        name: item.name,
        code: item.code
      } satisfies OrganizationParentSummary
    ])
  );

  return items.map((item) => ({
    ...item,
    provinceName: item.provinceCode ? (provinceMap.get(item.provinceCode) ?? null) : null,
    wardName: item.wardCode ? (wardMap.get(item.wardCode) ?? null) : null,
    areaName: item.areaId ? (areaMap.get(item.areaId) ?? null) : null,
    parent: item.parentId ? (parentMap.get(item.parentId) ?? null) : null
  }));
};

const resolveOrganizationAccessScope = async (
  accountId: string | null | undefined,
  workspaceId: string
): Promise<{ hasFullAccess: boolean; scopedOrganizationIds: string[] }> => {
  if (!accountId) {
    return { hasFullAccess: false, scopedOrganizationIds: [] };
  }

  const [account] = await db
    .select({ isSuperAdmin: accounts.isSuperAdmin })
    .from(accounts)
    .where(eq(accounts.uuid, accountId))
    .limit(1);

  if (account?.isSuperAdmin) {
    return { hasFullAccess: true, scopedOrganizationIds: [] };
  }

  const organizationIds = await getAccountOrganizationIds(accountId, workspaceId);
  const scopedOrganizationIds =
    organizationIds.length > 0 ? await expandOrganizationDescendants(workspaceId, organizationIds) : [];

  return { hasFullAccess: false, scopedOrganizationIds };
};

export const listOrganizationsAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const { page, limit, parentId, status, search, createdFrom, createdTo, sortBy, sortOrder } = parsed.data;
  const offset = (page - 1) * limit;
  const accountId = req.accountId?.trim();
  const accessScope = await resolveOrganizationAccessScope(accountId, workspaceId);

  const conditions: SQL<unknown>[] = [eq(organizations.workspaceId, workspaceId)];
  if (!accessScope.hasFullAccess) {
    if (accessScope.scopedOrganizationIds.length === 0) {
      const response = apiResponse.success(
        HttpStatusCode.OK,
        {
          items: [],
          pagination: { page, limit, total: 0, pages: 0 },
          filters: {
            workspaceId,
            parentId: parentId || null,
            status: status ?? null,
            search: search || null,
            createdFrom: createdFrom?.toISOString() || null,
            createdTo: createdTo?.toISOString() || null,
            sortBy,
            sortOrder
          }
        },
        "Organizations retrieved successfully"
      );
      res.status(response.code).send(response);
      return;
    }

    conditions.push(inArray(organizations.uuid, accessScope.scopedOrganizationIds));
  }

  if (parentId) conditions.push(eq(organizations.parentId, parentId));
  if (status !== undefined) conditions.push(eq(organizations.status, status));
  if (search) {
    conditions.push(or(ilike(organizations.name, `%${search}%`), ilike(organizations.code, `%${search}%`)) as SQL<unknown>);
  }
  if (createdFrom) conditions.push(gte(organizations.createdAt, createdFrom));
  if (createdTo) conditions.push(lte(organizations.createdAt, createdTo));

  const whereClause = conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : and(...conditions)) : undefined;
  const [totalResult] = whereClause
    ? await db.select({ count: count() }).from(organizations).where(whereClause)
    : await db.select({ count: count() }).from(organizations);

  const orderByClause = [sql`${sql.identifier("organizations")}.${sql.identifier("sort_order")} asc nulls last`, asc(organizations.name)];
  const items = whereClause
    ? await db.select().from(organizations).where(whereClause).orderBy(...orderByClause).limit(limit).offset(offset)
    : await db.select().from(organizations).orderBy(...orderByClause).limit(limit).offset(offset);
  const enrichedItems = await attachOrganizationLocationLabels(items);

  const total = totalResult?.count ?? 0;
  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      items: enrichedItems,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      filters: {
        workspaceId,
        parentId: parentId || null,
        status: status ?? null,
        search: search || null,
        createdFrom: createdFrom?.toISOString() || null,
        createdTo: createdTo?.toISOString() || null,
        sortBy,
        sortOrder
      }
    },
    "Organizations retrieved successfully"
  );
  res.status(response.code).send(response);
});

export const createOrganizationAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  try {
    ensureManagementLevelCombination(parsed.data);
  } catch (error) {
    const response = apiResponse.error(error instanceof Error ? error : new Error("Validation failed"));
    res.status(response.code).send(response);
    return;
  }

  if (parsed.data.parentId) {
    const [parentOrganization] = await db
      .select()
      .from(organizations)
      .where(and(eq(organizations.uuid, parsed.data.parentId), eq(organizations.workspaceId, workspaceId)))
      .limit(1);

    if (!parentOrganization) {
      const response = apiResponse.error(HttpErrors.NotFound("Parent organization"));
      res.status(response.code).send(response);
      return;
    }

    try {
      ensureWithinParentScope(parentOrganization, parsed.data);
    } catch (error) {
      const response = apiResponse.error(error instanceof Error ? error : new Error("Validation failed"));
      res.status(response.code).send(response);
      return;
    }
  }

  const { sortOrder, ...organizationPayload } = parsed.data;

  const [created] = await db
    .insert(organizations)
    .values({
      ...organizationPayload,
      sort_order: sortOrder,
      workspaceId
    })
    .returning();
  if (!created) throw new Error("Unable to create organization");

  if (req.accountId) {
    await auditHelpers.organizationCreated(
      req.accountId,
      created.uuid,
      workspaceId,
      {
        name: created.name,
        code: created.code,
        parentId: created.parentId,
        provinceCode: created.provinceCode,
        wardCode: created.wardCode,
        areaId: created.areaId,
        address: created.address,
        phone: created.phone,
        email: created.email,
        status: created.status,
        sortOrder: created.sort_order
      },
      req
    );
  }

  const [enrichedCreated] = await attachOrganizationLocationLabels([created]);
  const response = apiResponse.success(
    HttpStatusCode.CREATED,
    { item: enrichedCreated ?? created },
    "Organization created successfully"
  );
  res.status(response.code).send(response);
});

export const getOrganizationAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Organization ID"));
    res.status(response.code).send(response);
    return;
  }
  if (!z.uuid().safeParse(id).success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid organization id"));
    res.status(response.code).send(response);
    return;
  }

  const accessScope = await resolveOrganizationAccessScope(req.accountId?.trim(), workspaceId);
  if (!accessScope.hasFullAccess && !accessScope.scopedOrganizationIds.includes(id)) {
    const response = apiResponse.error(HttpErrors.NotFound("Organization"));
    res.status(response.code).send(response);
    return;
  }

  const [item] = await db
    .select()
    .from(organizations)
    .where(and(eq(organizations.uuid, id), eq(organizations.workspaceId, workspaceId)))
    .limit(1);
  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("Organization"));
    res.status(response.code).send(response);
    return;
  }

  const [enrichedItem] = await attachOrganizationLocationLabels([item]);
  const response = apiResponse.success(
    HttpStatusCode.OK,
    { item: enrichedItem ?? item },
    "Organization retrieved successfully"
  );
  res.status(response.code).send(response);
});

export const updateOrganizationAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Organization ID"));
    res.status(response.code).send(response);
    return;
  }
  if (!z.uuid().safeParse(id).success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid organization id"));
    res.status(response.code).send(response);
    return;
  }

  const accessScope = await resolveOrganizationAccessScope(req.accountId?.trim(), workspaceId);
  if (!accessScope.hasFullAccess && !accessScope.scopedOrganizationIds.includes(id)) {
    const response = apiResponse.error(HttpErrors.NotFound("Organization"));
    res.status(response.code).send(response);
    return;
  }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  try {
    ensureManagementLevelCombination(parsed.data);
  } catch (error) {
    const response = apiResponse.error(error instanceof Error ? error : new Error("Validation failed"));
    res.status(response.code).send(response);
    return;
  }

  const updatePayload = sanitizeUpdatePayload(parsed.data);
  if (Object.keys(updatePayload).length === 0) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("At least one field is required"));
    res.status(response.code).send(response);
    return;
  }

  const { sortOrder, ...restUpdatePayload } = updatePayload;
  const organizationUpdatePayload = {
    ...restUpdatePayload,
    ...(sortOrder !== undefined ? { sort_order: sortOrder } : {})
  };

  const [existingOrganization] = await db
    .select()
    .from(organizations)
    .where(and(eq(organizations.uuid, id), eq(organizations.workspaceId, workspaceId)))
    .limit(1);

  if (!existingOrganization) {
    const response = apiResponse.error(HttpErrors.NotFound("Organization"));
    res.status(response.code).send(response);
    return;
  }

  const resolvedParentId =
    organizationUpdatePayload.parentId !== undefined
      ? organizationUpdatePayload.parentId
      : existingOrganization.parentId;

  if (
    resolvedParentId &&
    !accessScope.hasFullAccess &&
    !accessScope.scopedOrganizationIds.includes(String(resolvedParentId))
  ) {
    const response = apiResponse.error(HttpErrors.NotFound("Parent organization"));
    res.status(response.code).send(response);
    return;
  }

  if (resolvedParentId) {
    const [parentOrganization] = await db
      .select()
      .from(organizations)
      .where(and(eq(organizations.uuid, String(resolvedParentId)), eq(organizations.workspaceId, workspaceId)))
      .limit(1);

    if (!parentOrganization) {
      const response = apiResponse.error(HttpErrors.NotFound("Parent organization"));
      res.status(response.code).send(response);
      return;
    }

    try {
      ensureWithinParentScope(parentOrganization, {
        provinceCode:
          organizationUpdatePayload.provinceCode !== undefined
            ? (organizationUpdatePayload.provinceCode as string | null)
            : existingOrganization.provinceCode,
        wardCode:
          organizationUpdatePayload.wardCode !== undefined
            ? (organizationUpdatePayload.wardCode as string | null)
            : existingOrganization.wardCode,
        areaId:
          organizationUpdatePayload.areaId !== undefined
            ? (organizationUpdatePayload.areaId as string | null)
            : existingOrganization.areaId
      });
    } catch (error) {
      const response = apiResponse.error(error instanceof Error ? error : new Error("Validation failed"));
      res.status(response.code).send(response);
      return;
    }
  }

  const [updated] = await db
    .update(organizations)
    .set(organizationUpdatePayload)
    .where(and(eq(organizations.uuid, id), eq(organizations.workspaceId, workspaceId)))
    .returning();
  if (!updated) {
    const response = apiResponse.error(HttpErrors.NotFound("Organization"));
    res.status(response.code).send(response);
    return;
  }

  if (req.accountId) {
    await auditHelpers.organizationUpdated(
      req.accountId,
      updated.uuid,
      workspaceId,
      {
        dataDetail: {
          oldData: existingOrganization,
          newData: req.body
        }
      },
      req
    );
  }

  const [enrichedUpdated] = await attachOrganizationLocationLabels([updated]);
  const response = apiResponse.success(
    HttpStatusCode.OK,
    { item: enrichedUpdated ?? updated },
    "Organization updated successfully"
  );
  res.status(response.code).send(response);
});

export const deleteOrganizationAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Organization ID"));
    res.status(response.code).send(response);
    return;
  }
  if (!z.uuid().safeParse(id).success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid organization id"));
    res.status(response.code).send(response);
    return;
  }

  const accessScope = await resolveOrganizationAccessScope(req.accountId?.trim(), workspaceId);
  if (!accessScope.hasFullAccess && !accessScope.scopedOrganizationIds.includes(id)) {
    const response = apiResponse.error(HttpErrors.NotFound("Organization"));
    res.status(response.code).send(response);
    return;
  }

  const [deleted] = await db
    .delete(organizations)
    .where(and(eq(organizations.uuid, id), eq(organizations.workspaceId, workspaceId)))
    .returning();
  if (!deleted) {
    const response = apiResponse.error(HttpErrors.NotFound("Organization"));
    res.status(response.code).send(response);
    return;
  }

  if (req.accountId) {
    await auditHelpers.organizationDeleted(
      req.accountId,
      deleted.uuid,
      workspaceId,
      {
        name: deleted.name,
        code: deleted.code,
        parentId: deleted.parentId,
        provinceCode: deleted.provinceCode,
        wardCode: deleted.wardCode,
        areaId: deleted.areaId,
        address: deleted.address,
        phone: deleted.phone,
        email: deleted.email,
        status: deleted.status
      },
      req
    );
  }

  const [enrichedDeleted] = await attachOrganizationLocationLabels([deleted]);
  const response = apiResponse.success(
    HttpStatusCode.OK,
    { item: enrichedDeleted ?? deleted },
    "Organization deleted successfully"
  );
  res.status(response.code).send(response);
});

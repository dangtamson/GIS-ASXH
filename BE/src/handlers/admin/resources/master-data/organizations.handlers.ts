import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import { accounts, organizations, workspaceMemberships } from "@/schema.ts";
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
    address: z.string().trim().optional(),
    phone: z.string().trim().max(50).optional(),
    email: optionalEmailSchema,
    status: z.boolean().optional(),
    sortOrder: z.coerce.number().int().optional()
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required"
  });

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
  let isSuperAdmin = false;

  if (accountId) {
    const [account] = await db
      .select({ isSuperAdmin: accounts.isSuperAdmin })
      .from(accounts)
      .where(eq(accounts.uuid, accountId))
      .limit(1);

    const [member] = await db
      .select({ isAdmin: workspaceMemberships.isAdmin })
      .from(workspaceMemberships)
      .where(eq(workspaceMemberships.accountId, accountId))
      .limit(1);

    isSuperAdmin = Boolean(account?.isSuperAdmin || member?.isAdmin);
  }

  const conditions: SQL<unknown>[] = [eq(organizations.workspaceId, workspaceId)];
  if (!isSuperAdmin) {
    const organizationIds = accountId ? await getAccountOrganizationIds(accountId, workspaceId) : [];
    const scopedOrganizationIds =
      organizationIds.length > 0 ? await expandOrganizationDescendants(workspaceId, organizationIds) : [];

    if (scopedOrganizationIds.length === 0) {
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

    conditions.push(inArray(organizations.uuid, scopedOrganizationIds));
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

  const total = totalResult?.count ?? 0;
  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      items,
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

  const [created] = await db
    .insert(organizations)
    .values({
      ...parsed.data,
      sort_order: parsed.data.sortOrder,
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
        address: created.address,
        phone: created.phone,
        email: created.email,
        status: created.status,
        sortOrder: created.sort_order
      },
      req
    );
  }

  const response = apiResponse.success(HttpStatusCode.CREATED, { item: created }, "Organization created successfully");
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

  const response = apiResponse.success(HttpStatusCode.OK, { item }, "Organization retrieved successfully");
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

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
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

  const response = apiResponse.success(HttpStatusCode.OK, { item: updated }, "Organization updated successfully");
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
        address: deleted.address,
        phone: deleted.phone,
        email: deleted.email,
        status: deleted.status
      },
      req
    );
  }

  const response = apiResponse.success(HttpStatusCode.OK, { item: deleted }, "Organization deleted successfully");
  res.status(response.code).send(response);
});

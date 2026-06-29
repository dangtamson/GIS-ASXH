import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import { categories } from "@/schema.ts";
import { auditHelpers } from "@/services/auditLog.ts";
import { db } from "@/services/db/drizzle.ts";
import type { SQL } from "drizzle-orm";
import { and, asc, count, desc, eq, gte, ilike, lte, or } from "drizzle-orm";
import type { Request, Response } from "express";
import { z } from "zod";
import { sanitizeUpdatePayload } from "../shared/updatePayload.ts";

const categoriesListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  sortBy: z.enum(["createdAt", "name", "code"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
});

const categoryCreateSchema = z.object({
  code: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().optional()
});

const categoryUpdateSchema = z
  .object({
    code: z.string().trim().min(1).max(100).optional(),
    name: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().optional()
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required"
  });

export const listCategoriesAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  const parsed = categoriesListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const { page, limit, search, createdFrom, createdTo, sortBy, sortOrder } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions: SQL<unknown>[] = [eq(categories.workspaceId, workspaceId)];
  if (search) {
    conditions.push(or(ilike(categories.name, `%${search}%`), ilike(categories.code, `%${search}%`)) as SQL<unknown>);
  }
  if (createdFrom) {
    conditions.push(gte(categories.createdAt, createdFrom));
  }
  if (createdTo) {
    conditions.push(lte(categories.createdAt, createdTo));
  }

  const whereClause = conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : and(...conditions)) : undefined;

  const [totalResult] = whereClause
    ? await db.select({ count: count() }).from(categories).where(whereClause)
    : await db.select({ count: count() }).from(categories);

  const sortColumn = sortBy === "name" ? categories.name : sortBy === "code" ? categories.code : categories.createdAt;
  const orderByClause = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  const items = whereClause
    ? await db.select().from(categories).where(whereClause).orderBy(orderByClause).limit(limit).offset(offset)
    : await db.select().from(categories).orderBy(orderByClause).limit(limit).offset(offset);

  const total = totalResult?.count ?? 0;

  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      filters: {
        workspaceId,
        search: search || null,
        createdFrom: createdFrom?.toISOString() || null,
        createdTo: createdTo?.toISOString() || null,
        sortBy,
        sortOrder
      }
    },
    "Categories retrieved successfully"
  );

  res.status(response.code).send(response);
});

export const createCategoryAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  const parsed = categoryCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const [created] = await db
    .insert(categories)
    .values({
      ...parsed.data,
      workspaceId
    })
    .returning();
  if (!created) {
    throw new Error("Unable to create category");
  }

  if (req.accountId) {
    await auditHelpers.categoryCreated(
      req.accountId,
      created.uuid,
      workspaceId,
      {
        code: created.code,
        name: created.name,
        description: created.description
      },
      req
    );
  }

  const response = apiResponse.success(HttpStatusCode.CREATED, { item: created }, "Category created successfully");
  res.status(response.code).send(response);
});

export const getCategoryAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Category ID"));
    res.status(response.code).send(response);
    return;
  }
  const idValidation = z.uuid().safeParse(id);
  if (!idValidation.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid category id"));
    res.status(response.code).send(response);
    return;
  }

  const [item] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.uuid, id), eq(categories.workspaceId, workspaceId)))
    .limit(1);
  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("Category"));
    res.status(response.code).send(response);
    return;
  }

  const response = apiResponse.success(HttpStatusCode.OK, { item }, "Category retrieved successfully");
  res.status(response.code).send(response);
});

export const updateCategoryAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Category ID"));
    res.status(response.code).send(response);
    return;
  }
  const idValidation = z.uuid().safeParse(id);
  if (!idValidation.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid category id"));
    res.status(response.code).send(response);
    return;
  }

  const parsed = categoryUpdateSchema.safeParse(req.body);
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

  const [existingCategory] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.uuid, id), eq(categories.workspaceId, workspaceId)))
    .limit(1);

  if (!existingCategory) {
    const response = apiResponse.error(HttpErrors.NotFound("Category"));
    res.status(response.code).send(response);
    return;
  }

  const [updated] = await db
    .update(categories)
    .set(updatePayload)
    .where(and(eq(categories.uuid, id), eq(categories.workspaceId, workspaceId)))
    .returning();
  if (!updated) {
    const response = apiResponse.error(HttpErrors.NotFound("Category"));
    res.status(response.code).send(response);
    return;
  }

  if (req.accountId) {
    await auditHelpers.categoryUpdated(
      req.accountId,
      updated.uuid,
      workspaceId,
      {
        dataDetail: {
          oldData: existingCategory,
          newData: req.body
        }
      },
      req
    );
  }

  const response = apiResponse.success(HttpStatusCode.OK, { item: updated }, "Category updated successfully");
  res.status(response.code).send(response);
});

export const deleteCategoryAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Category ID"));
    res.status(response.code).send(response);
    return;
  }
  const idValidation = z.uuid().safeParse(id);
  if (!idValidation.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid category id"));
    res.status(response.code).send(response);
    return;
  }

  const [deleted] = await db
    .delete(categories)
    .where(and(eq(categories.uuid, id), eq(categories.workspaceId, workspaceId)))
    .returning();
  if (!deleted) {
    const response = apiResponse.error(HttpErrors.NotFound("Category"));
    res.status(response.code).send(response);
    return;
  }

  if (req.accountId) {
    await auditHelpers.categoryDeleted(
      req.accountId,
      deleted.uuid,
      workspaceId,
      {
        code: deleted.code,
        name: deleted.name,
        description: deleted.description
      },
      req
    );
  }

  const response = apiResponse.success(HttpStatusCode.OK, { item: deleted }, "Category deleted successfully");
  res.status(response.code).send(response);
});

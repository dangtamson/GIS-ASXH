import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import { categoryItems } from "@/schema.ts";
import { auditHelpers } from "@/services/auditLog.ts";
import { db } from "@/services/db/drizzle.ts";
import type { SQL } from "drizzle-orm";
import { and, asc, count, desc, eq, gte, ilike, lte, or } from "drizzle-orm";
import type { Request, Response } from "express";
import { z } from "zod";
import { sanitizeUpdatePayload } from "../shared/updatePayload.ts";
import { categories } from "@/schema.ts";

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  categoryId: z.uuid().optional(),
  parentId: z.uuid().optional(),
  status: z.coerce.boolean().optional(),
  search: z.string().trim().optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  sortBy: z.enum(["createdAt", "name", "sortOrder"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  description: z.string().trim().optional(),
  categoryCode: z.string().trim().min(1).max(100).default(""),
});

const createSchema = z.object({
  categoryId: z.uuid().optional(),
  parentId: z.uuid().optional(),
  code: z.string().trim().max(100).optional(),
  name: z.string().trim().max(255).optional(),
  sortOrder: z.number().int().optional(),
  status: z.boolean().optional(),
  description: z.string().trim().optional()
});

const updateSchema = z
  .object({
    categoryId: z.uuid().optional(),
    parentId: z.uuid().optional(),
    code: z.string().trim().max(100).optional(),
    name: z.string().trim().max(255).optional(),
    sortOrder: z.number().int().optional(),
    status: z.boolean().optional(),
    description: z.string().trim().optional()
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required"
  });

export const listCategoryItemsAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const { page, limit, categoryId, parentId, status, search, createdFrom, createdTo, sortBy, sortOrder, categoryCode } = parsed.data;
  const offset = (page - 1) * limit;
  let parent;
  if(categoryCode){
      parent = await db.select().from(categories).where(eq(categories.code, categoryCode)).limit(1);
  }
  let categoryIdByCode=categoryId;
  if(parent){
    categoryIdByCode = parent.at(0)?.uuid;
  }

  const conditions: SQL<unknown>[] = [];
  if (categoryIdByCode) conditions.push(eq(categoryItems.categoryId, categoryIdByCode));
  if (parentId) conditions.push(eq(categoryItems.parentId, parentId));
  if (status !== undefined) conditions.push(eq(categoryItems.status, status));
  if (search) {
    conditions.push(or(ilike(categoryItems.name, `%${search}%`), ilike(categoryItems.code, `%${search}%`)) as SQL<unknown>);
  }
  if (createdFrom) conditions.push(gte(categoryItems.createdAt, createdFrom));
  if (createdTo) conditions.push(lte(categoryItems.createdAt, createdTo));

  const whereClause = conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : and(...conditions)) : undefined;
  const [totalResult] = whereClause
    ? await db.select({ count: count() }).from(categoryItems).where(whereClause)
    : await db.select({ count: count() }).from(categoryItems);

  const sortColumn = sortBy === "name" ? categoryItems.name : sortBy === "sortOrder" ? categoryItems.sortOrder : categoryItems.createdAt;
  const orderByClause = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);
  const items = whereClause
    ? await db.select().from(categoryItems).where(whereClause).orderBy(orderByClause).limit(limit).offset(offset)
    : await db.select().from(categoryItems).orderBy(orderByClause).limit(limit).offset(offset);

  const total = totalResult?.count ?? 0;
  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      filters: {
        categoryId: categoryId || null,
        parentId: parentId || null,
        status: status ?? null,
        search: search || null,
        createdFrom: createdFrom?.toISOString() || null,
        createdTo: createdTo?.toISOString() || null,
        sortBy,
        sortOrder
      }
    },
    "Category items retrieved successfully"
  );
  res.status(response.code).send(response);
});

export const createCategoryItemAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim() || "";
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }
  const [created] = await db.insert(categoryItems).values(parsed.data).returning();
  if (!created) throw new Error("Unable to create category item");

  if (req.accountId) {
    await auditHelpers.categoryItemCreated(
      req.accountId,
      created.uuid,
      workspaceId,
      {
        categoryId: created.categoryId,
        parentId: created.parentId,
        code: created.code,
        name: created.name,
        sortOrder: created.sortOrder,
        status: created.status,
        description: created.description
      },
      req
    );
  }

  const response = apiResponse.success(HttpStatusCode.CREATED, { item: created }, "Category item created successfully");
  res.status(response.code).send(response);
});

export const getCategoryItemAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Category Item ID"));
    res.status(response.code).send(response);
    return;
  }
  if (!z.uuid().safeParse(id).success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid category item id"));
    res.status(response.code).send(response);
    return;
  }
  const [item] = await db.select().from(categoryItems).where(eq(categoryItems.uuid, id)).limit(1);
  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("Category Item"));
    res.status(response.code).send(response);
    return;
  }
  const response = apiResponse.success(HttpStatusCode.OK, { item }, "Category item retrieved successfully");
  res.status(response.code).send(response);
});

export const updateCategoryItemAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim() || "";
  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Category Item ID"));
    res.status(response.code).send(response);
    return;
  }
  if (!z.uuid().safeParse(id).success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid category item id"));
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

  const [existingCategoryItem] = await db.select().from(categoryItems).where(eq(categoryItems.uuid, id)).limit(1);
  if (!existingCategoryItem) {
    const response = apiResponse.error(HttpErrors.NotFound("Category Item"));
    res.status(response.code).send(response);
    return;
  }

  const [updated] = await db.update(categoryItems).set(updatePayload).where(eq(categoryItems.uuid, id)).returning();
  if (!updated) {
    const response = apiResponse.error(HttpErrors.NotFound("Category Item"));
    res.status(response.code).send(response);
    return;
  }

  if (req.accountId) {
    await auditHelpers.categoryItemUpdated(
      req.accountId,
      updated.uuid,
      workspaceId,
      {
        updatedFields: Object.keys(updatePayload),
        dataDetail: {
          oldData: existingCategoryItem,
          newData: req.body
        }
      },
      req
    );
  }

  const response = apiResponse.success(HttpStatusCode.OK, { item: updated }, "Category item updated successfully");
  res.status(response.code).send(response);
});

export const deleteCategoryItemAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim() || "";
  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Category Item ID"));
    res.status(response.code).send(response);
    return;
  }
  if (!z.uuid().safeParse(id).success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid category item id"));
    res.status(response.code).send(response);
    return;
  }
  const [deleted] = await db.delete(categoryItems).where(eq(categoryItems.uuid, id)).returning();
  if (!deleted) {
    const response = apiResponse.error(HttpErrors.NotFound("Category Item"));
    res.status(response.code).send(response);
    return;
  }

  if (req.accountId) {
    await auditHelpers.categoryItemDeleted(
      req.accountId,
      deleted.uuid,
      workspaceId,
      {
        categoryId: deleted.categoryId,
        parentId: deleted.parentId,
        code: deleted.code,
        name: deleted.name,
        sortOrder: deleted.sortOrder,
        status: deleted.status,
        description: deleted.description
      },
      req
    );
  }

  const response = apiResponse.success(HttpStatusCode.OK, { item: deleted }, "Category item deleted successfully");
  res.status(response.code).send(response);
});

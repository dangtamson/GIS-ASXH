import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import { permissions, rolePermissions, roles } from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import type { SQL } from "drizzle-orm";
import { and, asc, count, desc, eq, ilike, or } from "drizzle-orm";
import type { Request, Response } from "express";
import { z } from "zod";
import { sanitizeUpdatePayload } from "../shared/updatePayload.ts";

const integerIdSchema = z.coerce.number().int().positive();

const rolesListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  sortBy: z.enum(["id", "code", "name", "createdAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
});

const roleCreateSchema = z.object({
  code: z.string().trim().min(1).max(100).optional(),
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().optional()
});

const roleUpdateSchema = z
  .object({
    code: z.string().trim().min(1).max(100).optional(),
    name: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().optional()
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required"
  });

const permissionsListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  sortBy: z.enum(["id", "code", "name"]).default("id"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
});

const permissionCreateSchema = z.object({
  code: z.string().trim().min(1).max(150).optional(),
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().optional()
});

const permissionUpdateSchema = z
  .object({
    code: z.string().trim().min(1).max(150).optional(),
    name: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().optional()
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required"
  });

const rolePermissionsListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  roleId: z.coerce.number().int().positive().optional(),
  permissionId: z.coerce.number().int().positive().optional(),
  sortBy: z.enum(["roleId", "permissionId"]).default("roleId"),
  sortOrder: z.enum(["asc", "desc"]).default("asc")
});

const rolePermissionCreateSchema = z.object({
  roleId: z.coerce.number().int().positive(),
  permissionId: z.coerce.number().int().positive()
});

const rolePermissionUpdateSchema = z
  .object({
    roleId: z.coerce.number().int().positive().optional(),
    permissionId: z.coerce.number().int().positive().optional()
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required"
  });

export const listRolesAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId;

  if(!workspaceId) {
    const resp = apiResponse.error(HttpErrors.MissingParameter("workspaceId is required"));
    res.status(resp.code).send(resp);
    return;
  }

  const parsed = rolesListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }
  const { page, limit, search, sortBy, sortOrder } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions: SQL<unknown>[] = [];
  if (search) {
    conditions.push(or(ilike(roles.name, `%${search}%`), ilike(roles.code, `%${search}%`)) as SQL<unknown>);
  }
  conditions.push(eq(roles.workspaceId, workspaceId!));

  const whereClause = conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : and(...conditions)) : undefined;
  const [totalResult] = whereClause
    ? await db.select({ count: count() }).from(roles).where(whereClause)
    : await db.select({ count: count() }).from(roles);

  const sortColumn = sortBy === "id" ? roles.id : sortBy === "code" ? roles.code : sortBy === "name" ? roles.name : roles.createdAt;
  const orderByClause = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  const items = whereClause
    ? await db.select().from(roles).where(whereClause).orderBy(orderByClause).limit(limit).offset(offset)
    : await db.select().from(roles).orderBy(orderByClause).limit(limit).offset(offset);

  const total = totalResult?.count ?? 0;
  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      filters: {
        search: search || null,
        sortBy,
        sortOrder
      }
    },
    "Roles retrieved successfully"
  );
  res.status(response.code).send(response);
});

export const createRoleAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId;

  if(!workspaceId) {
    const resp = apiResponse.error(HttpErrors.MissingParameter("workspaceId is required"));
    res.status(resp.code).send(resp);
    return;
  }

  const parsed = roleCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const [created] = await db.insert(roles).values({
    ...parsed.data,
    workspaceId: workspaceId!,
  }).returning();
  if (!created) throw new Error("Unable to create role");

  const response = apiResponse.success(HttpStatusCode.CREATED, { item: created }, "Role created successfully");
  res.status(response.code).send(response);
});

export const getRoleAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsedId = integerIdSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid role id"));
    res.status(response.code).send(response);
    return;
  }

  const [item] = await db.select().from(roles).where(eq(roles.id, parsedId.data)).limit(1);
  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("Role"));
    res.status(response.code).send(response);
    return;
  }

  const response = apiResponse.success(HttpStatusCode.OK, { item }, "Role retrieved successfully");
  res.status(response.code).send(response);
});

export const updateRoleAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId;

  if (!workspaceId) {
    const resp = apiResponse.error(HttpErrors.MissingParameter("workspaceId is required"));
    res.status(resp.code).send(resp);
    return;
  }

  const parsedId = integerIdSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid role id"));
    res.status(response.code).send(response);
    return;
  }

  const parsed = roleUpdateSchema.safeParse(req.body);
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

  const [updated] = await db.update(roles).set(updatePayload).where(and(eq(roles.id, parsedId.data), eq(roles.workspaceId, workspaceId))).returning();
  if (!updated) {
    const response = apiResponse.error(HttpErrors.NotFound("Role"));
    res.status(response.code).send(response);
    return;
  }

  const response = apiResponse.success(HttpStatusCode.OK, { item: updated }, "Role updated successfully");
  res.status(response.code).send(response);
});

export const deleteRoleAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsedId = integerIdSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid role id"));
    res.status(response.code).send(response);
    return;
  }

  const [deleted] = await db.delete(roles).where(eq(roles.id, parsedId.data)).returning();
  if (!deleted) {
    const response = apiResponse.error(HttpErrors.NotFound("Role"));
    res.status(response.code).send(response);
    return;
  }

  const response = apiResponse.success(HttpStatusCode.OK, { item: deleted }, "Role deleted successfully");
  res.status(response.code).send(response);
});

export const listPermissionsAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = permissionsListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const { page, limit, search, sortBy, sortOrder } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions: SQL<unknown>[] = [];
  if (search) {
    conditions.push(or(ilike(permissions.name, `%${search}%`), ilike(permissions.code, `%${search}%`)) as SQL<unknown>);
  }

  const whereClause = conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : and(...conditions)) : undefined;
  const [totalResult] = whereClause
    ? await db.select({ count: count() }).from(permissions).where(whereClause)
    : await db.select({ count: count() }).from(permissions);

  const sortColumn = sortBy === "id" ? permissions.id : sortBy === "code" ? permissions.code : permissions.name;
  const orderByClause = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  const items = whereClause
    ? await db.select().from(permissions).where(whereClause).orderBy(orderByClause).limit(limit).offset(offset)
    : await db.select().from(permissions).orderBy(orderByClause).limit(limit).offset(offset);

  const total = totalResult?.count ?? 0;
  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      filters: {
        search: search || null,
        sortBy,
        sortOrder
      }
    },
    "Permissions retrieved successfully"
  );
  res.status(response.code).send(response);
});

export const createPermissionAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = permissionCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const [created] = await db.insert(permissions).values(parsed.data).returning();
  if (!created) throw new Error("Unable to create permission");

  const response = apiResponse.success(HttpStatusCode.CREATED, { item: created }, "Permission created successfully");
  res.status(response.code).send(response);
});

export const getPermissionAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsedId = integerIdSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid permission id"));
    res.status(response.code).send(response);
    return;
  }

  const [item] = await db.select().from(permissions).where(eq(permissions.id, parsedId.data)).limit(1);
  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("Permission"));
    res.status(response.code).send(response);
    return;
  }

  const response = apiResponse.success(HttpStatusCode.OK, { item }, "Permission retrieved successfully");
  res.status(response.code).send(response);
});

export const updatePermissionAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsedId = integerIdSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid permission id"));
    res.status(response.code).send(response);
    return;
  }

  const parsed = permissionUpdateSchema.safeParse(req.body);
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

  const [updated] = await db.update(permissions).set(updatePayload).where(eq(permissions.id, parsedId.data)).returning();
  if (!updated) {
    const response = apiResponse.error(HttpErrors.NotFound("Permission"));
    res.status(response.code).send(response);
    return;
  }

  const response = apiResponse.success(HttpStatusCode.OK, { item: updated }, "Permission updated successfully");
  res.status(response.code).send(response);
});

export const deletePermissionAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsedId = integerIdSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid permission id"));
    res.status(response.code).send(response);
    return;
  }

  const [deleted] = await db.delete(permissions).where(eq(permissions.id, parsedId.data)).returning();
  if (!deleted) {
    const response = apiResponse.error(HttpErrors.NotFound("Permission"));
    res.status(response.code).send(response);
    return;
  }

  const response = apiResponse.success(HttpStatusCode.OK, { item: deleted }, "Permission deleted successfully");
  res.status(response.code).send(response);
});

export const listRolePermissionsAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = rolePermissionsListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const { page, limit, roleId, permissionId, sortBy, sortOrder } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions: SQL<unknown>[] = [];
  if (roleId) conditions.push(eq(rolePermissions.roleId, roleId));
  if (permissionId) conditions.push(eq(rolePermissions.permissionId, permissionId));

  const whereClause = conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : and(...conditions)) : undefined;
  const [totalResult] = whereClause
    ? await db.select({ count: count() }).from(rolePermissions).where(whereClause)
    : await db.select({ count: count() }).from(rolePermissions);

  const sortColumn = sortBy === "permissionId" ? rolePermissions.permissionId : rolePermissions.roleId;
  const orderByClause = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  const items = whereClause
    ? await db.select().from(rolePermissions).where(whereClause).orderBy(orderByClause).limit(limit).offset(offset)
    : await db.select().from(rolePermissions).orderBy(orderByClause).limit(limit).offset(offset);

  const total = totalResult?.count ?? 0;
  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      filters: {
        roleId: roleId ?? null,
        permissionId: permissionId ?? null,
        sortBy,
        sortOrder
      }
    },
    "Role permissions retrieved successfully"
  );
  res.status(response.code).send(response);
});

export const createRolePermissionAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = rolePermissionCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const [created] = await db.insert(rolePermissions).values(parsed.data).returning();
  if (!created) throw new Error("Unable to create role permission");

  const response = apiResponse.success(HttpStatusCode.CREATED, { item: created }, "Role permission created successfully");
  res.status(response.code).send(response);
});

export const getRolePermissionAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsedRoleId = integerIdSchema.safeParse(req.params.roleId);
  const parsedPermissionId = integerIdSchema.safeParse(req.params.permissionId);

  if (!parsedRoleId.success || !parsedPermissionId.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid roleId or permissionId"));
    res.status(response.code).send(response);
    return;
  }

  const [item] = await db
    .select()
    .from(rolePermissions)
    .where(and(eq(rolePermissions.roleId, parsedRoleId.data), eq(rolePermissions.permissionId, parsedPermissionId.data)))
    .limit(1);

  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("Role permission"));
    res.status(response.code).send(response);
    return;
  }

  const response = apiResponse.success(HttpStatusCode.OK, { item }, "Role permission retrieved successfully");
  res.status(response.code).send(response);
});

export const updateRolePermissionAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsedRoleId = integerIdSchema.safeParse(req.params.roleId);
  const parsedPermissionId = integerIdSchema.safeParse(req.params.permissionId);

  if (!parsedRoleId.success || !parsedPermissionId.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid roleId or permissionId"));
    res.status(response.code).send(response);
    return;
  }

  const parsed = rolePermissionUpdateSchema.safeParse(req.body);
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

  const [updated] = await db
    .update(rolePermissions)
    .set(updatePayload)
    .where(and(eq(rolePermissions.roleId, parsedRoleId.data), eq(rolePermissions.permissionId, parsedPermissionId.data)))
    .returning();

  if (!updated) {
    const response = apiResponse.error(HttpErrors.NotFound("Role permission"));
    res.status(response.code).send(response);
    return;
  }

  const response = apiResponse.success(HttpStatusCode.OK, { item: updated }, "Role permission updated successfully");
  res.status(response.code).send(response);
});

export const deleteRolePermissionAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsedRoleId = integerIdSchema.safeParse(req.params.roleId);
  const parsedPermissionId = integerIdSchema.safeParse(req.params.permissionId);

  if (!parsedRoleId.success || !parsedPermissionId.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid roleId or permissionId"));
    res.status(response.code).send(response);
    return;
  }

  const [deleted] = await db
    .delete(rolePermissions)
    .where(and(eq(rolePermissions.roleId, parsedRoleId.data), eq(rolePermissions.permissionId, parsedPermissionId.data)))
    .returning();

  if (!deleted) {
    const response = apiResponse.error(HttpErrors.NotFound("Role permission"));
    res.status(response.code).send(response);
    return;
  }

  const response = apiResponse.success(HttpStatusCode.OK, { item: deleted }, "Role permission deleted successfully");
  res.status(response.code).send(response);
});
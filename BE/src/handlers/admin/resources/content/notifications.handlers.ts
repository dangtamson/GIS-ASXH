import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import { notifications, userNotifications } from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import type { SQL } from "drizzle-orm";
import { and, asc, count, desc, eq, gte, ilike, lte, or } from "drizzle-orm";
import type { Request, Response } from "express";
import { z } from "zod";
import { sanitizeUpdatePayload } from "../shared/updatePayload.ts";

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  onlyMine: z
    .preprocess((value) => {
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (["true", "1", "yes"].includes(normalized)) {
          return true;
        }
        if (["false", "0", "no"].includes(normalized)) {
          return false;
        }
      }
      return undefined;
    }, z.boolean())
    .optional()
    .default(false),
  isRead: z
    .preprocess((value) => {
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (["true", "1", "yes"].includes(normalized)) {
          return true;
        }
        if (["false", "0", "no"].includes(normalized)) {
          return false;
        }
      }
      return undefined;
    }, z.boolean())
    .optional(),
  type: z.string().trim().optional(),
  status: z.string().trim().optional(),
  search: z.string().trim().optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  sortBy: z.enum(["created_at", "title"]).default("created_at"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
});

const createSchema = z.object({
  title: z.string().trim().optional(),
  message: z.string().trim().optional(),
  type: z.string().trim().optional(),
  status: z.string().trim().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

const updateSchema = z
  .object({
    title: z.string().trim().optional(),
    message: z.string().trim().optional(),
    type: z.string().trim().optional(),
    status: z.string().trim().optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required"
  });

export const listNotificationsAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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

  const { page, limit, onlyMine, isRead, type, status, search, createdFrom, createdTo, sortBy, sortOrder } = parsed.data;
  const accountId = req.accountId;
  const offset = (page - 1) * limit;

  const conditions: SQL<unknown>[] = [eq(notifications.workspaceId, workspaceId)];
  if (onlyMine) {
    if (!accountId) {
      const response = apiResponse.error(HttpErrors.Unauthorized("User not authenticated"));
      res.status(response.code).send(response);
      return;
    }

    conditions.push(eq(userNotifications.userId, accountId));

    if (typeof isRead === "boolean") {
      conditions.push(eq(userNotifications.isRead, isRead));
    }
  }
  if (type) conditions.push(eq(notifications.type, type));
  if (status) conditions.push(eq(notifications.status, status));
  if (search) {
    conditions.push(or(ilike(notifications.title, `%${search}%`), ilike(notifications.message, `%${search}%`)) as SQL<unknown>);
  }
  if (createdFrom) conditions.push(gte(notifications.created_at, createdFrom));
  if (createdTo) conditions.push(lte(notifications.created_at, createdTo));

  const whereClause = conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : and(...conditions)) : undefined;
  const sortColumn = sortBy === "title" ? notifications.title : notifications.created_at;
  const orderByClause = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  let total = 0;
  let items: unknown[] = [];

  if (onlyMine) {
    const [totalResult] = whereClause
      ? await db
        .select({ count: count() })
        .from(userNotifications)
        .innerJoin(notifications, eq(userNotifications.notificationId, notifications.uuid))
        .where(whereClause)
      : await db
        .select({ count: count() })
        .from(userNotifications)
        .innerJoin(notifications, eq(userNotifications.notificationId, notifications.uuid));

    const query = db
      .select({
        uuid: notifications.uuid,
        workspaceId: notifications.workspaceId,
        title: notifications.title,
        message: notifications.message,
        created_at: notifications.created_at,
        type: notifications.type,
        status: notifications.status,
        metadata: notifications.metadata,
        userNotificationId: userNotifications.uuid,
        isRead: userNotifications.isRead,
        readAt: userNotifications.readAt,
        deliveredAt: userNotifications.createdAt
      })
      .from(userNotifications)
      .innerJoin(notifications, eq(userNotifications.notificationId, notifications.uuid));

    items = whereClause
      ? await query.where(whereClause).orderBy(orderByClause).limit(limit).offset(offset)
      : await query.orderBy(orderByClause).limit(limit).offset(offset);

    total = totalResult?.count ?? 0;
  } else {
    const [totalResult] = whereClause
      ? await db.select({ count: count() }).from(notifications).where(whereClause)
      : await db.select({ count: count() }).from(notifications);

    items = whereClause
      ? await db.select().from(notifications).where(whereClause).orderBy(orderByClause).limit(limit).offset(offset)
      : await db.select().from(notifications).orderBy(orderByClause).limit(limit).offset(offset);

    total = totalResult?.count ?? 0;
  }

  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      filters: {
        workspaceId,
        onlyMine,
        isRead: typeof isRead === "boolean" ? isRead : null,
        type: type || null,
        status: status || null,
        search: search || null,
        createdFrom: createdFrom?.toISOString() || null,
        createdTo: createdTo?.toISOString() || null,
        sortBy,
        sortOrder
      }
    },
    "Notifications retrieved successfully"
  );
  res.status(response.code).send(response);
});

export const createNotificationAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
    .insert(notifications)
    .values({
      ...parsed.data,
      workspaceId
    })
    .returning();
  if (!created) throw new Error("Unable to create notification");

  const response = apiResponse.success(HttpStatusCode.CREATED, { item: created }, "Notification created successfully");
  res.status(response.code).send(response);
});

export const getNotificationAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Notification ID"));
    res.status(response.code).send(response);
    return;
  }
  if (!z.uuid().safeParse(id).success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid notification id"));
    res.status(response.code).send(response);
    return;
  }

  const [item] = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.uuid, id), eq(notifications.workspaceId, workspaceId)))
    .limit(1);
  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("Notification"));
    res.status(response.code).send(response);
    return;
  }

  const response = apiResponse.success(HttpStatusCode.OK, { item }, "Notification retrieved successfully");
  res.status(response.code).send(response);
});

export const updateNotificationAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Notification ID"));
    res.status(response.code).send(response);
    return;
  }
  if (!z.uuid().safeParse(id).success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid notification id"));
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

  const [updated] = await db
    .update(notifications)
    .set(updatePayload)
    .where(and(eq(notifications.uuid, id), eq(notifications.workspaceId, workspaceId)))
    .returning();
  if (!updated) {
    const response = apiResponse.error(HttpErrors.NotFound("Notification"));
    res.status(response.code).send(response);
    return;
  }

  const response = apiResponse.success(HttpStatusCode.OK, { item: updated }, "Notification updated successfully");
  res.status(response.code).send(response);
});

export const deleteNotificationAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Notification ID"));
    res.status(response.code).send(response);
    return;
  }
  if (!z.uuid().safeParse(id).success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid notification id"));
    res.status(response.code).send(response);
    return;
  }

  const [deleted] = await db
    .delete(notifications)
    .where(and(eq(notifications.uuid, id), eq(notifications.workspaceId, workspaceId)))
    .returning();
  if (!deleted) {
    const response = apiResponse.error(HttpErrors.NotFound("Notification"));
    res.status(response.code).send(response);
    return;
  }

  const response = apiResponse.success(HttpStatusCode.OK, { item: deleted }, "Notification deleted successfully");
  res.status(response.code).send(response);
});

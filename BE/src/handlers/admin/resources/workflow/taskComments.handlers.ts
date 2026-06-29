import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import { accounts, taskComments } from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import { AUDIT_ACTIONS, ENTITY_TYPES, createAuditLog } from "@/services/auditLog.ts";
import { inArray, type SQL } from "drizzle-orm";
import { and, asc, count, desc, eq, gte, ilike, lte } from "drizzle-orm";
import type { Request, Response } from "express";
import { z } from "zod";
import { sanitizeUpdatePayload } from "../shared/updatePayload.ts";

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  taskId: z.uuid().optional(),
  accountId: z.uuid().optional(),
  search: z.string().trim().optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  sortBy: z.enum(["createdAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
});

const createSchema = z.object({
  taskId: z.uuid().optional(),
  content: z.string().trim().optional()
});

const updateSchema = z
  .object({
    content: z.string().trim().optional()
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required"
  });

function resolveAuditActorId(req: Request): string {
  return String(req.accountId);
}

async function logTaskCommentAudit(params: {
  req: Request;
  action: string;
  commentId: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await createAuditLog(
    {
      action: params.action,
      entityType: ENTITY_TYPES.TASK_COMMENT,
      entityId: params.commentId,
      actorId: resolveAuditActorId(params.req),
      workspaceId: params.req.workspaceId?.trim(),
      details: params.details
    },
    params.req
  );
}

export const listTaskCommentsAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }
  const { page, limit, taskId, accountId, search, createdFrom, createdTo, sortOrder } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions: SQL<unknown>[] = [];
  if (taskId) conditions.push(eq(taskComments.taskId, taskId));
  if (accountId) conditions.push(eq(taskComments.accountId, accountId));
  if (search) conditions.push(ilike(taskComments.content, `%${search}%`));
  if (createdFrom) conditions.push(gte(taskComments.createdAt, createdFrom));
  if (createdTo) conditions.push(lte(taskComments.createdAt, createdTo));

  const whereClause = conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : and(...conditions)) : undefined;
  const [totalResult] = whereClause
    ? await db.select({ count: count() }).from(taskComments).where(whereClause)
    : await db.select({ count: count() }).from(taskComments);

  const orderByClause = sortOrder === "asc" ? asc(taskComments.createdAt) : desc(taskComments.createdAt);
  const items = whereClause
    ? await db.select().from(taskComments).where(whereClause).orderBy(orderByClause).limit(limit).offset(offset)
    : await db.select().from(taskComments).orderBy(orderByClause).limit(limit).offset(offset);
  
  const accountIds = items.map((i) => i.accountId).filter((uuid) => uuid != null);

  const accountItems = await db.select({uuid:accounts.uuid, fullName: accounts.fullName})
    .from(accounts).where(and(inArray(accounts.uuid, accountIds), eq(accounts.status, 'active')));

  const accountMap = Object.fromEntries(accountItems.map((acc) => [acc.uuid, acc]));
  const result = items
    .filter((item) => item.taskId != null)
    .map((item) => ({
      ...item,
      account: item.accountId ? accountMap[item.accountId] : undefined
    }));
  const total = totalResult?.count ?? 0;
  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      items: result,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      filters: {
        taskId: taskId || null,
        accountId: accountId || null,
        search: search || null,
        createdFrom: createdFrom?.toISOString() || null,
        createdTo: createdTo?.toISOString() || null,
        sortBy: "createdAt",
        sortOrder
      }
    },
    "Task comments retrieved successfully"
  );
  res.status(response.code).send(response);
});

export const createTaskCommentAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }
  const [created] = await db.insert(taskComments).values({
    ...parsed.data,
    accountId: req.accountId
  }).returning();
  if (!created) throw new Error("Unable to create task comment");

  await logTaskCommentAudit({
    req,
    action: AUDIT_ACTIONS.TASK_COMMENT_ADDED,
    commentId: created.uuid,
    details: {
      oldComment: null,
      newComment: created
    }
  });

  const response = apiResponse.success(HttpStatusCode.CREATED, { item: created }, "Task comment created successfully");
  res.status(response.code).send(response);
});

export const getTaskCommentAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Task Comment ID"));
    res.status(response.code).send(response);
    return;
  }
  if (!z.uuid().safeParse(id).success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid task comment id"));
    res.status(response.code).send(response);
    return;
  }
  const [item] = await db.select().from(taskComments).where(eq(taskComments.uuid, id)).limit(1);
  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("Task Comment"));
    res.status(response.code).send(response);
    return;
  }
  const response = apiResponse.success(HttpStatusCode.OK, { item }, "Task comment retrieved successfully");
  res.status(response.code).send(response);
});

export const updateTaskCommentAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Task Comment ID"));
    res.status(response.code).send(response);
    return;
  }
  if (!z.uuid().safeParse(id).success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid task comment id"));
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

  const [updated] = await db.update(taskComments).set(updatePayload).where(eq(taskComments.uuid, id)).returning();
  if (!updated) {
    const response = apiResponse.error(HttpErrors.NotFound("Task Comment"));
    res.status(response.code).send(response);
    return;
  }
  const response = apiResponse.success(HttpStatusCode.OK, { item: updated }, "Task comment updated successfully");
  res.status(response.code).send(response);
});

export const deleteTaskCommentAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Task Comment ID"));
    res.status(response.code).send(response);
    return;
  }
  if (!z.uuid().safeParse(id).success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid task comment id"));
    res.status(response.code).send(response);
    return;
  }
  const [existingComment] = await db.select().from(taskComments).where(eq(taskComments.uuid, id)).limit(1);
  const [deleted] = await db.delete(taskComments).where(eq(taskComments.uuid, id)).returning();
  if (!deleted) {
    const response = apiResponse.error(HttpErrors.NotFound("Task Comment"));
    res.status(response.code).send(response);
    return;
  }

  await logTaskCommentAudit({
    req,
    action: AUDIT_ACTIONS.TASK_COMMENT_DELETED,
    commentId: deleted.uuid,
    details: {
      oldComment: existingComment ?? deleted,
      newComment: null
    }
  });

  const response = apiResponse.success(HttpStatusCode.OK, { item: deleted }, "Task comment deleted successfully");
  res.status(response.code).send(response);
});

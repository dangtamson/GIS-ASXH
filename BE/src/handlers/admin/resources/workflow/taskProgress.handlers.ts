import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import { taskProgress, workspaceMemberships } from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import { AUDIT_ACTIONS, ENTITY_TYPES, createAuditLog } from "@/services/auditLog.ts";
import type { SQL } from "drizzle-orm";
import { and, asc, count, desc, eq, gte, lte, max } from "drizzle-orm";
import type { Request, Response } from "express";
import { z } from "zod";
import { sanitizeUpdatePayload } from "../shared/updatePayload.ts";

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  taskId: z.uuid().optional(),
  updatedBy: z.uuid().optional(),
  progressMin: z.coerce.number().int().min(0).max(100).optional(),
  progressMax: z.coerce.number().int().min(0).max(100).optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  sortBy: z.enum(["createdAt", "progressPercent"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  groupBy: z.enum(['organization', 'groupBy', '']).optional(),
});

const createSchema = z.object({
  taskId: z.uuid().optional(),
  progressPercent: z.number().int().min(0).max(100).optional(),
  comment: z.string().trim().optional(),
  updatedBy: z.uuid().optional()
});

const updateSchema = z
  .object({
    progressPercent: z.number().int().min(0).max(100).optional(),
    comment: z.string().trim().optional()
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required"
  });

function resolveAuditActorId(req: Request): string {
  return String(req.accountId);
}

async function logTaskProgressAudit(params: {
  req: Request;
  progressId: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await createAuditLog(
    {
      action: AUDIT_ACTIONS.TASK_PROGRESS_UPDATED,
      entityType: ENTITY_TYPES.TASK_PROGRESS,
      entityId: params.progressId,
      actorId: resolveAuditActorId(params.req),
      workspaceId: params.req.workspaceId?.trim(),
      details: params.details
    },
    params.req
  );
}

export const listTaskProgressAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }


  const { page, limit, taskId, updatedBy, progressMin, progressMax, createdFrom, createdTo, sortBy, sortOrder, groupBy } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions: SQL<unknown>[] = [];
  if (taskId) conditions.push(eq(taskProgress.taskId, taskId));
  if (updatedBy) conditions.push(eq(taskProgress.updatedBy, updatedBy));
  if (progressMin !== undefined) conditions.push(gte(taskProgress.progressPercent, progressMin));
  if (progressMax !== undefined) conditions.push(lte(taskProgress.progressPercent, progressMax));
  if (createdFrom) conditions.push(gte(taskProgress.createdAt, createdFrom));
  if (createdTo) conditions.push(lte(taskProgress.createdAt, createdTo));

  const whereClause = conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : and(...conditions)) : undefined;
  let total = 0;

  if (!groupBy) {
    const [totalResult] = whereClause
      ? await db.select({ count: count() }).from(taskProgress).where(whereClause)
      : await db.select({ count: count() }).from(taskProgress);

    total = totalResult?.count ?? 0;
  } else if (groupBy === "organization") {
    const groups = whereClause
      ? await db
          .select({
            organizationId: taskProgress.updatedBy
          })
          .from(taskProgress)
          .where(whereClause)
          .groupBy(taskProgress.updatedBy)
      : await db
          .select({
            organizationId: taskProgress.updatedBy
          })
          .from(taskProgress)
          .groupBy(taskProgress.updatedBy);

    total = groups.length;
  }

  const sortColumn = sortBy === "progressPercent" ? taskProgress.progressPercent : taskProgress.createdAt;
  const orderByClause = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);
  let items;

  if (!groupBy) {
    items = whereClause
      ? await db.select().from(taskProgress).where(whereClause).orderBy(orderByClause).limit(limit).offset(offset)
      : await db.select().from(taskProgress).orderBy(orderByClause).limit(limit).offset(offset);
  } else if (groupBy === "organization") {
    const baseQuery = db
      .select({
        organizationId: taskProgress.organizationId,
        progressPercent: max(taskProgress.progressPercent)
      })
      .from(taskProgress)
        .groupBy(taskProgress.organizationId)
        .orderBy(desc(max(taskProgress.progressPercent)));

    items = whereClause ? await baseQuery.where(whereClause) : await baseQuery;
  }

  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      filters: {
        taskId: taskId || null,
        updatedBy: updatedBy || null,
        progressMin: progressMin ?? null,
        progressMax: progressMax ?? null,
        createdFrom: createdFrom?.toISOString() || null,
        createdTo: createdTo?.toISOString() || null,
        sortBy,
        sortOrder
      }
    },
    "Task progress records retrieved successfully"
  );
  res.status(response.code).send(response);
});

export const createTaskProgressAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = createSchema.safeParse(req.body);
  const accountId = req.accountId;
  const workspaceId = req.workspaceId;
  let organizationId;

  if (accountId && workspaceId) {
    const [membership] = await db
      .select({
        organizationId: workspaceMemberships.organizationId
      })
      .from(workspaceMemberships)
      .where(and(eq(workspaceMemberships.workspaceId, workspaceId), eq(workspaceMemberships.accountId, accountId)))
      .limit(1);

    organizationId = membership?.organizationId;
  }
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }
  const [created] = await db
    .insert(taskProgress)
    .values({
      ...parsed.data,
      organizationId: organizationId || null,
    })
    .returning();
  if (!created) throw new Error("Unable to create task progress");

  await logTaskProgressAudit({
    req,
    progressId: created.uuid,
    details: {
      oldProgress: null,
      newProgress: created
    }
  });

  const response = apiResponse.success(HttpStatusCode.CREATED, { item: created }, "Task progress created successfully");
  res.status(response.code).send(response);
});

export const getTaskProgressAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Task Progress ID"));
    res.status(response.code).send(response);
    return;
  }
  if (!z.uuid().safeParse(id).success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid task progress id"));
    res.status(response.code).send(response);
    return;
  }
  const [item] = await db.select().from(taskProgress).where(eq(taskProgress.uuid, id)).limit(1);
  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("Task Progress"));
    res.status(response.code).send(response);
    return;
  }
  const response = apiResponse.success(HttpStatusCode.OK, { item }, "Task progress retrieved successfully");
  res.status(response.code).send(response);
});

export const updateTaskProgressAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Task Progress ID"));
    res.status(response.code).send(response);
    return;
  }
  if (!z.uuid().safeParse(id).success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid task progress id"));
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

  const [existingProgress] = await db.select().from(taskProgress).where(eq(taskProgress.uuid, id)).limit(1);
  const [updated] = await db.update(taskProgress).set(updatePayload).where(eq(taskProgress.uuid, id)).returning();
  if (!updated) {
    const response = apiResponse.error(HttpErrors.NotFound("Task Progress"));
    res.status(response.code).send(response);
    return;
  }

  await logTaskProgressAudit({
    req,
    progressId: updated.uuid,
    details: {
      oldProgress: existingProgress ?? null,
      newProgress: updated,
      updatePayload
    }
  });

  const response = apiResponse.success(HttpStatusCode.OK, { item: updated }, "Task progress updated successfully");
  res.status(response.code).send(response);
});

export const deleteTaskProgressAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Task Progress ID"));
    res.status(response.code).send(response);
    return;
  }
  if (!z.uuid().safeParse(id).success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid task progress id"));
    res.status(response.code).send(response);
    return;
  }
  const [existingProgress] = await db.select().from(taskProgress).where(eq(taskProgress.uuid, id)).limit(1);
  const [deleted] = await db.delete(taskProgress).where(eq(taskProgress.uuid, id)).returning();
  if (!deleted) {
    const response = apiResponse.error(HttpErrors.NotFound("Task Progress"));
    res.status(response.code).send(response);
    return;
  }

  await logTaskProgressAudit({
    req,
    progressId: deleted.uuid,
    details: {
      oldProgress: existingProgress ?? deleted,
      newProgress: null
    }
  });

  const response = apiResponse.success(HttpStatusCode.OK, { item: deleted }, "Task progress deleted successfully");
  res.status(response.code).send(response);
});

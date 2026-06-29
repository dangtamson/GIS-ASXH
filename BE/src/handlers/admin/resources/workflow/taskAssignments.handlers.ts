import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import { taskAssignments } from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import { AUDIT_ACTIONS, ENTITY_TYPES, createAuditLog } from "@/services/auditLog.ts";
import type { SQL } from "drizzle-orm";
import { and, asc, count, desc, eq, gte, lte } from "drizzle-orm";
import type { Request, Response } from "express";
import { z } from "zod";
import { sanitizeUpdatePayload } from "../shared/updatePayload.ts";

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  taskId: z.uuid().optional(),
  assignedToAccountId: z.uuid().optional(),
  assignedToOrgId: z.uuid().optional(),
  assignedBy: z.uuid().optional(),
  statusId: z.uuid().optional(),
  assignedFrom: z.coerce.date().optional(),
  assignedTo: z.coerce.date().optional(),
  sortBy: z.enum(["assignedAt"]).default("assignedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
});

const createSchema = z.object({
  taskId: z.uuid().optional(),
  assignedToAccountId: z.uuid().optional(),
  assignedToOrgId: z.uuid().optional(),
  assignedBy: z.uuid().optional(),
  assignedAt: z.coerce.date().optional(),
  statusId: z.uuid().optional(),
  isCoordination: z.boolean().optional(),
  dueDate: z.string().date().optional(),
});

const updateSchema = z
  .object({
    assignedToAccountId: z.uuid().optional(),
    assignedToOrgId: z.uuid().optional(),
    assignedAt: z.coerce.date().optional(),
    statusId: z.uuid().optional(),
    isCoordination: z.boolean().optional(),
    dueDate: z.string().date().optional()
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required"
  });

function resolveAuditActorId(req: Request): string {
  return String(req.accountId);
}

async function logTaskAssignmentAudit(params: {
  req: Request;
  action: string;
  assignmentId: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await createAuditLog(
    {
      action: params.action,
      entityType: ENTITY_TYPES.TASK_ASSIGNMENT,
      entityId: params.assignmentId,
      actorId: resolveAuditActorId(params.req),
      workspaceId: params.req.workspaceId?.trim(),
      details: params.details
    },
    params.req
  );
}

export const listTaskAssignmentsAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const {
    page,
    limit,
    taskId,
    assignedToAccountId,
    assignedToOrgId,
    assignedBy,
    statusId,
    assignedFrom,
    assignedTo,
    sortOrder
  } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions: SQL<unknown>[] = [];
  if (taskId) conditions.push(eq(taskAssignments.taskId, taskId));
  if (assignedToAccountId) conditions.push(eq(taskAssignments.assignedToAccountId, assignedToAccountId));
  if (assignedToOrgId) conditions.push(eq(taskAssignments.assignedToOrgId, assignedToOrgId));
  if (assignedBy) conditions.push(eq(taskAssignments.assignedBy, assignedBy));
  if (statusId) conditions.push(eq(taskAssignments.statusId, statusId));
  if (assignedFrom) conditions.push(gte(taskAssignments.assignedAt, assignedFrom));
  if (assignedTo) conditions.push(lte(taskAssignments.assignedAt, assignedTo));

  const whereClause = conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : and(...conditions)) : undefined;
  const [totalResult] = whereClause
    ? await db.select({ count: count() }).from(taskAssignments).where(whereClause)
    : await db.select({ count: count() }).from(taskAssignments);

  const orderByClause = sortOrder === "asc" ? asc(taskAssignments.assignedAt) : desc(taskAssignments.assignedAt);
  const items = whereClause
    ? await db.select().from(taskAssignments).where(whereClause).orderBy(orderByClause).limit(limit).offset(offset)
    : await db.select().from(taskAssignments).orderBy(orderByClause).limit(limit).offset(offset);

  const total = totalResult?.count ?? 0;
  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      filters: {
        taskId: taskId || null,
        assignedToAccountId: assignedToAccountId || null,
        assignedToOrgId: assignedToOrgId || null,
        assignedBy: assignedBy || null,
        statusId: statusId || null,
        assignedFrom: assignedFrom?.toISOString() || null,
        assignedTo: assignedTo?.toISOString() || null,
        sortBy: "assignedAt",
        sortOrder
      }
    },
    "Task assignments retrieved successfully"
  );
  res.status(response.code).send(response);
});

export const createTaskAssignmentAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = createSchema.safeParse(req.body);

  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const [created] = await db.insert(taskAssignments).values(parsed.data).returning();
  if (!created) throw new Error("Unable to create task assignment");

  await logTaskAssignmentAudit({
    req,
    action: AUDIT_ACTIONS.TASK_ASSIGNED,
    assignmentId: created.uuid,
    details: {
      oldAssignment: null,
      newAssignment: created
    }
  });

  const response = apiResponse.success(
    HttpStatusCode.CREATED,
    { item: created },
    "Task assignment created successfully"
  );
  res.status(response.code).send(response);
});

export const getTaskAssignmentAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Task Assignment ID"));
    res.status(response.code).send(response);
    return;
  }
  if (!z.uuid().safeParse(id).success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid task assignment id"));
    res.status(response.code).send(response);
    return;
  }
  const [item] = await db.select().from(taskAssignments).where(eq(taskAssignments.uuid, id)).limit(1);
  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("Task Assignment"));
    res.status(response.code).send(response);
    return;
  }
  const response = apiResponse.success(HttpStatusCode.OK, { item }, "Task assignment retrieved successfully");
  res.status(response.code).send(response);
});

export const updateTaskAssignmentAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Task Assignment ID"));
    res.status(response.code).send(response);
    return;
  }
  if (!z.uuid().safeParse(id).success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid task assignment id"));
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

  const [existingAssignment] = await db.select().from(taskAssignments).where(eq(taskAssignments.uuid, id)).limit(1);
  const [updated] = await db.update(taskAssignments).set(updatePayload).where(eq(taskAssignments.uuid, id)).returning();
  if (!updated) {
    const response = apiResponse.error(HttpErrors.NotFound("Task Assignment"));
    res.status(response.code).send(response);
    return;
  }

  await logTaskAssignmentAudit({
    req,
    action: AUDIT_ACTIONS.TASK_ASSIGNED,
    assignmentId: updated.uuid,
    details: {
      oldAssignment: existingAssignment ?? null,
      newAssignment: updated,
      updatePayload
    }
  });

  const response = apiResponse.success(HttpStatusCode.OK, { item: updated }, "Task assignment updated successfully");
  res.status(response.code).send(response);
});

export const deleteTaskAssignmentAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Task Assignment ID"));
    res.status(response.code).send(response);
    return;
  }
  if (!z.uuid().safeParse(id).success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid task assignment id"));
    res.status(response.code).send(response);
    return;
  }
  const [existingAssignment] = await db.select().from(taskAssignments).where(eq(taskAssignments.uuid, id)).limit(1);
  const [deleted] = await db.delete(taskAssignments).where(eq(taskAssignments.uuid, id)).returning();
  if (!deleted) {
    const response = apiResponse.error(HttpErrors.NotFound("Task Assignment"));
    res.status(response.code).send(response);
    return;
  }

  await logTaskAssignmentAudit({
    req,
    action: AUDIT_ACTIONS.TASK_UNASSIGNED,
    assignmentId: deleted.uuid,
    details: {
      oldAssignment: existingAssignment ?? deleted,
      newAssignment: null
    }
  });

  const response = apiResponse.success(HttpStatusCode.OK, { item: deleted }, "Task assignment deleted successfully");
  res.status(response.code).send(response);
});

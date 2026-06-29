import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import {
  taskAssignmentProgress,
  files,
  workspaceMemberships,
  organizations,
  taskAssignments,
  tasks,
  accounts
} from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import { AUDIT_ACTIONS, ENTITY_TYPES, createAuditLog } from "@/services/auditLog.ts";
import { inArray, isNull, sql, type SQL } from "drizzle-orm";
import { and, asc, count, desc, eq, gte, lte, max } from "drizzle-orm";
import type { Request, Response } from "express";
import { z } from "zod";
import { sanitizeUpdatePayload } from "../shared/updatePayload.ts";
import {
  fileAttachmentSchema, getFilesForEntities,
  getFilesForEntity,
  removeFilesForEntity,
  uploadFilesForEntity
} from "@/handlers/admin/resources/shared/fileAttachments.ts";
import { randomUUID } from "crypto";

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
  groupBy: z.enum(["organization", "groupBy", ""]).optional(),
  taskAssignmentId: z.uuid().optional(),

});

const createSchema = z.object({
  taskAssignmentId: z.uuid().optional(),
  progressPercent: z.number().int().min(0).max(100).optional(),
  comment: z.string().trim().optional(),
  attachments: z.array(fileAttachmentSchema).max(20).optional(),
});

const updateSchema = z
  .object({
    progressPercent: z.number().int().min(0).max(100).optional(),
    comment: z.string().trim().optional(),
    attachments: z.array(fileAttachmentSchema).max(20).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required"
  });

function resolveAuditActorId(req: Request): string {
  return String(req.accountId);
}

async function logTaskAssignmentProgressAudit(params: {
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

async function ensureAssignmentProgressIsEditable(taskAssignmentId?: string): Promise<Error | null> {
  if (!taskAssignmentId) {
    return HttpErrors.ValidationFailed("Thiếu đơn vị được giao.");
  }

  const [assignment] = await db
    .select()
    .from(taskAssignments)
    .where(eq(taskAssignments.uuid, taskAssignmentId))
    .limit(1);

  if (!assignment) {
    return HttpErrors.NotFound("Task Assignment");
  }

  if (["pending", "approved", "rejected"].includes(assignment.status ?? "")) {
    return HttpErrors.ValidationFailed("Nhiệm vụ đã kết thúc quy trình đánh giá, không thể cập nhật nhật ký.");
  }

  return null;
}

export const listTaskAssignmentProgressAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }


  const { page, limit, taskAssignmentId, updatedBy, progressMin, progressMax, createdFrom, createdTo, sortBy, sortOrder, groupBy, taskId } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions: SQL<unknown>[] = [];
  if (taskAssignmentId) conditions.push(eq(taskAssignmentProgress.taskAssignmentId, taskAssignmentId));
  if (updatedBy) conditions.push(eq(taskAssignmentProgress.updatedBy, updatedBy));
  if (progressMin !== undefined) conditions.push(gte(taskAssignmentProgress.progressPercent, progressMin));
  if (progressMax !== undefined) conditions.push(lte(taskAssignmentProgress.progressPercent, progressMax));
  if (createdFrom) conditions.push(gte(taskAssignmentProgress.createdAt, createdFrom));
  if (createdTo) conditions.push(lte(taskAssignmentProgress.createdAt, createdTo));

  if (taskId) {
    const assignmentIds = await db
      .select({ uuid: taskAssignments.uuid })
      .from(taskAssignments)
      .where(eq(taskAssignments.taskId, taskId));

    conditions.push(
      inArray(
        taskAssignmentProgress.taskAssignmentId,
        assignmentIds.map((i) => i.uuid)
      )
    );
  }

  const whereClause = conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : and(...conditions)) : undefined;
  let total = 0;

  if (!groupBy) {
    const [totalResult] = whereClause
      ? await db.select({ count: count() }).from(taskAssignmentProgress).where(whereClause)
      : await db.select({ count: count() }).from(taskAssignmentProgress);

    total = totalResult?.count ?? 0;
  } else if (groupBy === "organization") {
    const groups = whereClause
      ? await db
          .select({
            organizationId: taskAssignmentProgress.updatedBy
          })
          .from(taskAssignmentProgress)
          .where(whereClause)
          .groupBy(taskAssignmentProgress.updatedBy)
      : await db
          .select({
            organizationId: taskAssignmentProgress.updatedBy
          })
          .from(taskAssignmentProgress)
          .groupBy(taskAssignmentProgress.updatedBy);

    total = groups.length;
  }

  const sortColumn = sortBy === "progressPercent" ? taskAssignmentProgress.progressPercent : taskAssignmentProgress.createdAt;
  const orderByClause = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);
  let items;

  if (!groupBy) {
    items = whereClause
      ? await db.select().from(taskAssignmentProgress).where(whereClause).orderBy(orderByClause).limit(limit).offset(offset)
      : await db.select().from(taskAssignmentProgress).orderBy(orderByClause).limit(limit).offset(offset);

    const createdById = items.map((i) => i.createdBy).filter((i) => i != null);

    const accountItems = await db.select().from(accounts).where(inArray(accounts.uuid, createdById));
    const mapAccounts = new Map();
    accountItems.forEach((account) => {
      mapAccounts.set(account.uuid, account);
    });

    const itemIds = items.map((i) => i.uuid).filter((id) => id);
    
    const fileData = await getFilesForEntities({ entityType: "task_assignment_progress",
    entityIds: itemIds });
    items = items.map((i) => ({
      ...i,
      attachments: fileData.get(i.uuid),
      createdBy: mapAccounts.get(i.createdBy)
    }));

  } else if (groupBy === "organization") {
    const latest = db
      .select({
        taskAssignmentId: taskAssignmentProgress.taskAssignmentId,
        maxCreatedAt: max(taskAssignmentProgress.createdAt).as("maxCreatedAt")
      })
      .from(taskAssignmentProgress)
      .groupBy(taskAssignmentProgress.taskAssignmentId)
      .as("latest");

    items = await db
      .select({
        assignment: taskAssignments,
        progress: taskAssignmentProgress,
        organization: organizations
      })
      .from(taskAssignments)
      .leftJoin(latest, eq(taskAssignments.uuid, latest.taskAssignmentId))
      .leftJoin(
        taskAssignmentProgress,
        and(
          eq(taskAssignmentProgress.taskAssignmentId, latest.taskAssignmentId),
          eq(taskAssignmentProgress.createdAt, latest.maxCreatedAt)
        )
      )
      .leftJoin(organizations, eq(taskAssignments.assignedToOrgId, organizations.uuid))
      .where(taskId ? eq(taskAssignments.taskId, taskId) : sql`true`)
      .orderBy(desc(taskAssignmentProgress.createdAt))
      .limit(limit)
      .offset(offset);
    const itemIds = items.map((i) => i.progress?.uuid).filter((id): id is string => !!id);
    const orgId = items
      .map((i) => i.assignment.assignedToOrgId)
      .filter((id): id is string => !!id);
    const fileData = await getFilesForEntities({ entityType: "task_assignment_progress", entityIds: itemIds });
    const orgData = await db.select().from(organizations).where(inArray(organizations.uuid, orgId));
    const orgMap = new Map(orgData.map((org) => [org.uuid, org]));
    items = items.map((i) => ({
      ...i.assignment, // ✅ toàn bộ assignment
      ...i.progress, // giữ riêng progress
      attachments: fileData.get(i?.progress?.uuid || ""),
      organization: orgMap.get(i.assignment.assignedToOrgId || "")
    }));
  }



  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      filters: {
        taskAssignmentId: taskAssignmentId || null,
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

export const createTaskAssignmentProgressAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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

  const guardError = await ensureAssignmentProgressIsEditable(parsed.data.taskAssignmentId);
  if (guardError) {
    const response = apiResponse.error(guardError);
    res.status(response.code).send(response);
    return;
  }

  const {attachments = [], ...payload} = parsed.data
  const progressId = randomUUID();
  const [created] = await db
    .insert(taskAssignmentProgress)
    .values({
      ...payload,
      uuid: progressId,
      organizationId: organizationId || null,
      createdBy: accountId
    })
    .returning();


  if (!created) throw new Error("Unable to create task progress");

  await logTaskAssignmentProgressAudit({
    req,
    progressId,
    details: {
      oldProgress: null,
      newProgress: created
    }
  });


  if (created && created.progressPercent === 100 && created.taskAssignmentId) {
    const [taskAssign] = await db
      .update(taskAssignments)
      .set({
        status: "completed",
        finishDate: sql`current_date`
      })
      .where(eq(taskAssignments.uuid, created.taskAssignmentId))
      .returning();

    if (taskAssign && taskAssign.taskId) {
      const remaining = await db
        .select({ count: sql<number>`count(*)` })
        .from(taskAssignments)
        .where(and(eq(taskAssignments.taskId, taskAssign.taskId), sql`${taskAssignments.status} <> 'completed'`));

      const stillRemaining = Number(remaining[0]?.count || 0) > 0;

      if (!stillRemaining) {
        await db
          .update(tasks)
          .set({
            status: "completed",
            completedAt: sql`current_date`
          })
          .where(
            and(
              eq(tasks.uuid, taskAssign.taskId),
              eq(tasks.status, "in_progress")
            )
          );
      }
    }
  }

  if (attachments.length > 0) {
    try {
      await uploadFilesForEntity({
        attachments,
        entityType: "task_assignment_progress",
        entityId: progressId,
      });
    } catch (error) {
      await db.delete(taskAssignmentProgress).where(eq(taskAssignmentProgress.uuid, progressId));

      const response = apiResponse.error(
        error instanceof Error ? error : HttpErrors.InternalError("Unable to create task")
      );
      res.status(response.code).send(response);
      return;
    }
  }

  const response = apiResponse.success(HttpStatusCode.CREATED, { item: created }, "Task progress created successfully");
  res.status(response.code).send(response);
});

export const getTaskAssignmentProgressAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
  const [item] = await db.select().from(taskAssignmentProgress).where(eq(taskAssignmentProgress.uuid, id)).limit(1);
  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("Task Progress"));
    res.status(response.code).send(response);
    return;
  }
  const response = apiResponse.success(HttpStatusCode.OK, { item }, "Task progress retrieved successfully");
  res.status(response.code).send(response);
});

export const updateTaskAssignmentProgressAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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

  const [existingProgress] = await db
    .select()
    .from(taskAssignmentProgress)
    .where(eq(taskAssignmentProgress.uuid, id))
    .limit(1);

  const guardError = await ensureAssignmentProgressIsEditable(existingProgress?.taskAssignmentId ?? undefined);
  if (guardError) {
    const response = apiResponse.error(guardError);
    res.status(response.code).send(response);
    return;
  }

  const [updated] = await db
    .update(taskAssignmentProgress)
    .set(updatePayload)
    .where(eq(taskAssignmentProgress.uuid, id))
    .returning();
  if (!updated) {
    const response = apiResponse.error(HttpErrors.NotFound("Task Progress"));
    res.status(response.code).send(response);
    return;
  }

  await logTaskAssignmentProgressAudit({
    req,
    progressId: updated.uuid,
    details: {
      oldProgress: existingProgress ?? null,
      newProgress: updated,
      updatePayload
    }
  });

  if(updated && updated.progressPercent === 100) {
    await db.update(taskAssignments).set({status: 'completed', finishDate: sql`current_date`})
  }

  const attachments = req.body.attachments;
  if (attachments) {
    const oldAttachedFiles = await getFilesForEntity({
      entityType: "task_assignment_progress",
      entityId: id
    });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const addedFiles = attachments.filter((a) => a.fileContentBase64);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const currentIds = attachments.filter((a) => a.uuid).map((a) => a.uuid);

    const removedFiles = oldAttachedFiles.filter((old) => !currentIds.includes(old.uuid));

    // ADD
    if (addedFiles.length > 0) {
      try {
        await uploadFilesForEntity({
          attachments: addedFiles,
          entityType: "task_assignment_progress",
          entityId: id
        });
      } catch (error) {
        const response = apiResponse.error(
          error instanceof Error ? error : HttpErrors.InternalError("Unable to update file task")
        );
        res.status(response.code).send(response);
        return;
      }
    }

    // REMOVE
    if (removedFiles.length > 0) {
      try {
        await removeFilesForEntity({
          files: removedFiles,
          entityType: "task_assignment_progress",
          entityId: id
        });
      } catch (error) {
        const response = apiResponse.error(
          error instanceof Error ? error : HttpErrors.InternalError("Unable to update file task")
        );
        res.status(response.code).send(response);
        return;
      }
    }
  }
  const response = apiResponse.success(HttpStatusCode.OK, { item: updated }, "Task progress updated successfully");
  res.status(response.code).send(response);
});

export const deleteTaskAssignmentProgressAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
  const [existingProgress] = await db
    .select()
    .from(taskAssignmentProgress)
    .where(eq(taskAssignmentProgress.uuid, id))
    .limit(1);

  const guardError = await ensureAssignmentProgressIsEditable(existingProgress?.taskAssignmentId ?? undefined);
  if (guardError) {
    const response = apiResponse.error(guardError);
    res.status(response.code).send(response);
    return;
  }

  const [deleted] = await db.delete(taskAssignmentProgress).where(eq(taskAssignmentProgress.uuid, id)).returning();
  if (!deleted) {
    const response = apiResponse.error(HttpErrors.NotFound("Task Progress"));
    res.status(response.code).send(response);
    return;
  }

  await logTaskAssignmentProgressAudit({
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

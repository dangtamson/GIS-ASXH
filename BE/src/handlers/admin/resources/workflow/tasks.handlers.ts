import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import {
  accounts,
  categories,
  categoryItems,
  documents,
  files,
  organizations,
  taskAssignmentProgress,
  taskAssignments,
  taskDeployingDocs,
  tasks,
  workspaceMemberships
} from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import { and, eq, inArray, isNotNull, isNull, sql, ilike, gte, lte, desc } from "drizzle-orm";
import { type Request, response, type Response } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  fileAttachmentSchema,
  getFilesForEntity,
  removeFilesForEntity,
  uploadFilesForEntity
} from "../shared/fileAttachments.ts";
import { sanitizeUpdatePayload } from "../shared/updatePayload.ts";
import { AUDIT_ACTIONS, createAuditLog, ENTITY_TYPES } from "@/services/auditLog.ts";
import { PERMISSION_CODES } from "@/helpers/permissions.ts";
import { checkPermission } from "@/services/rbac.service.ts";

const tasksListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(["new", "in_progress", "completed", "overdue", "issued", "pending", "rejected", "approved"])
    .optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  organizationId: z.uuid().optional(),
  search: z.string().trim().optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  dueFrom: z.string().date().optional(),
  dueTo: z.string().date().optional(),
  sortBy: z
    .enum(["createdAt", "updatedAt", "dueDate", "startDate", "title", "priority", "status"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  documentId: z.uuid().optional(),
  fieldId: z.uuid().optional(),
  remind: z.enum(["over_due", "due_soon"]).optional(),
  isAssigned: z.coerce.boolean().optional(),
  isOwner: z.coerce.boolean().optional()
});

const taskParentOptionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional()
});

const taskCreateSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  documentId: z.uuid().optional(),
  organizationId: z.uuid().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  status: z.enum(["new", "in_progress", "completed", "overdue"]).default("new"),
  startDate: z.string().date().optional(),
  dueDate: z.string().date().optional(),
  completedAt: z.coerce.date().optional(),
  createdBy: z.uuid().optional(),
  attachments: z.array(fileAttachmentSchema).max(20).optional(),
  isIssued: z.boolean().optional(),
  parentTaskId: z.uuid().optional(),
  warningDeadlineDays: z.number().optional(),
  deployingDocs: z.string().optional(),
  fieldId: z.string().optional()
});

function toCamelCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase);
  }

  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        key.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
        toCamelCase(value),
      ])
    );
  }

  return obj;
}

const taskUpdateSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().optional(),
    documentId: z.uuid().optional(),
    organizationId: z.uuid().optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    status: z.enum(["new", "in_progress", "completed", "overdue", "pending", "rejected", "approved"]).optional(),
    startDate: z.string().date().optional(),
    dueDate: z.string().date().optional(),
    completedAt: z.coerce.date().optional(),
    isIssued: z.boolean().optional(),
    parentTaskId: z.uuid().optional(),
    warningDeadlineDays: z.number().optional(),
    fieldId: z.string().optional()
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required"
  });

function resolveAuditActorId(req: Request): string {
  return String(req.accountId);
}

async function logTaskAudit(params: {
  req: Request;
  workspaceId: string;
  taskId: string;
  action: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await createAuditLog(
    {
      action: params.action,
      entityType: ENTITY_TYPES.TASK,
      workspaceId: params.workspaceId,
      actorId: resolveAuditActorId(params.req),
      entityId: params.taskId,
      details: params.details
    },
    params.req
  );
}

async function logTaskAssignmentAudit(params: {
  req: Request;
  workspaceId?: string;
  assignmentId: string;
  action: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await createAuditLog(
    {
      action: params.action,
      entityType: ENTITY_TYPES.TASK_ASSIGNMENT,
      workspaceId: params.workspaceId,
      actorId: resolveAuditActorId(params.req),
      entityId: params.assignmentId,
      details: params.details
    },
    params.req
  );
}


const docMap = async ({ ids, workspaceId }: { ids?: string[] | undefined; workspaceId: string }) => {
  const map = new Map();

  const docItems =
    ids && ids.length > 0
      ? await db
          .select()
          .from(documents)
          .where(
            and(inArray(
              documents.uuid,
              ids.filter((e) => e != null)
            ), eq(documents.workspaceId, workspaceId), isNull(documents.deletedAt))
          )
      : await db.select().from(documents).where(and(eq(documents.workspaceId, workspaceId),isNull(documents.deletedAt))).limit(100).offset(0);

  const [fields, docTypes] = await Promise.all([
      fieldMap({workspaceId}),
      docTypeMap({workspaceId})
  ])


  const items = docItems.map((e) => ({
    ...e,
    field: fields.get(e.fieldId),
    documentType: docTypes.get(e.fieldId)
  }));

  items.forEach((docItem) => {
    map.set(docItem.uuid, docItem);
  });
  return map;
};

const fieldMap = async ({ workspaceId }: { workspaceId: string }) => {
  const map = new Map();
  const [field] = await db.select({uuid: categories.uuid}).from(categories)
    .where(and(eq(categories.code, 'FIELD'), eq(categories.workspaceId, workspaceId))).limit(1);


  const items = await db
    .select({ uuid: categoryItems.uuid, code: categoryItems.code, name: categoryItems.name })
    .from(categoryItems)
    .where(eq(categoryItems.categoryId, field!.uuid!));

  items.forEach((item) => {
    map.set(item.uuid, item);
  })

  return map;
};


const orgMap = async ({ workspaceId, ids }: { workspaceId: string; ids?: string[] | undefined }) => {
  const map = new Map();
  const items =
    ids && ids.length > 0
      ? await db
          .select()
          .from(organizations)
          .where(and(eq(organizations.workspaceId, workspaceId), inArray(organizations.uuid, ids)))
      : await db.select().from(organizations).where(eq(organizations.workspaceId, workspaceId));
  items.forEach((item) => {
    map.set(item.uuid, item);
  });
  return map;
};


const taskAssignmentMap = async ({ taskIds, workspaceId, status }: { taskIds: string[], workspaceId: string, status?: string }) => {
  const conditions = [inArray(taskAssignments.taskId, taskIds)];
  if(status) {
    // @ts-expect-error Drizzle enum typing does not accept narrowed runtime query value here
    conditions.push(eq(taskAssignments.status, status));
  }

  const taskAssigns = await db.select().from(taskAssignments).where(and(...conditions));

  const taskAssignIds = taskAssigns.map((e) => e.uuid).filter(Boolean);

  const orgIds = taskAssigns.map((e) => e.assignedToOrgId).filter((e) => e != null);

  let progressMap = new Map();

  if (taskAssignIds.length) {
    const { rows } = await db.execute(sql`
      SELECT DISTINCT ON (tap.task_assignment_id)
        tap.task_assignment_id,
        tap.progress_percent
      FROM task_assignment_progress tap
      WHERE tap.task_assignment_id IN (${sql.join(
        taskAssignIds.map((id) => sql`${id}`),
        sql`, `
      )})
      ORDER BY tap.task_assignment_id, tap.created_at DESC
    `);

    progressMap = new Map(rows.map((r) => [r.task_assignment_id, r]));
  }

  const orgMaps = await orgMap({ workspaceId, ids: orgIds });

  const result = new Map<string, any[]>();

  for (const ta of taskAssigns) {
    if (!result.has(ta.taskId!)) {
      result.set(ta.taskId!, []);
    }

    result.get(ta.taskId!)!.push({
      ...ta,
      organization: {
        ...orgMaps.get(ta.assignedToOrgId),
        isCoordination: ta.isCoordination
      },
      progressPercent: progressMap.get(ta.uuid)?.progress_percent ?? 0
    });
  }

  return result;
};

const docTypeMap = async ({ workspaceId }: { workspaceId: string }) => {
  const map = new Map();
  const [docType] = await db
    .select({ uuid: categories.uuid })
    .from(categories)
    .where(and(eq(categories.code, "DOCUMENT_TYPE"), eq(categories.workspaceId, workspaceId)))
    .limit(1);

  const items = await db.select({uuid: categoryItems.uuid, code: categoryItems.code, name: categoryItems.name})
      .from(categoryItems).where(eq(categoryItems.categoryId, docType!.uuid!));

  items.forEach((item) => {
    map.set(item.uuid, item);
  });

  return map;
};

export const listTasksAssignmentAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  const accountId = req.accountId?.trim();

  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  if (!accountId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("account id"));
    res.status(response.code).send(response);
    return;
  }

  const parsed = tasksListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const [membership] = await db.select().from(workspaceMemberships)
      .where(and(
          eq(workspaceMemberships.workspaceId, workspaceId),
          eq(workspaceMemberships.accountId, accountId),
      )).limit(1)

  const [organization] = await db.select().from(organizations)
      .where(and(eq(organizations.uuid, membership!.organizationId!))).limit(1)



  const {
    page,
    limit,
    status,
    priority,
    search,
    createdFrom,
    createdTo,
    dueFrom,
    dueTo,
      remind,
      documentId
  } = parsed.data;

  if (!organization) {
    const response = apiResponse.success(
      HttpStatusCode.OK,
      {
        items: [],
        reminds: {
          total: 0,
          overDue: 0,
          dueSoon: 0
        },
        pagination: {
          page,
          limit,
          total:0,
          pages: Math.ceil(0 / limit)
        },
        filters: {
          workspaceId,
          status: status || null,
          priority: priority || null,
          search: search || null,
          createdFrom: createdFrom?.toISOString() || null,
          createdTo: createdTo?.toISOString() || null,
          dueFrom: dueFrom || null,
          dueTo: dueTo || null,
          documentId: documentId || null
        }
      },
      "Tasks retrieved successfully"
    );

    res.status(response.code).send(response);
    return;
  }

  const offset = (page - 1) * limit;

  const baseConditions = [
      eq(tasks.organizationId, organization!.uuid!),
      eq(tasks.workspaceId, workspaceId),
      isNull(tasks.deletedAt)
  ]
  if(status) {
    // @ts-expect-error Drizzle enum typing does not accept narrowed runtime query value here
    baseConditions.push(eq(tasks.status, status))
  }

  if(priority) baseConditions.push(eq(tasks.priority, priority))
  if(search) baseConditions.push(ilike(tasks.title, `%${search}%`))
  if(createdFrom) baseConditions.push(gte(tasks.createdAt, createdFrom))
  if(createdTo) baseConditions.push(lte(tasks.createdAt, createdTo))
  if(dueFrom) baseConditions.push(gte(tasks.dueDate, dueFrom))
  if(dueTo) baseConditions.push(lte(tasks.dueDate, dueTo));
  if(documentId) baseConditions.push(eq(tasks.documentId, documentId));
  const listConditions = [...baseConditions];

  if (remind === "over_due") {
    listConditions.push(sql`${tasks.dueDate} < current_date`);
  }

  if (remind === "due_soon") {
    listConditions.push(sql`
      ${tasks.dueDate} >= current_date
    AND ${tasks.dueDate} <= current_date + (${tasks.warningDeadlineDays} * interval '1 day')
    `);
  }


  const [taskItems, [countResult]] = await Promise.all([
    db
      .select()
      .from(tasks)
      .where(and(...listConditions))
      .orderBy(desc(tasks.createdAt))
      .limit(limit)
      .offset(offset),

    db
      .select({
        total: sql<number>`count(*)`,
        overDue: sql<number>`
      count(*) filter (where ${tasks.dueDate} < current_date)
    `,
        dueSoon: sql<number>`
      count(*) filter (
        where ${tasks.dueDate} >= current_date
        and ${tasks.dueDate} <= current_date + (${tasks.warningDeadlineDays} * interval '1 day')
      )
    `
      })
      .from(tasks)
      .where(and(...baseConditions))
  ]);


  const docIds = taskItems.map((item) => item.documentId).filter((e) => e!=null)
  const [docs, taskAssignments] = await Promise.all([
    docMap({ workspaceId: workspaceId, ids: docIds }),
    taskAssignmentMap({ taskIds: taskItems.map((e) => e.uuid) , workspaceId})
  ]);

  const items = taskItems.map((item) => ({
    ...item,
    organization,
    taskAssignments: taskAssignments.get(item!.uuid!),
    document: docs.get(item.documentId),
  }))

  const total = countResult?.total || 0;
  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      items: items,
      reminds: countResult || {
        total: 0,
        overDue: 0,
        dueSoon: 0
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      filters: {
        workspaceId,
        status: status || null,
        priority: priority || null,
        search: search || null,
        createdFrom: createdFrom?.toISOString() || null,
        createdTo: createdTo?.toISOString() || null,
        dueFrom: dueFrom || null,
        dueTo: dueTo || null,
        documentId: documentId || null
      }
    },
    "Tasks retrieved successfully"
  );

  res.status(response.code).send(response);
});

export const listTasksParentOptionsAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  const accountId = req.accountId?.trim();

  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  if (!accountId) {
    const response = apiResponse.error(HttpErrors.Unauthorized());
    res.status(response.code).send(response);
    return;
  }

  const parsed = taskParentOptionsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const [account] = await db.select().from(accounts).where(eq(accounts.uuid, accountId)).limit(1);
  const canCreateTask = await checkPermission(
    { id: accountId, isSuperAdmin: Boolean(account?.isSuperAdmin) },
    workspaceId,
    PERMISSION_CODES.TaskCreate
  );

  if (!canCreateTask) {
    const response = apiResponse.error(HttpErrors.Forbidden("Bạn không có quyền tạo nhiệm vụ"));
    res.status(response.code).send(response);
    return;
  }

  const [membership] = await db
    .select({
      organizationId: workspaceMemberships.organizationId
    })
    .from(workspaceMemberships)
    .where(and(eq(workspaceMemberships.workspaceId, workspaceId), eq(workspaceMemberships.accountId, accountId)))
    .limit(1);

  if (!membership?.organizationId) {
    const response = apiResponse.success(
      HttpStatusCode.OK,
      {
        items: [],
        pagination: {
          page: parsed.data.page,
          limit: parsed.data.limit,
          total: 0,
          pages: 0
        }
      },
      "Task parent options retrieved successfully"
    );
    res.status(response.code).send(response);
    return;
  }

  const { page, limit, search } = parsed.data;
  const offset = (page - 1) * limit;
  const searchCondition = search ? sql`and t.title ilike ${`%${search}%`}` : sql``;

  const { rows } = await db.execute(sql`
    with accessible_tasks as (
      select
        t.uuid,
        t.title,
        t.created_at,
        'owner'::text as source
      from tasks t
      where t.workspace_id = ${workspaceId}
        and t.organization_id = ${membership.organizationId}
        and t.deleted_at is null
        ${searchCondition}

      union

      select
        t.uuid,
        t.title,
        t.created_at,
        'assigned'::text as source
      from tasks t
      inner join task_assignments ta on ta.task_id = t.uuid
      where t.workspace_id = ${workspaceId}
        and t.deleted_at is null
        and ta.assigned_to_org_id = ${membership.organizationId}
        and coalesce(ta.status, '') not in ('approved', 'rejected')
        ${searchCondition}
    ),
    deduped_tasks as (
      select distinct on (uuid)
        uuid,
        title,
        created_at,
        source
      from accessible_tasks
      order by uuid, created_at desc
    )
    select
      uuid,
      title,
      created_at,
      source,
      count(*) over()::int as total_count
    from deduped_tasks
    order by created_at desc, title asc
    limit ${limit}
    offset ${offset}
  `);

  const total = Number(rows[0]?.total_count ?? 0);
  const items = rows.map((row) => ({
    uuid: String(row.uuid ?? ""),
    title: String(row.title ?? ""),
    source: String(row.source ?? "")
  }));

  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      items,
      pagination: {
        page,
        limit,
        total,
        pages: total > 0 ? Math.ceil(total / limit) : 0
      },
      filters: {
        workspaceId,
        search: search || null
      }
    },
    "Task parent options retrieved successfully"
  );
  res.status(response.code).send(response);
});

export const listTasksAssignedAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  const accountId = req.accountId?.trim();

  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  if (!accountId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("account id"));
    res.status(response.code).send(response);
    return;
  }

  const parsed = tasksListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const [membership] = await db
    .select()
    .from(workspaceMemberships)
    .where(and(eq(workspaceMemberships.workspaceId, workspaceId), eq(workspaceMemberships.accountId, accountId)))
    .limit(1);


  const {
    page,
    limit,
    status,
    priority,
    search,
    createdFrom,
    createdTo,
    documentId, dueFrom,
    dueTo,
    remind,
    organizationId
  } = parsed.data;

  const offset = (page - 1) * limit;

  const baseConditions = [eq(tasks.workspaceId, workspaceId), isNull(tasks.deletedAt)];
  const activeAssignmentConditions = [
    eq(taskAssignments.assignedToOrgId, membership!.organizationId!),
    sql`${taskAssignments.status} not in ('approved', 'rejected')`
  ];

  if (status) { // @ts-expect-error Drizzle enum typing does not accept narrowed runtime query value here
    baseConditions.push(eq(tasks.status, status));
  }
  if (priority) baseConditions.push(eq(tasks.priority, priority));
  if (search) baseConditions.push(ilike(tasks.title, `%${search}%`));
  if (createdFrom) baseConditions.push(gte(tasks.createdAt, createdFrom));
  if (createdTo) baseConditions.push(lte(tasks.createdAt, createdTo));
  if (dueFrom) baseConditions.push(gte(tasks.dueDate, dueFrom));
  if (dueTo) baseConditions.push(lte(tasks.dueDate, dueTo));
  if (organizationId) baseConditions.push(eq(tasks.organizationId, organizationId));
  if (documentId) baseConditions.push(eq(tasks.documentId, documentId));

  const listConditions = [...baseConditions];

  if (remind === "over_due") {
    listConditions.push(sql`${tasks.dueDate} < current_date`);
  }

  if (remind === "due_soon") {
    listConditions.push(sql`
      ${tasks.dueDate} >= current_date
    AND ${tasks.dueDate} <= current_date + (${tasks.warningDeadlineDays} * interval '1 day')
    `);
  }


  const [taskItems, [countResult]] = await Promise.all([
    db
      .select()
      .from(tasks)
      .innerJoin(taskAssignments, eq(taskAssignments.taskId, tasks.uuid))
      .where(and(...listConditions, ...activeAssignmentConditions))
      .orderBy(desc(tasks.createdAt))
      .limit(limit)
      .offset(offset),

    db
      .select({
        total: sql<number>`count(distinct ${tasks.uuid})`,
        overDue: sql<number>`
            count(distinct ${tasks.uuid}) filter (where ${tasks.dueDate} < current_date)
          `,
        dueSoon: sql<number>`
            count(distinct ${tasks.uuid}) filter (
            where ${tasks.dueDate} >= current_date
            and ${tasks.dueDate} <= current_date + (${tasks.warningDeadlineDays} * interval '1 day')
            )
          `
      })
      .from(tasks)
      .innerJoin(taskAssignments, eq(taskAssignments.taskId, tasks.uuid))
      .where(and(...baseConditions, ...activeAssignmentConditions))
  ]);

  const docIds = taskItems.map((item) => item.tasks.uuid).filter((e) => e != null);
  const orgIds = taskItems.map((item) => item.tasks.organizationId).filter((e) => e != null);
  const [docs, taskAssignmentMaps, orgs] = await Promise.all([
    docMap({ workspaceId: workspaceId, ids: docIds }),
    taskAssignmentMap({ taskIds: taskItems.map((e) => e.tasks.uuid), workspaceId }),
    orgMap({ workspaceId: workspaceId, ids: orgIds }),
  ]);


  const items = taskItems.map((item) => ({
    ...item.tasks,
    organization: orgs.get(item.tasks.organizationId),
    taskAssignments: taskAssignmentMaps.get(item.tasks!.uuid!)?.filter(
      (e) => e.assignedToOrgId === membership!.organizationId && !["approved", "rejected"].includes(e.status ?? "")
    ),
    document: docs.get(item.tasks.uuid)
  }));

  const total = countResult?.total || 0;
  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      items: items,
      reminds: countResult || {
        total: 0,
        overDue: 0,
        dueSoon: 0
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      filters: {
        workspaceId,
        organizationId: organizationId || null,
        status: status || null,
        priority: priority || null,
        search: search || null,
        createdFrom: createdFrom?.toISOString() || null,
        createdTo: createdTo?.toISOString() || null,
        dueFrom: dueFrom || null,
        dueTo: dueTo || null,
        documentId: documentId || null
      }
    },
    "Tasks retrieved successfully"
  );

  res.status(response.code).send(response);
});

export const listTasksReviewAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  const accountId = req.accountId?.trim();

  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  if (!accountId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("account id"));
    res.status(response.code).send(response);
    return;
  }

  const parsed = tasksListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const [membership] = await db
    .select()
    .from(workspaceMemberships)
    .where(and(eq(workspaceMemberships.workspaceId, workspaceId), eq(workspaceMemberships.accountId, accountId)))
    .limit(1);

  const [organization] = await db
    .select()
    .from(organizations)
    .where(and(eq(organizations.uuid, membership!.organizationId!)))
    .limit(1);

  const { page, limit, status, priority, search, createdFrom, createdTo, dueFrom, dueTo, remind, documentId } =
    parsed.data;


  if (!organization) {
    const response = apiResponse.success(
      HttpStatusCode.OK,
      {
        items: [],
        reminds: {
          total: 0,
          overDue: 0,
          dueSoon: 0
        },
        pagination: {
          page,
          limit,
          total: 0,
          pages: Math.ceil(0 / limit)
        },
        filters: {
          workspaceId,
          status: status || null,
          priority: priority || null,
          search: search || null,
          createdFrom: createdFrom?.toISOString() || null,
          createdTo: createdTo?.toISOString() || null,
          dueFrom: dueFrom || null,
          dueTo: dueTo || null,
          documentId: documentId || null
        }
      },
      "Tasks retrieved successfully"
    );

    res.status(response.code).send(response);
    return;
  }

  const offset = (page - 1) * limit;

  const baseConditions = [
    eq(tasks.organizationId, organization!.uuid!),
    eq(tasks.workspaceId, workspaceId),
    isNull(tasks.deletedAt),
    sql`
    exists (
      select 1
      from task_assignments ta
      where ta.task_id = ${tasks.uuid}
      and ta.status = 'pending'
    )
  `
  ];
  if (status) {
    // @ts-expect-error Drizzle enum typing does not accept narrowed runtime query value here
    baseConditions.push(eq(tasks.status, status));
  }

  if (priority) baseConditions.push(eq(tasks.priority, priority));
  if (search) baseConditions.push(ilike(tasks.title, `%${search}%`));
  if (createdFrom) baseConditions.push(gte(tasks.createdAt, createdFrom));
  if (createdTo) baseConditions.push(lte(tasks.createdAt, createdTo));
  if (dueFrom) baseConditions.push(gte(tasks.dueDate, dueFrom));
  if (dueTo) baseConditions.push(lte(tasks.dueDate, dueTo));
  if (documentId) baseConditions.push(eq(tasks.documentId, documentId));

  const listConditions = [...baseConditions];

  if (remind === "over_due") {
    listConditions.push(sql`${tasks.dueDate} < current_date`);
  }

  if (remind === "due_soon") {
    listConditions.push(sql`
      ${tasks.dueDate} >= current_date
    AND ${tasks.dueDate} <= current_date + (${tasks.warningDeadlineDays} * interval '1 day')
    `);
  }

  const [taskItems, [countResult]] = await Promise.all([
    db
      .select()
      .from(tasks)
      .where(and(...listConditions))
      .orderBy(desc(tasks.createdAt))
      .limit(limit)
      .offset(offset),

    db
      .select({
        total: sql<number>`count(*)`,
        overDue: sql<number>`
      count(*) filter (where ${tasks.dueDate} < current_date)
    `,
        dueSoon: sql<number>`
      count(*) filter (
        where ${tasks.dueDate} >= current_date
        and ${tasks.dueDate} <= current_date + (${tasks.warningDeadlineDays} * interval '1 day')
      )
    `
      })
      .from(tasks)
      .where(and(...baseConditions))
  ]);

  const docIds = taskItems.map((item) => item.documentId).filter((e) => e != null);
  const [docs, taskAssignments] = await Promise.all([
    docMap({ workspaceId: workspaceId, ids: docIds }),
    taskAssignmentMap({ taskIds: taskItems.map((e) => e.uuid), workspaceId, status: "pending" })
  ]);

  const items = taskItems.map((item) => ({
    ...item,
    organization,
    taskAssignments: taskAssignments.get(item!.uuid!),
    document: docs.get(item.documentId)
  }));

  const total = countResult?.total || 0;
  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      items: items,
      reminds: countResult || {
        total: 0,
        overDue: 0,
        dueSoon: 0
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      filters: {
        workspaceId,
        status: status || null,
        priority: priority || null,
        search: search || null,
        createdFrom: createdFrom?.toISOString() || null,
        createdTo: createdTo?.toISOString() || null,
        dueFrom: dueFrom || null,
        dueTo: dueTo || null,
        documentId: documentId || null
      }
    },
    "Tasks retrieved successfully"
  );

  res.status(response.code).send(response);
});

export const createTaskAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  const accountId = req.accountId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }
  let organizationId;

  if (accountId) {
    const [membership] = await db
      .select({
        organizationId: workspaceMemberships.organizationId
      })
      .from(workspaceMemberships)
      .where(and(eq(workspaceMemberships.workspaceId, workspaceId), eq(workspaceMemberships.accountId, accountId)))
      .limit(1);

    organizationId = membership?.organizationId;
  }
  
    

  const parsed = taskCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const { attachments = [], deployingDocs, isIssued, ...taskPayload } = parsed.data;
  const taskId = randomUUID();

  const [created] = await db
    .insert(tasks)
    .values({
      ...taskPayload,
      workspaceId,
      uuid: taskId,
      createdBy: accountId,
      organizationId: organizationId,
    })
    .returning();

  if (!created) {
    throw new Error("Unable to create task");
  }

  if (attachments.length > 0) {
    try {
      await uploadFilesForEntity({
        attachments,
        entityType: "task",
        entityId: taskId,
        defaultUploadedBy: taskPayload.createdBy
      });
    } catch (error) {
      await db.delete(tasks).where(eq(tasks.uuid, taskId));

      const response = apiResponse.error(
        error instanceof Error ? error : HttpErrors.InternalError("Unable to create task")
      );
      res.status(response.code).send(response);
      return;
    }
  }

  if (deployingDocs) {
    await Promise.all(
      deployingDocs.split(";").map((deployDoc: string) => {
        return db.insert(taskDeployingDocs).values({
          workspaceId: workspaceId,
          taskId: taskId,
          documentId: deployDoc
        });
      })
    );
  }

  await logTaskAudit({
    req,
    workspaceId,
    taskId: created.uuid,
    action: AUDIT_ACTIONS.TASK_CREATED,
    details: {
      oldTask: null,
      newTask: created
    }
  });

  const response = apiResponse.success(HttpStatusCode.CREATED, { item: created }, "Task created successfully");
  res.status(response.code).send(response);
});

export const getTaskAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Task ID"));
    res.status(response.code).send(response);
    return;
  }

  const { rows } = await db.execute(sql`
      select
          fn_get_task_by_uuid_json(${JSON.stringify({
    uuid: id,
    workspaceId: workspaceId
  })}::jsonb)
  `);

  const item = rows[0]?.fn_get_task_by_uuid_json ?? null;

  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("Task"));
    res.status(response.code).send(response);
    return;
  }

  const attachedFiles = await getFilesForEntity({
    entityType: "task",
    entityId: id
  });

  const currentDocIds = (
    await db
      .select({
        documentId: taskDeployingDocs.documentId,
      })
      .from(taskDeployingDocs)
      .where(and(eq(taskDeployingDocs.taskId, id), isNull(taskDeployingDocs.deletedAt)))
  )
    .map((e) => e.documentId)
    .filter(Boolean) as string[];

  const docFiles = await db
    .select()
    .from(files)
    .where(and(eq(files.entityType, "document"), inArray(files.entityId, currentDocIds), isNull(files.deletedAt)));
  const docs = await db.select().from(documents).where(inArray(documents.uuid, currentDocIds));
  const orgIds = docs.map((d) => d.issuingOrgId).filter(Boolean) as string[];
  const orgs = await db
    .select()
    .from(organizations)
    .where(and(isNull(organizations.deletedAt), inArray(organizations.uuid, orgIds)));

  const deployingDocs = await db.select().from(documents).where(inArray(documents.uuid, currentDocIds));

  const docsWithAttachments = deployingDocs.map((item) => ({
    ...item,
    attachments: docFiles.filter((f) => f.entityId === item.uuid),
    organization: orgs[0]
  }));

  const response = apiResponse.success(
    HttpStatusCode.OK,
    { item: toCamelCase(item), files: attachedFiles, deployingDocs: docsWithAttachments },
    "Task retrieved successfully"
  );
  res.status(response.code).send(response);
});

export const updateTaskAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Task ID"));
    res.status(response.code).send(response);
    return;
  }
  const idValidation = z.uuid().safeParse(id);
  if (!idValidation.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid task id"));
    res.status(response.code).send(response);
    return;
  }

  const parsed = taskUpdateSchema.safeParse(req.body);
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

  const { isIssued, ...taskPayload } = updatePayload;
  const [existingTask] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.uuid, id), eq(tasks.workspaceId, workspaceId)))
    .limit(1);

  const [updated] = await db
    .update(tasks)
    .set({
      ...taskPayload
    })
    .where(and(eq(tasks.uuid, id), eq(tasks.workspaceId, workspaceId)))
    .returning();

  const attachments = req.body.attachments;
  if (attachments) {
    const oldAttachedFiles = await getFilesForEntity({
      entityType: "task",
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
          entityType: "task",
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
          entityType: "task",
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

    const deployingDocIdString: string = req.body.deployingDocs ?? "";

    const newDocIds = deployingDocIdString.split(";").filter(Boolean);

    const currentDocIds = (
      await db
        .select({
          documentId: taskDeployingDocs.documentId
        })
        .from(taskDeployingDocs)
        .where(and(eq(taskDeployingDocs.taskId, id), isNull(taskDeployingDocs.deletedAt)))
    )
      .map((e) => e.documentId)
      .filter(Boolean) as string[];

    const docsToAdd = newDocIds.filter((docId) => !currentDocIds.includes(docId));

    const docsToRemove = currentDocIds.filter((docId) => !newDocIds.includes(docId));

    await Promise.all([
      // ADD
      ...docsToAdd.map((docId) =>
        db.insert(taskDeployingDocs).values({
          taskId: id,
          documentId: docId,
          workspaceId: workspaceId
        })
      ),

      // REMOVE
      ...docsToRemove.map((docId) =>
        db
          .update(taskDeployingDocs)
          .set({
            deletedAt: sql`current_timestamp`
          })
          .where(
            and(
              eq(taskDeployingDocs.taskId, id),
              eq(taskDeployingDocs.documentId, docId),
              isNull(taskDeployingDocs.deletedAt)
            )
          )
      )
    ]);
  }

  if (!updated) {
    const response = apiResponse.error(HttpErrors.NotFound("Task"));
    res.status(response.code).send(response);
    return;
  }

  await logTaskAudit({
    req,
    workspaceId,
    taskId: updated.uuid,
    action: AUDIT_ACTIONS.TASK_UPDATED,
    details: {
      oldTask: existingTask ?? null,
      newTask: updated,
      updatePayload
    }
  });

  const response = apiResponse.success(HttpStatusCode.OK, { item: updated }, "Task updated successfully");
  res.status(response.code).send(response);
});

async function updateTaskAction(
  req: Request,
  res: Response,
  setValues: Record<string, unknown>,
  successMessage: string
): Promise<void> {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Task ID"));
    res.status(response.code).send(response);
    return;
  }

  const idValidation = z.uuid().safeParse(id);
  if (!idValidation.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid task id"));
    res.status(response.code).send(response);
    return;
  }

  const [currentTask] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.uuid, id), eq(tasks.workspaceId, workspaceId)))
    .limit(1);

  const [updated] = await db
    .update(tasks)
    .set({
      ...setValues,
      updatedAt: new Date()
    })
    .where(and(eq(tasks.uuid, id), eq(tasks.workspaceId, workspaceId)))
    .returning();

  if (!updated) {
    const response = apiResponse.error(HttpErrors.NotFound("Task"));
    res.status(response.code).send(response);
    return;
  }

  await logTaskAudit({
    req,
    workspaceId,
    taskId: updated.uuid,
    action: AUDIT_ACTIONS.TASK_STATUS_UPDATED,
    details: {
      oldTask: currentTask ?? null,
      newTask: updated,
      setValues
    }
  });

  const response = apiResponse.success(HttpStatusCode.OK, { item: updated }, successMessage);
  res.status(response.code).send(response);
}

export const sendTaskApprovalDataById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  let organizationId;

  if (req.accountId) {
    const [membership] = await db
      .select({
        organizationId: workspaceMemberships.organizationId
      })
      .from(workspaceMemberships)
      .where(and(eq(workspaceMemberships.workspaceId, workspaceId), eq(workspaceMemberships.accountId, req.accountId)))
      .limit(1);

    organizationId = membership?.organizationId;
  }

  if (!organizationId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Organization ID"));
    res.status(response.code).send(response);
    return;
  }

  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Task ID"));
    res.status(response.code).send(response);
    return;
  }

  const idValidation = z.uuid().safeParse(id);
  if (!idValidation.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid task id"));
    res.status(response.code).send(response);
    return;
  }

  const [currentAssignment] = await db
    .select()
    .from(taskAssignments)
    .where(and(eq(taskAssignments.taskId, id), eq(taskAssignments.assignedToOrgId, organizationId)))
    .limit(1);

  if (!currentAssignment) {
    const response = apiResponse.error(HttpErrors.NotFound("Task"));
    res.status(response.code).send(response);
    return;
  }

  if (["pending", "approved", "rejected"].includes(currentAssignment.status ?? "")) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Nhiệm vụ đã kết thúc quy trình đánh giá, không thể gửi lại."));
    res.status(response.code).send(response);
    return;
  }

  if (currentAssignment.status !== "completed") {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Chỉ được gửi đánh giá khi đơn vị đã hoàn thành nhiệm vụ."));
    res.status(response.code).send(response);
    return;
  }

  const [updated] = await db
    .update(taskAssignments)
    .set({
      status: "pending"
    })
    .where(and(eq(taskAssignments.taskId, id), eq(taskAssignments.assignedToOrgId, organizationId)))
    .returning();

  if (!updated) {
    const response = apiResponse.error(HttpErrors.NotFound("Task"));
    res.status(response.code).send(response);
    return;
  }

  await logTaskAssignmentAudit({
    req,
    workspaceId,
    assignmentId: updated.uuid,
    action: AUDIT_ACTIONS.TASK_STATUS_UPDATED,
    details: {
      taskId: id,
      oldStatus: currentAssignment?.status ?? null,
      newStatus: updated.status
    }
  });

  const response = apiResponse.success(HttpStatusCode.OK, { item: updated });
  res.status(response.code).send(response);
});

export const receiveTaskById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  let organizationId;

  if (req.accountId) {
    const [membership] = await db
      .select({
        organizationId: workspaceMemberships.organizationId
      })
      .from(workspaceMemberships)
      .where(and(eq(workspaceMemberships.workspaceId, workspaceId), eq(workspaceMemberships.accountId, req.accountId)))
      .limit(1);

    organizationId = membership?.organizationId;
  }

  if(!organizationId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Organization ID"));
    res.status(response.code).send(response);
    return;
  }

  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Task ID"));
    res.status(response.code).send(response);
    return;
  }

  const idValidation = z.uuid().safeParse(id);
  if (!idValidation.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid task id"));
    res.status(response.code).send(response);
    return;
  }

  const [currentAssignment] = await db
    .select()
    .from(taskAssignments)
    .where(and(eq(taskAssignments.taskId, id), eq(taskAssignments.assignedToOrgId, organizationId)))
    .limit(1);

  const [updatedAssignment] = await db
    .update(taskAssignments)
    .set({
      startDate: sql`current_date`,
      status: "in_progress"
    })
    .where(and(eq(taskAssignments.taskId, id), eq(taskAssignments.assignedToOrgId, organizationId)))
    .returning();

  const [updated] = await db
    .update(tasks)
    .set({
      startDate: sql`current_date`,
      status: "in_progress"
    }).where(and(eq(tasks.uuid, id), eq(tasks.workspaceId, workspaceId), eq(tasks.status, 'new'))).returning()

  if (!updated) {
    const response = apiResponse.error(HttpErrors.NotFound("Task"));
    res.status(response.code).send(response);
    return;
  }

  if (updatedAssignment) {
    await logTaskAssignmentAudit({
      req,
      workspaceId,
      assignmentId: updatedAssignment.uuid,
      action: AUDIT_ACTIONS.TASK_STATUS_UPDATED,
      details: {
        taskId: id,
        oldStatus: currentAssignment?.status ?? null,
        newStatus: updatedAssignment.status,
        startDate: updatedAssignment.startDate
      }
    });
  }

  await logTaskAudit({
    req,
    workspaceId,
    taskId: updated.uuid,
    action: AUDIT_ACTIONS.TASK_STATUS_UPDATED,
    details: {
      oldStatus: "new",
      newStatus: updated.status,
      newTask: updated
    }
  });

  const response = apiResponse.success(HttpStatusCode.OK, { item: updated });
  res.status(response.code).send(response);
});

export const approveTaskDataById = asyncHandler(async (req: Request, res: Response): Promise<void> => {


  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Task ID"));
    res.status(response.code).send(response);
    return;
  }

  const idValidation = z.uuid().safeParse(id);
  if (!idValidation.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid task id"));
    res.status(response.code).send(response);
    return;
  }

  const [currentAssignment] = await db
    .select()
    .from(taskAssignments)
    .where(eq(taskAssignments.uuid, id))
    .limit(1);

  const [updated] = await db
    .update(taskAssignments)
    .set({
      status: "approved",
    })
    .where(and(eq(taskAssignments.uuid, id), eq(taskAssignments.status, 'pending')))
    .returning();


  if (!updated) {
    const response = apiResponse.error(HttpErrors.NotFound("Task"));
    res.status(response.code).send(response);
    return;
  }

  await logTaskAssignmentAudit({
    req,
    assignmentId: updated.uuid,
    action: AUDIT_ACTIONS.TASK_STATUS_UPDATED,
    details: {
      oldStatus: currentAssignment?.status ?? "pending",
      newStatus: updated.status,
      taskId: updated.taskId
    }
  });

  const response = apiResponse.success(HttpStatusCode.OK, { item: updated });
  res.status(response.code).send(response);
});

export const rejectTaskApprovalDataById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Task ID"));
    res.status(response.code).send(response);
    return;
  }

  const idValidation = z.uuid().safeParse(id);
  if (!idValidation.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid task id"));
    res.status(response.code).send(response);
    return;
  }

  const [currentAssignment] = await db
    .select()
    .from(taskAssignments)
    .where(eq(taskAssignments.uuid, id))
    .limit(1);

  const [updated] = await db
    .update(taskAssignments)
    .set({
      status: "rejected"
    })
    .where(and(eq(taskAssignments.uuid, id), eq(taskAssignments.status, "pending")))
    .returning();

  if (!updated) {
    const response = apiResponse.error(HttpErrors.NotFound("Task"));
    res.status(response.code).send(response);
    return;
  }

  await logTaskAssignmentAudit({
    req,
    assignmentId: updated.uuid,
    action: AUDIT_ACTIONS.TASK_STATUS_UPDATED,
    details: {
      oldStatus: currentAssignment?.status ?? "pending",
      newStatus: updated.status,
      taskId: updated.taskId
    }
  });

  const response = apiResponse.success(HttpStatusCode.OK, { item: updated });
  res.status(response.code).send(response);
});

export const sendTaskPromulgateDataById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await updateTaskAction(req, res, { issuedDate: sql`current_date` }, "Task sent for publish successfully");
});

export const deleteTaskAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Task ID"));
    res.status(response.code).send(response);
    return;
  }
  const idValidation = z.uuid().safeParse(id);
  if (!idValidation.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid task id"));
    res.status(response.code).send(response);
    return;
  }

  const [existingTask] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.uuid, id), eq(tasks.workspaceId, workspaceId)))
    .limit(1);

  const [deleted] = await db
    .update(tasks)
    .set({
      deletedAt: sql`current_date`
    })
    .where(and(eq(tasks.uuid, id), eq(tasks.workspaceId, workspaceId)))
    .returning();
  if (!deleted) {
    const response = apiResponse.error(HttpErrors.NotFound("Task"));
    res.status(response.code).send(response);
    return;
  }

  await logTaskAudit({
    req,
    workspaceId,
    taskId: deleted.uuid,
    action: AUDIT_ACTIONS.TASK_DELETED,
    details: {
      oldTask: existingTask ?? deleted,
      newTask: null
    }
  });

  const response = apiResponse.success(HttpStatusCode.OK, { item: deleted }, "Task deleted successfully");
  res.status(response.code).send(response);
});

export const getTaskAdminReminder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  const accountId = req.accountId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  if (!accountId) {
    const response = apiResponse.error(HttpErrors.Unauthorized());
    res.status(response.code).send(response);
    return;
  }

  let currentAccount;

  if(accountId) {
    const [account] = await db.select().from(accounts).where(eq(accounts.uuid, accountId)).limit(1);
    currentAccount = account;
  }


  const canReceiveTask = await checkPermission(
    { id: accountId, isSuperAdmin: Boolean(currentAccount?.isSuperAdmin) },
    workspaceId,
    PERMISSION_CODES.TaskReceive
  );

  if (!canReceiveTask) {
    const response = apiResponse.success(
      HttpStatusCode.OK,
      { remind: 0 },
      "Lấy thông tin nhắc nhở thành công"
    );
    res.status(response.code).send(response);
    return;
  }

  const [membership] = await db
    .select({
      organizationId: workspaceMemberships.organizationId
    })
    .from(workspaceMemberships)
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.accountId, accountId)
      )
    )
    .limit(1);

  if (!membership?.organizationId) {
    const response = apiResponse.success(
      HttpStatusCode.OK,
      { remind: 0 },
      "Lấy thông tin nhắc nhở thành công"
    );
    res.status(response.code).send(response);
    return;
  }

  const [result] = await db
    .select({
      remind: sql<number>`count(${taskAssignments.uuid})`
    })
    .from(taskAssignments)
    .innerJoin(tasks, eq(taskAssignments.taskId, tasks.uuid))
    .where(
      and(
        eq(taskAssignments.assignedToOrgId, membership.organizationId),
        eq(taskAssignments.status, "new"),
        isNotNull(tasks.issuedDate),
        isNull(tasks.deletedAt),
        eq(tasks.workspaceId, workspaceId)
      )
    );

  const response = apiResponse.success(
    HttpStatusCode.OK,
    { remind: Number(result?.remind ?? 0) },
    "Lấy thông tin nhắc nhở thành công"
  );
  res.status(response.code).send(response);
});

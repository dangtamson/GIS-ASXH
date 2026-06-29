import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import { db } from "@/services/db/drizzle.ts";
import { expandOrganizationDescendants, getAccountOrganizationIds } from "./common.ts";
import { sql, type SQL } from "drizzle-orm";
import type { Request, Response } from "express";
import { z } from "zod";

const optionalDateString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined))
  .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "Invalid date format, expected YYYY-MM-DD"
  });

const reportQuerySchema = z.object({
  fromDate: optionalDateString,
  toDate: optionalDateString,
  organization_ids: z.union([z.string().trim(), z.array(z.string().trim())]).optional(),
  field: z.union([z.string().trim(), z.array(z.string().trim())]).optional(),
  document_type_id: z.union([z.string().trim(), z.array(z.string().trim())]).optional()
});

const detailMetricSchema = z.enum(["totalTasks", "totalMainUnits", "totalCoordinationUnits"]).optional();

const reportDetailQuerySchema = reportQuerySchema.extend({
  document_type_uuid: z.string().trim().optional(),
  metric: detailMetricSchema,
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(5000).optional()
});

type DetailMetric = z.infer<typeof detailMetricSchema>;

function parseList(raw?: string | string[]): string[] {
  if (!raw) {
    return [];
  }

  if (Array.isArray(raw)) {
    return raw.map((value) => value.trim()).filter(Boolean);
  }

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function buildInList(values: string[]): SQL {
  return sql.join(values.map((value) => sql`${value}`), sql`,`);
}

async function resolveOrganizationIds(
  workspaceId: string,
  accountId: string | undefined,
  organizationIds: string[],
  hasExplicitOrganizationFilter: boolean
): Promise<string[]> {
  if (organizationIds.length > 0 || !accountId) {
    return organizationIds;
  }

  const accountOrgIds = await getAccountOrganizationIds(accountId, workspaceId);
  if (accountOrgIds.length === 0) {
    return [];
  }

  return hasExplicitOrganizationFilter ? accountOrgIds : expandOrganizationDescendants(workspaceId, accountOrgIds);
}

function buildDetailMetricFilter(metric: DetailMetric): SQL {
  if (metric === "totalMainUnits") {
    return sql`and coalesce(assignment_summary.total_dvth, 0) > 0`;
  }

  if (metric === "totalCoordinationUnits") {
    return sql`and coalesce(assignment_summary.total_dvph, 0) > 0`;
  }

  return sql``;
}

function buildDocumentTypeTaskScopeQuery(input: {
  workspaceId: string;
  organizationIds: string[];
  fromDate?: string;
  toDate?: string;
  fieldList: string[];
  docTypeList: string[];
  documentTypeUuid?: string;
  metric?: DetailMetric;
  limit?: number;
  offset?: number;
  countOnly?: boolean;
}): SQL {
  const {
    workspaceId,
    organizationIds,
    fromDate,
    toDate,
    fieldList,
    docTypeList,
    documentTypeUuid,
    metric = "totalTasks",
    limit,
    offset,
    countOnly = false
  } = input;

  const organizationFilter =
    organizationIds.length > 0
      ? sql`ta.assigned_to_org_id in (${buildInList(organizationIds)})`
      : sql`1 = 2`;
  const assignmentFromFilter = fromDate ? sql`and ta.assigned_at >= ${fromDate}` : sql``;
  const assignmentToFilter = toDate ? sql`and ta.assigned_at <= ${toDate}` : sql``;
  const fieldFilter =
    fieldList.length > 0 ? sql`and d.field_id in (${buildInList(fieldList)})` : sql``;
  const docTypeFilter =
    docTypeList.length > 0 ? sql`and d.document_type_id in (${buildInList(docTypeList)})` : sql``;
  const documentTypeUuidFilter = documentTypeUuid ? sql`and d.document_type_id = ${documentTypeUuid}` : sql``;
  const metricFilter = buildDetailMetricFilter(metric);
  const paginationSql =
    typeof limit === "number" && typeof offset === "number"
      ? sql`limit ${limit} offset ${offset}`
      : sql``;

  if (countOnly) {
    return sql`
      with scoped_assignments as (
        select
          ta.task_id,
          ta.assigned_to_org_id,
          coalesce(ta.is_coordination, false) as is_coordination,
          org.name as organization_name
        from task_assignments ta
        left join organizations org on org.uuid = ta.assigned_to_org_id
        where ${organizationFilter}
          ${assignmentFromFilter}
          ${assignmentToFilter}
      ),
      filtered_tasks as (
        select distinct
          t.uuid
        from tasks t
        join scoped_assignments sa on sa.task_id = t.uuid
        join documents d on d.uuid = t.document_id
        where t.deleted_at is null
          and d.deleted_at is null
          and t.workspace_id = ${workspaceId}
          and d.workspace_id = ${workspaceId}
          ${fieldFilter}
          ${docTypeFilter}
          ${documentTypeUuidFilter}
      ),
      assignment_summary as (
        select
          sa.task_id,
          count(distinct case when sa.is_coordination = false then sa.assigned_to_org_id end)::int as total_dvth,
          count(distinct case when sa.is_coordination = true then sa.assigned_to_org_id end)::int as total_dvph
        from scoped_assignments sa
        group by sa.task_id
      )
      select count(*)::int as total
      from filtered_tasks ft
      join assignment_summary on assignment_summary.task_id = ft.uuid
      where 1 = 1
      ${metricFilter}
    `;
  }

  return sql`
    with scoped_assignments as (
      select
        ta.task_id,
        ta.assigned_to_org_id,
        coalesce(ta.is_coordination, false) as is_coordination,
        org.name as organization_name
      from task_assignments ta
      left join organizations org on org.uuid = ta.assigned_to_org_id
      where ${organizationFilter}
        ${assignmentFromFilter}
        ${assignmentToFilter}
    ),
    filtered_tasks as (
      select distinct
        t.uuid,
        t.title,
        t.status,
        t.priority,
        t.start_date,
        t.due_date,
        t.completed_at,
        t.created_at,
        d.document_type_id,
        coalesce(doc_type.name, 'Chưa xác định') as document_type_name,
        d.title as document_title
      from tasks t
      join scoped_assignments sa on sa.task_id = t.uuid
      join documents d on d.uuid = t.document_id
      left join category_items doc_type on doc_type.uuid = d.document_type_id
      where t.deleted_at is null
        and d.deleted_at is null
        and t.workspace_id = ${workspaceId}
        and d.workspace_id = ${workspaceId}
        ${fieldFilter}
        ${docTypeFilter}
        ${documentTypeUuidFilter}
    ),
    assignment_summary as (
      select
        sa.task_id,
        string_agg(distinct sa.organization_name, ', ' order by sa.organization_name)
          filter (where sa.is_coordination = false and sa.organization_name is not null) as org_main_names,
        string_agg(distinct sa.organization_name, ', ' order by sa.organization_name)
          filter (where sa.is_coordination = true and sa.organization_name is not null) as org_co_names,
        count(distinct case when sa.is_coordination = false then sa.assigned_to_org_id end)::int as total_dvth,
        count(distinct case when sa.is_coordination = true then sa.assigned_to_org_id end)::int as total_dvph
      from scoped_assignments sa
      group by sa.task_id
    )
    select
      ft.uuid,
      ft.title,
      ft.status,
      ft.priority,
      ft.start_date,
      ft.due_date,
      ft.completed_at,
      ft.document_type_id,
      ft.document_type_name,
      ft.document_title,
      coalesce(assignment_summary.org_main_names, '') as org_main_names,
      coalesce(assignment_summary.org_co_names, '') as org_co_names,
      coalesce(assignment_summary.total_dvth, 0) as total_dvth,
      coalesce(assignment_summary.total_dvph, 0) as total_dvph
    from filtered_tasks ft
    join assignment_summary on assignment_summary.task_id = ft.uuid
    where 1 = 1
    ${metricFilter}
    order by ft.created_at desc
    ${paginationSql}
  `;
}

export const reportTaskByDocumentType = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  const parsed = reportQuerySchema.safeParse(req.body);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const { fromDate, toDate, organization_ids, field, document_type_id } = parsed.data;
  const fieldList = parseList(field);
  const docTypeList = parseList(document_type_id);
  const organizationIds = await resolveOrganizationIds(
    workspaceId,
    req.accountId,
    parseList(organization_ids),
    Boolean(organization_ids)
  );
  const organizationFilter =
    organizationIds.length > 0
      ? sql`ta.assigned_to_org_id in (${buildInList(organizationIds)})`
      : sql`1 = 2`;
  const assignmentFromFilter = fromDate ? sql`and ta.assigned_at >= ${fromDate}` : sql``;
  const assignmentToFilter = toDate ? sql`and ta.assigned_at <= ${toDate}` : sql``;
  const fieldFilter =
    fieldList.length > 0 ? sql`and d.field_id in (${buildInList(fieldList)})` : sql``;
  const docTypeCatalogFilter =
    docTypeList.length > 0 ? sql`and ci.uuid in (${buildInList(docTypeList)})` : sql``;
  const docTypeTaskFilter =
    docTypeList.length > 0 ? sql`and d.document_type_id in (${buildInList(docTypeList)})` : sql``;

  const { rows } = await db.execute(sql`
    with scoped_assignments as (
      select
        ta.task_id,
        ta.assigned_to_org_id,
        coalesce(ta.is_coordination, false) as is_coordination
      from task_assignments ta
      where ${organizationFilter}
        ${assignmentFromFilter}
        ${assignmentToFilter}
    ),
    filtered_tasks as (
      select distinct
        t.uuid,
        d.document_type_id
      from tasks t
      join scoped_assignments sa on sa.task_id = t.uuid
      join documents d on d.uuid = t.document_id
      where t.deleted_at is null
        and d.deleted_at is null
        and t.workspace_id = ${workspaceId}
        and d.workspace_id = ${workspaceId}
        ${fieldFilter}
        ${docTypeTaskFilter}
    ),
    document_type_summary as (
      select
        ft.document_type_id as uuid,
        count(distinct ft.uuid)::int as tong_so_nhiem_vu,
        count(distinct case when sa.is_coordination = false then sa.assigned_to_org_id end)::int as tong_so_don_vi_thuc_hien,
        count(distinct case when sa.is_coordination = true then sa.assigned_to_org_id end)::int as tong_so_don_vi_phoi_hop
      from filtered_tasks ft
      join scoped_assignments sa on sa.task_id = ft.uuid
      where ft.document_type_id is not null
      group by ft.document_type_id
    )
    select
      ci.uuid,
      ci.name,
      coalesce(dts.tong_so_nhiem_vu, 0)::int as tong_so_nhiem_vu,
      coalesce(dts.tong_so_don_vi_thuc_hien, 0)::int as tong_so_don_vi_thuc_hien,
      coalesce(dts.tong_so_don_vi_phoi_hop, 0)::int as tong_so_don_vi_phoi_hop
    from category_items ci
    join categories c on c.uuid = ci.category_id
    left join document_type_summary dts on dts.uuid = ci.uuid
    where ci.status = true
      and c.code = 'DOCUMENT_TYPE'
      ${docTypeCatalogFilter}
    order by ci.sort_order nulls last, ci.name
  `);

  const { rows: totalRows } = await db.execute(sql`
    with scoped_assignments as (
      select
        ta.task_id,
        ta.assigned_to_org_id,
        coalesce(ta.is_coordination, false) as is_coordination
      from task_assignments ta
      where ${organizationFilter}
        ${assignmentFromFilter}
        ${assignmentToFilter}
    ),
    filtered_tasks as (
      select distinct
        t.uuid
      from tasks t
      join scoped_assignments sa on sa.task_id = t.uuid
      join documents d on d.uuid = t.document_id
      where t.deleted_at is null
        and d.deleted_at is null
        and t.workspace_id = ${workspaceId}
        and d.workspace_id = ${workspaceId}
        ${fieldFilter}
        ${docTypeTaskFilter}
    )
    select
      count(distinct ft.uuid)::int as tong_so_nhiem_vu,
      count(distinct case when sa.is_coordination = false then sa.assigned_to_org_id end)::int as tong_so_don_vi_thuc_hien,
      count(distinct case when sa.is_coordination = true then sa.assigned_to_org_id end)::int as tong_so_don_vi_phoi_hop
    from filtered_tasks ft
    join scoped_assignments sa on sa.task_id = ft.uuid
  `);

  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      items: rows,
      totals: totalRows?.[0] ?? {
        tong_so_nhiem_vu: 0,
        tong_so_don_vi_thuc_hien: 0,
        tong_so_don_vi_phoi_hop: 0
      },
      filters: {
        workspaceId,
        fromDate: fromDate || null,
        toDate: toDate || null,
        organizationIds,
        field: fieldList.length ? fieldList : null,
        documentTypeId: docTypeList.length ? docTypeList : null
      }
    },
    "Report task by document type retrieved successfully"
  );

  res.status(response.code).send(response);
});

export const reportTaskByDocumentTypeDetail = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  const parsed = reportDetailQuerySchema.safeParse(req.body);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const { fromDate, toDate, organization_ids, field, document_type_id, document_type_uuid, metric, page, limit } =
    parsed.data;
  const fieldList = parseList(field);
  const docTypeList = parseList(document_type_id);
  const organizationIds = await resolveOrganizationIds(
    workspaceId,
    req.accountId,
    parseList(organization_ids),
    Boolean(organization_ids)
  );
  const safePage = page ?? 1;
  const safeLimit = limit ?? 10;
  const offset = (safePage - 1) * safeLimit;
  const safeMetric = metric ?? "totalTasks";

  const { rows: countRows } = await db.execute(
    buildDocumentTypeTaskScopeQuery({
      workspaceId,
      organizationIds,
      fromDate,
      toDate,
      fieldList,
      docTypeList,
      documentTypeUuid: document_type_uuid,
      metric: safeMetric,
      countOnly: true
    })
  );

  const total = Number(countRows?.[0]?.total ?? 0);
  const totalPages = safeLimit > 0 ? Math.max(1, Math.ceil(total / safeLimit)) : 1;
  const { rows } = await db.execute(
    buildDocumentTypeTaskScopeQuery({
      workspaceId,
      organizationIds,
      fromDate,
      toDate,
      fieldList,
      docTypeList,
      documentTypeUuid: document_type_uuid,
      metric: safeMetric,
      limit: safeLimit,
      offset
    })
  );

  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      items: rows,
      pagination: {
        total,
        page: safePage,
        limit: safeLimit,
        pages: totalPages
      },
      filters: {
        workspaceId,
        fromDate: fromDate || null,
        toDate: toDate || null,
        organizationIds,
        field: fieldList.length ? fieldList : null,
        documentTypeId: docTypeList.length ? docTypeList : null,
        documentTypeUuid: document_type_uuid || null,
        metric: safeMetric
      }
    },
    "Report task by document type detail retrieved successfully"
  );

  res.status(response.code).send(response);
});

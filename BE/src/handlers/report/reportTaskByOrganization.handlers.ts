import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import { db } from "@/services/db/drizzle.ts";
import { sql, type SQL } from "drizzle-orm";
import type { Request, Response } from "express";
import { z } from "zod";
import { expandOrganizationDescendants, getAccountOrganizationIds } from "./common.ts";

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
  assigned_to_org_ids: z.union([z.string().trim(), z.array(z.string().trim())]).optional(),
  field: z.union([z.string().trim(), z.array(z.string().trim())]).optional(),
  document_type_id: z.union([z.string().trim(), z.array(z.string().trim())]).optional(),
  status: z.union([z.string().trim(), z.array(z.string().trim())]).optional()
});

type OrganizationReportFilters = {
  fromDate?: string;
  toDate?: string;
  organizationIds: string[];
  assignedToOrgIds: string[];
  fieldList: string[];
  docTypeList: string[];
  statusList: string[];
};

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

function buildTaskBucketCaseExpression(statusColumn: SQL): SQL {
  return sql`
    case
      when bool_and(${statusColumn} = 'completed') then 'completed'
      when bool_and(${statusColumn} = 'approved') then 'approved'
      when bool_and(${statusColumn} = 'rejected') then 'rejected'
      when bool_and(${statusColumn} = 'pending') then 'pending'
      when bool_and(${statusColumn} = 'new') then 'new'
      when bool_and(${statusColumn} = 'in_progress') then 'in_progress'
      else string_agg(${statusColumn}, ', ')
    end
  `;
}

async function resolveOrganizationReportFilters(req: Request, workspaceId: string): Promise<OrganizationReportFilters> {
  const parsed = reportQuerySchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpErrors.ValidationFailed(parsed.error.message);
  }

  const {
    fromDate,
    toDate,
    organization_ids,
    assigned_to_org_ids,
    field,
    document_type_id,
    status
  } = parsed.data;
  let organizationIds = parseList(organization_ids);
  let assignedToOrgIds = parseList(assigned_to_org_ids);
  const fieldList = parseList(field);
  const docTypeList = parseList(document_type_id);
  const statusList = parseList(status);

  if (organizationIds.length === 0 && req.accountId) {
    organizationIds = await getAccountOrganizationIds(req.accountId, workspaceId);
    if (organizationIds.length > 0 && !organization_ids) {
      organizationIds = await expandOrganizationDescendants(workspaceId, organizationIds);
    }
  }

  if (assignedToOrgIds.length === 0 && req.accountId) {
    assignedToOrgIds = await getAccountOrganizationIds(req.accountId, workspaceId);
    if (assignedToOrgIds.length > 0 && !assigned_to_org_ids) {
      assignedToOrgIds = await expandOrganizationDescendants(workspaceId, assignedToOrgIds);
    }
  }

  return {
    fromDate,
    toDate,
    organizationIds,
    assignedToOrgIds,
    fieldList,
    docTypeList,
    statusList
  };
}

function buildOrganizationReportSqlFilters(workspaceId: string, filters: OrganizationReportFilters) {
  let orgFilter: SQL = sql`and 1=2`;
  if (filters.organizationIds.length > 0 || filters.assignedToOrgIds.length > 0) {
    const clauses: SQL[] = [];
    if (filters.organizationIds.length > 0) {
      clauses.push(sql`t.organization_id in (${buildInList(filters.organizationIds)})`);
    }
    if (filters.assignedToOrgIds.length > 0) {
      clauses.push(sql`ta.assigned_to_org_id in (${buildInList(filters.assignedToOrgIds)})`);
    }
    orgFilter = sql`and (${sql.join(clauses, sql` and `)})`;
  }

  const orgFilterForOrg =
    filters.assignedToOrgIds.length > 0
      ? sql`and o.uuid in (${buildInList(filters.assignedToOrgIds)})`
      : filters.organizationIds.length > 0
      ? sql`and o.uuid in (${buildInList(filters.organizationIds)})`
      : sql`and 1=2`;

  const fromFilter = filters.fromDate ? sql`and ta.assigned_at >= ${filters.fromDate}` : sql``;
  const toFilter = filters.toDate ? sql`and ta.assigned_at <= ${filters.toDate}` : sql``;
  const fieldFilter =
    filters.fieldList.length > 0
      ? sql`and d.field_id in (${buildInList(filters.fieldList)})`
      : sql``;
  const docTypeFilter =
    filters.docTypeList.length > 0
      ? sql`and d.document_type_id in (${buildInList(filters.docTypeList)})`
      : sql``;
  const statusFilter =
    filters.statusList.length > 0
      ? sql`and t.status in (${buildInList(filters.statusList)})`
      : sql``;

  return {
    workspaceFilter: sql`t.deleted_at is null and t.workspace_id = ${workspaceId}`,
    orgFilter,
    orgFilterForOrg,
    fromFilter,
    toFilter,
    fieldFilter,
    docTypeFilter,
    statusFilter
  };
}

function buildWorkloadSummaryQuery(
  workspaceId: string,
  filters: OrganizationReportFilters,
  isCoordination: boolean
) {
  const { workspaceFilter, orgFilter, fromFilter, toFilter, fieldFilter, docTypeFilter, statusFilter } = buildOrganizationReportSqlFilters(workspaceId, filters);

  return sql`
    with scoped_tasks as (
      select distinct t.uuid
      from tasks t
      join task_assignments ta on t.uuid = ta.task_id
      left join documents d on t.document_id = d.uuid
      where ${workspaceFilter}
        ${statusFilter}
        ${orgFilter}
        ${fromFilter}
        ${toFilter}
        ${fieldFilter}
        ${docTypeFilter}
    ),
    scoped_assignments as (
      select
        ta.uuid as task_as_id,
        ta.status,
        ta.assigned_to_org_id as org_uuid
      from tasks t
      join task_assignments ta on t.uuid = ta.task_id
      left join documents d on t.document_id = d.uuid
      where ${workspaceFilter}
        ${statusFilter}
        ${orgFilter}
        ${fromFilter}
        ${toFilter}
        ${fieldFilter}
        ${docTypeFilter}
        and coalesce(ta.is_coordination, false) = ${isCoordination}
    ),
    task_buckets as (
      select
        sa.task_as_id,
        sa.org_uuid,
        ${buildTaskBucketCaseExpression(sql`sa.status`)} as task_bucket
      from scoped_assignments sa
      group by sa.task_as_id, sa.org_uuid
    )
    select
      (select count(*)::int from scoped_tasks) as total_actual,
      count(*)::int as total,
      count(distinct tb.org_uuid)::int as total_organizations,
      count(*) filter (where tb.task_bucket = 'completed')::int as completed,
      count(*) filter (where tb.task_bucket = 'in_progress')::int as in_progress,
      count(*) filter (where tb.task_bucket = 'new')::int as new,
      count(*) filter (where tb.task_bucket = 'pending')::int as pending,
      count(*) filter (where tb.task_bucket = 'rejected')::int as rejected,
      count(*) filter (where tb.task_bucket = 'approved')::int as approved,
      array_agg(tb.task_bucket) filter (where tb.task_bucket not in ('completed', 'in_progress', 'new', 'pending', 'rejected', 'approved')) as list_name_status_order
    from task_buckets tb
  `;
}

export const reportTaskByOrganization = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  const filters = await resolveOrganizationReportFilters(req, workspaceId);
  const { organizationIds, fieldList, docTypeList, fromDate, toDate } = filters;
  const { orgFilter, orgFilterForOrg, fromFilter, toFilter, fieldFilter, docTypeFilter, statusFilter } =
    buildOrganizationReportSqlFilters(workspaceId, {
      statusList: [],
      assignedToOrgIds :organizationIds,
      organizationIds,
      fieldList,
      docTypeList,
      fromDate,
      toDate
    });

  const { rows } = await db.execute(sql`
    with recursive scoped_assignments as (
      select
        ta.assigned_to_org_id as org_uuid,
        t.uuid as task_id,
        ta.uuid as task_as_id,
        coalesce(ta.is_coordination, false) as is_coordination,
        ta.status
      from tasks t
      join task_assignments ta on t.uuid = ta.task_id
      left join documents d on t.document_id = d.uuid
      where t.deleted_at is null
        and t.workspace_id = ${workspaceId}
        ${statusFilter}
        ${orgFilter}
        ${fromFilter}
        ${toFilter}
        ${fieldFilter}
        ${docTypeFilter}
    ),
    assignment_task_buckets as (
      select
        sa.org_uuid,
        sa.task_as_id,
        sa.is_coordination,
        ${buildTaskBucketCaseExpression(sql`sa.status`)} as task_bucket
      from scoped_assignments sa
      group by sa.org_uuid, sa.task_as_id, sa.is_coordination
    ),
    org_stat as (
      select
        o.uuid,
        o.name,
        o.code,
        o.parent_id,
        o.sort_order,
        count(distinct atb.task_as_id) as tong_cong,
        count(*) filter (where atb.is_coordination = false) as tongxlc,
        count(*) filter (where atb.is_coordination = true) as tongphxl,
        count(*) filter (where atb.is_coordination = false and atb.task_bucket = 'new') as sl_xlc_cho_tiep_nhan,
        count(*) filter (where atb.is_coordination = false and atb.task_bucket = 'in_progress') as sl_xlc_dang_xu_ly,
        count(*) filter (where atb.is_coordination = false and atb.task_bucket = 'completed') as sl_xlc_hoan_thanh,
        count(*) filter (where atb.is_coordination = false and atb.task_bucket = 'pending') as sl_xlc_cho_duyet,
        count(*) filter (where atb.is_coordination = false and atb.task_bucket = 'rejected') as sl_xlc_tu_choi,
        count(*) filter (where atb.is_coordination = false and atb.task_bucket = 'approved') as sl_xlc_phe_duyet,
        count(*) filter (where atb.is_coordination = true and atb.task_bucket = 'new') as sl_phxl_cho_tiep_nhan,
        count(*) filter (where atb.is_coordination = true and atb.task_bucket = 'in_progress') as sl_phxl_dang_xu_ly,
        count(*) filter (where atb.is_coordination = true and atb.task_bucket = 'completed') as sl_phxl_hoan_thanh
        ,
        count(*) filter (where atb.is_coordination = true and atb.task_bucket = 'pending') as sl_phxl_cho_duyet,
        count(*) filter (where atb.is_coordination = true and atb.task_bucket = 'rejected') as sl_phxl_tu_choi,
        count(*) filter (where atb.is_coordination = true and atb.task_bucket = 'approved') as sl_phxl_phe_duyet
      from organizations o
      left join assignment_task_buckets atb on o.uuid = atb.org_uuid
      where o.deleted_at is null
        and o.workspace_id = ${workspaceId}
        ${orgFilterForOrg}
      group by o.uuid, o.name, o.code, o.parent_id, o.sort_order
    ),
    tree as (
      select
        o.uuid,
        o.name,
        o.code,
        o.parent_id,
        o.sort_order,
        o.tong_cong,
        o.tongxlc,
        o.tongphxl,
        o.sl_xlc_cho_tiep_nhan,
        o.sl_xlc_dang_xu_ly,
        o.sl_xlc_hoan_thanh,
        o.sl_xlc_cho_duyet,
        o.sl_xlc_tu_choi,
        o.sl_xlc_phe_duyet,
        o.sl_phxl_cho_tiep_nhan,
        o.sl_phxl_dang_xu_ly,
        o.sl_phxl_hoan_thanh,
        o.sl_phxl_cho_duyet,
        o.sl_phxl_tu_choi,
        o.sl_phxl_phe_duyet,
        row_number() over (order by o.sort_order nulls last, o.name)::text as stt,
        lpad(row_number() over (order by o.sort_order nulls last, o.name)::text, 5, '0') as sort_path,
        1 as level
      from org_stat o
      where o.parent_id is null
        or not exists (select 1 from org_stat p where p.uuid = o.parent_id)

      union all

      select
        c.uuid,
        c.name,
        c.code,
        c.parent_id,
        c.sort_order,
        c.tong_cong,
        c.tongxlc,
        c.tongphxl,
        c.sl_xlc_cho_tiep_nhan,
        c.sl_xlc_dang_xu_ly,
        c.sl_xlc_hoan_thanh,
        c.sl_xlc_cho_duyet,
        c.sl_xlc_tu_choi,
        c.sl_xlc_phe_duyet,
        c.sl_phxl_cho_tiep_nhan,
        c.sl_phxl_dang_xu_ly,
        c.sl_phxl_hoan_thanh,
        c.sl_phxl_cho_duyet,
        c.sl_phxl_tu_choi,
        c.sl_phxl_phe_duyet,
        t.stt || '.' || s.sibling_no::text as stt,
        t.sort_path || '.' || lpad(s.sibling_no::text, 5, '0') as sort_path,
        t.level + 1 as level
      from tree t
      join (
        select
          c.*,
          row_number() over (partition by c.parent_id order by c.sort_order nulls last, c.name) as sibling_no
        from org_stat c
      ) s on s.parent_id = t.uuid
      join org_stat c on c.uuid = s.uuid
    )
    select
      stt,
      uuid,
      name,
      code,
      parent_id,
      coalesce(tong_cong, 0) as tong_cong,
      coalesce(tongxlc, 0) as tongxlc,
      coalesce(tongphxl, 0) as tongphxl,
      coalesce(sl_xlc_cho_tiep_nhan, 0) as sl_xlc_cho_tiep_nhan,
      coalesce(sl_xlc_dang_xu_ly, 0) as sl_xlc_dang_xu_ly,
      coalesce(sl_xlc_hoan_thanh, 0) as sl_xlc_hoan_thanh,
      coalesce(sl_xlc_cho_duyet, 0) as sl_xlc_cho_duyet,
      coalesce(sl_xlc_tu_choi, 0) as sl_xlc_tu_choi,
      coalesce(sl_xlc_phe_duyet, 0) as sl_xlc_phe_duyet,
      coalesce(sl_phxl_cho_tiep_nhan, 0) as sl_phxl_cho_tiep_nhan,
      coalesce(sl_phxl_dang_xu_ly, 0) as sl_phxl_dang_xu_ly,
      coalesce(sl_phxl_hoan_thanh, 0) as sl_phxl_hoan_thanh,
      coalesce(sl_phxl_cho_duyet, 0) as sl_phxl_cho_duyet,
      coalesce(sl_phxl_tu_choi, 0) as sl_phxl_tu_choi,
      coalesce(sl_phxl_phe_duyet, 0) as sl_phxl_phe_duyet,
      level
    from tree
    order by sort_path
  `);

  const totalsResult = await db.execute(sql`
    with scoped_assignments as (
      select
        t.uuid as task_id,
        ta.uuid as task_as_id,
        coalesce(ta.is_coordination, false) as is_coordination,
        ta.status
      from tasks t
      join task_assignments ta on t.uuid = ta.task_id
      left join documents d on t.document_id = d.uuid
      where t.deleted_at is null
        and t.workspace_id = ${workspaceId}
        ${statusFilter}
        ${orgFilter}
        ${fromFilter}
        ${toFilter}
        ${fieldFilter}
        ${docTypeFilter}
    ),
    task_buckets as (
      select
        sa.task_as_id,
        sa.task_id,
        sa.is_coordination,
        ${buildTaskBucketCaseExpression(sql`sa.status`)} as task_bucket
      from scoped_assignments sa
      group by sa.task_as_id, sa.task_id, sa.is_coordination
    )
    select
      count(distinct tb.task_id) as total_actual,
      count(*) filter (where tb.is_coordination = false) as xlc_tong,
      count(*) filter (where tb.is_coordination = false and tb.task_bucket = 'completed') as xlc_hoan_thanh,
      count(*) filter (where tb.is_coordination = false and tb.task_bucket = 'in_progress') as xlc_dang_thuc_hien,
      count(*) filter (where tb.is_coordination = false and tb.task_bucket = 'new') as xlc_cho_tiep_nhan,
      count(*) filter (where tb.is_coordination = false and tb.task_bucket = 'pending') as xlc_cho_duyet,
      count(*) filter (where tb.is_coordination = false and tb.task_bucket = 'rejected') as xlc_tu_choi,
      count(*) filter (where tb.is_coordination = false and tb.task_bucket = 'approved') as xlc_phe_duyet,
      count(*) filter (where tb.is_coordination = true) as phxl_tong,
      count(*) filter (where tb.is_coordination = true and tb.task_bucket = 'completed') as phxl_hoan_thanh,
      count(*) filter (where tb.is_coordination = true and tb.task_bucket = 'in_progress') as phxl_dang_thuc_hien,
      count(*) filter (where tb.is_coordination = true and tb.task_bucket = 'new') as phxl_cho_tiep_nhan,
      count(*) filter (where tb.is_coordination = true and tb.task_bucket = 'pending') as phxl_cho_duyet,
      count(*) filter (where tb.is_coordination = true and tb.task_bucket = 'rejected') as phxl_tu_choi,
      count(*) filter (where tb.is_coordination = true and tb.task_bucket = 'approved') as phxl_phe_duyet
    from task_buckets tb
  `);

  const totalsRow = (totalsResult.rows?.[0] ?? {}) as Record<string, unknown>;
  const totals = {
    totalActual: Number(totalsRow.total_actual ?? 0),
    xlcTong: Number(totalsRow.xlc_tong ?? 0),
    xlcHoanThanh: Number(totalsRow.xlc_hoan_thanh ?? 0),
    xlcDangXuLy: Number(totalsRow.xlc_dang_thuc_hien ?? 0),
    xlcChoTiepNhan: Number(totalsRow.xlc_cho_tiep_nhan ?? 0),
    xlcChoDuyet: Number(totalsRow.xlc_cho_duyet ?? 0),
    xlcTuChoi: Number(totalsRow.xlc_tu_choi ?? 0),
    xlcPheDuyet: Number(totalsRow.xlc_phe_duyet ?? 0),
    phxlTong: Number(totalsRow.phxl_tong ?? 0),
    phxlHoanThanh: Number(totalsRow.phxl_hoan_thanh ?? 0),
    phxlDangXuLy: Number(totalsRow.phxl_dang_thuc_hien ?? 0),
    phxlChoTiepNhan: Number(totalsRow.phxl_cho_tiep_nhan ?? 0),
    phxlChoDuyet: Number(totalsRow.phxl_cho_duyet ?? 0),
    phxlTuChoi: Number(totalsRow.phxl_tu_choi ?? 0),
    phxlPheDuyet: Number(totalsRow.phxl_phe_duyet ?? 0)
  };

  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      items: rows,
      totals,
      filters: {
        workspaceId,
        fromDate: fromDate || null,
        toDate: toDate || null,
        organizationIds,
        field: fieldList.length ? fieldList : null,
        documentTypeId: docTypeList.length ? docTypeList : null,
        status: filters.statusList.length ? filters.statusList : null
      }
    },
    "Report task by organization retrieved successfully"
  );

  res.status(response.code).send(response);
});

export const reportTaskDashboardMainWorkload = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  const filters = await resolveOrganizationReportFilters(req, workspaceId);
  const { rows } = await db.execute(buildWorkloadSummaryQuery(workspaceId, filters, false));
  const row = (rows?.[0] ?? {}) as Record<string, unknown>;

  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      totalActual: Number(row.total_actual ?? 0),
      totalOrganizations: Number(row.total_organizations ?? 0),
      total: Number(row.total ?? 0),
      completed: Number(row.completed ?? 0),
      inProgress: Number(row.in_progress ?? 0),
      new: Number(row.new ?? 0),
      pending: Number(row.pending ?? 0),
      rejected: Number(row.rejected ?? 0),
      approved: Number(row.approved ?? 0),
      listAllStatusOrders: row.list_name_status_order ?? []
    },
    "Dashboard main workload retrieved successfully"
  );

  res.status(response.code).send(response);
});

export const reportTaskDashboardCoordinationWorkload = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const workspaceId = req.workspaceId?.trim();
    if (!workspaceId) {
      const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
      res.status(response.code).send(response);
      return;
    }

    const filters = await resolveOrganizationReportFilters(req, workspaceId);
    const { rows } = await db.execute(buildWorkloadSummaryQuery(workspaceId, filters, true));
    const row = (rows?.[0] ?? {}) as Record<string, unknown>;

    const response = apiResponse.success(
      HttpStatusCode.OK,
      {
        totalActual: Number(row.total_actual ?? 0),
        totalOrganizations: Number(row.total_organizations ?? 0),
        total: Number(row.total ?? 0),
        completed: Number(row.completed ?? 0),
        inProgress: Number(row.in_progress ?? 0),
        new: Number(row.new ?? 0),
        pending: Number(row.pending ?? 0),
        rejected: Number(row.rejected ?? 0),
        approved: Number(row.approved ?? 0),
        listAllStatusOrders: row.list_name_status_order ?? []
      },
      "Dashboard coordination workload retrieved successfully"
    );

    res.status(response.code).send(response);
  }
);
export const reportTaskDashboardTotal = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }
  const organizationId = req.body?.organizationId;
  const typeTask = req.body?.typeTask ?? null;
  const fromDate = req.body?.fromDate ?? null;
  const toDate = req.body?.toDate ?? null;
  const documentIds = Array.isArray(req.body?.document_ids)
    ? req.body.document_ids.filter(Boolean)
    : typeof req.body?.document_ids === "string" && req.body.document_ids.trim()
    ? req.body.document_ids
        .split(",")
        .map((value: string) => value.trim())
        .filter(Boolean)
    : null;
  const documentIdsParam =
    documentIds && documentIds.length > 0
      ? sql`array[${sql.join(documentIds.map((id: string) => sql`${id}::uuid`), sql`, `)}]`
      : sql`null::uuid[]`;
  let rows;

  if (typeTask == 1) {
    ({ rows } = await db.execute(sql`
    select public.fn_report_summary_cards_delivered(
      ${organizationId}::uuid,
      ${fromDate}::date,
      ${toDate}::date,
      ${documentIdsParam}
    ) as data
  `));
  } else {
    ({ rows } = await db.execute(sql`
    select public.fn_report_summary_cards(
      ${organizationId}::uuid,
      ${fromDate}::date,
      ${toDate}::date,
      ${documentIdsParam}
    ) as data
  `));
  }
  const data = (rows?.[0]?.data ?? {}) as Record<string, unknown>;
  const summaryCards = (data.summaryCards ?? {}) as Record<string, unknown>;

  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      total: Number(summaryCards.total ?? 0),
      completedOnTime: Number(summaryCards.completedOnTime ?? 0),
      completedLate: Number(summaryCards.completedLate ?? 0),
      inProgress: Number(summaryCards.inProgress ?? 0),
      inProgressAwaitingAcceptance: Number(summaryCards.inProgressAwaitingAcceptance ?? 0),
      inProgressAcceptance: Number(summaryCards.inProgressAcceptance ?? 0),
      overdueInProgress: Number(summaryCards.overdueInProgress ?? 0),
      overdueInProgressAwaitingAcceptance: Number(summaryCards.overdueInProgressAwaitingAcceptance ?? 0),
      overdueInProgressAcceptance: Number(summaryCards.overdueInProgressAcceptance ?? 0),
      upcomingDeadline: Number(summaryCards.upcomingDeadline ?? 0)
    },
    "Dashboard summary cards retrieved successfully"
  );

  res.status(response.code).send(response);
});

export const reportTimelineDashboardTotal = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  const organizationId = req.body?.organizationId ?? req.body?.organization_id ?? null;
  const typeTask = req.body?.typeTask ?? null;

  const rawDocumentIds = Array.isArray(req.body?.document_ids)
    ? req.body.document_ids.filter(Boolean)
    : typeof req.body?.document_ids === "string" && req.body.document_ids.trim()
      ? req.body.document_ids
          .split(",")
          .map((value: string) => value.trim())
          .filter(Boolean)
      : [];

  const documentIds = rawDocumentIds.length > 0 ? rawDocumentIds : null;

  const documentIdsParam =
    documentIds && documentIds.length > 0
      ? sql`array[${sql.join(
          documentIds.map((id: string) => sql`${id}::uuid`),
          sql`, `
        )}]`
      : sql`null::uuid[]`;

  let rows;

  if (typeTask == 1) {
    ({ rows } = await db.execute(sql`
      select public.fn_report_timeline_stats_delivered(
        ${organizationId}::uuid,
        ${documentIdsParam}
      ) as data
    `));
  } else {
    ({ rows } = await db.execute(sql`
      select public.fn_report_timeline_stats(
        ${organizationId}::uuid,
        ${documentIdsParam}
      ) as data
    `));
  }

  const data = (rows?.[0]?.data ?? {}) as Record<string, unknown>;
  const extraCharts = (data.extraCharts ?? {}) as Record<string, unknown>;

  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      timelineStats: extraCharts.timelineStats ?? []
    },
    "Dashboard timeline stats retrieved successfully"
  );

  res.status(response.code).send(response);
});

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

const reportDashboardQuerySchema = z.object({
  fromDate: optionalDateString,
  toDate: optionalDateString,
  organization_ids: z.union([z.string().trim(), z.array(z.string().trim())]).optional(),
  related_organization_ids: z.union([z.string().trim(), z.array(z.string().trim())]).optional(),
  assigned_to_org_ids: z.union([z.string().trim(), z.array(z.string().trim())]).optional(),
  document_ids: z.union([z.string().trim(), z.array(z.string().trim())]).optional(),
  field: z.union([z.string().trim(), z.array(z.string().trim())]).optional(),
  document_type_id: z.union([z.string().trim(), z.array(z.string().trim())]).optional(),
  status: z.union([z.string().trim(), z.array(z.string().trim())]).optional(),
  topLimit: z.coerce.number().int().min(1).max(20).optional(),
  monthSpan: z.coerce.number().int().min(3).max(12).optional()
});

type ParsedDashboardFilters = {
  fromDate: string;
  toDate: string;
  organizationIds: string[];
  relatedOrganizationIds: string[];
  assignedToOrgIds: string[];
  documentIds: string[];
  fieldList: string[];
  docTypeList: string[];
  statusList: string[];
  safeTopLimit: number;
  safeMonthSpan: number;
};

function formatDateOnly(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getDefaultDashboardDateRange(): { fromDate: string; toDate: string } {
  const today = new Date();
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return {
    fromDate: formatDateOnly(new Date(today.getFullYear(), today.getMonth(), 1)),
    toDate: formatDateOnly(endOfMonth)
  };
}

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

function parseDashboardFilters(body: unknown): ParsedDashboardFilters {
  const parsed = reportDashboardQuerySchema.safeParse(body);
  if (!parsed.success) {
    throw HttpErrors.ValidationFailed(parsed.error.message);
  }

  const defaults = getDefaultDashboardDateRange();
  const {
    fromDate,
    toDate,
    organization_ids,
    related_organization_ids,
    assigned_to_org_ids,
    document_ids,
    field,
    document_type_id,
    status,
    topLimit,
    monthSpan
  } = parsed.data;

  return {
    fromDate: fromDate ?? defaults.fromDate,
    toDate: toDate ?? defaults.toDate,
    organizationIds: parseList(organization_ids),
    relatedOrganizationIds: parseList(related_organization_ids),
    assignedToOrgIds: parseList(assigned_to_org_ids),
    documentIds: parseList(document_ids),
    fieldList: parseList(field),
    docTypeList: parseList(document_type_id),
    statusList: parseList(status),
    safeTopLimit: topLimit ?? 10,
    safeMonthSpan: monthSpan ?? 6
  };
}

async function resolveDashboardScope(
  accountId: string | undefined,
  workspaceId: string,
  filters: ParsedDashboardFilters
): Promise<string[]> {
  if (
    filters.organizationIds.length > 0 ||
    filters.relatedOrganizationIds.length > 0 ||
    filters.assignedToOrgIds.length > 0 ||
    !accountId
  ) {
    return [];
  }

  const accountOrgIds = await getAccountOrganizationIds(accountId, workspaceId);
  if (accountOrgIds.length === 0) {
    return [];
  }

  return expandOrganizationDescendants(workspaceId, accountOrgIds);
}

function buildTaskWhereClause(workspaceId: string, filters: ParsedDashboardFilters, scopeOrgIds: string[]): SQL {
  const whereParts: SQL[] = [
    sql`t.deleted_at is null`,
    sql`t.workspace_id = ${workspaceId}`
  ];

  if (filters.organizationIds.length > 0) {
    whereParts.push(sql`t.organization_id in (${buildInList(filters.organizationIds)})`);
  }

  if (filters.relatedOrganizationIds.length > 0) {
    whereParts.push(sql`(
      t.organization_id in (${buildInList(filters.relatedOrganizationIds)})
      or fa.assigned_to_org_id in (${buildInList(filters.relatedOrganizationIds)})
    )`);
  }

  if (scopeOrgIds.length > 0) {
    whereParts.push(sql`(
      t.organization_id in (${buildInList(scopeOrgIds)})
      or fa.assigned_to_org_id in (${buildInList(scopeOrgIds)})
    )`);
  }

  if (filters.fieldList.length > 0) {
    whereParts.push(sql`coalesce(d.field_id, t.field_id) in (${buildInList(filters.fieldList)})`);
  }

  if (filters.documentIds.length > 0) {
    whereParts.push(sql`d.uuid in (${buildInList(filters.documentIds)})`);
  }

  if (filters.docTypeList.length > 0) {
    whereParts.push(sql`d.document_type_id in (${buildInList(filters.docTypeList)})`);
  }

  if (filters.statusList.length > 0) {
    whereParts.push(sql`t.status in (${buildInList(filters.statusList)})`);
  }

  return sql.join(whereParts, sql` and `);
}

function buildAssignmentSeedWhereClause(workspaceId: string, filters: ParsedDashboardFilters, scopeOrgIds: string[]): SQL {
  const whereParts: SQL[] = [
    sql`task_ref.deleted_at is null`,
    sql`task_ref.workspace_id = ${workspaceId}`,
    sql`ta.assigned_at >= ${filters.fromDate}`,
    sql`ta.assigned_at <= ${filters.toDate}`
  ];

  if (filters.assignedToOrgIds.length > 0) {
    whereParts.push(sql`ta.assigned_to_org_id in (${buildInList(filters.assignedToOrgIds)})`);
  } else if (scopeOrgIds.length > 0) {
    whereParts.push(sql`ta.assigned_to_org_id in (${buildInList(scopeOrgIds)})`);
  }

  return sql.join(whereParts, sql` and `);
}

function buildAssignmentScopeWhereClause(filters: ParsedDashboardFilters, scopeOrgIds: string[]): SQL {
  const whereParts: SQL[] = [sql`sa.task_id in (select uuid from filtered_tasks)`];

  if (filters.assignedToOrgIds.length > 0) {
    whereParts.push(sql`sa.assigned_to_org_id in (${buildInList(filters.assignedToOrgIds)})`);
  } else if (scopeOrgIds.length > 0) {
    whereParts.push(sql`sa.assigned_to_org_id in (${buildInList(scopeOrgIds)})`);
  }

  return sql.join(whereParts, sql` and `);
}

function buildDashboardBaseCtes(workspaceId: string, filters: ParsedDashboardFilters, scopeOrgIds: string[]): SQL {
  const taskWhereClause = buildTaskWhereClause(workspaceId, filters, scopeOrgIds);
  const assignmentSeedWhereClause = buildAssignmentSeedWhereClause(workspaceId, filters, scopeOrgIds);
  const assignmentScopeWhereClause = buildAssignmentScopeWhereClause(filters, scopeOrgIds);

  return sql`
    with latest_progress as (
      select
        tp.task_id,
        max(coalesce(tp.progress_percent, 0)) as progress_percent
      from task_progress tp
      group by tp.task_id
    ),
    scoped_assignments as (
      select
        ta.uuid as assignment_uuid,
        ta.task_id,
        ta.assigned_to_org_id,
        coalesce(ta.is_coordination, false) as is_coordination,
        ta.status as assignment_status,
        ta.assigned_at,
        assigned_org.name as assigned_organization_name
      from task_assignments ta
      join tasks task_ref on task_ref.uuid = ta.task_id
      left join organizations assigned_org on assigned_org.uuid = ta.assigned_to_org_id
      where ${assignmentSeedWhereClause}
    ),
    filtered_tasks as (
      select distinct
        t.uuid,
        t.title,
        t.status,
        t.start_date,
        t.due_date,
        t.completed_at,
        t.created_at,
        t.organization_id,
        source_org.name as source_organization_name,
        d.uuid as document_uuid,
        d.document_number,
        d.title as document_title,
        d.issued_date,
        coalesce(d.field_id, t.field_id) as field_id,
        field_item.name as field_name,
        d.document_type_id,
        doc_type.name as document_type_name,
        coalesce(lp.progress_percent, 0)::int as progress_percent,
        case
          when t.status = 'completed'
            and t.completed_at is not null
            and t.due_date is not null
            and t.completed_at::date > t.due_date then 'completedLate'
          when t.status = 'completed' then 'completedOnTime'
          when t.status = 'overdue'
            or (t.status <> 'completed' and t.due_date is not null and t.due_date < current_date) then 'overdue'
          when t.status = 'in_progress' then 'inProgress'
          when t.status = 'new' then 'waiting'
          else 'other'
        end as semantic_status
      from tasks t
      left join documents d on d.uuid = t.document_id
        and d.deleted_at is null
        and d.workspace_id = ${workspaceId}
      left join organizations source_org on source_org.uuid = t.organization_id
      left join category_items field_item on field_item.uuid = coalesce(d.field_id, t.field_id)
      left join category_items doc_type on doc_type.uuid = d.document_type_id
      left join latest_progress lp on lp.task_id = t.uuid
      join scoped_assignments fa on fa.task_id = t.uuid
      where ${taskWhereClause}
    ),
    assignment_scope as (
      select
        sa.assignment_uuid,
        sa.task_id,
        sa.assigned_to_org_id,
        sa.is_coordination,
        sa.assignment_status,
        sa.assigned_organization_name
      from scoped_assignments sa
      where ${assignmentScopeWhereClause}
    ),
    assignment_summary as (
      select
        fa.task_id,
        string_agg(distinct fa.assigned_organization_name, ', ' order by fa.assigned_organization_name)
          filter (where fa.assigned_organization_name is not null) as assigned_organizations
      from assignment_scope fa
      group by fa.task_id
    )
  `;
}

function buildTopOrganizationsQuery(workspaceId: string, filters: ParsedDashboardFilters, scopeOrgIds: string[]): SQL {
  const baseCtes = buildDashboardBaseCtes(workspaceId, filters, scopeOrgIds);

  return sql`
    ${baseCtes}
    select
      fa.assigned_to_org_id as uuid,
      coalesce(fa.assigned_organization_name, 'Chưa rõ đơn vị') as name,
      count(*)::int as total_assignments,
      count(distinct fa.task_id)::int as total_tasks
    from assignment_scope fa
    group by fa.assigned_to_org_id, fa.assigned_organization_name
    order by total_assignments desc, name
    limit ${filters.safeTopLimit}
  `;
}

function buildTopFieldsQuery(workspaceId: string, filters: ParsedDashboardFilters, scopeOrgIds: string[]): SQL {
  const baseCtes = buildDashboardBaseCtes(workspaceId, filters, scopeOrgIds);

  return sql`
    ${baseCtes}
    select
      ft.field_id as uuid,
      coalesce(ft.field_name, 'Chưa phân lĩnh vực') as name,
      count(*)::int as total_tasks
    from filtered_tasks ft
    group by ft.field_id, ft.field_name
    order by total_tasks desc, name
    limit ${filters.safeTopLimit}
  `;
}

function buildTopDocumentsQuery(workspaceId: string, filters: ParsedDashboardFilters, scopeOrgIds: string[]): SQL {
  const baseCtes = buildDashboardBaseCtes(workspaceId, filters, scopeOrgIds);

  return sql`
    ${baseCtes}
    select
      ft.document_uuid as uuid,
      coalesce(ft.document_number, '') as document_number,
      coalesce(ft.document_title, 'Chưa có văn bản') as title,
      ft.issued_date,
      count(*)::int as total_tasks,
      count(*) filter (where ft.status = 'completed')::int as completed_tasks,
      count(*) filter (where ft.semantic_status = 'overdue')::int as overdue_tasks
    from filtered_tasks ft
    where ft.document_uuid is not null
    group by ft.document_uuid, ft.document_number, ft.document_title, ft.issued_date
    order by total_tasks desc, title
    limit ${filters.safeTopLimit}
  `;
}

function buildTopParticipationTasksQuery(workspaceId: string, filters: ParsedDashboardFilters, scopeOrgIds: string[]): SQL {
  const baseCtes = buildDashboardBaseCtes(workspaceId, filters, scopeOrgIds);

  return sql`
    ${baseCtes}
    select
      ft.uuid,
      ft.title,
      ''::text as document_number,
      coalesce(ft.document_title, '') as document_title,
      count(distinct fa.assigned_to_org_id)::int as total_units,
      count(distinct case when fa.is_coordination = false then fa.assigned_to_org_id end)::int as total_main_units,
      count(distinct case when fa.is_coordination = true then fa.assigned_to_org_id end)::int as total_coordination_units
    from filtered_tasks ft
    join assignment_scope fa on fa.task_id = ft.uuid
    group by ft.uuid, ft.title, ft.document_number, ft.document_title
    order by total_units desc, total_main_units desc, total_coordination_units desc, ft.title
    limit ${filters.safeTopLimit}
  `;
}

function buildDashboardFiltersPayload(workspaceId: string, filters: ParsedDashboardFilters, scopeOrgIds: string[]): Record<string, unknown> {
  return {
    workspaceId,
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    organizationIds: filters.organizationIds,
    relatedOrganizationIds: filters.relatedOrganizationIds,
    assignedToOrgIds: filters.assignedToOrgIds,
    documentIds: filters.documentIds,
    field: filters.fieldList,
    documentTypeId: filters.docTypeList,
    status: filters.statusList,
    scopeOrganizationIds: scopeOrgIds,
    topLimit: filters.safeTopLimit,
    monthSpan: filters.safeMonthSpan
  };
}

export const reportTaskDashboard = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  const filters = parseDashboardFilters(req.body);
  const scopeOrgIds = await resolveDashboardScope(req.accountId, workspaceId, filters);

  const [topOrganizationsResult, topFieldsResult, topDocumentsResult, topParticipationTasksResult] =
    await Promise.all([
      db.execute(buildTopOrganizationsQuery(workspaceId, filters, scopeOrgIds)),
      db.execute(buildTopFieldsQuery(workspaceId, filters, scopeOrgIds)),
      db.execute(buildTopDocumentsQuery(workspaceId, filters, scopeOrgIds)),
      db.execute(buildTopParticipationTasksQuery(workspaceId, filters, scopeOrgIds))
    ]);

  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      topOrganizations: topOrganizationsResult.rows,
      topFields: topFieldsResult.rows,
      topDocuments: topDocumentsResult.rows,
      highlights: {
        topParticipationTasks: topParticipationTasksResult.rows
      },
      filters: buildDashboardFiltersPayload(workspaceId, filters, scopeOrgIds)
    },
    "Report task dashboard retrieved successfully"
  );

  res.status(response.code).send(response);
});

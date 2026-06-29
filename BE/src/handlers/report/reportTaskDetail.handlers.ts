import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import { db } from "@/services/db/drizzle.ts";
import { expandOrganizationDescendants, getAccountOrganizationIds } from "./common.ts";
import { sql } from "drizzle-orm";
import type { Request, Response } from "express";
import { z } from "zod";
import XLSX from "xlsx-js-style";

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
  status: z.union([z.string().trim(), z.array(z.string().trim())]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(5000).optional()
});

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

type ReportFilters = {
  orgFilter: ReturnType<typeof sql>;
  assignedOrgFilter: ReturnType<typeof sql>;
  fieldFilter: ReturnType<typeof sql>;
  docTypeFilter: ReturnType<typeof sql>;
  fromFilter: ReturnType<typeof sql>;
  toFilter: ReturnType<typeof sql>;
  statusFilter: ReturnType<typeof sql>;
  orgFilterSub: ReturnType<typeof sql>;
  assignedOrgFilterSub: ReturnType<typeof sql>;
  fieldFilterSub: ReturnType<typeof sql>;
  docTypeFilterSub: ReturnType<typeof sql>;
  fromFilterSub: ReturnType<typeof sql>;
  toFilterSub: ReturnType<typeof sql>;
  statusFilterSub: ReturnType<typeof sql>;
};

function buildFilters(params: {
  organizationIds: string[];
  assignedToOrgIds: string[];
  fieldList: string[];
  docTypeList: string[];
  statusList: string[];
  fromDate?: string;
  toDate?: string;
}): ReportFilters {
  const { organizationIds, assignedToOrgIds, fieldList, docTypeList, statusList, fromDate, toDate } = params;

  const orgFilter =
    organizationIds.length > 0
      ? sql`and t.organization_id in (${sql.join(organizationIds.map((id) => sql`${id}`), sql`,`)})`
      : sql``;

  const assignedOrgFilter =
    assignedToOrgIds.length > 0
      ? sql`and ta.assigned_to_org_id in (${sql.join(assignedToOrgIds.map((id) => sql`${id}`), sql`,`)})`
      : sql``;

  const fieldFilter =
    fieldList.length > 0
      ? sql`and t.field_id in (${sql.join(fieldList.map((value) => sql`${value}`), sql`,`)})`
      : sql``;

  const docTypeFilter =
    docTypeList.length > 0
      ? sql`and d.document_type_id in (${sql.join(docTypeList.map((value) => sql`${value}`), sql`,`)})`
      : sql``;

  const fromFilter = fromDate ? sql`and t.created_at >= ${fromDate}` : sql``;
  const toFilter = toDate ? sql`and t.created_at <= ${toDate}` : sql``;

  const statusFilter =
    statusList.length > 0
      ? sql`and ta.status in (${sql.join(statusList.map((value) => sql`${value}`), sql`,`)})`
      : sql``;

  const orgFilterSub =
    organizationIds.length > 0
      ? sql`and t_sub.organization_id in (${sql.join(organizationIds.map((id) => sql`${id}`), sql`,`)})`
      : sql``;
  const assignedOrgFilterSub =
    assignedToOrgIds.length > 0
      ? sql`and ta_sub.assigned_to_org_id in (${sql.join(assignedToOrgIds.map((id) => sql`${id}`), sql`,`)})`
      : sql``;
  const fieldFilterSub =
    fieldList.length > 0
      ? sql`and t_sub.field_id in (${sql.join(fieldList.map((value) => sql`${value}`), sql`,`)})`
      : sql``;
  const docTypeFilterSub =
    docTypeList.length > 0
      ? sql`and d_sub.document_type_id in (${sql.join(docTypeList.map((value) => sql`${value}`), sql`,`)})`
      : sql``;
  const fromFilterSub = fromDate ? sql`and t_sub.created_at >= ${fromDate}` : sql``;
  const toFilterSub = toDate ? sql`and t_sub.created_at <= ${toDate}` : sql``;
  const statusFilterSub =
    statusList.length > 0
      ? sql`and ta_sub.status in (${sql.join(statusList.map((value) => sql`${value}`), sql`,`)})`
      : sql``;

  return {
    orgFilter,
    assignedOrgFilter,
    fieldFilter,
    docTypeFilter,
    fromFilter,
    toFilter,
    statusFilter,
    orgFilterSub,
    assignedOrgFilterSub,
    fieldFilterSub,
    docTypeFilterSub,
    fromFilterSub,
    toFilterSub,
    statusFilterSub
  };
}

function formatDate(value?: string | null): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const day = `${parsed.getDate()}`.padStart(2, "0");
  const month = `${parsed.getMonth() + 1}`.padStart(2, "0");
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
}

function applyExcelBorderAndFont(worksheet: XLSX.WorkSheet): void {
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const address = XLSX.utils.encode_cell({ r, c });
      const cell = worksheet[address];
      if (!cell) continue;
      if (!cell.s) cell.s = {};
      cell.s.border = {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } }
      };
      if (r === 0) {
        cell.s.font = { bold: true, sz: 16, name: "Times New Roman" };
        cell.s.alignment = { horizontal: "center", vertical: "center" };
      } else if (r === 1) {
        cell.s.font = { bold: true, name: "Times New Roman" };
        cell.s.alignment = { horizontal: "center", vertical: "center" };
      } else {
        cell.s.font = { name: "Times New Roman" };
        const horizontal = c === 0 || c === 3 || c === 4 || c === 5 ? "center" : "left";
        cell.s.alignment = { horizontal, vertical: "center" };
      }
    }
  }
}

function buildDetailExcelBuffer(
  title: string,
  rows: Array<{
    uuid?: string | null;
    tenNhiemVu?: string | null;
    donViThucHien?: string | null;
    hanHoanThanh?: string | null;
    tienDo?: number | null;
    trangThai?: string | null;
    tenVanBan?: string | null;
  }>
): Buffer {
  const headers = [
    "STT",
    "Tên nhiệm vụ",
    "Đơn vị giao -> đơn vị thực hiện",
    "Hạn hoàn thành",
    "Tiến độ",
    "Trạng thái",
    "Văn bản"
  ];

  const counts = new Map<string, number>();
  const indexes = new Map<string, number>();
  let groupIndex = 0;
  rows.forEach((row) => {
    const key = row.uuid ?? "";
    if (!counts.has(key)) {
      counts.set(key, 0);
      indexes.set(key, ++groupIndex);
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  const dataRows = rows.map((row, index) => [
    indexes.get(row.uuid ?? "") ?? index + 1,
    row.tenNhiemVu ?? "",
    row.donViThucHien ?? "",
    formatDate(row.hanHoanThanh),
    `${Number(row.tienDo ?? 0)}%`,
    row.trangThai ?? "",
    row.tenVanBan ?? ""
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet([[title], headers, ...dataRows]);
  worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
  worksheet["!cols"] = [
    { wch: 6 },
    { wch: 40 },
    { wch: 50 },
    { wch: 16 },
    { wch: 10 },
    { wch: 16 },
    { wch: 30 }
  ];

  const seenMerge = new Set<string>();
  rows.forEach((row, index) => {
    const key = row.uuid ?? "";
    if (seenMerge.has(key)) {
      return;
    }
    seenMerge.add(key);
    const span = counts.get(key) ?? 1;
    if (span > 1) {
      const startRow = 2 + index;
      const endRow = startRow + span - 1;
      worksheet["!merges"]?.push({ s: { r: startRow, c: 0 }, e: { r: endRow, c: 0 } });
      worksheet["!merges"]?.push({ s: { r: startRow, c: 1 }, e: { r: endRow, c: 1 } });
      worksheet["!merges"]?.push({ s: { r: startRow, c: 6 }, e: { r: endRow, c: 6 } });
    }
  });

  applyExcelBorderAndFont(worksheet);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "BaoCao");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function buildPdfHtml(rows: Array<Record<string, unknown>>): string {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const key = String(row.uuid ?? "");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  const seen = new Set<string>();
  const tableRows = rows
    .map((row, index) => {
      const key = String(row.uuid ?? "");
      const isFirst = !seen.has(key);
      if (isFirst) seen.add(key);
      const rowSpan = counts.get(key) ?? 1;
      const stt = Array.from(seen).length;
      return `
        <tr>
          ${isFirst ? `<td class="center" rowspan="${rowSpan}">${stt}</td>` : ""}
          ${isFirst ? `<td class="text" rowspan="${rowSpan}">${row.tenNhiemVu ?? ""}</td>` : ""}
          <td class="text">${row.donViThucHien ?? ""}</td>
          <td class="center">${formatDate((row.hanHoanThanh as string | null) ?? null)}</td>
          <td class="center">${Number(row.tienDo ?? 0)}%</td>
          <td class="center">${row.trangThai ?? ""}</td>
          ${isFirst ? `<td class="text" rowspan="${rowSpan}">${row.tenVanBan ?? ""}</td>` : ""}
        </tr>
      `;
    })
    .join("");

  return `
    <html>
      <head>
        <title>Báo cáo chi tiết nhiệm vụ</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 16px; }
          h1 { font-size: 18px; margin-bottom: 12px; text-align: center; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #e5e7eb; padding: 8px; vertical-align: middle; }
          th { background: #f3f4f6; text-align: center; }
          td.text { text-align: left; }
          td.center { text-align: center; }
        </style>
      </head>
      <body>
        <h1>BÁO CÁO CHI TIẾT NHIỆM VỤ</h1>
        <table>
          <thead>
            <tr>
              <th>STT</th>
              <th>Tên nhiệm vụ</th>
              <th>Đơn vị giao -> đơn vị thực hiện</th>
              <th>Hạn hoàn thành</th>
              <th>Tiến độ</th>
              <th>Trạng thái</th>
              <th>Văn bản</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </body>
    </html>
  `;
}

export const reportTaskDetail = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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

  const { fromDate, toDate, organization_ids, assigned_to_org_ids, field, document_type_id, status, page, limit } =
    parsed.data;
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

  const {
    orgFilter,
    assignedOrgFilter,
    fieldFilter,
    docTypeFilter,
    fromFilter,
    toFilter,
    statusFilter,
    orgFilterSub,
    assignedOrgFilterSub,
    fieldFilterSub,
    docTypeFilterSub,
    fromFilterSub,
    toFilterSub,
    statusFilterSub
  } = buildFilters({
    organizationIds,
    assignedToOrgIds,
    fieldList,
    docTypeList,
    statusList,
    fromDate,
    toDate
  });

  const safePage = page ?? 1;
  const safeLimit = limit ?? 10;
  const offset = (safePage - 1) * safeLimit;

  const { rows: countRows } = await db.execute(sql`
    select count(distinct t.uuid) as total
    from tasks t
    left join task_assignments ta on t.uuid = ta.task_id
    left join documents d on d.uuid = t.document_id
    left join organizations o on o.uuid = t.organization_id
    left join organizations o2 on o2.uuid = ta.assigned_to_org_id
    where t.deleted_at is null
      and t.workspace_id = ${workspaceId}
      ${fieldFilter}
      ${docTypeFilter}
      ${fromFilter}
      ${toFilter}
      ${statusFilter}
      ${orgFilter}
      ${assignedOrgFilter}
  `);

  const total = Number(countRows?.[0]?.total ?? 0);
  const totalPages = safeLimit > 0 ? Math.max(1, Math.ceil(total / safeLimit)) : 1;

  const { rows } = await db.execute(sql`
    with filtered_tasks as (
      select distinct t.uuid, t.created_at
      from tasks t
      left join task_assignments ta on t.uuid = ta.task_id
      left join documents d on d.uuid = t.document_id
      where t.deleted_at is null
        and t.workspace_id = ${workspaceId}
        ${fieldFilter}
        ${docTypeFilter}
        ${fromFilter}
        ${toFilter}
        ${statusFilter}
        ${orgFilter}
        ${assignedOrgFilter}
      order by t.created_at desc, t.uuid
      limit ${safeLimit}
      offset ${offset}
    )
    select
      t.uuid as "uuid",
      ta.uuid as "uuid_as",
      t.title as "tenNhiemVu",
      case ta.is_coordination = true
        when true then concat(o.name, concat('-> ', concat(o2.name, ' (Phối hợp)')))
        else concat(o.name, concat('-> ', o2.name))
      end as "donViThucHien",
      ta.assigned_at as "hanHoanThanh",
      case
        when ta.status = 'new' then 'Chờ tiếp nhận'
        when ta.status = 'in_progress' then 'Đang xử lý'
        when ta.status = 'completed' then 'Hoàn thành'
        when ta.status = 'pending' then 'Chờ duyệt'
        when ta.status = 'rejected' then 'Từ chối'
        when ta.status = 'approved' then 'Phê duyệt'
        else ''
      end as "trangThai",
      tap.progress_percent as "tienDo",
      d.title as "tenVanBan"
    from filtered_tasks ft
    join tasks t on t.uuid = ft.uuid
    left join task_assignments ta on t.uuid = ta.task_id
    left join documents d on d.uuid = t.document_id
    left join organizations o on o.uuid = t.organization_id
    left join organizations o2 on o2.uuid = ta.assigned_to_org_id
    left join (
      select
        tap_sub.task_assignment_id,
        max(tap_sub.progress_percent) as progress_percent
      from task_assignment_progress tap_sub
      join task_assignments ta_sub on ta_sub.uuid = tap_sub.task_assignment_id
      join tasks t_sub on t_sub.uuid = ta_sub.task_id
      left join documents d_sub on d_sub.uuid = t_sub.document_id
      where t_sub.deleted_at is null
        and t_sub.workspace_id = ${workspaceId}
        ${fieldFilterSub}
        ${docTypeFilterSub}
        ${fromFilterSub}
        ${toFilterSub}
        ${statusFilterSub}
        ${orgFilterSub}
        ${assignedOrgFilterSub}
      group by tap_sub.task_assignment_id
    ) tap on tap.task_assignment_id = ta.uuid
    where t.deleted_at is null
      and t.workspace_id = ${workspaceId}
      ${fieldFilter}
      ${docTypeFilter}
      ${fromFilter}
      ${toFilter}
      ${statusFilter}
      ${orgFilter}
      ${assignedOrgFilter}
    order by t.created_at desc, t.uuid, ta.assigned_at desc
  `);

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
        assignedToOrgIds,
        field: fieldList.length ? fieldList : null,
        documentTypeId: docTypeList.length ? docTypeList : null,
        status: statusList.length ? statusList : null
      }
    },
    "Report task detail retrieved successfully"
  );

  res.status(response.code).send(response);
});

export const reportTaskDetailExportExcel = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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

  const { fromDate, toDate, organization_ids, assigned_to_org_ids, field, document_type_id, status } = parsed.data;
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


  const {
    orgFilter,
    assignedOrgFilter,
    fieldFilter,
    docTypeFilter,
    fromFilter,
    toFilter,
    statusFilter,
    orgFilterSub,
    assignedOrgFilterSub,
    fieldFilterSub,
    docTypeFilterSub,
    fromFilterSub,
    toFilterSub,
    statusFilterSub
  } = buildFilters({
    organizationIds,
    assignedToOrgIds,
    fieldList,
    docTypeList,
    statusList,
    fromDate,
    toDate
  });

  const { rows } = await db.execute(sql`
    select
      t.uuid as "uuid",
      t.title as "tenNhiemVu",
      case ta.is_coordination = true
        when true then concat(o.name, concat('-> ', concat(o2.name, ' (Phối hợp)')))
        else concat(o.name, concat('-> ', o2.name))
      end as "donViThucHien",
      ta.assigned_at as "hanHoanThanh",
      case
        when ta.status = 'new' then 'Chờ tiếp nhận'
        when ta.status = 'in_progress' then 'Đang xử lý'
        when ta.status = 'completed' then 'Hoàn thành'
        when ta.status = 'pending' then 'Chờ duyệt'
        when ta.status = 'rejected' then 'Từ chối'
        when ta.status = 'approved' then 'Phê duyệt'
        else ''
      end as "trangThai",
      tap.progress_percent as "tienDo",
      d.title as "tenVanBan"
    from tasks t
    left join task_assignments ta on t.uuid = ta.task_id
    left join documents d on d.uuid = t.document_id
    left join organizations o on o.uuid = t.organization_id
    left join organizations o2 on o2.uuid = ta.assigned_to_org_id
    left join (
      select
        tap_sub.task_assignment_id,
        max(tap_sub.progress_percent) as progress_percent
      from task_assignment_progress tap_sub
      join task_assignments ta_sub on ta_sub.uuid = tap_sub.task_assignment_id
      join tasks t_sub on t_sub.uuid = ta_sub.task_id
      left join documents d_sub on d_sub.uuid = t_sub.document_id
      where t_sub.deleted_at is null
        and t_sub.workspace_id = ${workspaceId}
        ${fieldFilterSub}
        ${docTypeFilterSub}
        ${fromFilterSub}
        ${toFilterSub}
        ${statusFilterSub}
        ${orgFilterSub}
        ${assignedOrgFilterSub}
      group by tap_sub.task_assignment_id
    ) tap on tap.task_assignment_id = ta.uuid
    where t.deleted_at is null
      and t.workspace_id = ${workspaceId}
      ${fieldFilter}
      ${docTypeFilter}
      ${fromFilter}
      ${toFilter}
      ${statusFilter}
      ${orgFilter}
      ${assignedOrgFilter}
    order by t.created_at desc, t.uuid, ta.assigned_at desc
  `);

  const title = "BÁO CÁO CHI TIẾT NHIỆM VỤ";
  const buffer = buildDetailExcelBuffer(title, rows as Array<Record<string, unknown>> as any);

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="bao-cao-chi-tiet-nhiem-vu.xlsx"`);
  res.status(200).send(buffer);
});

export const reportTaskDetailExportPdf = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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

  const { fromDate, toDate, organization_ids, assigned_to_org_ids, field, document_type_id, status } = parsed.data;
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


  const {
    orgFilter,
    assignedOrgFilter,
    fieldFilter,
    docTypeFilter,
    fromFilter,
    toFilter,
    statusFilter,
    orgFilterSub,
    assignedOrgFilterSub,
    fieldFilterSub,
    docTypeFilterSub,
    fromFilterSub,
    toFilterSub,
    statusFilterSub
  } = buildFilters({
    organizationIds,
    assignedToOrgIds,
    fieldList,
    docTypeList,
    statusList,
    fromDate,
    toDate
  });

  const { rows } = await db.execute(sql`
    select
      t.uuid as "uuid",
      t.title as "tenNhiemVu",
      case ta.is_coordination = true
        when true then concat(o.name, concat('-> ', concat(o2.name, ' (Phối hợp)')))
        else concat(o.name, concat('-> ', o2.name))
      end as "donViThucHien",
      ta.assigned_at as "hanHoanThanh",
      case
        when ta.status = 'new' then 'Chờ tiếp nhận'
        when ta.status = 'in_progress' then 'Đang xử lý'
        when ta.status = 'completed' then 'Hoàn thành'
        when ta.status = 'pending' then 'Chờ duyệt'
        when ta.status = 'rejected' then 'Từ chối'
        when ta.status = 'approved' then 'Phê duyệt'
        else ''
      end as "trangThai",
      tap.progress_percent as "tienDo",
      d.title as "tenVanBan"
    from tasks t
    left join task_assignments ta on t.uuid = ta.task_id
    left join documents d on d.uuid = t.document_id
    left join organizations o on o.uuid = t.organization_id
    left join organizations o2 on o2.uuid = ta.assigned_to_org_id
    left join (
      select
        tap_sub.task_assignment_id,
        max(tap_sub.progress_percent) as progress_percent
      from task_assignment_progress tap_sub
      join task_assignments ta_sub on ta_sub.uuid = tap_sub.task_assignment_id
      join tasks t_sub on t_sub.uuid = ta_sub.task_id
      left join documents d_sub on d_sub.uuid = t_sub.document_id
      where t_sub.deleted_at is null
        and t_sub.workspace_id = ${workspaceId}
        ${fieldFilterSub}
        ${docTypeFilterSub}
        ${fromFilterSub}
        ${toFilterSub}
        ${statusFilterSub}
        ${orgFilterSub}
        ${assignedOrgFilterSub}
      group by tap_sub.task_assignment_id
    ) tap on tap.task_assignment_id = ta.uuid
    where t.deleted_at is null
      and t.workspace_id = ${workspaceId}
      ${fieldFilter}
      ${docTypeFilter}
      ${fromFilter}
      ${toFilter}
      ${statusFilter}
      ${orgFilter}
      ${assignedOrgFilter}
    order by t.created_at desc, t.uuid, ta.assigned_at desc
  `);

  const html = buildPdfHtml(rows as Array<Record<string, unknown>>);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
});

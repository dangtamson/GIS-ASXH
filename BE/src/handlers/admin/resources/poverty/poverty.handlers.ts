import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  buildHouseholdExportWorkbook,
  buildPovertyReportDetailWorkbook,
  buildPovertyReportWorkbook,
  parseHouseholdWorkbook
} from "./poverty.excel.ts";
import {
  assessmentIdParamSchema,
  householdSupportCreateSchema,
  householdSupportUpdateSchema,
  householdAssessmentCreateSchema,
  householdAssessmentUpdateSchema,
  householdCreateSchema,
  householdIdParamSchema,
  householdMemberCreateSchema,
  householdMemberUpdateSchema,
  householdUpdateSchema,
  importHouseholdsSchema,
  listHouseholdsQuerySchema,
  memberIdParamSchema,
  povertyYearOverviewIdParamSchema,
  povertyYearOverviewQuerySchema,
  povertyYearOverviewUpsertSchema,
  reportDetailQuerySchema,
  reportQuerySchema,
  supportIdParamSchema
} from "./poverty.schemas.ts";
import {
  createAssessment,
  createHousehold,
  createMember,
  createSupport,
  deactivateHousehold,
  deletePovertyYearOverviewById,
  deleteAssessment,
  deleteMember,
  deleteSupport,
  getDashboard,
  getReportDetail,
  getReportDetailForExport,
  getHouseholdById,
  getHouseholdDetail,
  getReportSummary,
  importHouseholdRow,
  listAssessments,
  listChangeLogs,
  listGisMarkers,
  listHouseholds,
  listHouseholdsForExport,
  listPovertyYearOverviews,
  listMembers,
  listSupports,
  upsertPovertyYearOverview,
  updateAssessment,
  updateHousehold,
  updateMember,
  updateSupport
} from "./poverty.repository.ts";

const parseOrSendError = <T>(schema: z.ZodType<T>, value: unknown, res: Response): T | null => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return null;
  }
  return parsed.data;
};

const ensureHouseholdExists = async (id: string, res: Response): Promise<boolean> => {
  const household = await getHouseholdById(id);
  if (!household) {
    const response = apiResponse.error(HttpErrors.NotFound("Household"));
    res.status(response.code).send(response);
    return false;
  }
  return true;
};

export const listHouseholdsAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const query = parseOrSendError(listHouseholdsQuerySchema, req.query, res);
  if (!query) return;
  const result = await listHouseholds(query);
  const response = apiResponse.success(HttpStatusCode.OK, result, "Households retrieved successfully");
  res.status(response.code).send(response);
});

export const createHouseholdAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const body = parseOrSendError(householdCreateSchema, req.body, res);
  if (!body) return;
  const item = await createHousehold(body);
  const response = apiResponse.success(HttpStatusCode.CREATED, { item }, "Household created successfully");
  res.status(response.code).send(response);
});

export const getHouseholdAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(householdIdParamSchema, req.params, res);
  if (!params) return;
  const item = await getHouseholdDetail(params.id);
  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("Household"));
    res.status(response.code).send(response);
    return;
  }
  const response = apiResponse.success(HttpStatusCode.OK, item, "Household retrieved successfully");
  res.status(response.code).send(response);
});

export const updateHouseholdAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(householdIdParamSchema, req.params, res);
  if (!params) return;
  const body = parseOrSendError(householdUpdateSchema, req.body, res);
  if (!body) return;
  const item = await updateHousehold(params.id, body);
  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("Household"));
    res.status(response.code).send(response);
    return;
  }
  const response = apiResponse.success(HttpStatusCode.OK, { item }, "Household updated successfully");
  res.status(response.code).send(response);
});

export const deleteHouseholdAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(householdIdParamSchema, req.params, res);
  if (!params) return;
  const item = await deactivateHousehold(params.id, "Ngưng hoạt động hộ");
  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("Household"));
    res.status(response.code).send(response);
    return;
  }
  const response = apiResponse.success(HttpStatusCode.OK, { item }, "Household deactivated successfully");
  res.status(response.code).send(response);
});

export const listHouseholdMembersAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(householdIdParamSchema, req.params, res);
  if (!params || !(await ensureHouseholdExists(params.id, res))) return;
  const items = await listMembers(params.id);
  const response = apiResponse.success(HttpStatusCode.OK, { items }, "Household members retrieved successfully");
  res.status(response.code).send(response);
});

export const createHouseholdMemberAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(householdIdParamSchema, req.params, res);
  if (!params || !(await ensureHouseholdExists(params.id, res))) return;
  const body = parseOrSendError(householdMemberCreateSchema, req.body, res);
  if (!body) return;
  const item = await createMember(params.id, body);
  const response = apiResponse.success(HttpStatusCode.CREATED, { item }, "Household member created successfully");
  res.status(response.code).send(response);
});

export const updateHouseholdMemberAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(memberIdParamSchema, req.params, res);
  if (!params) return;
  const body = parseOrSendError(householdMemberUpdateSchema, req.body, res);
  if (!body) return;
  const item = await updateMember(params.id, params.memberId, body);
  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("Household member"));
    res.status(response.code).send(response);
    return;
  }
  const response = apiResponse.success(HttpStatusCode.OK, { item }, "Household member updated successfully");
  res.status(response.code).send(response);
});

export const deleteHouseholdMemberAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(memberIdParamSchema, req.params, res);
  if (!params) return;
  const item = await deleteMember(params.id, params.memberId, "Xóa thành viên hộ");
  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("Household member"));
    res.status(response.code).send(response);
    return;
  }
  const response = apiResponse.success(HttpStatusCode.OK, { item }, "Household member deleted successfully");
  res.status(response.code).send(response);
});

export const listHouseholdAssessmentsAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(householdIdParamSchema, req.params, res);
  if (!params || !(await ensureHouseholdExists(params.id, res))) return;
  const items = await listAssessments(params.id);
  const response = apiResponse.success(HttpStatusCode.OK, { items }, "Household assessments retrieved successfully");
  res.status(response.code).send(response);
});

export const createHouseholdAssessmentAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(householdIdParamSchema, req.params, res);
  if (!params || !(await ensureHouseholdExists(params.id, res))) return;
  const body = parseOrSendError(householdAssessmentCreateSchema, req.body, res);
  if (!body) return;
  const item = await createAssessment(params.id, body);
  const response = apiResponse.success(HttpStatusCode.CREATED, { item }, "Household assessment created successfully");
  res.status(response.code).send(response);
});

export const updateHouseholdAssessmentAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(assessmentIdParamSchema, req.params, res);
  if (!params) return;
  const body = parseOrSendError(householdAssessmentUpdateSchema, req.body, res);
  if (!body) return;
  const item = await updateAssessment(params.id, params.assessmentId, body);
  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("Household assessment"));
    res.status(response.code).send(response);
    return;
  }
  const response = apiResponse.success(HttpStatusCode.OK, { item }, "Household assessment updated successfully");
  res.status(response.code).send(response);
});

export const deleteHouseholdAssessmentAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(assessmentIdParamSchema, req.params, res);
  if (!params) return;
  const item = await deleteAssessment(params.id, params.assessmentId, "Xóa đánh giá hộ");
  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("Household assessment"));
    res.status(response.code).send(response);
    return;
  }
  const response = apiResponse.success(HttpStatusCode.OK, { item }, "Household assessment deleted successfully");
  res.status(response.code).send(response);
});

export const listHouseholdSupportsAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(householdIdParamSchema, req.params, res);
  if (!params || !(await ensureHouseholdExists(params.id, res))) return;
  const items = await listSupports(params.id);
  const response = apiResponse.success(HttpStatusCode.OK, { items }, "Household supports retrieved successfully");
  res.status(response.code).send(response);
});

export const createHouseholdSupportAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(householdIdParamSchema, req.params, res);
  if (!params || !(await ensureHouseholdExists(params.id, res))) return;
  const body = parseOrSendError(householdSupportCreateSchema, req.body, res);
  if (!body) return;
  const item = await createSupport(params.id, body);
  const response = apiResponse.success(HttpStatusCode.CREATED, { item }, "Household support created successfully");
  res.status(response.code).send(response);
});

export const updateHouseholdSupportAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(supportIdParamSchema, req.params, res);
  if (!params) return;
  const body = parseOrSendError(householdSupportUpdateSchema, req.body, res);
  if (!body) return;
  const item = await updateSupport(params.id, params.supportId, body);
  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("Household support"));
    res.status(response.code).send(response);
    return;
  }
  const response = apiResponse.success(HttpStatusCode.OK, { item }, "Household support updated successfully");
  res.status(response.code).send(response);
});

export const deleteHouseholdSupportAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(supportIdParamSchema, req.params, res);
  if (!params) return;
  const item = await deleteSupport(params.id, params.supportId, "Xóa hỗ trợ hộ");
  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("Household support"));
    res.status(response.code).send(response);
    return;
  }
  const response = apiResponse.success(HttpStatusCode.OK, { item }, "Household support deleted successfully");
  res.status(response.code).send(response);
});

export const listHouseholdChangeLogsAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(householdIdParamSchema, req.params, res);
  if (!params || !(await ensureHouseholdExists(params.id, res))) return;
  const items = await listChangeLogs(params.id);
  const response = apiResponse.success(HttpStatusCode.OK, { items }, "Household change logs retrieved successfully");
  res.status(response.code).send(response);
});

export const importHouseholdsAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const body = parseOrSendError(importHouseholdsSchema, req.body, res);
  if (!body) return;
  const parsedWorkbook = parseHouseholdWorkbook(body.fileContentBase64);
  const created: string[] = [];
  const updated: string[] = [];
  const errors = [...parsedWorkbook.errors];

  for (const row of parsedWorkbook.validRows) {
    try {
      const result = await importHouseholdRow(row.data);
      if (result.item?.id && result.action === "created") created.push(result.item.id);
      if (result.item?.id && result.action === "updated") updated.push(result.item.id);
    } catch (error) {
      errors.push({
        rowNumber: row.rowNumber,
        message: error instanceof Error ? error.message : "Không thể import dòng dữ liệu"
      });
    }
  }

  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      created,
      updated,
      failed: errors.length,
      errors
    },
    "Households imported successfully"
  );
  res.status(response.code).send(response);
});

export const exportHouseholdsAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const query = parseOrSendError(reportQuerySchema, req.query, res);
  if (!query) return;
  const items = await listHouseholdsForExport(query);
  const fileContentBase64 = buildHouseholdExportWorkbook(items);
  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      fileName: `poor-households-${new Date().toISOString().slice(0, 10)}.xlsx`,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileContentBase64
    },
    "Households exported successfully"
  );
  res.status(response.code).send(response);
});

export const listPovertyGisMarkersAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const query = parseOrSendError(reportQuerySchema, req.query, res);
  if (!query) return;
  const items = await listGisMarkers(query);
  const response = apiResponse.success(HttpStatusCode.OK, { items }, "GIS markers retrieved successfully");
  res.status(response.code).send(response);
});

export const getPovertyDashboardAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const query = parseOrSendError(reportQuerySchema, req.query, res);
  if (!query) return;
  const dashboard = await getDashboard(query);
  const response = apiResponse.success(HttpStatusCode.OK, dashboard, "Poverty dashboard retrieved successfully");
  res.status(response.code).send(response);
});

export const getPovertyReportSummaryAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const query = parseOrSendError(reportQuerySchema, req.query, res);
  if (!query) return;
  const items = await getReportSummary(query);
  const response = apiResponse.success(HttpStatusCode.OK, { items }, "Poverty report retrieved successfully");
  res.status(response.code).send(response);
});

export const exportPovertyReportAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const query = parseOrSendError(reportQuerySchema, req.query, res);
  if (!query) return;
  const items = await getReportSummary(query);
  const fileContentBase64 = buildPovertyReportWorkbook(items);
  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      fileName: `poverty-report-${new Date().toISOString().slice(0, 10)}.xlsx`,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileContentBase64
    },
    "Poverty report exported successfully"
  );
  res.status(response.code).send(response);
});

export const getPovertyReportDetailAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const query = parseOrSendError(reportDetailQuerySchema, req.query, res);
  if (!query) return;
  const result = await getReportDetail(query);
  const response = apiResponse.success(HttpStatusCode.OK, result, "Poverty detail report retrieved successfully");
  res.status(response.code).send(response);
});

export const exportPovertyReportDetailAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const query = parseOrSendError(reportQuerySchema, req.query, res);
  if (!query) return;
  const items = await getReportDetailForExport(query);
  const fileContentBase64 = buildPovertyReportDetailWorkbook(items);
  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      fileName: `poverty-report-detail-${new Date().toISOString().slice(0, 10)}.xlsx`,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileContentBase64
    },
    "Poverty detail report exported successfully"
  );
  res.status(response.code).send(response);
});

export const listPovertyYearOverviewsAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const query = parseOrSendError(povertyYearOverviewQuerySchema, req.query, res);
  if (!query) return;
  const items = await listPovertyYearOverviews(query.year);
  const response = apiResponse.success(HttpStatusCode.OK, { items }, "Poverty year overviews retrieved successfully");
  res.status(response.code).send(response);
});

export const upsertPovertyYearOverviewAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const body = parseOrSendError(povertyYearOverviewUpsertSchema, req.body, res);
  if (!body) return;
  const item = await upsertPovertyYearOverview(body);
  const response = apiResponse.success(HttpStatusCode.OK, { item }, "Poverty year overview saved successfully");
  res.status(response.code).send(response);
});

export const deletePovertyYearOverviewAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(povertyYearOverviewIdParamSchema, req.params, res);
  if (!params) return;
  const item = await deletePovertyYearOverviewById(params.id);
  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("Poverty year overview"));
    res.status(response.code).send(response);
    return;
  }
  const response = apiResponse.success(HttpStatusCode.OK, { item }, "Poverty year overview deleted successfully");
  res.status(response.code).send(response);
});

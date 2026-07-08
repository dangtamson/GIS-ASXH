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
  areaCreateSchema,
  areaIdParamSchema,
  areaUpdateSchema,
  assessmentIdParamSchema,
  contextHistoryIdParamSchema,
  householdSupportCreateSchema,
  householdContextHistoryCreateSchema,
  householdContextHistoryUpdateSchema,
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
  locationAreaQuerySchema,
  locationWardQuerySchema,
  memberIdParamSchema,
  povertyWardPublicLinkQuerySchema,
  povertyWardPublicLinkUpsertSchema,
  povertyWardOverviewIdParamSchema,
  povertyWardOverviewQuerySchema,
  povertyWardOverviewUpsertSchema,
  reportDetailQuerySchema,
  reportQuerySchema,
  supportIdParamSchema
} from "./poverty.schemas.ts";
import {
  createArea,
  createAssessment,
  createContextHistory,
  createHousehold,
  createMember,
  createSupport,
  deactivateHousehold,
  deleteArea,
  deletePovertyWardOverviewById,
  deleteAssessment,
  deleteContextHistory,
  deleteMember,
  deleteSupport,
  getAreaById,
  getDashboard,
  getPublicAreaDetailBySlugAndAreaSlug,
  getPublicHouseholdDetailBySlugAndHouseholdId,
  getReportDetail,
  getReportDetailForExport,
  getHouseholdById,
  getHouseholdDetail,
  getPovertyWardOverviewById,
  getPublicWardMapBySlug,
  getReportSummary,
  getWardPublicLink,
  importHouseholdRow,
  listAssessments,
  listAreas,
  listChangeLogs,
  listContextHistories,
  listGisMarkers,
  listHouseholds,
  listHouseholdsForExport,
  listLocationAreas,
  listLocationProvinces,
  listLocationWards,
  listPovertyWardOverviews,
  listMembers,
  listSupports,
  updateArea,
  upsertWardPublicLinkState,
  upsertPovertyWardOverview,
  updateAssessment,
  updateContextHistory,
  updateHousehold,
  updateMember,
  updateSupport
} from "./poverty.repository.ts";
import {
  buildSuperAdminPovertyAccessScope,
  isLocationWithinScope,
  resolvePovertyAccessScope,
  type PovertyAccessScope
} from "./poverty.scope.ts";

const parseOrSendError = <T>(schema: z.ZodType<T>, value: unknown, res: Response): T | null => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return null;
  }
  return parsed.data;
};

const NO_SCOPE_MESSAGE = "Tài khoản chưa được gán địa bàn quản lý";
const LOCATION_SCOPE_MESSAGE = "Bạn không có quyền truy cập địa bàn này";
const WARD_SCOPE_MESSAGE = "Bạn không có quyền truy cập xã/phường này";
const AREA_SCOPE_MESSAGE = "Bạn không có quyền truy cập khu vực này";

const hasLocationAccess = (
  scope: PovertyAccessScope,
  location: { provinceCode?: string | null; wardCode?: string | null; areaId?: string | null }
): boolean => scope.isSuperAdmin || isLocationWithinScope(scope, location);

const sendError = (res: Response, error: ReturnType<typeof HttpErrors.Forbidden>): null => {
  const response = apiResponse.error(error);
  res.status(response.code).send(response);
  return null;
};

const resolveRequiredPovertyScope = async (req: Request, res: Response): Promise<PovertyAccessScope | null> => {
  if (req.user?.isSuperAdmin) {
    return buildSuperAdminPovertyAccessScope();
  }

  const scope = await resolvePovertyAccessScope(req.accountId, req.workspaceId);
  if (!scope.hasScope) {
    return sendError(res, HttpErrors.Forbidden(NO_SCOPE_MESSAGE));
  }
  return scope;
};

const ensureLocationInScope = (
  scope: PovertyAccessScope,
  location: { provinceCode?: string | null; wardCode?: string | null; areaId?: string | null },
  res: Response,
  message = LOCATION_SCOPE_MESSAGE
): boolean => {
  if (!hasLocationAccess(scope, location)) {
    sendError(res, HttpErrors.Forbidden(message));
    return false;
  }
  return true;
};

const ensureWardLevelAccess = (
  scope: PovertyAccessScope,
  location: { provinceCode?: string | null; wardCode?: string | null },
  res: Response
): boolean => {
  if (scope.isSuperAdmin) {
    return true;
  }

  if (scope.provinceCodes.length === 0 && scope.wardCodes.length === 0) {
    sendError(res, HttpErrors.Forbidden(WARD_SCOPE_MESSAGE));
    return false;
  }
  return ensureLocationInScope(scope, location, res, WARD_SCOPE_MESSAGE);
};

const getScopedHouseholdOrSendNotFound = async (
  id: string,
  res: Response,
  scope: PovertyAccessScope
): Promise<Awaited<ReturnType<typeof getHouseholdById>> | null> => {
  const household = await getHouseholdById(id, scope);
  if (!household) {
    sendError(res, HttpErrors.NotFound("Household"));
    return null;
  }
  return household;
};

export const listPovertyLocationProvincesAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope) return;
  const items = await listLocationProvinces(scope);
  const response = apiResponse.success(HttpStatusCode.OK, { items }, "Location provinces retrieved successfully");
  res.status(response.code).send(response);
});

export const listPovertyLocationWardsAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const query = parseOrSendError(locationWardQuerySchema, req.query, res);
  if (!query) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope) return;
  const items = await listLocationWards(query.provinceCode, scope);
  const response = apiResponse.success(HttpStatusCode.OK, { items }, "Location wards retrieved successfully");
  res.status(response.code).send(response);
});

export const listPovertyLocationAreasAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const query = parseOrSendError(locationAreaQuerySchema, req.query, res);
  if (!query) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope) return;
  const items = await listLocationAreas(query.wardCode, scope);
  const response = apiResponse.success(HttpStatusCode.OK, { items }, "Location areas retrieved successfully");
  res.status(response.code).send(response);
});

export const listHouseholdsAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const query = parseOrSendError(listHouseholdsQuerySchema, req.query, res);
  if (!query) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope) return;
  const result = await listHouseholds(query, scope);
  const response = apiResponse.success(HttpStatusCode.OK, result, "Households retrieved successfully");
  res.status(response.code).send(response);
});

export const createHouseholdAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const body = parseOrSendError(householdCreateSchema, req.body, res);
  if (!body) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope || !ensureLocationInScope(scope, body, res)) return;
  const item = await createHousehold(body);
  const response = apiResponse.success(HttpStatusCode.CREATED, { item }, "Household created successfully");
  res.status(response.code).send(response);
});

export const getHouseholdAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(householdIdParamSchema, req.params, res);
  if (!params) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope) return;
  const item = await getHouseholdDetail(params.id, scope);
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
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope) return;
  const household = await getScopedHouseholdOrSendNotFound(params.id, res, scope);
  if (!household) return;

  const nextLocation = {
    provinceCode: body.provinceCode ?? household.provinceCode,
    wardCode: body.wardCode ?? household.wardCode,
    areaId: body.areaId ?? household.areaId
  };
  if (!ensureLocationInScope(scope, nextLocation, res)) return;

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
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope || !(await getScopedHouseholdOrSendNotFound(params.id, res, scope))) return;
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
  if (!params) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope || !(await getScopedHouseholdOrSendNotFound(params.id, res, scope))) return;
  const items = await listMembers(params.id);
  const response = apiResponse.success(HttpStatusCode.OK, { items }, "Household members retrieved successfully");
  res.status(response.code).send(response);
});

export const createHouseholdMemberAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(householdIdParamSchema, req.params, res);
  if (!params) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope || !(await getScopedHouseholdOrSendNotFound(params.id, res, scope))) return;
  const body = parseOrSendError(householdMemberCreateSchema, req.body, res);
  if (!body) return;
  const item = await createMember(params.id, body);
  const response = apiResponse.success(HttpStatusCode.CREATED, { item }, "Household member created successfully");
  res.status(response.code).send(response);
});

export const updateHouseholdMemberAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(memberIdParamSchema, req.params, res);
  if (!params) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope || !(await getScopedHouseholdOrSendNotFound(params.id, res, scope))) return;
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
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope || !(await getScopedHouseholdOrSendNotFound(params.id, res, scope))) return;
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
  if (!params) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope || !(await getScopedHouseholdOrSendNotFound(params.id, res, scope))) return;
  const items = await listAssessments(params.id);
  const response = apiResponse.success(HttpStatusCode.OK, { items }, "Household assessments retrieved successfully");
  res.status(response.code).send(response);
});

export const createHouseholdAssessmentAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(householdIdParamSchema, req.params, res);
  if (!params) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope || !(await getScopedHouseholdOrSendNotFound(params.id, res, scope))) return;
  const body = parseOrSendError(householdAssessmentCreateSchema, req.body, res);
  if (!body) return;
  const item = await createAssessment(params.id, body);
  const response = apiResponse.success(HttpStatusCode.CREATED, { item }, "Household assessment created successfully");
  res.status(response.code).send(response);
});

export const updateHouseholdAssessmentAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(assessmentIdParamSchema, req.params, res);
  if (!params) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope || !(await getScopedHouseholdOrSendNotFound(params.id, res, scope))) return;
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
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope || !(await getScopedHouseholdOrSendNotFound(params.id, res, scope))) return;
  const item = await deleteAssessment(params.id, params.assessmentId, "Xóa đánh giá hộ");
  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("Household assessment"));
    res.status(response.code).send(response);
    return;
  }
  const response = apiResponse.success(HttpStatusCode.OK, { item }, "Household assessment deleted successfully");
  res.status(response.code).send(response);
});

export const listHouseholdContextHistoriesAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(householdIdParamSchema, req.params, res);
  if (!params) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope || !(await getScopedHouseholdOrSendNotFound(params.id, res, scope))) return;
  const items = await listContextHistories(params.id);
  const response = apiResponse.success(HttpStatusCode.OK, { items }, "Household context histories retrieved successfully");
  res.status(response.code).send(response);
});

export const createHouseholdContextHistoryAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(householdIdParamSchema, req.params, res);
  if (!params) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope || !(await getScopedHouseholdOrSendNotFound(params.id, res, scope))) return;
  const body = parseOrSendError(householdContextHistoryCreateSchema, req.body, res);
  if (!body) return;
  const item = await createContextHistory(params.id, body);
  const response = apiResponse.success(HttpStatusCode.CREATED, { item }, "Household context history created successfully");
  res.status(response.code).send(response);
});

export const updateHouseholdContextHistoryAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(contextHistoryIdParamSchema, req.params, res);
  if (!params) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope || !(await getScopedHouseholdOrSendNotFound(params.id, res, scope))) return;
  const body = parseOrSendError(householdContextHistoryUpdateSchema, req.body, res);
  if (!body) return;
  const item = await updateContextHistory(params.id, params.contextHistoryId, body);
  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("Household context history"));
    res.status(response.code).send(response);
    return;
  }
  const response = apiResponse.success(HttpStatusCode.OK, { item }, "Household context history updated successfully");
  res.status(response.code).send(response);
});

export const deleteHouseholdContextHistoryAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(contextHistoryIdParamSchema, req.params, res);
  if (!params) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope || !(await getScopedHouseholdOrSendNotFound(params.id, res, scope))) return;
  const item = await deleteContextHistory(params.id, params.contextHistoryId, "Xoa hoan canh va hien trang ho");
  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("Household context history"));
    res.status(response.code).send(response);
    return;
  }
  const response = apiResponse.success(HttpStatusCode.OK, { item }, "Household context history deleted successfully");
  res.status(response.code).send(response);
});

export const listHouseholdSupportsAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(householdIdParamSchema, req.params, res);
  if (!params) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope || !(await getScopedHouseholdOrSendNotFound(params.id, res, scope))) return;
  const items = await listSupports(params.id);
  const response = apiResponse.success(HttpStatusCode.OK, { items }, "Household supports retrieved successfully");
  res.status(response.code).send(response);
});

export const createHouseholdSupportAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(householdIdParamSchema, req.params, res);
  if (!params) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope || !(await getScopedHouseholdOrSendNotFound(params.id, res, scope))) return;
  const body = parseOrSendError(householdSupportCreateSchema, req.body, res);
  if (!body) return;
  const item = await createSupport(params.id, body);
  const response = apiResponse.success(HttpStatusCode.CREATED, { item }, "Household support created successfully");
  res.status(response.code).send(response);
});

export const updateHouseholdSupportAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(supportIdParamSchema, req.params, res);
  if (!params) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope || !(await getScopedHouseholdOrSendNotFound(params.id, res, scope))) return;
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
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope || !(await getScopedHouseholdOrSendNotFound(params.id, res, scope))) return;
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
  if (!params) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope || !(await getScopedHouseholdOrSendNotFound(params.id, res, scope))) return;
  const items = await listChangeLogs(params.id);
  const response = apiResponse.success(HttpStatusCode.OK, { items }, "Household change logs retrieved successfully");
  res.status(response.code).send(response);
});

export const importHouseholdsAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const body = parseOrSendError(importHouseholdsSchema, req.body, res);
  if (!body) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope) return;
  const parsedWorkbook = parseHouseholdWorkbook(body.fileContentBase64);
  const created: string[] = [];
  const updated: string[] = [];
  const errors = [...parsedWorkbook.errors];

  for (const row of parsedWorkbook.validRows) {
    if (!hasLocationAccess(scope, row.data)) {
      errors.push({
        rowNumber: row.rowNumber,
        message: LOCATION_SCOPE_MESSAGE
      });
      continue;
    }

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
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope) return;
  const items = await listHouseholdsForExport(query, scope);
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
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope) return;
  const items = await listGisMarkers(query, scope);
  const response = apiResponse.success(HttpStatusCode.OK, { items }, "GIS markers retrieved successfully");
  res.status(response.code).send(response);
});

export const getPovertyDashboardAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const query = parseOrSendError(reportQuerySchema, req.query, res);
  if (!query) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope) return;
  const dashboard = await getDashboard(query, scope);
  const response = apiResponse.success(HttpStatusCode.OK, dashboard, "Poverty dashboard retrieved successfully");
  res.status(response.code).send(response);
});

export const getPovertyReportSummaryAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const query = parseOrSendError(reportQuerySchema, req.query, res);
  if (!query) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope) return;
  const items = await getReportSummary(query, scope);
  const response = apiResponse.success(HttpStatusCode.OK, { items }, "Poverty report retrieved successfully");
  res.status(response.code).send(response);
});

export const exportPovertyReportAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const query = parseOrSendError(reportQuerySchema, req.query, res);
  if (!query) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope) return;
  const items = await getReportSummary(query, scope);
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
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope) return;
  const result = await getReportDetail(query, scope);
  const response = apiResponse.success(HttpStatusCode.OK, result, "Poverty detail report retrieved successfully");
  res.status(response.code).send(response);
});

export const exportPovertyReportDetailAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const query = parseOrSendError(reportQuerySchema, req.query, res);
  if (!query) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope) return;
  const items = await getReportDetailForExport(query, scope);
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

export const getPovertyWardPublicLinkAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const query = parseOrSendError(povertyWardPublicLinkQuerySchema, req.query, res);
  if (!query) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope || !ensureWardLevelAccess(scope, query, res) || !req.workspaceId) return;
  const item = await getWardPublicLink(req.workspaceId, query.provinceCode, query.wardCode);
  const response = apiResponse.success(HttpStatusCode.OK, { item }, "Ward public link retrieved successfully");
  res.status(response.code).send(response);
});

export const upsertPovertyWardPublicLinkAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const body = parseOrSendError(povertyWardPublicLinkUpsertSchema, req.body, res);
  if (!body) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope || !ensureWardLevelAccess(scope, body, res) || !req.workspaceId) return;
  const item = await upsertWardPublicLinkState(req.workspaceId, body, req.accountId);
  const response = apiResponse.success(HttpStatusCode.OK, { item }, "Ward public link saved successfully");
  res.status(response.code).send(response);
});

export const getPublicPovertyWardBySlug = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const slug = String(req.params.slug ?? "").trim();
  if (!slug) {
    const response = apiResponse.error(HttpErrors.NotFound("Ward public link"));
    res.status(response.code).send(response);
    return;
  }

  const data = await getPublicWardMapBySlug(slug);
  if (!data) {
    const response = apiResponse.error(HttpErrors.NotFound("Ward public link"));
    res.status(response.code).send(response);
    return;
  }

  const response = apiResponse.success(HttpStatusCode.OK, data, "Public ward poverty map retrieved successfully");
  res.status(response.code).send(response);
});

export const getPublicPovertyAreaBySlugAndAreaSlug = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const slug = String(req.params.slug ?? "").trim();
  const areaSlug = String(req.params.areaSlug ?? "").trim();

  if (!slug || !areaSlug) {
    const response = apiResponse.error(HttpErrors.NotFound("Area"));
    res.status(response.code).send(response);
    return;
  }

  const data = await getPublicAreaDetailBySlugAndAreaSlug(slug, areaSlug);
  if (!data) {
    const response = apiResponse.error(HttpErrors.NotFound("Area"));
    res.status(response.code).send(response);
    return;
  }

  const response = apiResponse.success(HttpStatusCode.OK, data, "Public poverty area detail retrieved successfully");
  res.status(response.code).send(response);
});

export const getPublicPovertyHouseholdBySlugAndHouseholdId = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const slug = String(req.params.slug ?? "").trim();
  const householdId = String(req.params.householdId ?? "").trim();

  if (!slug || !householdId) {
    const response = apiResponse.error(HttpErrors.NotFound("Household"));
    res.status(response.code).send(response);
    return;
  }

  const data = await getPublicHouseholdDetailBySlugAndHouseholdId(slug, householdId);
  if (!data) {
    const response = apiResponse.error(HttpErrors.NotFound("Household"));
    res.status(response.code).send(response);
    return;
  }

  const response = apiResponse.success(HttpStatusCode.OK, data, "Public household retrieved successfully");
  res.status(response.code).send(response);
});

export const listPovertyWardOverviewsAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const query = parseOrSendError(povertyWardOverviewQuerySchema, req.query, res);
  if (!query) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope || !ensureWardLevelAccess(scope, query, res)) return;
  const items = await listPovertyWardOverviews(query.provinceCode, query.wardCode, scope);
  const response = apiResponse.success(HttpStatusCode.OK, { items }, "Ward overviews retrieved successfully");
  res.status(response.code).send(response);
});

export const upsertPovertyWardOverviewAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const body = parseOrSendError(povertyWardOverviewUpsertSchema, req.body, res);
  if (!body) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope || !ensureWardLevelAccess(scope, body, res)) return;
  const item = await upsertPovertyWardOverview(body);
  const response = apiResponse.success(HttpStatusCode.OK, { item }, "Ward overview saved successfully");
  res.status(response.code).send(response);
});

export const deletePovertyWardOverviewAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(povertyWardOverviewIdParamSchema, req.params, res);
  if (!params) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope) return;
  const overview = await getPovertyWardOverviewById(params.id);
  if (!overview) {
    const response = apiResponse.error(HttpErrors.NotFound("Ward overview"));
    res.status(response.code).send(response);
    return;
  }
  if (!ensureWardLevelAccess(scope, overview, res)) return;
  const item = await deletePovertyWardOverviewById(params.id);
  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("Ward overview"));
    res.status(response.code).send(response);
    return;
  }
  const response = apiResponse.success(HttpStatusCode.OK, { item }, "Ward overview deleted successfully");
  res.status(response.code).send(response);
});

export const listPovertyAreasAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(z.object({ wardCode: z.string().trim().min(1) }), req.params, res);
  if (!params) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope) return;
  const items = await listAreas(params.wardCode, scope);
  const response = apiResponse.success(HttpStatusCode.OK, { items }, "Ward areas retrieved successfully");
  res.status(response.code).send(response);
});

export const createPovertyAreaAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(z.object({ wardCode: z.string().trim().min(1) }), req.params, res);
  if (!params) return;
  const body = parseOrSendError(areaCreateSchema, req.body, res);
  if (!body) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope || !ensureLocationInScope(scope, { provinceCode: body.provinceCode, wardCode: params.wardCode }, res, AREA_SCOPE_MESSAGE)) return;
  const item = await createArea(params.wardCode, body);
  const response = apiResponse.success(HttpStatusCode.CREATED, { item }, "Ward area created successfully");
  res.status(response.code).send(response);
});

export const updatePovertyAreaAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(areaIdParamSchema, req.params, res);
  if (!params) return;
  const body = parseOrSendError(areaUpdateSchema, req.body, res);
  if (!body) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope) return;
  const area = await getAreaById(params.wardCode, params.areaId);
  if (!area) {
    const response = apiResponse.error(HttpErrors.NotFound("Ward area"));
    res.status(response.code).send(response);
    return;
  }
  const nextLocation = {
    provinceCode: body.provinceCode ?? area.provinceCode,
    wardCode: params.wardCode,
    areaId: area.id
  };
  if (!ensureLocationInScope(scope, nextLocation, res, AREA_SCOPE_MESSAGE)) return;
  const item = await updateArea(params.wardCode, params.areaId, body);
  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("Ward area"));
    res.status(response.code).send(response);
    return;
  }
  const response = apiResponse.success(HttpStatusCode.OK, { item }, "Ward area updated successfully");
  res.status(response.code).send(response);
});

export const deletePovertyAreaAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = parseOrSendError(areaIdParamSchema, req.params, res);
  if (!params) return;
  const scope = await resolveRequiredPovertyScope(req, res);
  if (!scope) return;
  const area = await getAreaById(params.wardCode, params.areaId);
  if (!area) {
    const response = apiResponse.error(HttpErrors.NotFound("Ward area"));
    res.status(response.code).send(response);
    return;
  }
  if (!ensureLocationInScope(scope, area, res, AREA_SCOPE_MESSAGE)) return;
  const item = await deleteArea(params.wardCode, params.areaId);
  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("Ward area"));
    res.status(response.code).send(response);
    return;
  }
  const response = apiResponse.success(HttpStatusCode.OK, { item }, "Ward area deleted successfully");
  res.status(response.code).send(response);
});

import {
  createPovertyAreaAdmin,
  createHouseholdAdmin,
  createHouseholdAssessmentAdmin,
  createHouseholdContextHistoryAdmin,
  createHouseholdMemberAdmin,
  createHouseholdSupportAdmin,
  deletePovertyAreaAdminById,
  deletePovertyWardOverviewAdminById,
  deleteHouseholdAdminById,
  deleteHouseholdAssessmentAdminById,
  deleteHouseholdContextHistoryAdminById,
  deleteHouseholdMemberAdminById,
  deleteHouseholdSupportAdminById,
  exportHouseholdsAdmin,
  exportPovertyReportDetailAdmin,
  exportPovertyReportAdmin,
  getHouseholdAdminById,
  getPovertyDashboardAdmin,
  getPovertyReportDetailAdmin,
  getPovertyReportSummaryAdmin,
  getPovertyWardPublicLinkAdmin,
  listPovertyAreasAdmin,
  listPovertyLocationAreasAdmin,
  listPovertyLocationProvincesAdmin,
  listPovertyLocationWardsAdmin,
  listPovertyWardOverviewsAdmin,
  importHouseholdsAdmin,
  listHouseholdAssessmentsAdmin,
  listHouseholdContextHistoriesAdmin,
  listHouseholdChangeLogsAdmin,
  listHouseholdMembersAdmin,
  listHouseholdSupportsAdmin,
  listHouseholdsAdmin,
  listPovertyGisMarkersAdmin,
  updatePovertyAreaAdminById,
  upsertPovertyWardPublicLinkAdmin,
  upsertPovertyWardOverviewAdmin,
  updateHouseholdAdminById,
  updateHouseholdAssessmentAdminById,
  updateHouseholdContextHistoryAdminById,
  updateHouseholdMemberAdminById,
  updateHouseholdSupportAdminById,
} from "@/handlers/admin/resources/poverty/index.ts";
import { API_ROUTES } from "@/helpers/permissions.ts";
import type { Application, RequestHandler } from "express";

export function registerPovertyAdminRoutes(app: Application, guards: readonly RequestHandler[]): void {
  app.get(API_ROUTES.povertyHouseholdsExport, ...guards, exportHouseholdsAdmin);
  app.post(API_ROUTES.povertyHouseholdsImport, ...guards, importHouseholdsAdmin);
  app.get(API_ROUTES.povertyHouseholds, ...guards, listHouseholdsAdmin);
  app.post(API_ROUTES.povertyHouseholds, ...guards, createHouseholdAdmin);
  app.post(API_ROUTES.povertyHouseholdsFromMap, ...guards, createHouseholdAdmin);
  app.get(API_ROUTES.povertyHouseholdById, ...guards, getHouseholdAdminById);
  app.patch(API_ROUTES.povertyHouseholdById, ...guards, updateHouseholdAdminById);
  app.delete(API_ROUTES.povertyHouseholdById, ...guards, deleteHouseholdAdminById);

  app.get(API_ROUTES.povertyHouseholdMembers, ...guards, listHouseholdMembersAdmin);
  app.post(API_ROUTES.povertyHouseholdMembers, ...guards, createHouseholdMemberAdmin);
  app.patch(API_ROUTES.povertyHouseholdMemberById, ...guards, updateHouseholdMemberAdminById);
  app.delete(API_ROUTES.povertyHouseholdMemberById, ...guards, deleteHouseholdMemberAdminById);

  app.get(API_ROUTES.povertyHouseholdAssessments, ...guards, listHouseholdAssessmentsAdmin);
  app.post(API_ROUTES.povertyHouseholdAssessments, ...guards, createHouseholdAssessmentAdmin);
  app.patch(API_ROUTES.povertyHouseholdAssessmentById, ...guards, updateHouseholdAssessmentAdminById);
  app.delete(API_ROUTES.povertyHouseholdAssessmentById, ...guards, deleteHouseholdAssessmentAdminById);

  app.get(API_ROUTES.povertyHouseholdContextHistories, ...guards, listHouseholdContextHistoriesAdmin);
  app.post(API_ROUTES.povertyHouseholdContextHistories, ...guards, createHouseholdContextHistoryAdmin);
  app.patch(API_ROUTES.povertyHouseholdContextHistoryById, ...guards, updateHouseholdContextHistoryAdminById);
  app.delete(API_ROUTES.povertyHouseholdContextHistoryById, ...guards, deleteHouseholdContextHistoryAdminById);

  app.get(API_ROUTES.povertyHouseholdSupports, ...guards, listHouseholdSupportsAdmin);
  app.post(API_ROUTES.povertyHouseholdSupports, ...guards, createHouseholdSupportAdmin);
  app.patch(API_ROUTES.povertyHouseholdSupportById, ...guards, updateHouseholdSupportAdminById);
  app.delete(API_ROUTES.povertyHouseholdSupportById, ...guards, deleteHouseholdSupportAdminById);

  app.get(API_ROUTES.povertyHouseholdChangeLogs, ...guards, listHouseholdChangeLogsAdmin);
  app.get(API_ROUTES.povertyGisMarkers, ...guards, listPovertyGisMarkersAdmin);
  app.patch(API_ROUTES.povertyGisMarkerPosition, ...guards, updateHouseholdAdminById);
  app.get(API_ROUTES.povertyDashboard, ...guards, getPovertyDashboardAdmin);
  app.get(API_ROUTES.povertyReportSummary, ...guards, getPovertyReportSummaryAdmin);
  app.get(API_ROUTES.povertyReportExportExcel, ...guards, exportPovertyReportAdmin);
  app.get(API_ROUTES.povertyReportDetail, ...guards, getPovertyReportDetailAdmin);
  app.get(API_ROUTES.povertyReportDetailExportExcel, ...guards, exportPovertyReportDetailAdmin);
  app.get(API_ROUTES.povertyLocationProvinces, ...guards, listPovertyLocationProvincesAdmin);
  app.get(API_ROUTES.povertyLocationWards, ...guards, listPovertyLocationWardsAdmin);
  app.get(API_ROUTES.povertyLocationAreas, ...guards, listPovertyLocationAreasAdmin);
  app.get(API_ROUTES.povertyWardPublicLinks, ...guards, getPovertyWardPublicLinkAdmin);
  app.put(API_ROUTES.povertyWardPublicLinks, ...guards, upsertPovertyWardPublicLinkAdmin);
  app.get(API_ROUTES.povertyWardOverviews, ...guards, listPovertyWardOverviewsAdmin);
  app.put(API_ROUTES.povertyWardOverviews, ...guards, upsertPovertyWardOverviewAdmin);
  app.delete(API_ROUTES.povertyWardOverviewById, ...guards, deletePovertyWardOverviewAdminById);
  app.get(API_ROUTES.povertyWardAreas, ...guards, listPovertyAreasAdmin);
  app.post(API_ROUTES.povertyWardAreas, ...guards, createPovertyAreaAdmin);
  app.patch(API_ROUTES.povertyWardAreaById, ...guards, updatePovertyAreaAdminById);
  app.delete(API_ROUTES.povertyWardAreaById, ...guards, deletePovertyAreaAdminById);
}

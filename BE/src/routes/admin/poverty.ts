import {
  createHouseholdAdmin,
  createHouseholdAssessmentAdmin,
  createHouseholdMemberAdmin,
  createHouseholdSupportAdmin,
  deletePovertyYearOverviewAdminById,
  deleteHouseholdAdminById,
  deleteHouseholdAssessmentAdminById,
  deleteHouseholdMemberAdminById,
  deleteHouseholdSupportAdminById,
  exportHouseholdsAdmin,
  exportPovertyReportDetailAdmin,
  exportPovertyReportAdmin,
  getHouseholdAdminById,
  getPovertyDashboardAdmin,
  getPovertyReportDetailAdmin,
  getPovertyReportSummaryAdmin,
  listPovertyYearOverviewsAdmin,
  importHouseholdsAdmin,
  listHouseholdAssessmentsAdmin,
  listHouseholdChangeLogsAdmin,
  listHouseholdMembersAdmin,
  listHouseholdSupportsAdmin,
  listHouseholdsAdmin,
  listPovertyGisMarkersAdmin,
  updateHouseholdAdminById,
  updateHouseholdAssessmentAdminById,
  updateHouseholdMemberAdminById,
  updateHouseholdSupportAdminById,
  upsertPovertyYearOverviewAdmin
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
  app.get(API_ROUTES.povertyYearOverviews, ...guards, listPovertyYearOverviewsAdmin);
  app.put(API_ROUTES.povertyYearOverviews, ...guards, upsertPovertyYearOverviewAdmin);
  app.delete(API_ROUTES.povertyYearOverviewById, ...guards, deletePovertyYearOverviewAdminById);
}

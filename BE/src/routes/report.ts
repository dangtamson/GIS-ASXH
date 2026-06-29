import {
  reportTaskByDocument
} from "@/handlers/report/reportTaskByDocument.handlers.ts";
import {
  reportTaskByOrganization,
  reportTaskDashboardCoordinationWorkload,
  reportTaskDashboardMainWorkload,
  reportTaskDashboardTotal,
  reportTimelineDashboardTotal
} from "@/handlers/report/reportTaskByOrganization.handlers.ts";
import {
  reportTaskByField
} from "@/handlers/report/reportTaskByField.handlers.ts";
import {
  reportTaskByDocumentType
} from "@/handlers/report/reportTaskByDocumentType.handlers.ts";
import {
  reportTaskDetail,
  reportTaskDetailExportExcel,
  reportTaskDetailExportPdf
} from "@/handlers/report/reportTaskDetail.handlers.ts";
import { reportTaskDashboard } from "@/handlers/report/reportTaskDashboard.handlers.ts";
import { checkAccountStatus } from "@/middleware/checkAccountStatus.ts";
import { isAuthenticated } from "@/middleware/isAuthenticated.ts";
import { isAuthorized } from "@/middleware/isAuthorized.ts";
import type { Application, RequestHandler } from "express";

const reportGuards: readonly RequestHandler[] = [isAuthenticated, checkAccountStatus, isAuthorized];

export function reportRoutes(app: Application): void {
  app.post("/report/reportTaskByDocument", ...reportGuards, reportTaskByDocument);
  app.post("/report/reportTaskByOrganization", ...reportGuards, reportTaskByOrganization);
  app.post("/report/reportTaskByField", ...reportGuards, reportTaskByField);
  app.post("/report/reportTaskByDocumentType", ...reportGuards, reportTaskByDocumentType);
  app.post("/report/reportTaskDetail", ...reportGuards, reportTaskDetail);
  app.post("/report/reportTaskDetailExportExcel", ...reportGuards, reportTaskDetailExportExcel);
  app.post("/report/reportTaskDetailExportPdf", ...reportGuards, reportTaskDetailExportPdf);
  app.post("/report/reportTaskDashboard", ...reportGuards, reportTaskDashboard);
  app.post("/report/reportTaskDashboardMainWorkload", ...reportGuards, reportTaskDashboardMainWorkload);
  app.post("/report/reportTaskDashboardCoordinationWorkload", ...reportGuards, reportTaskDashboardCoordinationWorkload);
  app.post("/report/reportTaskDashboardTotal", ...reportGuards, reportTaskDashboardTotal);
  app.post("/report/reportTimelineDashboardTotal", ...reportGuards, reportTimelineDashboardTotal);
}

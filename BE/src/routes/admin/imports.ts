import {
  commitImportAdmin,
  getImportTemplateAdmin,
  previewImportAdmin
} from "@/handlers/admin/resources/imports/imports.handlers.ts";
import { API_ROUTES } from "@/helpers/permissions.ts";
import type { Application, RequestHandler } from "express";

export function registerImportAdminRoutes(app: Application, guards: readonly RequestHandler[]): void {
  app.get(API_ROUTES.adminImportTemplate, ...guards, getImportTemplateAdmin);
  app.post(API_ROUTES.adminImportPreview, ...guards, previewImportAdmin);
  app.post(API_ROUTES.adminImportCommit, ...guards, commitImportAdmin);
}

import {
  createDocumentAdmin,
  createFileAdmin,
  createNotificationAdmin,
  deleteDocumentAdminById,
  deleteFileAdminById,
  downloadFileAdminById,
  deleteNotificationAdminById,
  getDocumentAdminById,
  getDocumentAdminFiles,
  getFileAdminById,
  getNotificationAdminById,
  // getAiSummaryAdmin,
  listDocumentsAdmin,
  listFilesAdmin,
  listNotificationsAdmin,
  previewFileAdminById,
  // summarizeFileAdminById,
  updateDocumentAdminById,
  updateFileAdminById,
  updateNotificationAdminById,
  // createAiSummaryAdmin,
  // updateAiSummaryAdminById,
  getOrSummarizeAiSummaryAdminByFileId
} from "@/handlers/admin/resources/content/index.ts";
import type { Application, RequestHandler } from "express";

export function registerContentAdminRoutes(app: Application, guards: readonly RequestHandler[]): void {
  app.get("/content/documents", ...guards, listDocumentsAdmin);
  app.post("/content/documents", ...guards, createDocumentAdmin);
  app.get("/content/documents/:id", ...guards, getDocumentAdminById);
  app.get("/content/documents/:id/files", ...guards, getDocumentAdminFiles);
  app.patch("/content/documents/:id", ...guards, updateDocumentAdminById);
  app.delete("/content/documents/:id", ...guards, deleteDocumentAdminById);

  app.get("/content/files", ...guards, listFilesAdmin);
  app.post("/content/files", ...guards, createFileAdmin);
  app.get("/content/files/:id", ...guards, getFileAdminById);
  app.get("/content/files/:id/preview", ...guards, previewFileAdminById);
  // app.post("/content/files/:id/summary", ...guards, summarizeFileAdminById);
  app.post("/content/files/:id/summary", ...guards, getOrSummarizeAiSummaryAdminByFileId);
  app.get("/content/files/:id/download", ...guards, downloadFileAdminById);
  app.patch("/content/files/:id", ...guards, updateFileAdminById);
  app.delete("/content/files/:id", ...guards, deleteFileAdminById);

  // app.post("/content/summary", ...guards, createAiSummaryAdmin);
  // app.get("/content/summary", ...guards, getAiSummaryAdmin);
  // app.patch("/content/summary/:id", ...guards, updateAiSummaryAdminById);

  app.get("/content/notifications", ...guards, listNotificationsAdmin);
  app.post("/content/notifications", ...guards, createNotificationAdmin);
  app.get("/content/notifications/:id", ...guards, getNotificationAdminById);
  app.patch("/content/notifications/:id", ...guards, updateNotificationAdminById);
  app.delete("/content/notifications/:id", ...guards, deleteNotificationAdminById);
}

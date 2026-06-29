import { getSystemConfigAdmin, testSystemConfigEmailAdmin, upsertSystemConfigAdmin } from "@/handlers/admin/resources/system/index.ts";
import type { Application, RequestHandler } from "express";

export function registerSystemAdminRoutes(app: Application, guards: readonly RequestHandler[]): void {
    app.get("/admin/system-config", ...guards, getSystemConfigAdmin);
    app.put("/admin/system-config", ...guards, upsertSystemConfigAdmin);
    app.post("/admin/system-config/test-email", ...guards, testSystemConfigEmailAdmin);
}

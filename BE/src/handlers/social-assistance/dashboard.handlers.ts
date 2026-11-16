import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { buildSuperAdminPovertyAccessScope, resolvePovertyAccessScope } from "@/handlers/admin/resources/poverty/poverty.scope.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import type { Request, Response } from "express";
import { getSocialAssistanceDashboard } from "./dashboard.repository.ts";
import { socialAssistanceDashboardQuerySchema } from "./dashboard.schemas.ts";

const sendError = (res: Response, error: ReturnType<typeof HttpErrors.Forbidden>): void => {
    const response = apiResponse.error(error);
    res.status(response.code).send(response);
};

export const getSocialAssistanceDashboardAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const filters = socialAssistanceDashboardQuerySchema.safeParse(req.query);
    if (!filters.success) {
        sendError(res, HttpErrors.ValidationFailed("Dashboard filters are invalid"));
        return;
    }

    const workspaceId = req.workspaceId?.trim();
    const actorId = req.accountId?.trim();
    if (!workspaceId || !actorId) {
        sendError(res, HttpErrors.Forbidden("Workspace access is required"));
        return;
    }

    const scope = req.user?.isSuperAdmin
        ? buildSuperAdminPovertyAccessScope()
        : await resolvePovertyAccessScope(actorId, workspaceId);
    if (!scope.hasScope) {
        sendError(res, HttpErrors.Forbidden("No organization location scope is assigned"));
        return;
    }

    const dashboard = await getSocialAssistanceDashboard(workspaceId, scope, filters.data);
    const response = apiResponse.success(HttpStatusCode.OK, dashboard, "Social assistance dashboard retrieved");
    res.status(response.code).send(response);
});
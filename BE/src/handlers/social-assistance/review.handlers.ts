import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import {
    buildSuperAdminPovertyAccessScope,
    resolvePovertyAccessScope
} from "@/handlers/admin/resources/poverty/poverty.scope.ts";
import { AUDIT_ACTIONS, createAuditLog, ENTITY_TYPES } from "@/services/auditLog.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import type { Request, Response } from "express";
import {
    canTransitionSocialAssistanceRequest,
    socialAssistanceRequestIdParamSchema,
    socialAssistanceRequestReviewQuerySchema,
    socialAssistanceRequestStatusUpdateSchema
} from "./review.schemas.ts";
import {
    findPotentialDuplicateRequests,
    getSocialAssistanceRequestById,
    listSocialAssistanceRequests,
    updateSocialAssistanceRequestStatus
} from "./requests.repository.ts";

const sendError = (res: Response, error: ReturnType<typeof HttpErrors.Forbidden>): void => {
    const response = apiResponse.error(error);
    res.status(response.code).send(response);
};

const resolveStaffScope = async (req: Request, res: Response) => {
    if (!req.workspaceId || !req.accountId) {
        sendError(res, HttpErrors.Forbidden("Workspace access is required"));
        return null;
    }

    if (req.user?.isSuperAdmin) return buildSuperAdminPovertyAccessScope();

    const scope = await resolvePovertyAccessScope(req.accountId, req.workspaceId);
    if (!scope.hasScope) {
        sendError(res, HttpErrors.Forbidden("No organization location scope is assigned"));
        return null;
    }
    return scope;
};

export const listSocialAssistanceRequestsAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const query = socialAssistanceRequestReviewQuerySchema.safeParse(req.query);
    if (!query.success) {
        sendError(res, HttpErrors.ValidationFailed("Request filters are invalid"));
        return;
    }

    const scope = await resolveStaffScope(req, res);
    if (!scope || !req.workspaceId) return;

    const result = await listSocialAssistanceRequests(req.workspaceId, scope, query.data);
    const response = apiResponse.success(HttpStatusCode.OK, result, "Social assistance requests retrieved");
    res.status(response.code).send(response);
});

export const getSocialAssistanceRequestAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const params = socialAssistanceRequestIdParamSchema.safeParse(req.params);
    if (!params.success) {
        sendError(res, HttpErrors.ValidationFailed("Request ID is invalid"));
        return;
    }

    const scope = await resolveStaffScope(req, res);
    if (!scope || !req.workspaceId) return;

    const item = await getSocialAssistanceRequestById(params.data.id, req.workspaceId, scope);
    if (!item) {
        sendError(res, HttpErrors.NotFound("Social assistance request"));
        return;
    }

    const potentialDuplicates = await findPotentialDuplicateRequests(req.workspaceId, {
        requestId: item.id,
        phone: item.phone,
        provinceCode: item.provinceCode,
        wardCode: item.wardCode
    });
    const response = apiResponse.success(
        HttpStatusCode.OK,
        { item, potentialDuplicates },
        "Social assistance request retrieved"
    );
    res.status(response.code).send(response);
});

export const updateSocialAssistanceRequestStatusAdmin = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
        const params = socialAssistanceRequestIdParamSchema.safeParse(req.params);
        if (!params.success) {
            sendError(res, HttpErrors.ValidationFailed("Request ID is invalid"));
            return;
        }

        const body = socialAssistanceRequestStatusUpdateSchema.safeParse(req.body);
        if (!body.success) {
            sendError(res, HttpErrors.ValidationFailed("Request status update is invalid"));
            return;
        }

        const scope = await resolveStaffScope(req, res);
        if (!scope || !req.workspaceId || !req.accountId) return;

        const existing = await getSocialAssistanceRequestById(params.data.id, req.workspaceId, scope);
        if (!existing) {
            sendError(res, HttpErrors.NotFound("Social assistance request"));
            return;
        }

        if (!canTransitionSocialAssistanceRequest(existing.status as never, body.data.status)) {
            sendError(res, HttpErrors.BadRequest("Request status transition is not allowed"));
            return;
        }

        const updated = await updateSocialAssistanceRequestStatus(
            params.data.id,
            req.workspaceId,
            scope,
            body.data.status,
            body.data.internalReason,
            req.accountId
        );
        if (!updated) {
            sendError(res, HttpErrors.NotFound("Social assistance request"));
            return;
        }

        await createAuditLog(
            {
                action: AUDIT_ACTIONS.SOCIAL_ASSISTANCE_REQUEST_STATUS_UPDATED,
                entityType: ENTITY_TYPES.SOCIAL_ASSISTANCE_REQUEST,
                entityId: updated.id,
                actorId: req.accountId,
                workspaceId: req.workspaceId,
                details: {
                    from: existing.status,
                    to: updated.status,
                    note: body.data.internalReason ?? null
                }
            },
            req
        );

        const response = apiResponse.success(HttpStatusCode.OK, { item: updated }, "Social assistance request updated");
        res.status(response.code).send(response);
    }
);
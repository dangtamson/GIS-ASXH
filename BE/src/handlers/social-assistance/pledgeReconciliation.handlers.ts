import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { AUDIT_ACTIONS, createAuditLog, ENTITY_TYPES } from "@/services/auditLog.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import type { Request, Response } from "express";
import {
    listSocialAssistancePledges,
    updateSocialAssistancePledgeReconciliation
} from "./pledges.repository.ts";
import {
    socialAssistancePledgeIdParamSchema,
    socialAssistancePledgeListQuerySchema,
    socialAssistancePledgeReconciliationSchema
} from "./pledges.schemas.ts";

const sendError = (res: Response, error: ReturnType<typeof HttpErrors.Forbidden>): void => {
    const response = apiResponse.error(error);
    res.status(response.code).send(response);
};

export const listSocialAssistancePledgesAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const workspaceId = req.workspaceId?.trim();
    if (!workspaceId) {
        sendError(res, HttpErrors.Forbidden("Workspace access is required"));
        return;
    }

    const query = socialAssistancePledgeListQuerySchema.safeParse(req.query);
    if (!query.success) {
        sendError(res, HttpErrors.ValidationFailed("Pledge filters are invalid"));
        return;
    }

    const items = await listSocialAssistancePledges(workspaceId, query.data.status);
    const response = apiResponse.success(HttpStatusCode.OK, { items }, "Social assistance pledges retrieved");
    res.status(response.code).send(response);
});

export const updateSocialAssistancePledgeAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const workspaceId = req.workspaceId?.trim();
    const actorId = req.accountId?.trim();
    if (!workspaceId || !actorId) {
        sendError(res, HttpErrors.Forbidden("Workspace access is required"));
        return;
    }

    const params = socialAssistancePledgeIdParamSchema.safeParse(req.params);
    if (!params.success) {
        sendError(res, HttpErrors.ValidationFailed("Pledge ID is invalid"));
        return;
    }
    const body = socialAssistancePledgeReconciliationSchema.safeParse(req.body);
    if (!body.success) {
        sendError(res, HttpErrors.ValidationFailed("Pledge reconciliation is invalid"));
        return;
    }

    const item = await updateSocialAssistancePledgeReconciliation(params.data.id, workspaceId, actorId, body.data);
    if (!item) {
        sendError(res, HttpErrors.Conflict("Pledge transition or receipt details are invalid"));
        return;
    }

    await createAuditLog(
        {
            action: AUDIT_ACTIONS.SOCIAL_ASSISTANCE_PLEDGE_STATUS_UPDATED,
            entityType: ENTITY_TYPES.SOCIAL_ASSISTANCE_PLEDGE,
            entityId: item.id,
            actorId,
            workspaceId,
            details: {
                status: item.status,
                receivedAmount: item.receivedAmount ?? null,
                hasReceivedDescription: Boolean(item.receivedDescription),
                note: item.internalNote ?? null
            }
        },
        req
    );

    const response = apiResponse.success(HttpStatusCode.OK, { item }, "Social assistance pledge updated");
    res.status(response.code).send(response);
});
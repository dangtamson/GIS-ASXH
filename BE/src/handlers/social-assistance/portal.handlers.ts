import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { AUDIT_ACTIONS, createAuditLog, ENTITY_TYPES } from "@/services/auditLog.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import type { Request, Response } from "express";
import {
    getOrCreateSocialAssistancePortal,
    resolveSocialAssistancePortalFromWardSlug,
    updateSocialAssistancePortal
} from "./portal.repository.ts";
import { socialAssistancePublicPortalUpdateSchema } from "./portal.schemas.ts";

const sendError = (res: Response, error: ReturnType<typeof HttpErrors.Forbidden>): void => {
    const response = apiResponse.error(error);
    res.status(response.code).send(response);
};

const requireWorkspace = (req: Request, res: Response): { workspaceId: string; actorId: string } | null => {
    const workspaceId = req.workspaceId?.trim();
    const actorId = req.accountId?.trim();
    if (!workspaceId || !actorId) {
        sendError(res, HttpErrors.Forbidden("Workspace access is required"));
        return null;
    }
    return { workspaceId, actorId };
};

export const getSocialAssistancePortalAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const access = requireWorkspace(req, res);
    if (!access) return;

    const item = await getOrCreateSocialAssistancePortal(access.workspaceId, access.actorId);
    if (!item) {
        sendError(res, HttpErrors.InternalError("Could not load the social assistance portal"));
        return;
    }

    const response = apiResponse.success(HttpStatusCode.OK, { item }, "Social assistance portal retrieved");
    res.status(response.code).send(response);
});

export const updateSocialAssistancePortalAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const access = requireWorkspace(req, res);
    if (!access) return;

    const parsed = socialAssistancePublicPortalUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
        sendError(res, HttpErrors.ValidationFailed("Portal settings are invalid"));
        return;
    }

    await getOrCreateSocialAssistancePortal(access.workspaceId, access.actorId);
    const item = await updateSocialAssistancePortal(access.workspaceId, access.actorId, parsed.data);
    if (!item) {
        sendError(res, HttpErrors.NotFound("Social assistance portal"));
        return;
    }

    await createAuditLog(
        {
            action: AUDIT_ACTIONS.SOCIAL_ASSISTANCE_PORTAL_UPDATED,
            entityType: ENTITY_TYPES.SOCIAL_ASSISTANCE_PORTAL,
            entityId: item.id,
            actorId: access.actorId,
            workspaceId: access.workspaceId,
            details: parsed.data
        },
        req
    );

    const response = apiResponse.success(HttpStatusCode.OK, { item }, "Social assistance portal updated");
    res.status(response.code).send(response);
});

export const getPublicSocialAssistancePortalFromWardHandler = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
        const wardSlug = String(req.params.wardSlug ?? "").trim();
        if (!wardSlug) {
            sendError(res, HttpErrors.NotFound("Social assistance portal"));
            return;
        }

        const item = await resolveSocialAssistancePortalFromWardSlug(wardSlug);
        if (!item) {
            sendError(res, HttpErrors.NotFound("Social assistance portal"));
            return;
        }

        const response = apiResponse.success(HttpStatusCode.OK, item, "Social assistance portal resolved");
        res.status(response.code).send(response);
    }
);

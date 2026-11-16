import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { AUDIT_ACTIONS, createAuditLog, ENTITY_TYPES } from "@/services/auditLog.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import type { Request, Response } from "express";
import {
    createSocialAssistanceProgram,
    listPublicSocialAssistancePrograms,
    updateSocialAssistanceProgram
} from "./programs.repository.ts";
import {
    socialAssistanceProgramCreateSchema,
    socialAssistanceProgramIdParamSchema,
    socialAssistanceProgramUpdateSchema
} from "./programs.schemas.ts";

const sendError = (res: Response, error: ReturnType<typeof HttpErrors.Forbidden>): void => {
    const response = apiResponse.error(error);
    res.status(response.code).send(response);
};

export const createSocialAssistanceProgramAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const workspaceId = req.workspaceId?.trim();
    const actorId = req.accountId?.trim();
    if (!workspaceId || !actorId) {
        sendError(res, HttpErrors.Forbidden("Workspace access is required"));
        return;
    }

    const parsed = socialAssistanceProgramCreateSchema.safeParse(req.body);
    if (!parsed.success) {
        sendError(res, HttpErrors.ValidationFailed("Program information is invalid"));
        return;
    }

    const item = await createSocialAssistanceProgram(workspaceId, actorId, parsed.data);
    if (!item) {
        sendError(res, HttpErrors.InternalError("Could not create program"));
        return;
    }

    await createAuditLog(
        {
            action: AUDIT_ACTIONS.SOCIAL_ASSISTANCE_PROGRAM_CREATED,
            entityType: ENTITY_TYPES.SOCIAL_ASSISTANCE_PROGRAM,
            entityId: item.id,
            actorId,
            workspaceId,
            details: { status: item.status, category: item.category }
        },
        req
    );

    const response = apiResponse.success(HttpStatusCode.CREATED, { item }, "Social assistance program created");
    res.status(response.code).send(response);
});

export const updateSocialAssistanceProgramAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const workspaceId = req.workspaceId?.trim();
    const actorId = req.accountId?.trim();
    if (!workspaceId || !actorId) {
        sendError(res, HttpErrors.Forbidden("Workspace access is required"));
        return;
    }

    const params = socialAssistanceProgramIdParamSchema.safeParse(req.params);
    if (!params.success) {
        sendError(res, HttpErrors.ValidationFailed("Program ID is invalid"));
        return;
    }

    const parsed = socialAssistanceProgramUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
        sendError(res, HttpErrors.ValidationFailed("Program update is invalid"));
        return;
    }

    const item = await updateSocialAssistanceProgram(params.data.id, workspaceId, actorId, parsed.data);
    if (!item) {
        sendError(res, HttpErrors.NotFound("Social assistance program"));
        return;
    }

    await createAuditLog(
        {
            action: AUDIT_ACTIONS.SOCIAL_ASSISTANCE_PROGRAM_UPDATED,
            entityType: ENTITY_TYPES.SOCIAL_ASSISTANCE_PROGRAM,
            entityId: item.id,
            actorId,
            workspaceId,
            details: { updatedFields: Object.keys(parsed.data), status: item.status }
        },
        req
    );

    const response = apiResponse.success(HttpStatusCode.OK, { item }, "Social assistance program updated");
    res.status(response.code).send(response);
});

export const listPublicSocialAssistanceProgramsHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const slug = String(req.params.slug ?? "").trim();
    if (!slug) {
        sendError(res, HttpErrors.NotFound("Social assistance portal"));
        return;
    }

    const items = await listPublicSocialAssistancePrograms(slug);
    if (!items) {
        sendError(res, HttpErrors.NotFound("Social assistance portal"));
        return;
    }

    const response = apiResponse.success(HttpStatusCode.OK, { items }, "Public social assistance programs retrieved");
    res.status(response.code).send(response);
});
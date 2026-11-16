import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { buildSuperAdminPovertyAccessScope, resolvePovertyAccessScope } from "@/handlers/admin/resources/poverty/poverty.scope.ts";
import { AUDIT_ACTIONS, createAuditLog, ENTITY_TYPES } from "@/services/auditLog.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import type { Request, Response } from "express";
import {
    approveSocialAssistancePublication,
    createSocialAssistancePublicationDraft,
    getSocialAssistancePublicationOptions,
    listPublicSocialAssistanceMap,
    previewSocialAssistancePublication
} from "./publications.repository.ts";
import {
    socialAssistancePublicationBatchIdSchema,
    socialAssistancePublicationFiltersSchema
} from "./publications.schemas.ts";

const sendError = (res: Response, error: ReturnType<typeof HttpErrors.Forbidden>): void => {
    const response = apiResponse.error(error);
    res.status(response.code).send(response);
};

const resolvePublicationScope = async (req: Request, res: Response) => {
    const workspaceId = req.workspaceId?.trim();
    const actorId = req.accountId?.trim();
    if (!workspaceId || !actorId) {
        sendError(res, HttpErrors.Forbidden("Workspace access is required"));
        return null;
    }
    const scope = req.user?.isSuperAdmin
        ? buildSuperAdminPovertyAccessScope()
        : await resolvePovertyAccessScope(actorId, workspaceId);
    if (!scope.hasScope) {
        sendError(res, HttpErrors.Forbidden("No organization location scope is assigned"));
        return null;
    }
    return { workspaceId, actorId, scope };
};

export const getSocialAssistancePublicationOptionsAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const access = await resolvePublicationScope(req, res);
    if (!access) return;
    const options = await getSocialAssistancePublicationOptions(access.workspaceId, access.scope);
    if (!options) {
        sendError(res, HttpErrors.Forbidden("No organization location scope is assigned"));
        return;
    }
    const response = apiResponse.success(HttpStatusCode.OK, options, "Publication filter options retrieved");
    res.status(response.code).send(response);
});

export const previewSocialAssistancePublicationAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const filters = socialAssistancePublicationFiltersSchema.safeParse(req.body);
    if (!filters.success) {
        sendError(res, HttpErrors.ValidationFailed("Publication filters are invalid"));
        return;
    }
    const access = await resolvePublicationScope(req, res);
    if (!access) return;

    const items = await previewSocialAssistancePublication(access.workspaceId, access.scope, filters.data);
    if (!items) {
        sendError(res, HttpErrors.Forbidden("No organization location scope is assigned"));
        return;
    }
    const response = apiResponse.success(HttpStatusCode.OK, { items }, "Publication preview generated");
    res.status(response.code).send(response);
});

export const createSocialAssistancePublicationDraftAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const filters = socialAssistancePublicationFiltersSchema.safeParse(req.body);
    if (!filters.success) {
        sendError(res, HttpErrors.ValidationFailed("Publication filters are invalid"));
        return;
    }
    const access = await resolvePublicationScope(req, res);
    if (!access) return;

    const draft = await createSocialAssistancePublicationDraft(
        access.workspaceId,
        access.actorId,
        access.scope,
        filters.data
    );
    if (!draft) {
        sendError(res, HttpErrors.Conflict("No completed support is available for this publication period"));
        return;
    }

    await createAuditLog({
        action: AUDIT_ACTIONS.SOCIAL_ASSISTANCE_PUBLICATION_DRAFT_CREATED,
        entityType: ENTITY_TYPES.SOCIAL_ASSISTANCE_PUBLICATION,
        entityId: draft.publicationBatchId,
        actorId: access.actorId,
        workspaceId: access.workspaceId,
        details: { periodStart: filters.data.periodStart, periodEnd: filters.data.periodEnd, rowCount: draft.items.length }
    }, req);

    const response = apiResponse.success(HttpStatusCode.CREATED, draft, "Publication draft created");
    res.status(response.code).send(response);
});

export const approveSocialAssistancePublicationAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const params = socialAssistancePublicationBatchIdSchema.safeParse(req.params);
    if (!params.success) {
        sendError(res, HttpErrors.ValidationFailed("Publication batch ID is invalid"));
        return;
    }
    const access = await resolvePublicationScope(req, res);
    if (!access) return;

    const publication = await approveSocialAssistancePublication(
        access.workspaceId,
        access.actorId,
        access.scope,
        params.data.batchId
    );
    if (!publication) {
        sendError(res, HttpErrors.Conflict("Publication batch is unavailable or outside your location scope"));
        return;
    }

    await createAuditLog({
        action: AUDIT_ACTIONS.SOCIAL_ASSISTANCE_PUBLICATION_APPROVED,
        entityType: ENTITY_TYPES.SOCIAL_ASSISTANCE_PUBLICATION,
        entityId: publication.publicationBatchId,
        actorId: access.actorId,
        workspaceId: access.workspaceId,
        details: { approvedRowCount: publication.items.length }
    }, req);

    const response = apiResponse.success(HttpStatusCode.OK, publication, "Publication approved");
    res.status(response.code).send(response);
});

export const getPublicSocialAssistanceMapHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const slug = typeof req.params.slug === "string" ? req.params.slug.trim() : "";
    if (!slug) {
        sendError(res, HttpErrors.NotFound("Social assistance results"));
        return;
    }

    const result = await listPublicSocialAssistanceMap(slug);
    if (!result) {
        sendError(res, HttpErrors.NotFound("Social assistance results"));
        return;
    }
    const response = apiResponse.success(HttpStatusCode.OK, result, "Public social assistance results retrieved");
    res.status(response.code).send(response);
});
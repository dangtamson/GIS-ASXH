import type { Request, Response } from "express";
import { HttpError, HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import {
    buildSuperAdminPovertyAccessScope,
    resolvePovertyAccessScope
} from "@/handlers/admin/resources/poverty/poverty.scope.ts";
import { AUDIT_ACTIONS, createAuditLog, ENTITY_TYPES } from "@/services/auditLog.ts";
import {
    closeDistributionBatch,
    createDistributionBatch,
    getDistributionBatch,
    listDistributionBatches,
    listPublicDistributionBatches,
    publishDistributionBatch,
    updateDraftDistributionBatch
} from "./distribution-batches.repository.ts";
import {
    distributionBatchCreateSchema,
    distributionBatchIdParamSchema,
    distributionBatchListQuerySchema,
    publicDistributionBatchListQuerySchema
} from "./distribution-batches.schemas.ts";

const sendError = (res: Response, error: HttpError): void => {
    const response = apiResponse.error(error);
    res.status(response.code).send(response);
};

type AdminContext = {
    workspaceId: string;
    actorId: string;
    scope: Awaited<ReturnType<typeof resolvePovertyAccessScope>>;
};

const resolveAdminContext = async (req: Request, res: Response): Promise<AdminContext | null> => {
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

const auditDistributionBatch = async (
    req: Request,
    context: AdminContext,
    item: {
        id: string;
        documentNumber: string;
        status: string;
        declaredTotalQuantity: number;
        declaredTotalAmount: number;
        lines: Array<unknown>;
        supersedesBatchId?: string | null;
    },
    action: string
): Promise<void> => createAuditLog({
    action,
    entityType: ENTITY_TYPES.SOCIAL_ASSISTANCE_DISTRIBUTION_BATCH,
    entityId: item.id,
    actorId: context.actorId,
    workspaceId: context.workspaceId,
    details: {
        documentNumber: item.documentNumber,
        status: item.status,
        lineCount: item.lines.length,
        declaredTotalQuantity: item.declaredTotalQuantity,
        declaredTotalAmount: item.declaredTotalAmount,
        supersedesBatchId: item.supersedesBatchId ?? null
    }
}, req);

export const listDistributionBatchesAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const context = await resolveAdminContext(req, res);
    if (!context) return;

    const parsed = distributionBatchListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        sendError(res, HttpErrors.ValidationFailed("Distribution batch filters are invalid"));
        return;
    }

    const items = await listDistributionBatches(context.workspaceId, context.scope, parsed.data);
    const response = apiResponse.success(HttpStatusCode.OK, { items }, "Distribution batches retrieved");
    res.status(response.code).send(response);
});

export const getDistributionBatchAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const context = await resolveAdminContext(req, res);
    if (!context) return;

    const parsed = distributionBatchIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
        sendError(res, HttpErrors.ValidationFailed("Distribution batch ID is invalid"));
        return;
    }

    const item = await getDistributionBatch(context.workspaceId, context.scope, parsed.data.id);
    if (!item) {
        sendError(res, HttpErrors.NotFound("Distribution batch"));
        return;
    }

    const response = apiResponse.success(HttpStatusCode.OK, { item }, "Distribution batch retrieved");
    res.status(response.code).send(response);
});

export const createDistributionBatchAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const context = await resolveAdminContext(req, res);
    if (!context) return;

    const parsed = distributionBatchCreateSchema.safeParse(req.body);
    if (!parsed.success) {
        sendError(res, HttpErrors.ValidationFailed("Distribution batch information is invalid"));
        return;
    }

    const item = await createDistributionBatch(context.workspaceId, context.actorId, context.scope, parsed.data);
    if (!item) {
        sendError(res, HttpErrors.Conflict("Distribution batch references or locality scope are invalid"));
        return;
    }

    await auditDistributionBatch(req, context, item, AUDIT_ACTIONS.SOCIAL_ASSISTANCE_DISTRIBUTION_BATCH_CREATED);
    const response = apiResponse.success(HttpStatusCode.CREATED, { item }, "Distribution batch created");
    res.status(response.code).send(response);
});

export const updateDraftDistributionBatchAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const context = await resolveAdminContext(req, res);
    if (!context) return;

    const params = distributionBatchIdParamSchema.safeParse(req.params);
    const parsed = distributionBatchCreateSchema.safeParse(req.body);
    if (!params.success || !parsed.success) {
        sendError(res, HttpErrors.ValidationFailed("Distribution batch update is invalid"));
        return;
    }

    const item = await updateDraftDistributionBatch(
        context.workspaceId,
        context.actorId,
        context.scope,
        params.data.id,
        parsed.data
    );
    if (!item) {
        sendError(res, HttpErrors.Conflict("Only an in-scope draft batch can be updated"));
        return;
    }

    await auditDistributionBatch(req, context, item, AUDIT_ACTIONS.SOCIAL_ASSISTANCE_DISTRIBUTION_BATCH_UPDATED);
    const response = apiResponse.success(HttpStatusCode.OK, { item }, "Distribution batch updated");
    res.status(response.code).send(response);
});

export const publishDistributionBatchAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const context = await resolveAdminContext(req, res);
    if (!context) return;

    const parsed = distributionBatchIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
        sendError(res, HttpErrors.ValidationFailed("Distribution batch ID is invalid"));
        return;
    }

    const item = await publishDistributionBatch(context.workspaceId, context.actorId, context.scope, parsed.data.id);
    if (!item) {
        sendError(res, HttpErrors.Conflict("Distribution batch cannot be published in its current state"));
        return;
    }

    await auditDistributionBatch(req, context, item, AUDIT_ACTIONS.SOCIAL_ASSISTANCE_DISTRIBUTION_BATCH_PUBLISHED);
    const response = apiResponse.success(HttpStatusCode.OK, { item }, "Distribution batch published");
    res.status(response.code).send(response);
});

export const closeDistributionBatchAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const context = await resolveAdminContext(req, res);
    if (!context) return;

    const parsed = distributionBatchIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
        sendError(res, HttpErrors.ValidationFailed("Distribution batch ID is invalid"));
        return;
    }

    const item = await closeDistributionBatch(context.workspaceId, context.actorId, context.scope, parsed.data.id);
    if (!item) {
        sendError(res, HttpErrors.Conflict("Only a published in-scope batch can be closed"));
        return;
    }

    await auditDistributionBatch(req, context, item, AUDIT_ACTIONS.SOCIAL_ASSISTANCE_DISTRIBUTION_BATCH_CLOSED);
    const response = apiResponse.success(HttpStatusCode.OK, { item }, "Distribution batch closed");
    res.status(response.code).send(response);
});

export const listPublicDistributionBatchesHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const slug = req.params.slug?.trim();
    const parsed = publicDistributionBatchListQuerySchema.safeParse(req.query);
    if (!slug || !parsed.success) {
        sendError(res, HttpErrors.ValidationFailed("Public distribution batch request is invalid"));
        return;
    }

    const items = await listPublicDistributionBatches(slug, parsed.data);
    if (!items) {
        sendError(res, HttpErrors.NotFound("Public allocation portal"));
        return;
    }

    const response = apiResponse.success(HttpStatusCode.OK, { items }, "Public allocation batches retrieved");
    res.status(response.code).send(response);
});
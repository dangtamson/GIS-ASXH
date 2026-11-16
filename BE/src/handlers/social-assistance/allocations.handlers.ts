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
    createSocialAssistanceAllocation,
    listSocialAssistanceAllocations,
    updateSocialAssistanceAllocation
} from "./allocations.repository.ts";
import {
    socialAssistanceAllocationCreateSchema,
    socialAssistanceAllocationIdParamSchema,
    socialAssistanceAllocationUpdateSchema
} from "./allocations.schemas.ts";

const sendError = (res: Response, error: ReturnType<typeof HttpErrors.Forbidden>): void => {
    const response = apiResponse.error(error);
    res.status(response.code).send(response);
};

export const listSocialAssistanceAllocationsAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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

    const items = await listSocialAssistanceAllocations(workspaceId, scope);
    const response = apiResponse.success(HttpStatusCode.OK, { items }, "Social assistance allocations retrieved");
    res.status(response.code).send(response);
});

export const createSocialAssistanceAllocationAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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

    const parsed = socialAssistanceAllocationCreateSchema.safeParse(req.body);
    if (!parsed.success) {
        sendError(res, HttpErrors.ValidationFailed("Allocation information is invalid"));
        return;
    }

    const result = await createSocialAssistanceAllocation(workspaceId, actorId, scope, parsed.data);
    if (!result) {
        sendError(res, HttpErrors.Conflict("Only verified requests and published programs can be allocated"));
        return;
    }

    await createAuditLog(
        {
            action: AUDIT_ACTIONS.SOCIAL_ASSISTANCE_ALLOCATION_CREATED,
            entityType: ENTITY_TYPES.SOCIAL_ASSISTANCE_ALLOCATION,
            entityId: result.item.id,
            actorId,
            workspaceId,
            details: {
                programId: result.item.programId,
                requestId: result.item.requestId,
                priorSupportCount: result.priorSupportCount,
                plannedCashAmount: result.item.plannedCashAmount ?? null,
                hasPlannedItemDescription: Boolean(result.item.plannedItemDescription)
            }
        },
        req
    );

    const response = apiResponse.success(HttpStatusCode.CREATED, result, "Social assistance allocation created");
    res.status(response.code).send(response);
});

export const updateSocialAssistanceAllocationAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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

    const params = socialAssistanceAllocationIdParamSchema.safeParse(req.params);
    const parsed = socialAssistanceAllocationUpdateSchema.safeParse(req.body);
    if (!params.success || !parsed.success) {
        sendError(res, HttpErrors.ValidationFailed("Allocation update is invalid"));
        return;
    }

    const item = await updateSocialAssistanceAllocation(params.data.id, workspaceId, actorId, parsed.data);
    if (!item) {
        sendError(res, HttpErrors.Conflict("Allocation transition or delivery details are invalid"));
        return;
    }

    await createAuditLog(
        {
            action: AUDIT_ACTIONS.SOCIAL_ASSISTANCE_ALLOCATION_UPDATED,
            entityType: ENTITY_TYPES.SOCIAL_ASSISTANCE_ALLOCATION,
            entityId: item.id,
            actorId,
            workspaceId,
            details: {
                status: item.status,
                deliveredCashAmount: item.deliveredCashAmount ?? null,
                hasDeliveredItemDescription: Boolean(item.deliveredItemDescription),
                deliveryDate: item.deliveryDate ?? null
            }
        },
        req
    );

    const response = apiResponse.success(HttpStatusCode.OK, { item }, "Social assistance allocation updated");
    res.status(response.code).send(response);
});
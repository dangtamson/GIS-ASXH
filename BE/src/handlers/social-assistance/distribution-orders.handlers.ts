import type { Request, Response } from "express";
import { z } from "zod";
import { HttpError, HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import { buildSuperAdminPovertyAccessScope, resolvePovertyAccessScope } from "@/handlers/admin/resources/poverty/poverty.scope.ts";
import { AUDIT_ACTIONS, createAuditLog, ENTITY_TYPES } from "@/services/auditLog.ts";
import { createDistributionBeneficiary, listDistributionBeneficiaries } from "./distribution-beneficiaries.repository.ts";
import { closeDistributionOrder, createDistributionOrder, getDistributionOrder, listDistributionOrders, listPublicDistributionOrders, publishDistributionOrder, updateDraftDistributionOrder } from "./distribution-orders.repository.ts";
import { distributionBeneficiaryCreateSchema, distributionOrderCreateSchema } from "./distribution-orders.schemas.ts";

const targetParamsSchema = z.object({ targetId: z.uuid() });
const orderParamsSchema = z.object({ id: z.uuid() });

const sendError = (response: Response, error: HttpError): void => {
    const body = apiResponse.error(error);
    response.status(body.code).send(body);
};

type AdminContext = {
    workspaceId: string;
    actorId: string;
    scope: Awaited<ReturnType<typeof resolvePovertyAccessScope>>;
};

const resolveContext = async (request: Request, response: Response, requireAssignedScope = false): Promise<AdminContext | null> => {
    const workspaceId = request.workspaceId?.trim();
    const actorId = request.accountId?.trim();
    if (!workspaceId || !actorId) {
        sendError(response, HttpErrors.Forbidden("Workspace access is required"));
        return null;
    }
    const scope = request.user?.isSuperAdmin && !requireAssignedScope
        ? buildSuperAdminPovertyAccessScope()
        : await resolvePovertyAccessScope(actorId, workspaceId);
    if (!scope.isSuperAdmin && !scope.hasScope && scope.organizationIds.length === 0) {
        sendError(response, HttpErrors.Forbidden("No organization or location scope is assigned"));
        return null;
    }
    return { workspaceId, actorId, scope };
};

export const listDistributionOrdersAdmin = asyncHandler(async (request: Request, response: Response): Promise<void> => {
    const context = await resolveContext(request, response);
    if (!context) return;
    const items = await listDistributionOrders(context.workspaceId, context.scope);
    const body = apiResponse.success(HttpStatusCode.OK, { items }, "Distribution orders retrieved");
    response.status(body.code).send(body);
});

export const createDistributionOrderAdmin = asyncHandler(async (request: Request, response: Response): Promise<void> => {
    const context = await resolveContext(request, response);
    if (!context) return;
    const parsed = distributionOrderCreateSchema.safeParse(request.body);
    if (!parsed.success) {
        sendError(response, HttpErrors.ValidationFailed("Distribution order is invalid"));
        return;
    }
    const item = await createDistributionOrder(context.workspaceId, context.actorId, context.scope, parsed.data);
    if (!item) {
        sendError(response, HttpErrors.Conflict("Distribution order references or scope are invalid"));
        return;
    }
    await createAuditLog({
        action: AUDIT_ACTIONS.SOCIAL_ASSISTANCE_DISTRIBUTION_ORDER_CREATED,
        entityType: ENTITY_TYPES.SOCIAL_ASSISTANCE_DISTRIBUTION_ORDER,
        entityId: item.id,
        actorId: context.actorId,
        workspaceId: context.workspaceId,
        details: { documentNumber: item.documentNumber, componentCount: parsed.data.components.length }
    }, request);
    const body = apiResponse.success(HttpStatusCode.CREATED, { item }, "Distribution order created");
    response.status(body.code).send(body);
});

export const getDistributionOrderAdmin = asyncHandler(async (request: Request, response: Response): Promise<void> => {
    const context = await resolveContext(request, response);
    if (!context) return;
    const parsed = orderParamsSchema.safeParse(request.params);
    if (!parsed.success) {
        sendError(response, HttpErrors.ValidationFailed("Distribution order ID is invalid"));
        return;
    }
    const item = await getDistributionOrder(context.workspaceId, context.scope, parsed.data.id);
    if (!item) {
        sendError(response, HttpErrors.NotFound("Distribution order"));
        return;
    }
    const body = apiResponse.success(HttpStatusCode.OK, { item }, "Distribution order retrieved");
    response.status(body.code).send(body);
});

export const updateDraftDistributionOrderAdmin = asyncHandler(async (request: Request, response: Response): Promise<void> => {
    const context = await resolveContext(request, response);
    if (!context) return;
    const params = orderParamsSchema.safeParse(request.params);
    const parsed = distributionOrderCreateSchema.safeParse(request.body);
    if (!params.success || !parsed.success) {
        sendError(response, HttpErrors.ValidationFailed("Distribution order update is invalid"));
        return;
    }
    const item = await updateDraftDistributionOrder(context.workspaceId, context.actorId, context.scope, params.data.id, parsed.data);
    if (!item) {
        sendError(response, HttpErrors.Conflict("Only an in-scope draft distribution order can be updated"));
        return;
    }
    await createAuditLog({
        action: AUDIT_ACTIONS.SOCIAL_ASSISTANCE_DISTRIBUTION_ORDER_UPDATED,
        entityType: ENTITY_TYPES.SOCIAL_ASSISTANCE_DISTRIBUTION_ORDER,
        entityId: item.id,
        actorId: context.actorId,
        workspaceId: context.workspaceId,
        details: { documentNumber: item.documentNumber, componentCount: item.components.length }
    }, request);
    const body = apiResponse.success(HttpStatusCode.OK, { item }, "Distribution order updated");
    response.status(body.code).send(body);
});

export const publishDistributionOrderAdmin = asyncHandler(async (request: Request, response: Response): Promise<void> => {
    const context = await resolveContext(request, response);
    if (!context) return;
    const params = orderParamsSchema.safeParse(request.params);
    if (!params.success) {
        sendError(response, HttpErrors.ValidationFailed("Distribution order ID is invalid"));
        return;
    }
    const item = await publishDistributionOrder(context.workspaceId, context.actorId, context.scope, params.data.id);
    if (!item) {
        sendError(response, HttpErrors.Conflict("Distribution order cannot be published in its current state"));
        return;
    }
    await createAuditLog({
        action: AUDIT_ACTIONS.SOCIAL_ASSISTANCE_DISTRIBUTION_ORDER_PUBLISHED,
        entityType: ENTITY_TYPES.SOCIAL_ASSISTANCE_DISTRIBUTION_ORDER,
        entityId: item.id,
        actorId: context.actorId,
        workspaceId: context.workspaceId,
        details: { documentNumber: item.documentNumber, status: item.status }
    }, request);
    const body = apiResponse.success(HttpStatusCode.OK, { item }, "Distribution order published");
    response.status(body.code).send(body);
});

export const closeDistributionOrderAdmin = asyncHandler(async (request: Request, response: Response): Promise<void> => {
    const context = await resolveContext(request, response);
    if (!context) return;
    const params = orderParamsSchema.safeParse(request.params);
    if (!params.success) {
        sendError(response, HttpErrors.ValidationFailed("Distribution order ID is invalid"));
        return;
    }
    const item = await closeDistributionOrder(context.workspaceId, context.actorId, context.scope, params.data.id);
    if (!item) {
        sendError(response, HttpErrors.Conflict("Only a published in-scope distribution order can be closed"));
        return;
    }
    await createAuditLog({
        action: AUDIT_ACTIONS.SOCIAL_ASSISTANCE_DISTRIBUTION_ORDER_CLOSED,
        entityType: ENTITY_TYPES.SOCIAL_ASSISTANCE_DISTRIBUTION_ORDER,
        entityId: item.id,
        actorId: context.actorId,
        workspaceId: context.workspaceId,
        details: { documentNumber: item.documentNumber, status: item.status }
    }, request);
    const body = apiResponse.success(HttpStatusCode.OK, { item }, "Distribution order closed");
    response.status(body.code).send(body);
});

export const listDistributionBeneficiariesAdmin = asyncHandler(async (request: Request, response: Response): Promise<void> => {
    const context = await resolveContext(request, response, true);
    if (!context) return;
    const parsed = targetParamsSchema.safeParse(request.params);
    if (!parsed.success) {
        sendError(response, HttpErrors.ValidationFailed("Allocation target is invalid"));
        return;
    }
    const items = await listDistributionBeneficiaries(context.workspaceId, context.scope, parsed.data.targetId);
    if (!items) {
        sendError(response, HttpErrors.NotFound("Allocation target"));
        return;
    }
    const body = apiResponse.success(HttpStatusCode.OK, { items }, "Beneficiaries retrieved");
    response.status(body.code).send(body);
});

export const createDistributionBeneficiaryAdmin = asyncHandler(async (request: Request, response: Response): Promise<void> => {
    const context = await resolveContext(request, response, true);
    if (!context) return;
    const params = targetParamsSchema.safeParse(request.params);
    const parsed = distributionBeneficiaryCreateSchema.safeParse(request.body);
    if (!params.success || !parsed.success || parsed.data.targetId !== params.data.targetId) {
        sendError(response, HttpErrors.ValidationFailed("Beneficiary information is invalid"));
        return;
    }
    const item = await createDistributionBeneficiary(context.workspaceId, context.actorId, context.scope, parsed.data);
    if (!item) {
        sendError(response, HttpErrors.NotFound("Allocation target or household"));
        return;
    }
    await createAuditLog({
        action: AUDIT_ACTIONS.SOCIAL_ASSISTANCE_DISTRIBUTION_BENEFICIARY_CREATED,
        entityType: ENTITY_TYPES.SOCIAL_ASSISTANCE_DISTRIBUTION_BENEFICIARY,
        entityId: item.id,
        actorId: context.actorId,
        workspaceId: context.workspaceId,
        details: { targetId: item.targetId, componentId: item.componentId, status: item.status }
    }, request);
    const body = apiResponse.success(HttpStatusCode.CREATED, { item }, "Beneficiary created");
    response.status(body.code).send(body);
});

export const listPublicDistributionOrdersHandler = asyncHandler(async (request: Request, response: Response): Promise<void> => {
    const slug = request.params.slug?.trim();
    if (!slug) {
        sendError(response, HttpErrors.ValidationFailed("Public portal slug is required"));
        return;
    }
    const items = await listPublicDistributionOrders(slug);
    if (!items) {
        sendError(response, HttpErrors.NotFound("Public allocation portal"));
        return;
    }
    const body = apiResponse.success(HttpStatusCode.OK, { items }, "Public allocation orders retrieved");
    response.status(body.code).send(body);
});
import type { Application, RequestHandler } from "express";
import { API_ROUTES } from "@/helpers/permissions.ts";
import { getSocialAssistancePortalAdmin, updateSocialAssistancePortalAdmin } from "@/handlers/social-assistance/portal.handlers.ts";
import { listSocialAssistanceProgramsAdmin } from "@/handlers/social-assistance/programList.handlers.ts";
import {
    createSocialAssistanceProgramAdmin,
    updateSocialAssistanceProgramAdmin
} from "@/handlers/social-assistance/programs.handlers.ts";
import {
    listSocialAssistancePledgesAdmin,
    updateSocialAssistancePledgeAdmin
} from "@/handlers/social-assistance/pledgeReconciliation.handlers.ts";
import {
    createSocialAssistanceAllocationAdmin,
    listSocialAssistanceAllocationsAdmin,
    updateSocialAssistanceAllocationAdmin
} from "@/handlers/social-assistance/allocations.handlers.ts";
import {
    closeDistributionBatchAdmin,
    createDistributionBatchAdmin,
    getDistributionBatchAdmin,
    listDistributionBatchesAdmin,
    publishDistributionBatchAdmin,
    updateDraftDistributionBatchAdmin
} from "@/handlers/social-assistance/distribution-batches.handlers.ts";
import { getSocialAssistanceDashboardAdmin } from "@/handlers/social-assistance/dashboard.handlers.ts";
import {
    approveSocialAssistancePublicationAdmin,
    createSocialAssistancePublicationDraftAdmin,
    getSocialAssistancePublicationOptionsAdmin,
    previewSocialAssistancePublicationAdmin
} from "@/handlers/social-assistance/publications.handlers.ts";
import {
    getSocialAssistanceRequestAdmin,
    listSocialAssistanceRequestsAdmin,
    updateSocialAssistanceRequestStatusAdmin
} from "@/handlers/social-assistance/review.handlers.ts";

export const registerSocialAssistanceAdminRoutes = (
    app: Application,
    guards: readonly RequestHandler[]
): void => {
    app.get(API_ROUTES.socialAssistanceRequests, ...guards, listSocialAssistanceRequestsAdmin);
    app.get(API_ROUTES.socialAssistanceRequestById, ...guards, getSocialAssistanceRequestAdmin);
    app.patch(API_ROUTES.socialAssistanceRequestStatus, ...guards, updateSocialAssistanceRequestStatusAdmin);
    app.get(API_ROUTES.socialAssistancePublicPortal, ...guards, getSocialAssistancePortalAdmin);
    app.put(API_ROUTES.socialAssistancePublicPortal, ...guards, updateSocialAssistancePortalAdmin);
    app.get(API_ROUTES.socialAssistancePrograms, ...guards, listSocialAssistanceProgramsAdmin);
    app.post(API_ROUTES.socialAssistancePrograms, ...guards, createSocialAssistanceProgramAdmin);
    app.patch(API_ROUTES.socialAssistanceProgramById, ...guards, updateSocialAssistanceProgramAdmin);
    app.get(API_ROUTES.socialAssistancePledges, ...guards, listSocialAssistancePledgesAdmin);
    app.patch(API_ROUTES.socialAssistancePledgeReconcile, ...guards, updateSocialAssistancePledgeAdmin);
    app.get(API_ROUTES.socialAssistanceAllocations, ...guards, listSocialAssistanceAllocationsAdmin);
    app.post(API_ROUTES.socialAssistanceAllocations, ...guards, createSocialAssistanceAllocationAdmin);
    app.patch(API_ROUTES.socialAssistanceAllocationStatus, ...guards, updateSocialAssistanceAllocationAdmin);
    app.get(API_ROUTES.socialAssistanceDistributionBatches, ...guards, listDistributionBatchesAdmin);
    app.post(API_ROUTES.socialAssistanceDistributionBatches, ...guards, createDistributionBatchAdmin);
    app.get(API_ROUTES.socialAssistanceDistributionBatchById, ...guards, getDistributionBatchAdmin);
    app.patch(API_ROUTES.socialAssistanceDistributionBatchById, ...guards, updateDraftDistributionBatchAdmin);
    app.post(API_ROUTES.socialAssistanceDistributionBatchPublish, ...guards, publishDistributionBatchAdmin);
    app.post(API_ROUTES.socialAssistanceDistributionBatchClose, ...guards, closeDistributionBatchAdmin);
    app.get(API_ROUTES.socialAssistanceDashboard, ...guards, getSocialAssistanceDashboardAdmin);
    app.get(API_ROUTES.socialAssistancePublicationOptions, ...guards, getSocialAssistancePublicationOptionsAdmin);
    app.post(API_ROUTES.socialAssistancePublicationPreview, ...guards, previewSocialAssistancePublicationAdmin);
    app.post(API_ROUTES.socialAssistancePublicationDraft, ...guards, createSocialAssistancePublicationDraftAdmin);
    app.post(API_ROUTES.socialAssistancePublicationApprove, ...guards, approveSocialAssistancePublicationAdmin);
};
import {
    listPublicSocialAssistanceProvincesHandler,
    listPublicSocialAssistanceWardsHandler,
    submitPublicSocialAssistanceRequest
} from "@/handlers/social-assistance/requests.handlers.ts";
import { getPublicSocialAssistancePortalFromWardHandler } from "@/handlers/social-assistance/portal.handlers.ts";
import { listPublicSocialAssistanceProgramsHandler } from "@/handlers/social-assistance/programs.handlers.ts";
import { submitPublicSocialAssistancePledge } from "@/handlers/social-assistance/pledges.handlers.ts";
import { getPublicSocialAssistanceMapHandler } from "@/handlers/social-assistance/publications.handlers.ts";
import { API_ROUTES } from "@/helpers/permissions.ts";
import { socialAssistanceIntakeRateLimit, socialAssistanceLocationRateLimit } from "@/middleware/rateLimiter.ts";
import type { Application } from "express";

export const registerSocialAssistancePublicRoutes = (app: Application): void => {
    app.get(
        API_ROUTES.publicSocialAssistanceProvinces,
        socialAssistanceLocationRateLimit,
        listPublicSocialAssistanceProvincesHandler
    );
    app.get(
        API_ROUTES.publicSocialAssistanceWards,
        socialAssistanceLocationRateLimit,
        listPublicSocialAssistanceWardsHandler
    );
    app.get(
        API_ROUTES.publicSocialAssistancePortalFromWard,
        socialAssistanceLocationRateLimit,
        getPublicSocialAssistancePortalFromWardHandler
    );
    app.get(
        API_ROUTES.publicSocialAssistancePrograms,
        socialAssistanceLocationRateLimit,
        listPublicSocialAssistanceProgramsHandler
    );
    app.post(
        API_ROUTES.publicSocialAssistanceRequests,
        socialAssistanceIntakeRateLimit,
        submitPublicSocialAssistanceRequest
    );
    app.post(
        API_ROUTES.publicSocialAssistancePledges,
        socialAssistanceIntakeRateLimit,
        submitPublicSocialAssistancePledge
    );
    app.get(API_ROUTES.publicSocialAssistanceMap, socialAssistanceLocationRateLimit, getPublicSocialAssistanceMapHandler);
};
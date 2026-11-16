import { describe, expect, it, vi } from "vitest";

const { locationRateLimit, intakeRateLimit, mapHandler } = vi.hoisted(() => ({
    locationRateLimit: vi.fn(),
    intakeRateLimit: vi.fn(),
    mapHandler: vi.fn()
}));
vi.mock("@/middleware/rateLimiter.ts", () => ({
    socialAssistanceLocationRateLimit: locationRateLimit,
    socialAssistanceIntakeRateLimit: intakeRateLimit
}));
vi.mock("@/handlers/social-assistance/publications.handlers.ts", () => ({
    getPublicSocialAssistanceMapHandler: mapHandler
}));
vi.mock("@/handlers/social-assistance/requests.handlers.ts", () => ({
    submitPublicSocialAssistanceRequest: vi.fn(),
    listPublicSocialAssistanceProvincesHandler: vi.fn(),
    listPublicSocialAssistanceWardsHandler: vi.fn(),
    getPublicSocialAssistancePortalFromWardHandler: vi.fn()
}));
vi.mock("@/handlers/social-assistance/programs.handlers.ts", () => ({ listPublicSocialAssistanceProgramsHandler: vi.fn() }));
vi.mock("@/handlers/social-assistance/pledges.handlers.ts", () => ({ submitPublicSocialAssistancePledge: vi.fn() }));

import { registerSocialAssistancePublicRoutes } from "./social-assistance-public.ts";

describe("social assistance public map route", () => {
    it("rate limits the anonymous map request without authentication guards", () => {
        const app = { get: vi.fn(), post: vi.fn(), put: vi.fn() };
        registerSocialAssistancePublicRoutes(app as never);

        expect(app.get).toHaveBeenCalledWith("/public/social-assistance/:slug/map", locationRateLimit, mapHandler);
    });
});
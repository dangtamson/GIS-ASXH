import { describe, expect, it, vi } from "vitest";

const {
    rateLimit,
    locationRateLimit,
    submitHandler,
    provincesHandler,
    wardsHandler,
    wardPortalHandler,
    publicProgramsHandler,
    publicPledgeHandler
} = vi.hoisted(() => ({
    rateLimit: vi.fn(),
    locationRateLimit: vi.fn(),
    submitHandler: vi.fn(),
    provincesHandler: vi.fn(),
    wardsHandler: vi.fn(),
    wardPortalHandler: vi.fn(),
    publicProgramsHandler: vi.fn(),
    publicPledgeHandler: vi.fn()
}));

vi.mock("@/middleware/rateLimiter.ts", () => ({
    socialAssistanceIntakeRateLimit: rateLimit,
    socialAssistanceLocationRateLimit: locationRateLimit
}));

vi.mock("@/handlers/social-assistance/requests.handlers.ts", () => ({
    submitPublicSocialAssistanceRequest: submitHandler,
    listPublicSocialAssistanceProvincesHandler: provincesHandler,
    listPublicSocialAssistanceWardsHandler: wardsHandler,
}));
vi.mock("@/handlers/social-assistance/portal.handlers.ts", () => ({
    getPublicSocialAssistancePortalFromWardHandler: wardPortalHandler
}));
vi.mock("@/handlers/social-assistance/programs.handlers.ts", () => ({
    listPublicSocialAssistanceProgramsHandler: publicProgramsHandler
}));
vi.mock("@/handlers/social-assistance/pledges.handlers.ts", () => ({
    submitPublicSocialAssistancePledge: publicPledgeHandler
}));

import { registerSocialAssistancePublicRoutes } from "./social-assistance-public.ts";

describe("social assistance public routes", () => {
    it("registers intake with rate limiting and without authentication guards", () => {
        const app = { get: vi.fn(), post: vi.fn(), put: vi.fn() };

        registerSocialAssistancePublicRoutes(app as never);

        expect(app.get).toHaveBeenCalledWith(
            "/public/social-assistance/:slug/locations/provinces",
            locationRateLimit,
            provincesHandler
        );
        expect(app.get).toHaveBeenCalledWith(
            "/public/social-assistance/:slug/locations/wards",
            locationRateLimit,
            wardsHandler
        );
        expect(app.get).toHaveBeenCalledWith(
            "/public/social-assistance/from-ward/:wardSlug",
            locationRateLimit,
            wardPortalHandler
        );
        expect(app.get).toHaveBeenCalledWith(
            "/public/social-assistance/:slug/programs",
            locationRateLimit,
            publicProgramsHandler
        );
        expect(app.post).toHaveBeenCalledWith(
            "/public/social-assistance/:slug/pledges",
            rateLimit,
            publicPledgeHandler
        );
        const [path, ...handlers] = app.post.mock.calls[0] ?? [];
        expect(path).toBe("/public/social-assistance/:slug/requests");
        expect(handlers).toEqual([rateLimit, submitHandler]);
    });
});
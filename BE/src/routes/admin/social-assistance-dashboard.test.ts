import { describe, expect, it, vi } from "vitest";

const { dashboardHandler } = vi.hoisted(() => ({ dashboardHandler: vi.fn() }));
vi.mock("@/handlers/social-assistance/dashboard.handlers.ts", () => ({
    getSocialAssistanceDashboardAdmin: dashboardHandler
}));

import { registerSocialAssistanceAdminRoutes } from "./social-assistance.ts";

describe("social assistance dashboard route", () => {
    it("registers the report endpoint behind the supplied admin guards", () => {
        const app = { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn() };
        const guards = [vi.fn(), vi.fn()];

        registerSocialAssistanceAdminRoutes(app as never, guards);

        expect(app.get).toHaveBeenCalledWith("/social-assistance/reports/dashboard", ...guards, dashboardHandler);
    });
});
import { describe, expect, it, vi } from "vitest";

const {
    listHandler,
    detailHandler,
    statusHandler,
    getPortalHandler,
    updatePortalHandler,
    programListHandler,
    programCreateHandler,
    programUpdateHandler,
    pledgeListHandler,
    pledgeUpdateHandler,
    allocationListHandler,
    allocationCreateHandler,
    allocationUpdateHandler
} = vi.hoisted(() => ({
    listHandler: vi.fn(),
    detailHandler: vi.fn(),
    statusHandler: vi.fn(),
    getPortalHandler: vi.fn(),
    updatePortalHandler: vi.fn(),
    programListHandler: vi.fn(),
    programCreateHandler: vi.fn(),
    programUpdateHandler: vi.fn(),
    pledgeListHandler: vi.fn(),
    pledgeUpdateHandler: vi.fn(),
    allocationListHandler: vi.fn(),
    allocationCreateHandler: vi.fn(),
    allocationUpdateHandler: vi.fn()
}));

vi.mock("@/handlers/social-assistance/review.handlers.ts", () => ({
    listSocialAssistanceRequestsAdmin: listHandler,
    getSocialAssistanceRequestAdmin: detailHandler,
    updateSocialAssistanceRequestStatusAdmin: statusHandler,
    getSocialAssistancePortalAdmin: getPortalHandler,
    updateSocialAssistancePortalAdmin: updatePortalHandler
}));
vi.mock("@/handlers/social-assistance/portal.handlers.ts", () => ({
    getSocialAssistancePortalAdmin: getPortalHandler,
    updateSocialAssistancePortalAdmin: updatePortalHandler
}));
vi.mock("@/handlers/social-assistance/programList.handlers.ts", () => ({
    listSocialAssistanceProgramsAdmin: programListHandler
}));
vi.mock("@/handlers/social-assistance/programs.handlers.ts", () => ({
    createSocialAssistanceProgramAdmin: programCreateHandler,
    updateSocialAssistanceProgramAdmin: programUpdateHandler
}));
vi.mock("@/handlers/social-assistance/pledgeReconciliation.handlers.ts", () => ({
    listSocialAssistancePledgesAdmin: pledgeListHandler,
    updateSocialAssistancePledgeAdmin: pledgeUpdateHandler
}));
vi.mock("@/handlers/social-assistance/allocations.handlers.ts", () => ({
    listSocialAssistanceAllocationsAdmin: allocationListHandler,
    createSocialAssistanceAllocationAdmin: allocationCreateHandler,
    updateSocialAssistanceAllocationAdmin: allocationUpdateHandler
}));

import { registerSocialAssistanceAdminRoutes } from "./social-assistance.ts";

describe("social assistance admin routes", () => {
    it("registers queue, detail, and review endpoints behind the supplied guards", () => {
        const app = { get: vi.fn(), patch: vi.fn(), put: vi.fn(), post: vi.fn() };
        const guards = [vi.fn(), vi.fn()];

        registerSocialAssistanceAdminRoutes(app as never, guards);

        expect(app.get).toHaveBeenCalledWith("/social-assistance/requests", ...guards, listHandler);
        expect(app.get).toHaveBeenCalledWith("/social-assistance/requests/:id", ...guards, detailHandler);
        expect(app.patch).toHaveBeenCalledWith("/social-assistance/requests/:id/status", ...guards, statusHandler);
        expect(app.get).toHaveBeenCalledWith("/social-assistance/public-portal", ...guards, getPortalHandler);
        expect(app.put).toHaveBeenCalledWith("/social-assistance/public-portal", ...guards, updatePortalHandler);
        expect(app.get).toHaveBeenCalledWith("/social-assistance/programs", ...guards, programListHandler);
        expect(app.post).toHaveBeenCalledWith("/social-assistance/programs", ...guards, programCreateHandler);
        expect(app.patch).toHaveBeenCalledWith("/social-assistance/programs/:id", ...guards, programUpdateHandler);
        expect(app.get).toHaveBeenCalledWith("/social-assistance/pledges", ...guards, pledgeListHandler);
        expect(app.patch).toHaveBeenCalledWith("/social-assistance/pledges/:id/reconcile", ...guards, pledgeUpdateHandler);
        expect(app.get).toHaveBeenCalledWith("/social-assistance/allocations", ...guards, allocationListHandler);
        expect(app.post).toHaveBeenCalledWith("/social-assistance/allocations", ...guards, allocationCreateHandler);
        expect(app.patch).toHaveBeenCalledWith("/social-assistance/allocations/:id/status", ...guards, allocationUpdateHandler);
    });
});
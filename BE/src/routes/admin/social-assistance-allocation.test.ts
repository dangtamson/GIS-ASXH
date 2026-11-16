import { describe, expect, it, vi } from "vitest";

const { listHandler, createHandler, updateHandler } = vi.hoisted(() => ({
    listHandler: vi.fn(),
    createHandler: vi.fn(),
    updateHandler: vi.fn()
}));

vi.mock("@/handlers/social-assistance/allocations.handlers.ts", () => ({
    listSocialAssistanceAllocationsAdmin: listHandler,
    createSocialAssistanceAllocationAdmin: createHandler,
    updateSocialAssistanceAllocationAdmin: updateHandler
}));

import { registerSocialAssistanceAdminRoutes } from "./social-assistance.ts";

describe("social assistance allocation routes", () => {
    it("registers list/create/update behind the supplied admin guards", () => {
        const app = { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn() };
        const guards = [vi.fn(), vi.fn()];

        registerSocialAssistanceAdminRoutes(app as never, guards);

        expect(app.get).toHaveBeenCalledWith("/social-assistance/allocations", ...guards, listHandler);
        expect(app.post).toHaveBeenCalledWith("/social-assistance/allocations", ...guards, createHandler);
        expect(app.patch).toHaveBeenCalledWith("/social-assistance/allocations/:id/status", ...guards, updateHandler);
    });
});
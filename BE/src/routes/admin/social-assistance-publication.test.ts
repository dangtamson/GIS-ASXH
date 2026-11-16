import { describe, expect, it, vi } from "vitest";

const { optionsHandler, previewHandler, draftHandler, approveHandler } = vi.hoisted(() => ({
    optionsHandler: vi.fn(),
    previewHandler: vi.fn(),
    draftHandler: vi.fn(),
    approveHandler: vi.fn()
}));
vi.mock("@/handlers/social-assistance/publications.handlers.ts", () => ({
    getSocialAssistancePublicationOptionsAdmin: optionsHandler,
    previewSocialAssistancePublicationAdmin: previewHandler,
    createSocialAssistancePublicationDraftAdmin: draftHandler,
    approveSocialAssistancePublicationAdmin: approveHandler
}));

import { registerSocialAssistanceAdminRoutes } from "./social-assistance.ts";

describe("social assistance publication admin routes", () => {
    it("registers preview, draft, and approval behind admin guards", () => {
        const app = { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn() };
        const guards = [vi.fn(), vi.fn()];
        registerSocialAssistanceAdminRoutes(app as never, guards);

        expect(app.get).toHaveBeenCalledWith("/social-assistance/publications/options", ...guards, optionsHandler);
        expect(app.post).toHaveBeenCalledWith("/social-assistance/publications/preview", ...guards, previewHandler);
        expect(app.post).toHaveBeenCalledWith("/social-assistance/publications", ...guards, draftHandler);
        expect(app.post).toHaveBeenCalledWith("/social-assistance/publications/:batchId/approve", ...guards, approveHandler);
    });
});
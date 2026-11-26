import { describe, expect, it, vi } from "vitest";

const { listHandler, createHandler, updateHandler } = vi.hoisted(() => ({
    listHandler: vi.fn(),
    createHandler: vi.fn(),
    updateHandler: vi.fn()
}));
const { orderList, orderCreate, orderGet, orderUpdate, orderPublish, orderClose, beneficiaryList, beneficiaryCreate, publicOrders } = vi.hoisted(() => ({
    orderList: vi.fn(), orderCreate: vi.fn(), orderGet: vi.fn(), orderUpdate: vi.fn(), orderPublish: vi.fn(), orderClose: vi.fn(),
    beneficiaryList: vi.fn(), beneficiaryCreate: vi.fn(), publicOrders: vi.fn()
}));

vi.mock("@/handlers/social-assistance/allocations.handlers.ts", () => ({
    listSocialAssistanceAllocationsAdmin: listHandler,
    createSocialAssistanceAllocationAdmin: createHandler,
    updateSocialAssistanceAllocationAdmin: updateHandler
}));
vi.mock("@/handlers/social-assistance/distribution-orders.handlers.ts", () => ({
    listDistributionOrdersAdmin: orderList,
    createDistributionOrderAdmin: orderCreate,
    listDistributionBeneficiariesAdmin: beneficiaryList,
    createDistributionBeneficiaryAdmin: beneficiaryCreate,
    listPublicDistributionOrdersHandler: publicOrders,
    getDistributionOrderAdmin: orderGet,
    updateDraftDistributionOrderAdmin: orderUpdate,
    publishDistributionOrderAdmin: orderPublish,
    closeDistributionOrderAdmin: orderClose
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

    it("registers order and private beneficiary routes behind admin guards", () => {
        const app = { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn() };
        const guards = [vi.fn(), vi.fn()];
        registerSocialAssistanceAdminRoutes(app as never, guards);
        expect(app.get).toHaveBeenCalledWith("/social-assistance/distribution-orders", ...guards, orderList);
        expect(app.post).toHaveBeenCalledWith("/social-assistance/distribution-orders", ...guards, orderCreate);
        expect(app.get).toHaveBeenCalledWith("/social-assistance/distribution-targets/:targetId/beneficiaries", ...guards, beneficiaryList);
        expect(app.post).toHaveBeenCalledWith("/social-assistance/distribution-targets/:targetId/beneficiaries", ...guards, beneficiaryCreate);
        expect(app.get).toHaveBeenCalledWith("/social-assistance/distribution-orders/:id", ...guards, orderGet);
        expect(app.patch).toHaveBeenCalledWith("/social-assistance/distribution-orders/:id", ...guards, orderUpdate);
        expect(app.post).toHaveBeenCalledWith("/social-assistance/distribution-orders/:id/publish", ...guards, orderPublish);
        expect(app.post).toHaveBeenCalledWith("/social-assistance/distribution-orders/:id/close", ...guards, orderClose);
    });
});
import { beforeEach, describe, expect, it, vi } from "vitest";

const { update, select } = vi.hoisted(() => ({ update: vi.fn(), select: vi.fn() }));

vi.mock("@/services/db/drizzle.ts", () => ({ db: { update, select } }));

import { updateSocialAssistancePortal } from "./portal.repository.ts";

const workspaceId = "22222222-2222-4222-8222-222222222222";
const actorId = "33333333-3333-4333-8333-333333333333";

describe("updateSocialAssistancePortal", () => {
    beforeEach(() => vi.clearAllMocks());

    it("updates only the supplied portal flags for the workspace", async () => {
        const portal = { id: "portal-1", workspaceId, intakeEnabled: true, updatedBy: actorId };
        const returning = vi.fn().mockResolvedValue([portal]);
        const where = vi.fn().mockReturnValue({ returning });
        const set = vi.fn().mockReturnValue({ where });
        update.mockReturnValue({ set });
        const innerJoin = vi.fn().mockResolvedValue([{ workspaceId, workspaceName: "UBND TP Cần Thơ" }]);
        select.mockReturnValue({ from: vi.fn().mockReturnValue({ innerJoin }) });

        await expect(updateSocialAssistancePortal(workspaceId, actorId, { intakeEnabled: true })).resolves.toEqual({
            ...portal,
            publicAlias: "can-tho"
        });
        expect(set).toHaveBeenCalledWith(expect.objectContaining({ intakeEnabled: true, updatedBy: actorId }));
    });
});

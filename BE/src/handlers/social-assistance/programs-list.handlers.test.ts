import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listSocialAssistancePrograms } = vi.hoisted(() => ({ listSocialAssistancePrograms: vi.fn() }));
vi.mock("./programs.repository.ts", () => ({ listSocialAssistancePrograms }));

import { listSocialAssistanceProgramsAdmin } from "./programList.handlers.ts";

const createMockRes = (): Response =>
    ({ status: vi.fn().mockReturnThis(), send: vi.fn() }) as unknown as Response;

const flushAsync = async (): Promise<void> => {
    await new Promise((resolve) => setImmediate(resolve));
};

describe("listSocialAssistanceProgramsAdmin", () => {
    beforeEach(() => vi.clearAllMocks());

    it("lists programs in the current workspace with an optional status filter", async () => {
        listSocialAssistancePrograms.mockResolvedValue([{ id: "program-1", status: "PUBLISHED" }]);
        const req = {
            workspaceId: "workspace-1",
            accountId: "account-1",
            query: { status: "PUBLISHED" }
        } as unknown as Request;
        const res = createMockRes();

        listSocialAssistanceProgramsAdmin(req, res, vi.fn());
        await flushAsync();

        expect(listSocialAssistancePrograms).toHaveBeenCalledWith("workspace-1", "PUBLISHED");
        expect(res.status).toHaveBeenCalledWith(200);
    });
});
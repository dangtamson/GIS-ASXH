import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSocialAssistanceProgram, listSocialAssistancePrograms, listPublicSocialAssistancePrograms, updateSocialAssistanceProgram } = vi.hoisted(() => ({
    createSocialAssistanceProgram: vi.fn(),
    listSocialAssistancePrograms: vi.fn(),
    listPublicSocialAssistancePrograms: vi.fn(),
    updateSocialAssistanceProgram: vi.fn()
}));
const { createAuditLog } = vi.hoisted(() => ({ createAuditLog: vi.fn() }));

vi.mock("./programs.repository.ts", () => ({
    createSocialAssistanceProgram,
    listSocialAssistancePrograms,
    listPublicSocialAssistancePrograms,
    updateSocialAssistanceProgram
}));
vi.mock("@/services/auditLog.ts", async () => {
    const actual = await vi.importActual<typeof import("@/services/auditLog.ts")>("@/services/auditLog.ts");
    return { ...actual, createAuditLog };
});

import {
    createSocialAssistanceProgramAdmin,
    listPublicSocialAssistanceProgramsHandler,
    updateSocialAssistanceProgramAdmin
} from "./programs.handlers.ts";

const createMockRes = (): Response =>
    ({ status: vi.fn().mockReturnThis(), send: vi.fn() }) as unknown as Response;

const flushAsync = async (): Promise<void> => {
    await new Promise((resolve) => setImmediate(resolve));
};

describe("social assistance program handlers", () => {
    beforeEach(() => vi.clearAllMocks());

    it("creates a program in the current workspace and audits it", async () => {
        const program = {
            id: "11111111-1111-4111-8111-111111111111",
            workspaceId: "workspace-1",
            title: "Nha o an toan",
            publicDescription: "Ho tro nha o.",
            category: "HOUSING",
            eligibilitySummary: "Ho da duoc xac minh.",
            startDate: "2026-11-01",
            endDate: "2026-12-31",
            status: "DRAFT"
        };
        createSocialAssistanceProgram.mockResolvedValue(program);
        const req = {
            workspaceId: "workspace-1",
            accountId: "account-1",
            body: {
                title: program.title,
                publicDescription: program.publicDescription,
                category: program.category,
                eligibilitySummary: program.eligibilitySummary,
                startDate: program.startDate,
                endDate: program.endDate
            }
        } as unknown as Request;
        const res = createMockRes();

        createSocialAssistanceProgramAdmin(req, res, vi.fn());
        await flushAsync();

        expect(createSocialAssistanceProgram).toHaveBeenCalledWith("workspace-1", "account-1", expect.objectContaining({ status: "DRAFT" }));
        expect(createAuditLog).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(201);
    });

    it("returns only published programs for a public portal", async () => {
        listPublicSocialAssistancePrograms.mockResolvedValue([{ id: "program-1", title: "Nha o an toan" }]);
        const req = { params: { slug: "sa-slug" } } as unknown as Request;
        const res = createMockRes();

        listPublicSocialAssistanceProgramsHandler(req, res, vi.fn());
        await flushAsync();

        expect(listPublicSocialAssistancePrograms).toHaveBeenCalledWith("sa-slug");
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it("publishes a program only within the current workspace and audits the update", async () => {
        const program = {
            id: "11111111-1111-4111-8111-111111111111",
            workspaceId: "workspace-1",
            status: "PUBLISHED",
            category: "HOUSING"
        };
        updateSocialAssistanceProgram.mockResolvedValue(program);
        const req = {
            workspaceId: "workspace-1",
            accountId: "account-1",
            params: { id: program.id },
            body: { status: "PUBLISHED" }
        } as unknown as Request;
        const res = createMockRes();

        updateSocialAssistanceProgramAdmin(req, res, vi.fn());
        await flushAsync();

        expect(updateSocialAssistanceProgram).toHaveBeenCalledWith(program.id, "workspace-1", "account-1", { status: "PUBLISHED" });
        expect(createAuditLog).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
    });
});
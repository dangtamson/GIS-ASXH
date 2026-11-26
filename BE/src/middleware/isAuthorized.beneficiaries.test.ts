import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const { select, checkMembership } = vi.hoisted(() => ({ select: vi.fn(), checkMembership: vi.fn() }));
vi.mock("@/services/db/drizzle.ts", () => ({ db: { select } }));
vi.mock("@/handlers/memberships/memberships.methods.ts", () => ({ checkMembership }));

import { isAuthorized } from "./isAuthorized.ts";

describe("beneficiary authorization", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        const accountQuery = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ uuid: "account", isSuperAdmin: true }]) };
        select.mockReturnValueOnce(accountQuery);
    });

    it("does not grant a super admin access without workspace membership and explicit permission", async () => {
        checkMembership.mockResolvedValue([false, null]);
        const request = {
            accountId: "account", workspaceId: "11111111-1111-4111-8111-111111111111",
            method: "GET", baseUrl: "", route: { path: "/social-assistance/distribution-targets/:targetId/beneficiaries" }
        } as unknown as Request;
        const response = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
        const next = vi.fn();
        await isAuthorized(request, response, next);
        expect(next).not.toHaveBeenCalled();
        expect(response.status).toHaveBeenCalledWith(403);
    });

    it.each([
        { permissionRows: [], allowed: false },
        { permissionRows: [{ roleId: "role" }], allowed: true }
    ])("checks the workspace role permission for a super admin: allowed=$allowed", async ({ permissionRows, allowed }) => {
        checkMembership.mockResolvedValue([true, "admin"]);
        const permissionQuery = {
            from: vi.fn().mockReturnThis(), innerJoin: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue(permissionRows)
        };
        select.mockReturnValueOnce(permissionQuery);
        const request = {
            accountId: "account", workspaceId: "11111111-1111-4111-8111-111111111111",
            method: "GET", baseUrl: "", route: { path: "/social-assistance/distribution-targets/:targetId/beneficiaries" }
        } as unknown as Request;
        const response = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
        const next = vi.fn();
        await isAuthorized(request, response, next);
        expect(next).toHaveBeenCalledTimes(allowed ? 1 : 0);
        if (!allowed) expect(response.status).toHaveBeenCalledWith(403);
    });
});
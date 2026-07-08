import { db } from "@/services/db/drizzle.ts";
import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isAuthenticated } from "./isAuthenticated.ts";

vi.mock("@/handlers/auth/auth.methods.ts", () => ({
  verifyToken: vi.fn()
}));

vi.mock("@/services/db/drizzle.ts", () => ({
  db: {
    select: vi.fn()
  }
}));

import { verifyToken } from "@/handlers/auth/auth.methods.ts";

const VALID_ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";
const VALID_WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";

const createMockRes = (): Response => {
  const res = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn()
  };

  return res as unknown as Response;
};

describe("isAuthenticated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("attaches req.user with superadmin flag after verifying bearer token", async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      sub: VALID_ACCOUNT_ID
    } as never);
    vi.mocked(db.select).mockImplementationOnce(
      () =>
        ({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: VALID_ACCOUNT_ID,
                  isSuperAdmin: true
                }
              ])
            })
          })
        }) as never
    );

    const req = {
      method: "GET",
      baseUrl: "",
      route: { path: "/poverty/locations/provinces" },
      headers: {
        authorization: "Bearer valid-token",
        "x-workspace-id": VALID_WORKSPACE_ID
      }
    } as unknown as Request;
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    await isAuthenticated(req, res, next);

    expect(req.accountId).toBe(VALID_ACCOUNT_ID);
    expect(req.workspaceId).toBe(VALID_WORKSPACE_ID);
    expect(req.user).toEqual({
      id: VALID_ACCOUNT_ID,
      isSuperAdmin: true
    });
    expect(next).toHaveBeenCalledTimes(1);
  });
});

import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createPublicSocialAssistancePledge } = vi.hoisted(() => ({ createPublicSocialAssistancePledge: vi.fn() }));

vi.mock("./pledges.repository.ts", () => ({ createPublicSocialAssistancePledge }));

import { submitPublicSocialAssistancePledge } from "./pledges.handlers.ts";

const validPledge = {
    programId: "11111111-1111-4111-8111-111111111111",
    donorType: "ORGANIZATION",
    donorName: "Doanh nghiep A",
    contactPhone: "0909123456",
    pledgeType: "CASH",
    pledgedAmount: 5000000,
    consent: true
};

const createMockRes = (): Response =>
    ({ status: vi.fn().mockReturnThis(), send: vi.fn() }) as unknown as Response;

const createRequest = (body = validPledge, idempotencyKey = "pledge-key"): Request =>
    ({
        params: { slug: "sa-slug" },
        body,
        get: vi.fn((name: string) => name.toLowerCase() === "idempotency-key" ? idempotencyKey : undefined)
    }) as unknown as Request;

const flushAsync = async (): Promise<void> => {
    await new Promise((resolve) => setImmediate(resolve));
};

describe("submitPublicSocialAssistancePledge", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns a pledge reference without donor contact details", async () => {
        createPublicSocialAssistancePledge.mockResolvedValue({ pledgeId: "pledge-id" });
        const req = createRequest();
        const res = createMockRes();

        submitPublicSocialAssistancePledge(req, res, vi.fn());
        await flushAsync();

        expect(createPublicSocialAssistancePledge).toHaveBeenCalledWith("sa-slug", validPledge, "pledge-key");
        expect(res.status).toHaveBeenCalledWith(201);
        const responseBody = JSON.stringify(vi.mocked(res.send).mock.calls[0]?.[0]);
        expect(responseBody).toContain("pledge-id");
        expect(responseBody).not.toContain("Doanh nghiep A");
        expect(responseBody).not.toContain("0909123456");
    });

    it("requires an idempotency key before repository access", async () => {
        const req = createRequest(validPledge, "");
        const res = createMockRes();

        submitPublicSocialAssistancePledge(req, res, vi.fn());
        await flushAsync();

        expect(res.status).toHaveBeenCalledWith(400);
        expect(createPublicSocialAssistancePledge).not.toHaveBeenCalled();
    });
});
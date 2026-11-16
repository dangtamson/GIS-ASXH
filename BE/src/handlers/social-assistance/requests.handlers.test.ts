import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createPublicRequest, listPublicSocialAssistanceProvinces, listPublicSocialAssistanceWards } = vi.hoisted(() => ({
    createPublicRequest: vi.fn(),
    listPublicSocialAssistanceProvinces: vi.fn(),
    listPublicSocialAssistanceWards: vi.fn()
}));

vi.mock("./requests.repository.ts", () => ({
    createPublicRequest,
    listPublicSocialAssistanceProvinces,
    listPublicSocialAssistanceWards
}));

import {
    listPublicSocialAssistanceProvincesHandler,
    listPublicSocialAssistanceWardsHandler,
    submitPublicSocialAssistanceRequest
} from "./requests.handlers.ts";

const validRequest = {
    contactName: "Nguyen Van A",
    phone: "0909123456",
    needCategory: "FOOD",
    needDescription: "Can ho tro luong thuc",
    address: "Phuong An Khanh, Can Tho",
    provinceCode: "92",
    wardCode: "31117",
    consent: true,
    source: "MAP"
};

const createMockRes = (): Response => {
    return {
        status: vi.fn().mockReturnThis(),
        send: vi.fn()
    } as unknown as Response;
};

const createRequest = (overrides: Partial<Request> = {}): Request =>
    ({
        params: { slug: "opaque-portal-slug" },
        body: validRequest,
        get: vi.fn((name: string) => (name.toLowerCase() === "idempotency-key" ? "request-key-123" : undefined)),
        ...overrides
    }) as unknown as Request;

const flushAsync = async (): Promise<void> => {
    await new Promise((resolve) => setImmediate(resolve));
};

describe("submitPublicSocialAssistanceRequest", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns only a receipt code for a valid request", async () => {
        createPublicRequest.mockResolvedValue({ receiptCode: "SA-receipt-code" });
        const req = createRequest();
        const res = createMockRes();

        submitPublicSocialAssistanceRequest(req, res, vi.fn());
        await flushAsync();

        expect(createPublicRequest).toHaveBeenCalledWith("opaque-portal-slug", validRequest, "request-key-123");
        expect(res.status).toHaveBeenCalledWith(201);
        const responseBody = vi.mocked(res.send).mock.calls[0]?.[0];
        expect(JSON.stringify(responseBody)).toContain("SA-receipt-code");
        expect(JSON.stringify(responseBody)).not.toContain("Nguyen Van A");
        expect(JSON.stringify(responseBody)).not.toContain("0909123456");
    });

    it("rejects submissions without an idempotency key", async () => {
        const req = createRequest({ get: vi.fn().mockReturnValue(undefined) });
        const res = createMockRes();

        submitPublicSocialAssistanceRequest(req, res, vi.fn());
        await flushAsync();

        expect(res.status).toHaveBeenCalledWith(400);
        expect(createPublicRequest).not.toHaveBeenCalled();
    });

    it("returns not found when the public intake portal is unavailable", async () => {
        createPublicRequest.mockResolvedValue(null);
        const req = createRequest();
        const res = createMockRes();

        submitPublicSocialAssistanceRequest(req, res, vi.fn());
        await flushAsync();

        expect(res.status).toHaveBeenCalledWith(404);
    });

    it("rejects invalid request payloads before persistence", async () => {
        const req = createRequest({ body: { ...validRequest, consent: false } });
        const res = createMockRes();

        submitPublicSocialAssistanceRequest(req, res, vi.fn());
        await flushAsync();

        expect(res.status).toHaveBeenCalledWith(400);
        expect(createPublicRequest).not.toHaveBeenCalled();
    });

    it("describes the invalid fields in the validation response", async () => {
        const req = createRequest({ body: { ...validRequest, phone: "bad", consent: false } });
        const res = createMockRes();

        submitPublicSocialAssistanceRequest(req, res, vi.fn());
        await flushAsync();

        const responseBody = vi.mocked(res.send).mock.calls[0]?.[0] as { message?: string };
        expect(responseBody.message).toContain("phone");
        expect(responseBody.message).toContain("consent");
        expect(responseBody.message).not.toBe("Request information is invalid");
        expect(createPublicRequest).not.toHaveBeenCalled();
    });
});

describe("public social assistance location handlers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns only province location fields for an enabled portal", async () => {
        listPublicSocialAssistanceProvinces.mockResolvedValue([{ code: "92", name: "Can Tho", fullName: null }]);
        const req = createRequest({ body: {} });
        const res = createMockRes();

        listPublicSocialAssistanceProvincesHandler(req, res, vi.fn());
        await flushAsync();

        expect(listPublicSocialAssistanceProvinces).toHaveBeenCalledWith("opaque-portal-slug");
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it("requires a province code before listing wards", async () => {
        const req = createRequest({ body: {}, query: {} });
        const res = createMockRes();

        listPublicSocialAssistanceWardsHandler(req, res, vi.fn());
        await flushAsync();

        expect(res.status).toHaveBeenCalledWith(400);
        expect(listPublicSocialAssistanceWards).not.toHaveBeenCalled();
    });
});
import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    getSocialAssistanceRequestById,
    findPotentialDuplicateRequests,
    listSocialAssistanceRequests,
    updateSocialAssistanceRequestStatus
} = vi.hoisted(() => ({
    getSocialAssistanceRequestById: vi.fn(),
    findPotentialDuplicateRequests: vi.fn(),
    listSocialAssistanceRequests: vi.fn(),
    updateSocialAssistanceRequestStatus: vi.fn()
}));
const { resolvePovertyAccessScope } = vi.hoisted(() => ({ resolvePovertyAccessScope: vi.fn() }));
const { createAuditLog } = vi.hoisted(() => ({ createAuditLog: vi.fn() }));

vi.mock("./requests.repository.ts", () => ({
    getSocialAssistanceRequestById,
    findPotentialDuplicateRequests,
    listSocialAssistanceRequests,
    updateSocialAssistanceRequestStatus
}));
vi.mock("@/handlers/admin/resources/poverty/poverty.scope.ts", () => ({ resolvePovertyAccessScope }));
vi.mock("@/services/auditLog.ts", async () => {
    const actual = await vi.importActual<typeof import("@/services/auditLog.ts")>("@/services/auditLog.ts");
    return { ...actual, createAuditLog };
});

import {
    getSocialAssistanceRequestAdmin,
    listSocialAssistanceRequestsAdmin,
    updateSocialAssistanceRequestStatusAdmin
} from "./review.handlers.ts";

const REQUEST_ID = "11111111-1111-4111-8111-111111111111";

const scope = {
    organizationIds: ["org-1"],
    provinceCodes: [],
    wardCodes: ["31117"],
    areaIds: [],
    isBranchAdmin: false,
    isSuperAdmin: false,
    hasScope: true
};

const requestRow = (status: string) => ({
    id: REQUEST_ID,
    workspaceId: "workspace-1",
    status,
    provinceCode: "92",
    wardCode: "31117",
    areaId: null,
    phone: "0909123456"
});

const createMockRes = (): Response =>
    ({ status: vi.fn().mockReturnThis(), send: vi.fn() }) as unknown as Response;

const createRequest = (body: Record<string, unknown>): Request =>
    ({
        accountId: "account-1",
        workspaceId: "workspace-1",
        user: { isSuperAdmin: false },
        params: { id: REQUEST_ID },
        body,
        headers: { "user-agent": "test-agent" }
    }) as unknown as Request;

const flushAsync = async (): Promise<void> => {
    await new Promise((resolve) => setImmediate(resolve));
};

describe("updateSocialAssistanceRequestStatusAdmin", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resolvePovertyAccessScope.mockResolvedValue(scope);
    });

    it("denies users without an organization location scope", async () => {
        resolvePovertyAccessScope.mockResolvedValue({ ...scope, hasScope: false });
        const req = createRequest({ status: "IN_REVIEW" });
        const res = createMockRes();

        updateSocialAssistanceRequestStatusAdmin(req, res, vi.fn());
        await flushAsync();

        expect(res.status).toHaveBeenCalledWith(403);
        expect(getSocialAssistanceRequestById).not.toHaveBeenCalled();
    });

    it("rejects an invalid state jump without updating or auditing", async () => {
        getSocialAssistanceRequestById.mockResolvedValue(requestRow("RECEIVED"));
        const req = createRequest({ status: "VERIFIED", internalReason: "Checked" });
        const res = createMockRes();

        updateSocialAssistanceRequestStatusAdmin(req, res, vi.fn());
        await flushAsync();

        expect(res.status).toHaveBeenCalledWith(400);
        expect(updateSocialAssistanceRequestStatus).not.toHaveBeenCalled();
        expect(createAuditLog).not.toHaveBeenCalled();
    });

    it("updates a valid transition and writes an audit record", async () => {
        getSocialAssistanceRequestById.mockResolvedValue(requestRow("IN_REVIEW"));
        updateSocialAssistanceRequestStatus.mockResolvedValue(requestRow("VERIFIED"));
        const req = createRequest({ status: "VERIFIED", internalReason: "Da doi chieu" });
        const res = createMockRes();

        updateSocialAssistanceRequestStatusAdmin(req, res, vi.fn());
        await flushAsync();

        expect(updateSocialAssistanceRequestStatus).toHaveBeenCalledWith(
            REQUEST_ID,
            "workspace-1",
            scope,
            "VERIFIED",
            "Da doi chieu",
            "account-1"
        );
        expect(createAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({
                action: "social_assistance_request_status_updated",
                entityType: "social_assistance_request",
                entityId: REQUEST_ID,
                actorId: "account-1",
                workspaceId: "workspace-1",
                details: expect.objectContaining({ from: "IN_REVIEW", to: "VERIFIED", note: "Da doi chieu" })
            }),
            req
        );
        expect(res.status).toHaveBeenCalledWith(200);
    });
});

describe("social assistance staff request queue", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resolvePovertyAccessScope.mockResolvedValue(scope);
    });

    it("lists requests using validated filters and the resolved organization scope", async () => {
        const result = { items: [requestRow("RECEIVED")], hasMore: false, page: 1, limit: 25 };
        listSocialAssistanceRequests.mockResolvedValue(result);
        const req = Object.assign(createRequest({}), { query: { status: "RECEIVED", wardCode: "31117" } });
        const res = createMockRes();

        listSocialAssistanceRequestsAdmin(req, res, vi.fn());
        await flushAsync();

        expect(listSocialAssistanceRequests).toHaveBeenCalledWith("workspace-1", scope, {
            page: 1,
            limit: 25,
            status: "RECEIVED",
            wardCode: "31117"
        });
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it("returns 404 for a request outside the resolved location scope", async () => {
        getSocialAssistanceRequestById.mockResolvedValue(null);
        const req = createRequest({});
        const res = createMockRes();

        getSocialAssistanceRequestAdmin(req, res, vi.fn());
        await flushAsync();

        expect(getSocialAssistanceRequestById).toHaveBeenCalledWith(REQUEST_ID, "workspace-1", scope);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    it("includes duplicate candidate summaries in staff detail", async () => {
        getSocialAssistanceRequestById.mockResolvedValue(requestRow("IN_REVIEW"));
        findPotentialDuplicateRequests.mockResolvedValue([
            { id: "duplicate-id", receiptCode: "SA-duplicate", status: "VERIFIED", needCategory: "FOOD", createdAt: null }
        ]);
        const req = createRequest({});
        const res = createMockRes();

        getSocialAssistanceRequestAdmin(req, res, vi.fn());
        await flushAsync();

        expect(findPotentialDuplicateRequests).toHaveBeenCalledWith("workspace-1", {
            requestId: REQUEST_ID,
            phone: "0909123456",
            provinceCode: "92",
            wardCode: "31117"
        });
        const responseBody = vi.mocked(res.send).mock.calls[0]?.[0] as {
            data?: { potentialDuplicates?: Array<Record<string, unknown>> };
        };
        expect(responseBody.data?.potentialDuplicates?.[0]?.receiptCode).toBe("SA-duplicate");
        expect(responseBody.data?.potentialDuplicates?.[0]).not.toHaveProperty("phone");
    });
});
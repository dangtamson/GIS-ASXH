import { describe, expect, it } from "vitest";
import { aggregateSocialAssistanceDashboard } from "./dashboard.repository.ts";

describe("social assistance dashboard aggregation", () => {
    it("keeps pledges separate from allocations and delivery across multiple allocations", () => {
        const result = aggregateSocialAssistanceDashboard(
            [
                { id: "request-1", status: "VERIFIED", provinceCode: "92", wardCode: "31117", areaId: null, phone: "0900000001" },
                { id: "request-2", status: "VERIFIED", provinceCode: "92", wardCode: "31117", areaId: null, phone: "0900000002" },
                { id: "request-3", status: "RECEIVED", provinceCode: "92", wardCode: "31118", areaId: null, phone: "0900000003" }
            ],
            [
                { programId: "program-1", pledgeType: "CASH", pledgedAmount: 100, receivedAmount: 80, status: "RECONCILED" },
                { programId: "program-1", pledgeType: "CASH", pledgedAmount: 40, receivedAmount: null, status: "PENDING_REVIEW" },
                { programId: "program-1", pledgeType: "IN_KIND", pledgedAmount: null, receivedAmount: null, status: "PENDING_REVIEW" }
            ],
            [
                { requestId: "request-1", programId: "program-1", plannedCashAmount: 50, deliveredCashAmount: 40, status: "DELIVERED" },
                { requestId: "request-1", programId: "program-1", plannedCashAmount: 30, deliveredCashAmount: 20, status: "DELIVERED" },
                { requestId: "request-2", programId: "program-1", plannedCashAmount: 20, deliveredCashAmount: null, status: "APPROVED" }
            ]
        );

        expect(result.summary).toEqual({
            requestsReceived: 3,
            requestsVerified: 2,
            awaitingAllocation: 0,
            allocatedCases: 2,
            completedCases: 1,
            openReviewBacklog: 1,
            duplicateReviewCount: 0,
            pledgeCount: 3,
            inKindPledgeCount: 1,
            pledgedCashAmount: 140,
            receivedCashAmount: 80,
            allocatedCashAmount: 100,
            deliveredCashAmount: 60
        });
        expect(result.byProgram[0]).toEqual({
            programId: "program-1",
            pledgeCount: 3,
            pledgedCashAmount: 140,
            receivedCashAmount: 80,
            allocatedCashAmount: 100,
            deliveredCashAmount: 60
        });
        expect(result.byGeography).toEqual([
            expect.objectContaining({ wardCode: "31117", requestsReceived: 2, allocatedCashAmount: 100, deliveredCashAmount: 60 }),
            expect.objectContaining({ wardCode: "31118", requestsReceived: 1, allocatedCashAmount: 0, deliveredCashAmount: 0 })
        ]);
    });

    it("counts duplicate advisories within the same ward without returning contact data", () => {
        const result = aggregateSocialAssistanceDashboard(
            [
                { id: "request-1", status: "RECEIVED", provinceCode: "92", wardCode: "31117", areaId: null, phone: "+84 900 000 001" },
                { id: "request-2", status: "IN_REVIEW", provinceCode: "92", wardCode: "31117", areaId: null, phone: "0900000001" }
            ],
            [],
            []
        );

        expect(result.summary.duplicateReviewCount).toBe(2);
        expect(JSON.stringify(result)).not.toContain("0900000001");
    });

    it("does not count a partially delivered case as completed", () => {
        const result = aggregateSocialAssistanceDashboard(
            [{ id: "request-1", status: "VERIFIED", provinceCode: "92", wardCode: "31117", areaId: null, phone: "0900000001" }],
            [],
            [
                { requestId: "request-1", programId: "program-1", plannedCashAmount: 50, deliveredCashAmount: 50, status: "DELIVERED" },
                { requestId: "request-1", programId: "program-2", plannedCashAmount: 20, deliveredCashAmount: null, status: "APPROVED" }
            ]
        );

        expect(result.summary.completedCases).toBe(0);
    });
});
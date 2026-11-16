import { describe, expect, it } from "vitest";
import { aggregateSocialAssistancePublicationRows } from "./publications.repository.ts";

describe("social assistance publication aggregation", () => {
    it("includes delivered support only and counts distinct recipients without private fields", () => {
        const result = aggregateSocialAssistancePublicationRows(
            [
                { requestId: "request-1", programId: "program-1", provinceCode: "92", wardCode: "31117", areaId: "area-1", deliveredCashAmount: 40, deliveredItemDescription: null, status: "DELIVERED" },
                { requestId: "request-1", programId: "program-1", provinceCode: "92", wardCode: "31117", areaId: "area-1", deliveredCashAmount: 10, deliveredItemDescription: null, status: "RECONCILED" },
                { requestId: "request-2", programId: "program-1", provinceCode: "92", wardCode: "31117", areaId: "area-1", deliveredCashAmount: null, deliveredItemDescription: "Rice", status: "RECONCILED" },
                { requestId: "request-3", programId: "program-1", provinceCode: "92", wardCode: "31118", areaId: null, deliveredCashAmount: 80, deliveredItemDescription: null, status: "APPROVED" }
            ],
            { periodStart: "2026-01-01", periodEnd: "2026-12-31" }
        );

        expect(result).toEqual([
            {
                programId: "program-1",
                provinceCode: "92",
                wardCode: "31117",
                areaId: "area-1",
                recipientCount: 2,
                deliveredCashAmount: 50,
                deliveredItemCount: 1,
                periodStart: "2026-01-01",
                periodEnd: "2026-12-31"
            }
        ]);
        expect(JSON.stringify(result)).not.toContain("Rice");
        expect(JSON.stringify(result)).not.toContain("request-1");
    });
});
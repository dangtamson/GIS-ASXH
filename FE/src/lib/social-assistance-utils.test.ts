import assert from "node:assert/strict";
import test from "node:test";
import * as socialAssistanceUtils from "./social-assistance-utils.ts";
import {
    buildSocialAssistanceDashboardQuery,
    buildPublicSocialAssistanceRequestPayload,
    buildPublicSocialAssistanceWardSummary,
    createSocialAssistanceIdempotencyKey,
    getPublicSocialAssistanceMapMeasureValue,
    getPublicSocialAssistancePortalSummary,
    getPublicSocialAssistanceProgramSummary,
    getSocialAssistanceRequestStatusLabel,
    sortPublicSocialAssistanceWardSummary
} from "./social-assistance-utils.ts";

test("request status labels are localized for staff", () => {
    assert.equal(getSocialAssistanceRequestStatusLabel("RECEIVED"), "Mới tiếp nhận");
    assert.equal(getSocialAssistanceRequestStatusLabel("IN_REVIEW"), "Đang rà soát");
    assert.equal(getSocialAssistanceRequestStatusLabel("NEEDS_INFORMATION"), "Cần bổ sung thông tin");
    assert.equal(getSocialAssistanceRequestStatusLabel("VERIFIED"), "Đã xác minh");
    assert.equal(getSocialAssistanceRequestStatusLabel("REJECTED"), "Từ chối");
});

test("support categories use the same Vietnamese labels on staff and public screens", () => {
    assert.ok("getSocialAssistanceCategoryLabel" in socialAssistanceUtils);
    const categoryLabel = socialAssistanceUtils.getSocialAssistanceCategoryLabel as (value: string) => string;
    assert.equal(categoryLabel("FOOD"), "Lương thực, thực phẩm");
    assert.equal(categoryLabel("HEALTHCARE"), "Y tế");
    assert.equal(categoryLabel("HOUSING"), "Nhà ở");
    assert.equal(categoryLabel("EDUCATION"), "Giáo dục");
    assert.equal(categoryLabel("LIVELIHOOD"), "Sinh kế");
    assert.equal(categoryLabel("CASH"), "Tiền mặt");
    assert.equal(categoryLabel("OTHER"), "Khác");
    assert.equal(categoryLabel("CUSTOM"), "CUSTOM");
});

test("public submission keys are unique opaque UUIDs", () => {
    const firstKey = createSocialAssistanceIdempotencyKey();
    const secondKey = createSocialAssistanceIdempotencyKey();

    assert.match(firstKey, /^[0-9a-f-]{36}$/i);
    assert.notEqual(firstKey, secondKey);
});

test("dashboard filters serialize only selected values", () => {
    assert.equal(buildSocialAssistanceDashboardQuery({
        from: "2026-01-01",
        to: "2026-12-31",
        provinceCode: "92",
        wardCode: "31117",
        programId: "program-1",
        requestStatus: "VERIFIED"
    }), "from=2026-01-01&to=2026-12-31&provinceCode=92&wardCode=31117&programId=program-1&requestStatus=VERIFIED");
    assert.equal(buildSocialAssistanceDashboardQuery({}), "");
});

test("public request payload keeps fields collected across both form steps", () => {
    const payload = buildPublicSocialAssistanceRequestPayload({
        contactName: "Nguyen Van A",
        phone: "0909123456",
        needCategory: "FOOD",
        needDescription: "Can ho tro luong thuc",
        address: "123 Le Loi",
        provinceCode: "92",
        wardCode: "31510",
        consent: true,
        source: "MAP",
        latitude: 10.03,
        longitude: 105.78
    }, "WEBSITE");

    assert.deepEqual(payload, {
        contactName: "Nguyen Van A",
        phone: "0909123456",
        needCategory: "FOOD",
        needDescription: "Can ho tro luong thuc",
        address: "123 Le Loi",
        provinceCode: "92",
        wardCode: "31510",
        consent: true,
        source: "WEBSITE",
        latitude: 10.03,
        longitude: 105.78
    });
});

test("portal summary is derived from published programs and approved map aggregates", () => {
    assert.deepEqual(getPublicSocialAssistancePortalSummary(
        [{ id: "program-1" }, { id: "program-2" }],
        [
            { recipientCount: 5, deliveredCashAmount: 200, deliveredItemCount: 2 },
            { recipientCount: 3, deliveredCashAmount: 100, deliveredItemCount: 1 }
        ]
    ), {
        supportCount: 8,
        programCount: 2,
        deliveredCashAmount: 300,
        deliveredItemCount: 3
    });
});

test("portal map summary groups published rows by ward without dropping program totals", () => {
    assert.deepEqual(buildPublicSocialAssistanceWardSummary([
        { periodStart: "2026-01-01", periodEnd: "2026-12-31", programId: "program-1", programTitle: "Housing", provinceCode: "92", wardCode: "31117", recipientCount: 5, deliveredCashAmount: 200, deliveredItemCount: 2 },
        { periodStart: "2026-01-01", periodEnd: "2026-12-31", programId: "program-2", programTitle: "Education", provinceCode: "92", wardCode: "31117", recipientCount: 3, deliveredCashAmount: 100, deliveredItemCount: 1 },
        { periodStart: "2026-01-01", periodEnd: "2026-12-31", programId: "program-1", programTitle: "Housing", provinceCode: "92", wardCode: "31510", recipientCount: 2, deliveredCashAmount: 60, deliveredItemCount: 0 }
    ]), [
        { provinceCode: "92", wardCode: "31117", recipientCount: 8, deliveredCashAmount: 300, deliveredItemCount: 3, programCount: 2 },
        { provinceCode: "92", wardCode: "31510", recipientCount: 2, deliveredCashAmount: 60, deliveredItemCount: 0, programCount: 1 }
    ]);
});

test("program overview totals come from published aggregate rows only", () => {
    assert.deepEqual(getPublicSocialAssistanceProgramSummary(
        [{ id: "program-1" }, { id: "program-2" }],
        [
            { periodStart: "2026-01-01", periodEnd: "2026-12-31", programId: "program-1", programTitle: "Housing", provinceCode: "92", wardCode: "31117", recipientCount: 5, deliveredCashAmount: 200, deliveredItemCount: 2 },
            { periodStart: "2026-01-01", periodEnd: "2026-12-31", programId: "program-2", programTitle: "Education", provinceCode: "92", wardCode: "31510", recipientCount: 3, deliveredCashAmount: 100, deliveredItemCount: 1 },
            { periodStart: "2026-01-01", periodEnd: "2026-12-31", programId: "program-1", programTitle: "Housing", provinceCode: "92", wardCode: "31119", recipientCount: 2, deliveredCashAmount: 60, deliveredItemCount: 0 }
        ]
    ), {
        programCount: 2,
        supportInstances: 10,
        deliveredCashAmount: 360,
        deliveredItemCount: 3,
        geographyCount: 3
    });
});

test("thematic map measures read the matching published aggregate field", () => {
    const item = {
        periodStart: "2026-01-01",
        periodEnd: "2026-12-31",
        programId: "program-1",
        programTitle: "Housing",
        provinceCode: "92",
        wardCode: "31117",
        recipientCount: 8,
        deliveredCashAmount: 300,
        deliveredItemCount: 3
    };

    assert.equal(getPublicSocialAssistanceMapMeasureValue(item, "recipients"), 8);
    assert.equal(getPublicSocialAssistanceMapMeasureValue(item, "cash"), 300);
    assert.equal(getPublicSocialAssistanceMapMeasureValue(item, "items"), 3);
});

test("ward ranking follows the selected measure without mutating the source", () => {
    const rows = buildPublicSocialAssistanceWardSummary([
        { periodStart: "2026-01-01", periodEnd: "2026-12-31", programId: "program-1", programTitle: "Housing", provinceCode: "92", wardCode: "31117", recipientCount: 8, deliveredCashAmount: 300, deliveredItemCount: 3 },
        { periodStart: "2026-01-01", periodEnd: "2026-12-31", programId: "program-2", programTitle: "Education", provinceCode: "92", wardCode: "31119", recipientCount: 5, deliveredCashAmount: 900, deliveredItemCount: 1 },
        { periodStart: "2026-01-01", periodEnd: "2026-12-31", programId: "program-1", programTitle: "Housing", provinceCode: "92", wardCode: "31510", recipientCount: 5, deliveredCashAmount: 700, deliveredItemCount: 1 }
    ]);
    const originalOrder = rows.map((row) => row.wardCode);

    assert.deepEqual(sortPublicSocialAssistanceWardSummary(rows, "cash").map((row) => row.wardCode), ["31119", "31510", "31117"]);
    assert.deepEqual(sortPublicSocialAssistanceWardSummary(rows, "recipients").map((row) => row.wardCode), ["31117", "31119", "31510"]);
    assert.deepEqual(rows.map((row) => row.wardCode), originalOrder);
});
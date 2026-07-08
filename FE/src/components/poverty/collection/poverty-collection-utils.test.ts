import test from "node:test";
import assert from "node:assert/strict";
import {
    COLLECTION_ACTION_BAR_Z_INDEX,
    COLLECTION_MAP_LAYER_Z_INDEX,
    buildCollectionSearchLoadingState,
    buildCoordinateStatusLabel,
    shouldLoadCollectionAreaOptions,
    shouldLoadCollectionWardOptions,
    buildStepOneCreatePayload,
    buildStepOneUpdatePayload,
    buildStepTwoContextPayload,
    canSubmitCollectionStepTwo,
    createInitialCollectionState,
} from "./poverty-collection-utils.ts";

test("createInitialCollectionState starts in search mode", () => {
    const state = createInitialCollectionState();

    assert.equal(state.mode, "search");
    assert.equal(state.step, null);
    assert.equal(state.selectedHouseholdId, null);
});

test("canSubmitCollectionStepTwo accepts any non-empty context or photo", () => {
    assert.equal(canSubmitCollectionStepTwo({ familySituation: "Kho khan", currentStatus: "", photos: [] }), true);
    assert.equal(canSubmitCollectionStepTwo({ familySituation: "", currentStatus: "Da cap nhat", photos: [] }), true);
    assert.equal(
        canSubmitCollectionStepTwo({
            familySituation: "",
            currentStatus: "",
            photos: [{ id: "1", fileName: "a.jpg", fileSize: 100, mimeType: "image/jpeg", fileContentBase64: "abc" }],
        }),
        true,
    );
    assert.equal(canSubmitCollectionStepTwo({ familySituation: "", currentStatus: "", photos: [] }), false);
});

test("buildCoordinateStatusLabel distinguishes households with and without coordinates", () => {
    assert.equal(buildCoordinateStatusLabel({ latitude: 10.03, longitude: 105.76 }), "Da co toa do");
    assert.equal(buildCoordinateStatusLabel({ latitude: null, longitude: null }), "Chua co toa do");
});

test("buildCollectionSearchLoadingState keeps the household list in loading state while detail is opening", () => {
    assert.equal(buildCollectionSearchLoadingState({ searching: true, loading: false }), true);
    assert.equal(buildCollectionSearchLoadingState({ searching: false, loading: true }), true);
    assert.equal(buildCollectionSearchLoadingState({ searching: false, loading: false }), false);
});

test("shouldLoadCollectionWardOptions only reloads wards when province value actually changes", () => {
    assert.equal(shouldLoadCollectionWardOptions({ previousProvinceCode: null, nextProvinceCode: "" }), false);
    assert.equal(shouldLoadCollectionWardOptions({ previousProvinceCode: null, nextProvinceCode: "92" }), true);
    assert.equal(shouldLoadCollectionWardOptions({ previousProvinceCode: "92", nextProvinceCode: "92" }), false);
    assert.equal(shouldLoadCollectionWardOptions({ previousProvinceCode: "92", nextProvinceCode: "01" }), true);
});

test("shouldLoadCollectionAreaOptions only reloads areas when ward value actually changes", () => {
    assert.equal(shouldLoadCollectionAreaOptions({ previousWardCode: null, nextWardCode: "" }), false);
    assert.equal(shouldLoadCollectionAreaOptions({ previousWardCode: null, nextWardCode: "31117" }), true);
    assert.equal(shouldLoadCollectionAreaOptions({ previousWardCode: "31117", nextWardCode: "31117" }), false);
    assert.equal(shouldLoadCollectionAreaOptions({ previousWardCode: "31117", nextWardCode: "31120" }), true);
});

test("collection action bar stays above the map layer", () => {
    assert.ok(COLLECTION_ACTION_BAR_Z_INDEX > COLLECTION_MAP_LAYER_Z_INDEX);
});

test("buildStepOneUpdatePayload includes location fields only", () => {
    const payload = buildStepOneUpdatePayload({
        provinceCode: "92",
        wardCode: "31117",
        areaId: "11111111-1111-1111-1111-111111111111",
        address: "So 1 Duong ABC",
        latitude: 10.03,
        longitude: 105.76,
        code: "IGNORED",
        year: 2026,
        povertyType: "POOR",
        status: "ACTIVE",
        headFullName: "Nguyen Van A",
        headCitizenId: "079123456789",
        memberCount: 4,
    });

    assert.deepEqual(payload, {
        provinceCode: "92",
        wardCode: "31117",
        areaId: "11111111-1111-1111-1111-111111111111",
        address: "So 1 Duong ABC",
        latitude: 10.03,
        longitude: 105.76,
    });
});

test("buildStepOneCreatePayload keeps all mobile step one fields", () => {
    const payload = buildStepOneCreatePayload({
        code: "HN-001",
        year: 2026,
        povertyType: "POOR",
        status: "ACTIVE",
        provinceCode: "92",
        wardCode: "31117",
        areaId: "11111111-1111-1111-1111-111111111111",
        address: "So 1 Duong ABC",
        latitude: 10.03,
        longitude: 105.76,
        headFullName: "Nguyen Van A",
        headCitizenId: "079123456789",
        memberCount: 4,
    });

    assert.equal(payload.headFullName, "Nguyen Van A");
    assert.equal(payload.headCitizenId, "079123456789");
    assert.equal(payload.memberCount, 4);
});

test("buildStepTwoContextPayload trims empty strings to undefined", () => {
    const payload = buildStepTwoContextPayload({
        recordedAt: "2026-07-06",
        familySituation: "  Kho khan  ",
        currentStatus: "   ",
        note: "",
    });

    assert.deepEqual(payload, {
        recordedAt: "2026-07-06",
        familySituation: "Kho khan",
        currentStatus: undefined,
        note: undefined,
    });
});

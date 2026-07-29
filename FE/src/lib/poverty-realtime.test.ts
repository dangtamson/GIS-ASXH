import assert from "node:assert/strict";
import test from "node:test";
import {
    buildPovertyCoordinateChannel,
    formatPovertyCoordinateNotification,
    parsePovertyCoordinateUpdate,
} from "./poverty-realtime.ts";

test("buildPovertyCoordinateChannel scopes the channel to a workspace", () => {
    assert.equal(
        buildPovertyCoordinateChannel("workspace-1"),
        "poverty-household-coordinate-updates:workspace-1",
    );
});

test("parsePovertyCoordinateUpdate accepts only complete event payloads", () => {
    assert.deepEqual(parsePovertyCoordinateUpdate({
        householdId: "household-1",
        householdHeadName: "Trần Văn B",
        actorName: "Nguyễn Văn A",
        updatedAt: "2026-07-29T03:30:00.000Z",
    }), {
        householdId: "household-1",
        householdHeadName: "Trần Văn B",
        actorName: "Nguyễn Văn A",
        updatedAt: "2026-07-29T03:30:00.000Z",
    });
    assert.equal(parsePovertyCoordinateUpdate({ householdId: "household-1" }), null);
});

test("formatPovertyCoordinateNotification returns the Vietnamese toast text", () => {
    assert.equal(
        formatPovertyCoordinateNotification({
            householdId: "household-1",
            householdHeadName: "Trần Văn B",
            actorName: "Nguyễn Văn A",
            updatedAt: "2026-07-29T03:30:00.000Z",
        }),
        "Nguyễn Văn A đã thu thập cập nhật hộ: Trần Văn B lúc 10:30 29/07/2026",
    );
});

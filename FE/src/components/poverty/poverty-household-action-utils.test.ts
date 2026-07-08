import test from "node:test";
import assert from "node:assert/strict";
import { getVisibleHouseholdExtraActions } from "./poverty-household-action-utils.ts";

test("getVisibleHouseholdExtraActions keeps only visible actions in original order", () => {
    const actions = getVisibleHouseholdExtraActions([
        { key: "collection", label: "Thu thập hiện trường", iconAction: "more", visible: true },
        { key: "assessmentTimeline", label: "Xem timeline đánh giá", iconAction: "timeline", visible: true },
        { key: "supportTimeline", label: "Xem timeline hỗ trợ", iconAction: "supportTimeline", visible: false },
        { key: "map", label: "Xem trên bản đồ", iconAction: "more", visible: true },
        { key: "delete", label: "Ngưng hoạt động", iconAction: "delete", visible: true, danger: true },
    ]);

    assert.deepEqual(
        actions.map((item) => ({ key: item.key, label: item.label, iconAction: item.iconAction, danger: item.danger ?? false })),
        [
            { key: "collection", label: "Thu thập hiện trường", iconAction: "more", danger: false },
            { key: "assessmentTimeline", label: "Xem timeline đánh giá", iconAction: "timeline", danger: false },
            { key: "map", label: "Xem trên bản đồ", iconAction: "more", danger: false },
            { key: "delete", label: "Ngưng hoạt động", iconAction: "delete", danger: true },
        ],
    );
});

test("getVisibleHouseholdExtraActions returns an empty list when nothing is visible", () => {
    const actions = getVisibleHouseholdExtraActions([
        { key: "assessmentTimeline", label: "Xem timeline đánh giá", iconAction: "timeline", visible: false },
        { key: "supportTimeline", label: "Xem timeline hỗ trợ", iconAction: "supportTimeline", visible: false },
    ]);

    assert.equal(actions.length, 0);
});

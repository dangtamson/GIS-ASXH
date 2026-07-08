import test from "node:test";
import assert from "node:assert/strict";
import {
    buildWardFilterOptions,
    filterWardItems,
    type WardListItemLike,
} from "./poverty-admin-general-info-utils.ts";

test("filterWardItems returns all wards when no ward is selected", () => {
    const items: WardListItemLike[] = [
        { code: "31150", name: "An Binh", fullName: "Phuong An Binh" },
        { code: "31117", name: "An Khanh", fullName: "Phuong An Khanh" },
    ];

    assert.deepEqual(filterWardItems(items, undefined), items);
    assert.deepEqual(filterWardItems(items, ""), items);
});

test("filterWardItems narrows the list to the selected ward", () => {
    const items: WardListItemLike[] = [
        { code: "31150", name: "An Binh", fullName: "Phuong An Binh" },
        { code: "31117", name: "An Khanh", fullName: "Phuong An Khanh" },
    ];

    assert.deepEqual(filterWardItems(items, "31117"), [items[1]]);
});

test("buildWardFilterOptions uses fullName when available", () => {
    const items: WardListItemLike[] = [
        { code: "31150", name: "An Binh", fullName: "Phuong An Binh" },
        { code: "31117", name: "An Khanh" },
    ];

    assert.deepEqual(buildWardFilterOptions(items), [
        { value: "31150", label: "Phuong An Binh" },
        { value: "31117", label: "An Khanh" },
    ]);
});

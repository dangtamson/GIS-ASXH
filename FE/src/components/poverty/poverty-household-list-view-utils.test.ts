import assert from "node:assert/strict";
import test from "node:test";

import {
    buildHouseholdAreaLabel,
    getHouseholdGridActionAriaLabel,
    hasDropdownActions,
} from "./poverty-household-list-view-utils.ts";

test("buildHouseholdAreaLabel joins province ward and area names in display order", () => {
    const label = buildHouseholdAreaLabel({
        provinceName: "Can Tho",
        wardName: "Phuong Tan An",
        areaName: "Khu vuc 1",
    });

    assert.equal(label, "Can Tho / Phuong Tan An / Khu vuc 1");
});

test("buildHouseholdAreaLabel falls back to a dash when no area data exists", () => {
    const label = buildHouseholdAreaLabel({
        provinceName: null,
        wardName: undefined,
        areaName: "",
    });

    assert.equal(label, "-");
});

test("hasDropdownActions returns true only for a non-empty menu item list", () => {
    assert.equal(hasDropdownActions(undefined), false);
    assert.equal(hasDropdownActions([]), false);
    assert.equal(hasDropdownActions([{ key: "map", label: "Xem tren ban do" }]), true);
});

test("getHouseholdGridActionAriaLabel returns stable labels for icon-only buttons", () => {
    assert.equal(getHouseholdGridActionAriaLabel("view"), "Xem chi tiết hộ");
    assert.equal(getHouseholdGridActionAriaLabel("edit"), "Sửa thông tin hộ");
    assert.equal(getHouseholdGridActionAriaLabel("more"), "Mở thêm thao tác");
});

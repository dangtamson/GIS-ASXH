import assert from "node:assert/strict";
import test from "node:test";

import { buildPublicAreaAdministrativeSections } from "./poverty-public-area-modal-utils.ts";

test("buildPublicAreaAdministrativeSections groups area information into personnel and geography sections", () => {
    const sections = buildPublicAreaAdministrativeSections({
        id: "area-1",
        name: "Phu Tri B1",
        secretaryName: "Dang Van Dung",
        secretaryPhone: "0975382758",
        hamletHeadName: "Pham Van Minh",
        hamletHeadPhone: "0912345678",
        securityTeamLeaderName: "Pham Vinh Tran",
        securityTeamLeaderPhone: "0981030110",
        naturalArea: 150,
        description: "Khu vuc phia bac, giap Long Tho.",
        note: "Dan so khoang 800 nguoi.",
    });

    assert.equal(sections.length, 2);
    assert.equal(sections[0]?.title, "Nhân sự phụ trách");
    assert.equal(sections[1]?.title, "Địa lý và ghi chú");
    assert.equal(sections[0]?.items[0]?.value, "Dang Van Dung");
    assert.equal(sections[1]?.items[0]?.value, "150 ha");
});

test("buildPublicAreaAdministrativeSections uses a consistent fallback for missing values", () => {
    const sections = buildPublicAreaAdministrativeSections({
        id: "area-1",
        name: "Phu Tri B1",
    });

    assert.equal(sections[0]?.items[0]?.value, "Chưa cập nhật");
    assert.equal(sections[1]?.items[0]?.value, "Chưa cập nhật");
    assert.equal(sections[1]?.items[2]?.value, "Chưa cập nhật");
});

import assert from "node:assert/strict";
import test from "node:test";

import {
    GIS_SIGNIN_EYEBROW,
    GIS_SIGNIN_DESCRIPTION,
    GIS_SIGNIN_PANEL_TITLE,
    GIS_SIGNIN_SIGNAL_LABELS,
    getGisSignInMobileHeroLines,
} from "./signin-showcase.ts";

test("GIS sign-in copy stays short and product-focused", () => {
    assert.equal(GIS_SIGNIN_EYEBROW, "Nền tảng GIS điều hành số");
    assert.match(GIS_SIGNIN_DESCRIPTION, /bản đồ số|tín hiệu|vị trí/i);
    assert.ok(GIS_SIGNIN_DESCRIPTION.length <= 120);
});

test("GIS sign-in glass panel keeps only non-numeric signal labels", () => {
    assert.equal(GIS_SIGNIN_PANEL_TITLE, "Không gian tín hiệu bản đồ số");

    assert.deepEqual(
        GIS_SIGNIN_SIGNAL_LABELS,
        ["Radar quét vùng", "Contour địa hình", "Tín hiệu vị trí"]
    );

    GIS_SIGNIN_SIGNAL_LABELS.forEach((label) => {
        assert.equal(/\d/.test(label), false);
    });
});

test("mobile hero lines stay concise for small screens", () => {
    assert.deepEqual(getGisSignInMobileHeroLines(), [
        "Không gian đăng nhập kính mờ cho bản đồ số",
        "Radar, contour và tín hiệu vị trí hội tụ tức thời",
    ]);
});
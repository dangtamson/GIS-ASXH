import assert from "node:assert/strict";
import test from "node:test";

import { getPublicHouseholdTheme } from "./poverty-utils.ts";

test("getPublicHouseholdTheme uses a rose theme for poor households", () => {
    const theme = getPublicHouseholdTheme("POOR");

    assert.equal(theme.tone, "poor");
    assert.match(theme.heroClassName, /#fb7185|#fda4af|#fff1f2/i);
    assert.match(theme.surfaceClassName, /rose/i);
    assert.match(theme.badgeClassName, /rose/i);
});

test("getPublicHouseholdTheme uses an amber theme for near-poor households", () => {
    const theme = getPublicHouseholdTheme("NEAR_POOR");

    assert.equal(theme.tone, "near-poor");
    assert.match(theme.heroClassName, /amber|#f59e0b|#fbbf24/i);
    assert.match(theme.surfaceClassName, /amber|orange/i);
    assert.match(theme.badgeClassName, /amber|orange/i);
});

test("getPublicHouseholdTheme falls back to a blue theme for normal households", () => {
    const theme = getPublicHouseholdTheme("NONE");

    assert.equal(theme.tone, "normal");
    assert.match(theme.heroClassName, /blue|#2563eb|#60a5fa/i);
    assert.match(theme.surfaceClassName, /blue|sky/i);
});

test("getPublicHouseholdTheme uses a neutral loading theme before household data is available", () => {
    const theme = getPublicHouseholdTheme(undefined);

    assert.equal(theme.tone, "loading");
    assert.match(theme.heroClassName, /slate|sky|#e2e8f0|#f8fafc/i);
    assert.doesNotMatch(theme.heroClassName, /#2563eb|#3b82f6/i);
});

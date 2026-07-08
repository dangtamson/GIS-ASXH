import test from "node:test";
import assert from "node:assert/strict";
import { getHouseholdContextCardTheme, getHouseholdSummaryCardTheme, getLatestHouseholdContextHistory, resolveLatestHouseholdContextHistory } from "./poverty-context-utils.ts";

type ContextHistoryFixture = {
    id: string;
    householdId: string;
    recordedAt: string;
    familySituation: string | null;
    currentStatus: string | null;
    note: string | null;
    createdAt?: string;
};

test("getLatestHouseholdContextHistory returns the latest recorded item", () => {
    const latest = getLatestHouseholdContextHistory<ContextHistoryFixture>([
        { id: "1", householdId: "h1", recordedAt: "2026-07-01", familySituation: "Hoan canh 1", currentStatus: null, note: null },
        { id: "2", householdId: "h1", recordedAt: "2026-07-03", familySituation: null, currentStatus: "Hien trang 2", note: null },
        { id: "3", householdId: "h1", recordedAt: "2026-07-03", createdAt: "2026-07-03T10:00:00.000Z", familySituation: "Hoan canh 3", currentStatus: "Hien trang 3", note: null },
    ]);

    assert.equal(latest?.id, "3");
});

test("resolveLatestHouseholdContextHistory prefers the explicit latest item from api", () => {
    const latest = resolveLatestHouseholdContextHistory<ContextHistoryFixture>(
        { id: "99", householdId: "h1", recordedAt: "2026-07-02", familySituation: "Hoan canh moi nhat", currentStatus: "Hien trang moi nhat", note: null } satisfies ContextHistoryFixture,
        [
            { id: "1", householdId: "h1", recordedAt: "2026-07-01", familySituation: "Hoan canh 1", currentStatus: null, note: null },
            { id: "2", householdId: "h1", recordedAt: "2026-07-03", familySituation: null, currentStatus: "Hien trang 2", note: null },
        ] satisfies ContextHistoryFixture[],
    );

    assert.equal(latest?.id, "99");
});

test("resolveLatestHouseholdContextHistory falls back to the newest history item", () => {
    const latest = resolveLatestHouseholdContextHistory<ContextHistoryFixture>(null, [
        { id: "1", householdId: "h1", recordedAt: "2026-07-01", familySituation: "Hoan canh 1", currentStatus: null, note: null },
        { id: "2", householdId: "h1", recordedAt: "2026-07-03", familySituation: null, currentStatus: "Hien trang 2", note: null },
    ]);

    assert.equal(latest?.id, "2");
});

test("getHouseholdContextCardTheme returns a warm theme for family situation", () => {
    const theme = getHouseholdContextCardTheme("familySituation");

    assert.match(theme.cardClassName, /amber|orange/);
    assert.match(theme.iconClassName, /amber|orange/);
    assert.match(theme.labelClassName, /amber|orange/);
});

test("getHouseholdContextCardTheme returns a cool theme for current status", () => {
    const theme = getHouseholdContextCardTheme("currentStatus");

    assert.match(theme.cardClassName, /emerald|teal|cyan/);
    assert.match(theme.iconClassName, /emerald|teal|cyan/);
    assert.match(theme.labelClassName, /emerald|teal|cyan/);
});

test("getHouseholdSummaryCardTheme returns a blue theme for owner info", () => {
    const theme = getHouseholdSummaryCardTheme("owner");

    assert.match(theme.cardClassName, /blue|indigo/);
    assert.match(theme.iconClassName, /blue|indigo/);
    assert.match(theme.labelClassName, /blue|indigo/);
});

test("getHouseholdSummaryCardTheme returns a violet theme for member info", () => {
    const theme = getHouseholdSummaryCardTheme("members");

    assert.match(theme.cardClassName, /violet|fuchsia|indigo/);
    assert.match(theme.iconClassName, /violet|fuchsia|indigo/);
    assert.match(theme.labelClassName, /violet|fuchsia|indigo/);
});

test("getHouseholdSummaryCardTheme returns a cyan theme for location info", () => {
    const theme = getHouseholdSummaryCardTheme("location");

    assert.match(theme.cardClassName, /sky|cyan|teal/);
    assert.match(theme.iconClassName, /sky|cyan|teal/);
    assert.match(theme.labelClassName, /sky|cyan|teal/);
});

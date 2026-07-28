import assert from "node:assert/strict";
import test from "node:test";

import {
    getLoginAccountEmailInput,
    isValidAccountEmailInput,
    normalizeAccountEmail
} from "./accountEmail.ts";

test("normalizeAccountEmail appends the primary default domain for aliases", () => {
    assert.equal(normalizeAccountEmail("nguyenvana"), "nguyenvana@cantho.gov.vn");
});

test("normalizeAccountEmail supports vnpt.vn when explicitly selected", () => {
    assert.equal(normalizeAccountEmail("nguyenvana", "@vnpt.vn"), "nguyenvana@vnpt.vn");
});

test("normalizeAccountEmail keeps full emails unchanged", () => {
    assert.equal(normalizeAccountEmail("User.Name@VNPT.VN"), "user.name@vnpt.vn");
});

test("getLoginAccountEmailInput keeps aliases unresolved for backend fallback", () => {
    assert.equal(getLoginAccountEmailInput(" NguyenVanA "), "nguyenvana");
});

test("isValidAccountEmailInput accepts aliases and full emails", () => {
    assert.equal(isValidAccountEmailInput("abc_xyz"), true);
    assert.equal(isValidAccountEmailInput("abc@vnpt.vn"), true);
    assert.equal(isValidAccountEmailInput(""), false);
});

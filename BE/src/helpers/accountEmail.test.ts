import { describe, expect, it } from "vitest";

import {
    DEFAULT_ACCOUNT_EMAIL_DOMAIN,
    normalizeAccountEmail,
    isValidAccountEmailInput
} from "./accountEmail.ts";

describe("accountEmail helper", () => {
    it("exposes default domains including cantho and vnpt", () => {
        expect(Array.isArray(DEFAULT_ACCOUNT_EMAIL_DOMAIN)).toBe(true);
        expect(DEFAULT_ACCOUNT_EMAIL_DOMAIN).toEqual([
            "@cantho.gov.vn",
            "@vnpt.vn"
        ]);
    });

    it("normalizes alias with primary default domain", () => {
        expect(normalizeAccountEmail("nguyenvana")).toBe("nguyenvana@cantho.gov.vn");
    });

    it("supports explicit vnpt domain", () => {
        expect(normalizeAccountEmail("nguyenvana", "@vnpt.vn")).toBe("nguyenvana@vnpt.vn");
    });

    it("validates alias and full email", () => {
        expect(isValidAccountEmailInput("abc_xyz")).toBe(true);
        expect(isValidAccountEmailInput("abc@vnpt.vn")).toBe(true);
        expect(isValidAccountEmailInput("")).toBe(false);
    });
});

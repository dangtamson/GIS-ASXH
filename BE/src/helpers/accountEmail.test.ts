import { describe, expect, it } from "vitest";

import {
    DEFAULT_ACCOUNT_EMAIL_DOMAIN,
    accountEmailLoginInputSchema,
    getAccountEmailCandidates,
    normalizeAccountEmail,
    isValidAccountEmailInput,
    resolveAccountEmail
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

    it("returns ordered domain candidates for an account alias", () => {
        expect(getAccountEmailCandidates(" NguyenVanA ")).toEqual([
            "nguyenvana@cantho.gov.vn",
            "nguyenvana@vnpt.vn"
        ]);
    });

    it("keeps a full email as the only candidate", () => {
        expect(getAccountEmailCandidates("User.Name@VNPT.VN")).toEqual([
            "user.name@vnpt.vn"
        ]);
    });

    it("keeps a login alias unresolved for backend domain lookup", () => {
        expect(accountEmailLoginInputSchema.parse(" NguyenVanA ")).toBe("nguyenvana");
    });

    it("returns no candidates for an empty input", () => {
        expect(getAccountEmailCandidates(" ")).toEqual([]);
    });

    it("resolves the first existing account in candidate order", () => {
        expect(
            resolveAccountEmail(
                ["nguyenvana@cantho.gov.vn", "nguyenvana@vnpt.vn"],
                ["nguyenvana@vnpt.vn"]
            )
        ).toBe("nguyenvana@vnpt.vn");
    });

    it("prefers the Can Tho account when both candidates exist", () => {
        expect(
            resolveAccountEmail(
                ["nguyenvana@cantho.gov.vn", "nguyenvana@vnpt.vn"],
                ["nguyenvana@vnpt.vn", "nguyenvana@cantho.gov.vn"]
            )
        ).toBe("nguyenvana@cantho.gov.vn");
    });

    it("validates alias and full email", () => {
        expect(isValidAccountEmailInput("abc_xyz")).toBe(true);
        expect(isValidAccountEmailInput("abc@vnpt.vn")).toBe(true);
        expect(isValidAccountEmailInput("")).toBe(false);
    });
});

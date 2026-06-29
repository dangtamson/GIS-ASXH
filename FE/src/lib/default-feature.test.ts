import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    isSafeFeaturePath,
    selectDefaultFeaturePath,
    type AccessibleFeature,
} from "./default-feature.ts";

const features: AccessibleFeature[] = [
    { uuid: "dashboard", name: "Dashboard", path: "/dashboard", enabled: true, orderIndex: 20 },
    { uuid: "poverty", name: "Hộ nghèo", path: "/ho-ngheo", enabled: true, orderIndex: 10 },
];

describe("isSafeFeaturePath", () => {
    for (const path of ["", "/", "https://example.com", "//example.com"]) {
        it(`rejects unsafe path ${path}`, () => {
            assert.equal(isSafeFeaturePath(path), false);
        });
    }

    it("accepts an internal application path", () => {
        assert.equal(isSafeFeaturePath("/ho-ngheo/dashboard"), true);
    });
});

describe("selectDefaultFeaturePath", () => {
    it("returns configured feature when accessible", () => {
        assert.equal(selectDefaultFeaturePath(features, "dashboard"), "/dashboard");
    });

    it("falls back to the first accessible feature by orderIndex", () => {
        assert.equal(selectDefaultFeaturePath(features, "missing"), "/ho-ngheo");
    });

    it("ignores disabled and unsafe features", () => {
        assert.equal(selectDefaultFeaturePath([
            { uuid: "root", name: "Root", path: "/", enabled: true, orderIndex: 1 },
            { uuid: "disabled", name: "Disabled", path: "/disabled", enabled: false, orderIndex: 2 },
        ], "root"), null);
    });
});

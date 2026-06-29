import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    getCurrentRoleId,
    normalizeAdminFeatures,
    normalizeRoleFeatures,
} from "./default-feature-access.ts";

describe("getCurrentRoleId", () => {
    it("reads role id from selected workspace membership", () => {
        assert.equal(getCurrentRoleId({
            memberships: [{ workspaceId: "workspace-1", roleId: 7 }],
        }, "workspace-1"), 7);
    });

    it("ignores memberships from another workspace", () => {
        assert.equal(getCurrentRoleId({
            memberships: [{ workspaceId: "workspace-2", roleId: 7 }],
        }, "workspace-1"), null);
    });
});

describe("feature normalization", () => {
    it("normalizes enabled admin features", () => {
        assert.deepEqual(normalizeAdminFeatures([
            { uuid: "one", name: "One", path: "/one", enabled: true, orderIndex: 2 },
        ]), [
            { uuid: "one", name: "One", path: "/one", enabled: true, orderIndex: 2 },
        ]);
    });

    it("extracts nested enabled role features", () => {
        assert.equal(normalizeRoleFeatures([
            { feature: { uuid: "one", name: "One", path: "/one", enabled: true } },
        ]).length, 1);
    });

    it("drops disabled and incomplete features", () => {
        assert.deepEqual(normalizeAdminFeatures([
            { uuid: "disabled", name: "Disabled", path: "/disabled", enabled: false },
            { uuid: "", name: "Missing id", path: "/missing", enabled: true },
        ]), []);
    });
});

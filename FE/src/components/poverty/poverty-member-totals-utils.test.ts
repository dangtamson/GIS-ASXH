import assert from "node:assert/strict";
import test from "node:test";

import type { PovertyMarker } from "@/types/poverty";
import { buildPovertyMemberTotalsFromMarkers } from "./poverty-member-totals-utils.ts";

test("buildPovertyMemberTotalsFromMarkers sums memberCount for poor and near-poor markers only", () => {
    assert.deepEqual(
        buildPovertyMemberTotalsFromMarkers([
            { povertyType: "POOR", memberCount: 5 },
            { povertyType: "NEAR_POOR", memberCount: 4 },
            { povertyType: "NONE", memberCount: 9 },
            { povertyType: "POOR", memberCount: null },
        ] as PovertyMarker[]),
        { total: 9, poor: 5, nearPoor: 4 }
    );
});

import type { PovertyMarker } from "@/types/poverty";
import { normalizePovertyType } from "./poverty-utils.ts";

export const buildPovertyMemberTotalsFromMarkers = (
    markers: PovertyMarker[]
): { total: number; poor: number; nearPoor: number } =>
    markers.reduce(
        (summary, marker) => {
            const memberCount = Number(marker.memberCount ?? 0);
            const povertyType = normalizePovertyType(marker.povertyType);

            if (povertyType === "POOR") {
                summary.poor += memberCount;
                summary.total += memberCount;
            }

            if (povertyType === "NEAR_POOR") {
                summary.nearPoor += memberCount;
                summary.total += memberCount;
            }

            return summary;
        },
        { total: 0, poor: 0, nearPoor: 0 }
    );

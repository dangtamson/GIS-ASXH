import type { PovertyMarker } from "@/types/poverty";

export const DEFAULT_CANTHO_PROVINCE_CODE = "92";

type HouseholdLocationLike = {
    provinceCode?: string | null;
    wardCode?: string | null;
    areaId?: string | null;
    provinceName?: string | null;
    wardName?: string | null;
    areaName?: string | null;
};

export type PovertyMapAreaSummary = {
    key: string;
    areaId: string | null;
    areaName: string;
    totalCount: number;
    poorCount: number;
    nearPoorCount: number;
};

export const getInitialProvinceCode = (value?: string | null): string =>
    String(value ?? "").trim() || DEFAULT_CANTHO_PROVINCE_CODE;

export const hasUnresolvedStandardizedLocation = (value: HouseholdLocationLike): boolean => {
    const hasSnapshot = Boolean(value.provinceName || value.wardName || value.areaName);
    const hasStandardizedKeys = Boolean(value.provinceCode && value.wardCode && value.areaId);
    return hasSnapshot && !hasStandardizedKeys;
};

export const buildPovertyDashboardQuery = (filters: {
    provinceCode?: string | null;
    wardCode?: string | null;
}): string => {
    const params = new URLSearchParams();

    if (filters.provinceCode) {
        params.set("provinceCode", filters.provinceCode);
    }

    if (filters.wardCode) {
        params.set("wardCode", filters.wardCode);
    }

    return params.toString();
};

export const shouldShowPovertyDashboardLocationSelect = (isSuperAdmin?: boolean | null): boolean =>
    Boolean(isSuperAdmin);

const normalizePovertyAreaKey = (value?: string | null): string =>
    String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

export const buildPovertyMapAreaKey = (value: Pick<HouseholdLocationLike, "areaId" | "areaName">): string => {
    const areaId = String(value.areaId ?? "").trim();
    if (areaId) {
        return `id:${areaId}`;
    }

    const normalizedAreaName = normalizePovertyAreaKey(value.areaName) || "chua co khu vuc";
    return `name:${normalizedAreaName}`;
};

export const buildPovertyMapAreaSummaries = (markers: PovertyMarker[]): PovertyMapAreaSummary[] => {
    const summaryMap = new Map<string, PovertyMapAreaSummary>();

    markers.forEach((marker) => {
        const key = buildPovertyMapAreaKey(marker);
        const areaName = String(marker.areaName ?? "").trim() || "Chưa có khu vực";
        const summary = summaryMap.get(key) ?? {
            key,
            areaId: marker.areaId ? String(marker.areaId) : null,
            areaName,
            totalCount: 0,
            poorCount: 0,
            nearPoorCount: 0,
        };

        summary.totalCount += 1;
        if (marker.povertyType === "POOR") {
            summary.poorCount += 1;
        }
        if (marker.povertyType === "NEAR_POOR") {
            summary.nearPoorCount += 1;
        }

        summaryMap.set(key, summary);
    });

    return Array.from(summaryMap.values()).sort((left, right) => {
        if (right.totalCount !== left.totalCount) {
            return right.totalCount - left.totalCount;
        }

        return left.areaName.localeCompare(right.areaName, "vi");
    });
};

export const filterPovertyMarkersBySelectedArea = (
    markers: PovertyMarker[],
    selectedAreaKey?: string | null
): PovertyMarker[] => {
    const areaKey = String(selectedAreaKey ?? "").trim();
    if (!areaKey) {
        return markers;
    }

    return markers.filter((marker) => buildPovertyMapAreaKey(marker) === areaKey);
};

const toPovertyMapRegionName = (value?: string | null): string | undefined => {
    const text = String(value ?? "").trim();
    if (!text) return undefined;

    return text
        .replace(/^(phường|phuong|xã|xa|thị trấn|thi tran|thị xã|thi xa)\s+/iu, "")
        .trim() || undefined;
};

export const resolvePovertyDashboardSelectedWardName = (input: {
    selectedWardCode?: string | null;
    wardOptions?: Array<{ code: string; name: string; fullName?: string | null }>;
    markerWardNames?: Array<string | null | undefined>;
}): string | undefined => {
    const selectedWardCode = String(input.selectedWardCode ?? "").trim();
    const wardOptions = input.wardOptions ?? [];

    if (selectedWardCode) {
        const matchedWard = wardOptions.find((item) => item.code === selectedWardCode);
        if (matchedWard) {
            return toPovertyMapRegionName(matchedWard.fullName) || toPovertyMapRegionName(matchedWard.name);
        }
    }

    const uniqueWardNames = Array.from(
        new Set(
            (input.markerWardNames ?? [])
                .map((item) => toPovertyMapRegionName(item))
                .filter(Boolean)
        )
    );

    return uniqueWardNames.length === 1 ? uniqueWardNames[0] : undefined;
};

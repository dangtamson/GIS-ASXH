import type { PublicPovertyMarker } from "@/types/poverty";
import type { FeatureCollection, Geometry } from "geojson";

export function buildPovertyWardPublicUrl(slug: string, origin = ""): string {
    const normalizedOrigin = origin.replace(/\/$/, "");
    return `${normalizedOrigin}/ban-do-ho-ngheo-cong-khai/${encodeURIComponent(slug)}`;
}

const slugifyPublicSegment = (value: string): string =>
    value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

const normalizePublicBoundaryName = (value?: string | null): string =>
    String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/^(thanh pho|thi xa|thi tran|phuong|xa|quan|huyen)\s+/i, "")
        .trim();

export function buildPublicAreaSlug(areaName: string, areaId: string): string {
    const nameSegment = slugifyPublicSegment(areaName || "khu-vuc");
    const suffix = areaId.slice(0, 8).toLowerCase();
    return `${nameSegment || "khu-vuc"}--${suffix}`;
}

export function buildPublicWardBoundaryGeoJson<TProperties extends { name?: string | null }>(
    source: FeatureCollection<Geometry, TProperties>,
    wardName?: string | null
): FeatureCollection<Geometry, TProperties> | null {
    const normalizedWardName = normalizePublicBoundaryName(wardName);
    if (!normalizedWardName) return null;

    const features = source.features.filter((feature) => {
        const featureName = normalizePublicBoundaryName(feature.properties?.name);
        return featureName === normalizedWardName;
    });

    if (features.length === 0) return null;

    return {
        type: "FeatureCollection",
        features,
    };
}

export function buildPublicPovertyAreaDetailUrl(slug: string, areaSlug: string, origin = ""): string {
    const normalizedOrigin = origin.replace(/\/$/, "");
    return `${normalizedOrigin}/ban-do-ho-ngheo-cong-khai/${encodeURIComponent(slug)}/khu-vuc/${encodeURIComponent(areaSlug)}`;
}

export function buildPublicWardMapTitle(wardName: string): string {
    return `Bản đồ số hộ nghèo ${wardName}`;
}

export function buildPublicWardHouseholdListDescription(): string {
    return "Tổng hợp các hộ trong xã/phường công khai.";
}

export function getPublicBaseLayerLabel(
    layerKey: "streets" | "satellite" | "hybrid",
    variant: "full" | "compact" = "full"
): string {
    if (layerKey === "satellite") return "Vệ tinh";
    if (layerKey === "hybrid") return "Hybrid";
    return variant === "compact" ? "Đường" : "Đường phố";
}

export function getPublicMapHeightClass(view: "ward" | "area" | "household"): string {
    if (view === "area") return "h-[480px] md:h-[460px]";
    if (view === "household") return "h-[420px] md:h-[380px]";
    return "h-[560px] md:h-[620px]";
}

export function getPublicClusterInteractionOptions() {
    return {
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: false,
        zoomToBoundsOnClick: false,
        maxClusterRadius: 46,
        disableClusteringAtZoom: 18,
    } as const;
}

export function getPublicMapFitBoundsOptions() {
    return {
        padding: [48, 48] as [number, number],
        maxZoom: 17,
        animate: false,
    } as const;
}

export const PUBLIC_MAP_INITIAL_LOADER_MIN_MS = 900;
export const PUBLIC_MAP_INITIAL_LOADER_EXIT_MS = 300;

type PublicMapHeroLoaderVisibilityInput = {
    loading: boolean;
    hasLoadedOnce: boolean;
    hasData: boolean;
    hasError: boolean;
    minimumDelayReached: boolean;
    isExitAnimating: boolean;
};

type PublicMapHeroLoaderExitInput = {
    loading: boolean;
    hasLoadedOnce: boolean;
    hasData: boolean;
    hasError: boolean;
    minimumDelayReached: boolean;
};

export function shouldShowPublicMapHeroLoader(input: PublicMapHeroLoaderVisibilityInput): boolean {
    if (input.hasLoadedOnce) {
        return false;
    }

    if (input.hasError && !input.hasData) {
        return false;
    }

    if (input.isExitAnimating) {
        return true;
    }

    if (input.loading) {
        return true;
    }

    return input.hasData && !input.minimumDelayReached;
}

export function shouldStartPublicMapHeroLoaderExit(input: PublicMapHeroLoaderExitInput): boolean {
    if (input.hasLoadedOnce) {
        return false;
    }

    if (input.loading) {
        return false;
    }

    if (input.hasError) {
        return false;
    }

    if (!input.hasData) {
        return false;
    }

    return input.minimumDelayReached;
}

export type PublicPovertyAreaSummary = {
    areaId: string | null;
    areaName: string;
    totalCount: number;
    poorCount: number;
    nearPoorCount: number;
};

type FilterPublicPovertyMarkersInput = {
    search: string;
    activeAreaId: string | null;
    povertyFilter: "ALL" | "POOR" | "NEAR_POOR" | "NONE";
};

export function buildPublicPovertyAreaSummaries(markers: PublicPovertyMarker[]): PublicPovertyAreaSummary[] {
    const grouped = new Map<string, PublicPovertyAreaSummary>();

    markers.forEach((marker) => {
        const key = marker.areaId ?? `name:${marker.areaName ?? "Chua xac dinh"}`;
        const current = grouped.get(key) ?? {
            areaId: marker.areaId ?? null,
            areaName: marker.areaName ?? "Chua xac dinh",
            totalCount: 0,
            poorCount: 0,
            nearPoorCount: 0,
        };

        current.totalCount += 1;
        if (marker.povertyType === "POOR") current.poorCount += 1;
        if (marker.povertyType === "NEAR_POOR") current.nearPoorCount += 1;
        grouped.set(key, current);
    });

    return [...grouped.values()].sort((a, b) => {
        if (b.totalCount !== a.totalCount) return b.totalCount - a.totalCount;
        return a.areaName.localeCompare(b.areaName, "vi");
    });
}

export function filterPublicPovertyMarkers(
    markers: PublicPovertyMarker[],
    input: FilterPublicPovertyMarkersInput
): PublicPovertyMarker[] {
    const normalizedSearch = input.search.trim().toLowerCase();

    return markers.filter((marker) => {
        if (input.activeAreaId && marker.areaId !== input.activeAreaId) return false;
        if (input.povertyFilter !== "ALL" && marker.povertyType !== input.povertyFilter) return false;
        if (!normalizedSearch) return true;

        const haystack = [
            marker.headFullName,
            marker.code,
            marker.areaName,
            marker.wardName,
            marker.address,
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        return haystack.includes(normalizedSearch);
    });
}

export function buildPublicPovertyHouseholdDetailUrl(slug: string, householdId: string, origin = ""): string {
    const normalizedOrigin = origin.replace(/\/$/, "");
    return `${normalizedOrigin}/ban-do-ho-ngheo-cong-khai/${encodeURIComponent(slug)}/ho/${encodeURIComponent(householdId)}`;
}

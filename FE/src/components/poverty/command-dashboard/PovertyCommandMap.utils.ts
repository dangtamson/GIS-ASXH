const normalizeCommandMapKey = (value?: string | null): string =>
    String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

const cleanMergedRegionName = (value?: string | null): string | undefined => {
    const text = String(value ?? "")
        .replace(/\s*\([^)]*\)\s*/g, "")
        .trim();

    return text || undefined;
};

export const getCommandMapFeatureAliases = (feature: {
    name?: string | null;
    mergedFrom?: string | null;
}): string[] => {
    const aliases = new Set<string>();

    const primaryName = cleanMergedRegionName(feature.name);
    if (primaryName) {
        aliases.add(primaryName);
    }

    String(feature.mergedFrom ?? "")
        .split(",")
        .map((item) => cleanMergedRegionName(item))
        .filter(Boolean)
        .forEach((item) => aliases.add(String(item)));

    return [...aliases];
};

export const doesCommandMapFeatureMatchSelection = (
    feature: { name?: string | null; mergedFrom?: string | null },
    selectedRegionName?: string | null
): boolean => {
    const selectedKey = normalizeCommandMapKey(selectedRegionName);
    if (!selectedKey) return false;

    return getCommandMapFeatureAliases(feature)
        .some((alias) => normalizeCommandMapKey(alias) === selectedKey);
};

export const filterCommandMapItemsBySelection = <T extends { name?: string | null; mergedFrom?: string | null }>(
    items: T[],
    selectedRegionName?: string | null
): T[] => {
    const selectedKey = normalizeCommandMapKey(selectedRegionName);
    if (!selectedKey) return items;

    const matchedItems = items.filter((item) => doesCommandMapFeatureMatchSelection(item, selectedRegionName));
    return matchedItems.length > 0 ? matchedItems : items;
};

export const filterCommandMapMarkersBySelection = <T extends { wardName?: string | null; areaName?: string | null }>(
    markers: T[],
    selectedRegionName?: string | null
): T[] => {
    const selectedKey = normalizeCommandMapKey(selectedRegionName);
    if (!selectedKey) return markers;

    const matchedMarkers = markers.filter((marker) =>
        [marker.wardName, marker.areaName].some((value) => normalizeCommandMapKey(value) === selectedKey)
    );

    return matchedMarkers.length > 0 ? matchedMarkers : markers;
};

export type CommandMapHeatmapPoint = {
    id: string;
    x: number;
    y: number;
    value: number;
    povertyType: string | null | undefined;
};

export const buildCommandMapHeatmapPoints = <
    T extends {
        id?: string | number | null;
        latitude?: number | string | null;
        longitude?: number | string | null;
        povertyType?: string | null;
        heatValue?: number | null;
    },
>(
    markers: T[],
    projection: (coordinates: [number, number]) => [number, number] | null | undefined
): CommandMapHeatmapPoint[] =>
    markers.flatMap((marker) => {
        const latitude = Number(marker.latitude);
        const longitude = Number(marker.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return [];
        }

        const projected = projection([longitude, latitude]);
        if (!projected) {
            return [];
        }

        const [x, y] = projected;
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return [];
        }

        return [{
            id: String(marker.id ?? `${longitude}:${latitude}`),
            x,
            y: -y,
            value: Math.max(1, Number(marker.heatValue ?? 1)),
            povertyType: marker.povertyType,
        }];
    });

export const shouldFocusCommandMapSelection = (input: {
    selectedRegionName?: string | null;
    visibleRegionCount: number;
}): boolean => Boolean(String(input.selectedRegionName ?? "").trim()) && input.visibleRegionCount === 1;

export const getCommandMapFocusConfig = (input: {
    selectedRegionSize: number;
    fullMapSize: number;
    preferDeepFocus: boolean;
}): {
    selectedRegionScale: number;
    focusDistance: number;
    minDistance: number;
    maxDistance: number;
} => {
    const selectedRegionScale = input.selectedRegionSize > 0
        ? clamp((input.fullMapSize / input.selectedRegionSize) * (input.preferDeepFocus ? 0.78 : 0.58), input.preferDeepFocus ? 2.4 : 1.8, input.preferDeepFocus ? 9 : 7)
        : 1;
    const focusDistance = input.selectedRegionSize > 0
        ? clamp((input.selectedRegionSize * selectedRegionScale) * (input.preferDeepFocus ? 0.78 : 0.98), input.preferDeepFocus ? 28 : 42, input.preferDeepFocus ? 72 : 96)
        : 160;

    return {
        selectedRegionScale,
        focusDistance,
        minDistance: input.selectedRegionSize > 0
            ? clamp(focusDistance * (input.preferDeepFocus ? 0.38 : 0.45), input.preferDeepFocus ? 12 : 18, input.preferDeepFocus ? 30 : 44)
            : 92,
        maxDistance: input.selectedRegionSize > 0
            ? clamp(focusDistance * (input.preferDeepFocus ? 1.45 : 1.75), input.preferDeepFocus ? 54 : 88, input.preferDeepFocus ? 120 : 190)
            : 310,
    };
};

export const resolveCommandMapFeatureDisplayName = (
    feature: { name?: string | null; mergedFrom?: string | null },
    selectedRegionName?: string | null
): string => {
    const fallbackName = cleanMergedRegionName(feature.name) || "";
    const selectedName = cleanMergedRegionName(selectedRegionName);

    if (selectedName && doesCommandMapFeatureMatchSelection(feature, selectedName)) {
        return selectedName;
    }

    return fallbackName;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

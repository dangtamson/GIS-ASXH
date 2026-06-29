export type AccessibleFeature = {
    uuid: string;
    name: string;
    path: string;
    enabled: boolean;
    orderIndex?: number;
};

export function isSafeFeaturePath(path?: string | null): path is string {
    const value = String(path ?? "").trim();
    return value.startsWith("/") && !value.startsWith("//") && value !== "/";
}

export function selectDefaultFeaturePath(
    features: AccessibleFeature[],
    defaultFeatureId?: string | null
): string | null {
    const candidates = features
        .filter((feature) => feature.enabled && isSafeFeaturePath(feature.path))
        .sort((first, second) => (first.orderIndex ?? 0) - (second.orderIndex ?? 0));

    const configured = candidates.find((feature) => feature.uuid === defaultFeatureId);
    return configured?.path ?? candidates[0]?.path ?? null;
}

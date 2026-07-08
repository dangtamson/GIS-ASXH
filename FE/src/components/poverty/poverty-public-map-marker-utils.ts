import { normalizePovertyType, parseCoordinate } from "./poverty-utils.ts";

const POOR_MARKER_ICON_URL = "/images/poverty/marker-poor.png";
const NEAR_POOR_MARKER_ICON_URL = "/images/poverty/marker-near-poor.png";

function resolvePublicMarkerVariant(povertyType?: string | null): {
    markerTypeClass: string;
    iconUrl: string | null;
} {
    const normalizedType = normalizePovertyType(povertyType);

    if (normalizedType === "POOR") {
        return {
            markerTypeClass: "poverty-map-marker--poor",
            iconUrl: POOR_MARKER_ICON_URL,
        };
    }

    if (normalizedType === "NEAR_POOR") {
        return {
            markerTypeClass: "poverty-map-marker--near-poor",
            iconUrl: NEAR_POOR_MARKER_ICON_URL,
        };
    }

    return {
        markerTypeClass: "poverty-map-marker--normal",
        iconUrl: null,
    };
}

export function buildPublicMarkerIconHtml(povertyType?: string | null): string {
    const { markerTypeClass, iconUrl } = resolvePublicMarkerVariant(povertyType);
    const content = iconUrl
        ? `<img class="poverty-map-marker__image" src="${iconUrl}" alt="" />`
        : `<span class="poverty-map-marker__dot" aria-hidden="true"></span>`;

    return `
        <span class="poverty-map-marker ${markerTypeClass}">
            <span class="poverty-map-marker__pulse" aria-hidden="true"></span>
            ${content}
        </span>
    `;
}

export function formatPublicMarkerCoordinate(value: unknown): string {
    const numeric = parseCoordinate(value);
    return numeric === null ? "-" : numeric.toFixed(5);
}

export function getPublicClusterBadgeSize(count: number): number {
    if (count >= 100) return 52;
    if (count >= 10) return 46;
    return 40;
}

export function buildPublicClusterIconHtml(count: number): string {
    const size = getPublicClusterBadgeSize(count);

    return `
        <span style="
            display:flex;
            width:${size}px;
            height:${size}px;
            align-items:center;
            justify-content:center;
            border-radius:999px;
            background:#0f766e;
            border:4px solid rgba(204,251,241,.95);
            color:#fff;
            font-weight:700;
            font-size:13px;
            box-shadow:0 10px 26px rgba(15,23,42,.28);
        ">${count}</span>
    `;
}

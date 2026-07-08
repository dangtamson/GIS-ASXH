import type { HouseholdStatus, PovertyType } from "@/types/poverty";

export const povertyTypeOptions = [
    { label: "Hộ nghèo", value: "POOR" },
    { label: "Hộ cận nghèo", value: "NEAR_POOR" },
    { label: "Không còn nghèo/cận nghèo", value: "NONE" },
];

export const householdStatusOptions = [
    { label: "Hoạt động", value: "ACTIVE" },
    { label: "Ngưng", value: "INACTIVE" },
];

const normalizeToken = (value?: string | null): string =>
    String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

export function normalizePovertyType(value?: string | null): PovertyType | null {
    const raw = String(value ?? "").trim();
    const normalized = normalizeToken(raw);
    if (!normalized) return null;
    if (raw.toUpperCase() === "POOR" || ["poor", "ho ngheo", "ngheo"].includes(normalized)) return "POOR";
    if (raw.toUpperCase() === "NEAR_POOR" || ["near poor", "ho can ngheo", "can ngheo"].includes(normalized)) return "NEAR_POOR";
    if (raw.toUpperCase() === "NONE" || ["none", "khong ngheo", "khong con ngheo", "thoat ngheo", "khong thuoc dien ngheo", "khong con ngheo can ngheo"].includes(normalized)) return "NONE";
    return null;
}

export function povertyTypeLabel(value?: string | null): string {
    const normalized = normalizePovertyType(value);
    if (normalized === "POOR") return "Hộ nghèo";
    if (normalized === "NEAR_POOR") return "Hộ cận nghèo";
    if (normalized === "NONE") return "Không còn nghèo/cận nghèo";
    return value || "-";
}

export function povertyTypeColor(value?: string | null): string {
    const normalized = normalizePovertyType(value);
    if (normalized === "POOR") return "red";
    if (normalized === "NEAR_POOR") return "gold";
    if (normalized === "NONE") return "default";
    return "default";
}

export function getPublicHouseholdTheme(value?: string | null): {
    tone: "loading" | "poor" | "near-poor" | "normal";
    pageBackgroundClassName: string;
    heroClassName: string;
    surfaceClassName: string;
    surfaceIconClassName: string;
    linkClassName: string;
    badgeClassName: string;
} {
    const normalized = normalizePovertyType(value);

    if (!normalized) {
        return {
            tone: "loading",
            pageBackgroundClassName: "bg-[linear-gradient(180deg,#f8fafc_0%,#f8fbff_24%,#ffffff_100%)]",
            heroClassName:
                "border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(226,232,240,0.14),_transparent_34%),linear-gradient(135deg,_#64748b,_#94a3b8_46%,_#cbd5e1)] shadow-[0_28px_72px_rgba(148,163,184,0.12)]",
            surfaceClassName: "border-slate-200 bg-slate-50/80",
            surfaceIconClassName: "bg-white text-slate-500 shadow-sm",
            linkClassName: "!text-slate-700",
            badgeClassName: "bg-slate-100 text-slate-700",
        };
    }

    if (normalized === "POOR") {
        return {
            tone: "poor",
            pageBackgroundClassName: "bg-[linear-gradient(180deg,#fff7f8_0%,#fffaf7_22%,#ffffff_100%)]",
            heroClassName:
                "border border-rose-200/75 bg-[radial-gradient(circle_at_top_left,_rgba(251,113,133,0.18),_transparent_34%),linear-gradient(135deg,_#fb7185,_#fda4af_52%,_#fff1f2)] shadow-[0_32px_84px_rgba(251,113,133,0.14)]",
            surfaceClassName: "border-rose-100 bg-rose-50/75",
            surfaceIconClassName: "bg-white text-rose-500 shadow-sm",
            linkClassName: "!text-rose-700",
            badgeClassName: "bg-rose-50 text-rose-700",
        };
    }

    if (normalized === "NEAR_POOR") {
        return {
            tone: "near-poor",
            pageBackgroundClassName: "bg-[linear-gradient(180deg,#fffdf4_0%,#fff9ee_22%,#ffffff_100%)]",
            heroClassName:
                "border border-amber-200/75 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.2),_transparent_34%),linear-gradient(135deg,_#f59e0b,_#fbbf24_50%,_#fef3c7)] shadow-[0_32px_84px_rgba(245,158,11,0.14)]",
            surfaceClassName: "border-amber-100 bg-amber-50/75",
            surfaceIconClassName: "bg-white text-amber-600 shadow-sm",
            linkClassName: "!text-amber-700",
            badgeClassName: "bg-amber-50 text-amber-700",
        };
    }

    return {
        tone: "normal",
        pageBackgroundClassName: "bg-[linear-gradient(180deg,#eff6ff_0%,#f8fbff_22%,#ffffff_100%)]",
        heroClassName:
            "border border-sky-200/75 bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.2),_transparent_34%),linear-gradient(135deg,_#3b82f6,_#60a5fa_50%,_#dbeafe)] shadow-[0_32px_84px_rgba(59,130,246,0.14)]",
        surfaceClassName: "border-sky-100 bg-sky-50/75",
        surfaceIconClassName: "bg-white text-sky-600 shadow-sm",
        linkClassName: "!text-sky-700",
        badgeClassName: "bg-sky-50 text-sky-700",
    };
}

export function householdStatusLabel(value?: string | null): string {
    if (value === "ACTIVE") return "Hoạt động";
    if (value === "INACTIVE") return "Ngưng";
    return value || "-";
}

export function householdStatusColor(value?: string | null): string {
    if (value === "ACTIVE") return "green";
    if (value === "INACTIVE") return "default";
    return "default";
}

export function formatDate(value?: string | null): string {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("vi-VN");
}

export function formatNumber(value?: number | string | null): string {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric.toLocaleString("vi-VN") : "0";
}

export type GeoPosition = {
    latitude: number;
    longitude: number;
};

export function parseCoordinate(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "string" && value.trim() === "") return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

export function getValidGeoPosition(latitudeValue: unknown, longitudeValue: unknown): GeoPosition | null {
    const latitude = parseCoordinate(latitudeValue);
    const longitude = parseCoordinate(longitudeValue);
    if (latitude === null || longitude === null) return null;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
    return { latitude, longitude };
}

export function normalizePovertyFormValue(value?: string): PovertyType {
    if (value === "NEAR_POOR") return "NEAR_POOR";
    if (value === "NONE") return "NONE";
    return "POOR";
}

export function normalizeStatusFormValue(value?: string): HouseholdStatus {
    return value === "INACTIVE" ? "INACTIVE" : "ACTIVE";
}

export function downloadBase64File(fileName: string, mimeType: string, fileContentBase64: string): void {
    const link = document.createElement("a");
    link.href = `data:${mimeType};base64,${fileContentBase64}`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
}

export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || "");
            const commaIndex = result.indexOf(",");
            resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
        };
        reader.onerror = () => reject(new Error("Không thể đọc file."));
        reader.readAsDataURL(file);
    });
}

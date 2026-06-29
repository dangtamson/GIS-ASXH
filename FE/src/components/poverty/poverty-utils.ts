import type {HouseholdStatus, PovertyType} from "@/types/poverty";

export const povertyTypeOptions = [
    {label: "Hộ nghèo", value: "POOR"},
    {label: "Hộ cận nghèo", value: "NEAR_POOR"},
    {label: "Không còn nghèo/cận nghèo", value: "NONE"},
];

export const householdStatusOptions = [
    {label: "Hoạt động", value: "ACTIVE"},
    {label: "Ngưng", value: "INACTIVE"},
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
    return {latitude, longitude};
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

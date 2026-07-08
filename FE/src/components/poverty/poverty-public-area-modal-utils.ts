import type { PublicPovertyAreaDetailResponse } from "@/types/poverty";

export type PublicAreaAdministrativeItem = {
    label: string;
    value: string;
};

export type PublicAreaAdministrativeSection = {
    key: string;
    title: string;
    description: string;
    items: PublicAreaAdministrativeItem[];
};

const EMPTY_VALUE = "Chưa cập nhật";

function formatValue(value?: string | null): string {
    const normalized = String(value ?? "").trim();
    return normalized || EMPTY_VALUE;
}

function formatNaturalArea(value?: number | null): string {
    if (value === null || value === undefined) return EMPTY_VALUE;
    return `${value} ha`;
}

export function buildPublicAreaAdministrativeSections(
    area: PublicPovertyAreaDetailResponse["area"] | null | undefined
): PublicAreaAdministrativeSection[] {
    return [
        {
            key: "personnel",
            title: "Nhân sự phụ trách",
            description: "Thông tin đầu mối điều hành và liên hệ tại khu vực công khai.",
            items: [
                { label: "Bí thư", value: formatValue(area?.secretaryName) },
                { label: "Số điện thoại bí thư", value: formatValue(area?.secretaryPhone) },
                { label: "Trưởng ấp", value: formatValue(area?.hamletHeadName) },
                { label: "Số điện thoại trưởng ấp", value: formatValue(area?.hamletHeadPhone) },
                { label: "Tổ trưởng TANTTCS", value: formatValue(area?.securityTeamLeaderName) },
                { label: "Số điện thoại Tổ trưởng TANTTCS", value: formatValue(area?.securityTeamLeaderPhone) },
            ],
        }
    ];
}

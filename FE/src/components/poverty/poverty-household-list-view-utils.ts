import type { MenuProps } from "antd";
import type { PoorHousehold } from "@/types/poverty";

type HouseholdAreaFields = Pick<PoorHousehold, "provinceName" | "wardName" | "areaName">;
type HouseholdGridActionKey = "view" | "edit" | "more";

export function buildHouseholdAreaLabel(item: HouseholdAreaFields): string {
    const parts = [item.provinceName, item.wardName, item.areaName]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean);

    return parts.length > 0 ? parts.join(" / ") : "-";
}

export function hasDropdownActions(items: MenuProps["items"] | undefined): boolean {
    return Array.isArray(items) && items.length > 0;
}

export function getHouseholdGridActionAriaLabel(action: HouseholdGridActionKey): string {
    if (action === "view") return "Xem chi tiết hộ";
    if (action === "edit") return "Sửa thông tin hộ";
    return "Mở thêm thao tác";
}

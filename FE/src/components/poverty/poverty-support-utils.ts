import type { HouseholdSupport, HouseholdSupportType } from "@/types/poverty";

export const supportTypeOptions: { label: string; value: HouseholdSupportType }[] = [
    { label: "Nhà cửa", value: "HOUSING" },
    { label: "Tiền mặt", value: "CASH" },
    { label: "Y tế", value: "HEALTHCARE" },
    { label: "Giáo dục", value: "EDUCATION" },
    { label: "Lương thực", value: "FOOD" },
    { label: "Khác", value: "OTHER" },
];

export const supportTypeLabel = (value?: string | null) =>
    supportTypeOptions.find((item) => item.value === value)?.label ?? value ?? "-";

export const getSupportTotalAmount = (support: Pick<HouseholdSupport, "amounts">) =>
    Object.values(support.amounts ?? {}).reduce<number>((total, value) => {
        const amount = Number(value);
        return Number.isFinite(amount) ? total + amount : total;
    }, 0);

export const formatCurrency = (value?: number | null) =>
    Number(value ?? 0).toLocaleString("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

export const sortHouseholdSupports = (supports: HouseholdSupport[]) =>
    [...supports].sort((a, b) => {
        const dateDiff = new Date(a.supportDate ?? 0).getTime() - new Date(b.supportDate ?? 0).getTime();
        if (dateDiff !== 0) return dateDiff;
        return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
    });

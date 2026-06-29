import { STATUS_COLOR_STYLE_MAP, STATUS_OPTIONS } from "@/lib/task-options";
import type { CSSProperties } from "react";

type ResolveDisplayStatusOptions = {
    issuedDate?: string | null;
    startDate?: string | null;
};

type EvaluationMeta = {
    label: string;
    style: CSSProperties;
};

type DisplayStatusMeta = {
    value: string;
    label: string;
    style: CSSProperties;
};

const DEFAULT_STATUS_STYLE: CSSProperties = {
    backgroundColor: "#f3f4f6",
    color: "#374151",
};

export function resolveDisplayStatus(
    rawStatus?: string,
    options: ResolveDisplayStatusOptions = {}
): DisplayStatusMeta {
    let value = rawStatus?.trim() || "new";

    if (value === "new" && options.issuedDate && !options.startDate) {
        value = "not_received";
    } else if (value === "new" && options.issuedDate) {
        value = "issued";
    }

    const label = STATUS_OPTIONS.find((item) => item.value === value)?.label ?? value;

    return {
        value,
        label,
        style: STATUS_COLOR_STYLE_MAP[value] ?? DEFAULT_STATUS_STYLE,
    };
}

export function resolveEvaluationMeta(status?: string): EvaluationMeta {
    switch (status) {
        case "approved":
            return {
                label: "Đạt",
                style: { backgroundColor: "#dcfce7", color: "#15803d" },
            };
        case "rejected":
            return {
                label: "Chưa đạt",
                style: { backgroundColor: "#ffe4e6", color: "#be123c" },
            };
        case "pending":
            return {
                label: "Chờ đánh giá",
                style: { backgroundColor: "#fef3c7", color: "#b45309" },
            };
        default:
            return {
                label: "Chưa gửi đánh giá",
                style: DEFAULT_STATUS_STYLE,
            };
    }
}

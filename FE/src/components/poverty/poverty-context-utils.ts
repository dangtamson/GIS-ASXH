type ContextHistoryLike = {
    recordedAt: string;
    createdAt?: string | null;
};

export type HouseholdContextCardThemeKey = "familySituation" | "currentStatus";
export type HouseholdSummaryCardThemeKey = "owner" | "members" | "location";

type HouseholdContextCardTheme = {
    cardClassName: string;
    iconClassName: string;
    labelClassName: string;
    textClassName: string;
};

export function sortHouseholdContextHistoriesLatestFirst<T extends ContextHistoryLike>(items: T[]): T[] {
    return [...items].sort((left, right) => {
        const recordedDiff = new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime();
        if (recordedDiff !== 0) return recordedDiff;
        return new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime();
    });
}

export function getLatestHouseholdContextHistory<T extends ContextHistoryLike>(items: T[]): T | null {
    return sortHouseholdContextHistoriesLatestFirst(items)[0] ?? null;
}

export function resolveLatestHouseholdContextHistory<T extends ContextHistoryLike>(
    latestItem?: T | null,
    items?: T[] | null,
): T | null {
    if (latestItem) return latestItem;
    return getLatestHouseholdContextHistory(items ?? []);
}

export function getHouseholdContextCardTheme(section: HouseholdContextCardThemeKey): HouseholdContextCardTheme {
    if (section === "familySituation") {
        return {
            cardClassName: "border border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-white",
            iconClassName: "bg-white text-amber-700 ring-1 ring-amber-200",
            labelClassName: "text-amber-700",
            textClassName: "text-slate-800",
        };
    }

    return {
        cardClassName: "border border-emerald-200 bg-gradient-to-br from-emerald-50 via-teal-50 to-white",
        iconClassName: "bg-white text-emerald-700 ring-1 ring-emerald-200",
        labelClassName: "text-emerald-700",
        textClassName: "text-slate-800",
    };
}

export function getHouseholdSummaryCardTheme(section: HouseholdSummaryCardThemeKey): HouseholdContextCardTheme {
    if (section === "owner") {
        return {
            cardClassName: "border border-blue-200 bg-gradient-to-br from-blue-50 via-indigo-50 to-white",
            iconClassName: "bg-white text-blue-700 ring-1 ring-blue-200",
            labelClassName: "text-blue-700",
            textClassName: "text-slate-800",
        };
    }

    if (section === "members") {
        return {
            cardClassName: "border border-violet-200 bg-gradient-to-br from-violet-50 via-fuchsia-50 to-white",
            iconClassName: "bg-white text-violet-700 ring-1 ring-violet-200",
            labelClassName: "text-violet-700",
            textClassName: "text-slate-800",
        };
    }

    return {
        cardClassName: "border border-sky-200 bg-gradient-to-br from-sky-50 via-cyan-50 to-white",
        iconClassName: "bg-white text-sky-700 ring-1 ring-sky-200",
        labelClassName: "text-sky-700",
        textClassName: "text-slate-800",
    };
}

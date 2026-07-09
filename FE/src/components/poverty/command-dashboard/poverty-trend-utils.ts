import type { PovertyDashboard } from "@/types/poverty";

type YearlyTrendPoint = NonNullable<PovertyDashboard["yearlyTrend"]>[number];
type MonthlyTrendYear = NonNullable<PovertyDashboard["monthlyTrendByYear"]>[number];
type MonthlyTrendPoint = MonthlyTrendYear["months"][number];

export type DashboardTrendMode = "yearly" | "monthly";

export const MONTH_LABELS = Array.from({ length: 12 }, (_, index) => `T${index + 1}`);

export const resolveDefaultDashboardTrendYear = (
    availableYears?: number[],
    monthlyTrendByYear?: MonthlyTrendYear[]
): number | undefined => {
    const years = (availableYears && availableYears.length > 0
        ? availableYears
        : (monthlyTrendByYear ?? []).map((item) => item.year)
    )
        .filter((year): year is number => Number.isInteger(year))
        .sort((left, right) => left - right);

    return years.at(-1);
};

export const buildYearlyDashboardTrendPoints = (
    data?: YearlyTrendPoint[]
): YearlyTrendPoint[] => [...(data ?? [])].sort((left, right) => left.year - right.year);

export const buildMonthlyDashboardTrendPoints = (
    data: MonthlyTrendYear[] | undefined,
    selectedYear?: number
): { year?: number; points: MonthlyTrendPoint[] } => {
    if (!data || data.length === 0) {
        return { year: selectedYear, points: [] };
    }

    const fallbackYear = resolveDefaultDashboardTrendYear(undefined, data);
    const activeYear = selectedYear && data.some((item) => item.year === selectedYear) ? selectedYear : fallbackYear;
    const activeYearData = data.find((item) => item.year === activeYear);

    if (!activeYearData) {
        return { year: activeYear, points: [] };
    }

    const pointsByMonth = new Map(activeYearData.months.map((item) => [item.month, item]));
    const points = Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        const point = pointsByMonth.get(month);

        return {
            month,
            poor: Number(point?.poor ?? 0),
            nearPoor: Number(point?.nearPoor ?? 0),
            total: Number(point?.total ?? 0),
        };
    });

    return { year: activeYear, points };
};

export const calculateDashboardTrendChangePercent = (values: number[]): number => {
    if (values.length <= 1) return 0;

    const firstValue = values[0] ?? 0;
    const lastValue = values[values.length - 1] ?? 0;

    if (firstValue === 0) {
        return 0;
    }

    return Number((((lastValue - firstValue) / firstValue) * 100).toFixed(1));
};

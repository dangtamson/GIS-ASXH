"use client";

import type { PovertyMarker } from "@/types/poverty";
import { Empty } from "antd";
import dynamic from "next/dynamic";
import { useMemo } from "react";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
    ssr: false,
    loading: () => <div className="h-[220px] animate-pulse bg-white/50" />,
});

type SupportSummaryPanelProps = {
    markers: PovertyMarker[];
};

const formatCurrencyVnd = (value: number) =>
    new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
    }).format(Number.isFinite(value) ? value : 0);

const getHouseholdLabel = (marker: PovertyMarker | null) => {
    if (!marker) return "-";
    return marker.code || marker.headFullName || `Hộ #${marker.id}`;
};

const formatSupportDateLabel = (dateText?: string | null) => {
    if (!dateText) return "Chưa có dữ liệu";
    const date = new Date(dateText);
    if (Number.isNaN(date.getTime())) return "Chưa có dữ liệu";
    return date.toLocaleDateString("vi-VN");
};

export default function SupportSummaryPanel({ markers }: SupportSummaryPanelProps) {
    const supportInsights = useMemo(() => {
        const supportedMarkers = markers.filter(
            (item) => Number(item.supportCount ?? 0) > 0 || Number(item.supportTotalAmount ?? 0) > 0
        );
        const markersWithSupportDate = supportedMarkers.filter((item) => {
            const parsed = Date.parse(String(item.latestSupportDate ?? ""));
            return Number.isFinite(parsed);
        });

        const latestTimestamp = markersWithSupportDate.reduce<number | null>((currentMax, item) => {
            const parsed = Date.parse(String(item.latestSupportDate));
            if (!Number.isFinite(parsed)) return currentMax;
            if (currentMax == null || parsed > currentMax) return parsed;
            return currentMax;
        }, null);

        const latestMonthKey = latestTimestamp != null ? new Date(latestTimestamp).toISOString().slice(0, 7) : null;
        const latestMonthMarkers = latestMonthKey
            ? markersWithSupportDate.filter((item) => String(item.latestSupportDate).slice(0, 7) === latestMonthKey)
            : [];
        const latestMonthTotalAmount = latestMonthMarkers.reduce(
            (sum, item) => sum + Number(item.latestSupportMonthAmount ?? 0),
            0
        );

        const mostSupportedHousehold = supportedMarkers.reduce<PovertyMarker | null>((currentMax, item) => {
            if (!currentMax) return item;
            const currentAmount = Number(currentMax.supportTotalAmount ?? 0);
            const itemAmount = Number(item.supportTotalAmount ?? 0);
            if (itemAmount > currentAmount) return item;
            if (itemAmount === currentAmount && Number(item.supportCount ?? 0) > Number(currentMax.supportCount ?? 0)) {
                return item;
            }
            return currentMax;
        }, null);

        const leastSupportedHousehold = supportedMarkers.reduce<PovertyMarker | null>((currentMin, item) => {
            if (!currentMin) return item;
            const currentAmount = Number(currentMin.supportTotalAmount ?? 0);
            const itemAmount = Number(item.supportTotalAmount ?? 0);
            if (itemAmount < currentAmount) return item;
            if (itemAmount === currentAmount && Number(item.supportCount ?? 0) < Number(currentMin.supportCount ?? 0)) {
                return item;
            }
            return currentMin;
        }, null);

        const longestNoSupportHousehold = markersWithSupportDate.reduce<PovertyMarker | null>((oldest, item) => {
            if (!oldest) return item;
            const oldestTime = Date.parse(String(oldest.latestSupportDate));
            const itemTime = Date.parse(String(item.latestSupportDate));
            if (!Number.isFinite(oldestTime) || (Number.isFinite(itemTime) && itemTime < oldestTime)) {
                return item;
            }
            return oldest;
        }, null);

        const longestNoSupportDays = longestNoSupportHousehold?.latestSupportDate
            ? Math.max(
                0,
                Math.floor(
                    (Date.now() - Date.parse(String(longestNoSupportHousehold.latestSupportDate))) /
                    (1000 * 60 * 60 * 24)
                )
            )
            : null;

        const monthlyData = new Map<string, { count: number; amount: number }>();
        supportedMarkers.forEach((marker) => {
            const monthKey = String(marker.latestSupportDate ?? "").slice(0, 7);
            if (!monthKey || monthKey.length !== 7) return;
            const existing = monthlyData.get(monthKey) ?? { count: 0, amount: 0 };
            existing.count += 1;
            existing.amount += Number(marker.latestSupportMonthAmount ?? 0);
            monthlyData.set(monthKey, existing);
        });

        const sortedMonths = Array.from(monthlyData.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-6);

        return {
            latestMonthKey,
            latestMonthTotalAmount,
            latestMonthSupportedCount: latestMonthMarkers.length,
            mostSupportedHousehold,
            leastSupportedHousehold,
            longestNoSupportHousehold,
            longestNoSupportDays,
            sortedMonths,
            supportedCount: supportedMarkers.length,
            unsupportedCount: Math.max(0, markers.length - supportedMarkers.length),
        };
    }, [markers]);

    const chartData = useMemo(() => {
        const series = [
            {
                name: "Hộ được hỗ trợ",
                data: supportInsights.sortedMonths.map(([, data]) => data.count),
            },
            {
                name: "Kinh phí (triệu đ)",
                data: supportInsights.sortedMonths.map(([, data]) => Math.round(data.amount / 1000000)),
            },
        ];

        const categories = supportInsights.sortedMonths.map(([month]) => {
            const [year, m] = month.split("-");
            return `T${m}/${year}`;
        });

        return { series, categories };
    }, [supportInsights]);

    const supportRate = markers.length > 0 ? Math.round((supportInsights.supportedCount / markers.length) * 100) : 0;
    const latestMonthLabel = supportInsights.latestMonthKey
        ? `Tháng ${supportInsights.latestMonthKey.slice(5)}/${supportInsights.latestMonthKey.slice(0, 4)}`
        : "Chưa có dữ liệu";

    return (
        <div className="space-y-3">
            <div className="rounded-xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-4 shadow-md shadow-emerald-900/10">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Tổng quan hỗ trợ</p>
                <div className="mt-2 flex items-end justify-between gap-3">
                    <div>
                        <p className="text-3xl font-bold leading-none text-emerald-700">{supportInsights.supportedCount.toLocaleString("vi-VN")}</p>
                        <p className="mt-1 text-xs text-emerald-800/80">hộ đã được hỗ trợ</p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">{supportRate}%</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-white/80 p-2.5 ring-1 ring-emerald-100">
                        <p className="text-[11px] text-gray-500">Tổng hộ theo dõi</p>
                        <p className="mt-1 text-sm font-semibold text-gray-800">{markers.length.toLocaleString("vi-VN")}</p>
                    </div>
                    <div className="rounded-lg bg-white/80 p-2.5 ring-1 ring-rose-100">
                        <p className="text-[11px] text-gray-500">Chưa hỗ trợ</p>
                        <p className="mt-1 text-sm font-semibold text-rose-700">{supportInsights.unsupportedCount.toLocaleString("vi-VN")}</p>
                    </div>
                </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-cyan-200/70 bg-gradient-to-br from-cyan-50 via-white to-amber-50 p-4 shadow-lg shadow-cyan-900/10 backdrop-blur">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">Tình hình hỗ trợ</h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 text-[11px] font-medium text-cyan-700 ring-1 ring-cyan-100">
                        <span className="h-2 w-2 rounded-full bg-cyan-500" />
                        Xu hướng 6 tháng
                    </span>
                </div>
                {supportInsights.sortedMonths.length > 0 ? (
                    <div className="mt-3">
                        <ReactApexChart
                            type="line"
                            series={chartData.series}
                            options={{
                                chart: {
                                    type: "line",
                                    height: 200,
                                    sparkline: { enabled: false },
                                    toolbar: { show: false },
                                },
                                stroke: {
                                    curve: "smooth",
                                    width: [3, 3],
                                },
                                markers: {
                                    size: 4,
                                    strokeWidth: 0,
                                    hover: { size: 6 },
                                },
                                dataLabels: {
                                    enabled: false,
                                },
                                xaxis: {
                                    categories: chartData.categories,
                                    labels: {
                                        style: { colors: "#6b7280", fontSize: 11 },
                                    },
                                },
                                yaxis: [
                                    {
                                        title: { text: "Số hộ", style: { fontSize: "11px", color: "#6b7280" } },
                                        labels: { style: { colors: "#6b7280", fontSize: "11px" } },
                                    },
                                    {
                                        opposite: true,
                                        title: { text: "Kinh phí (triệu đ)", style: { fontSize: "11px", color: "#6b7280" } },
                                        labels: { style: { colors: "#6b7280", fontSize: "11px" } },
                                    },
                                ],
                                colors: ["#06b6d4", "#f59e0b"],
                                legend: {
                                    fontSize: "11px",
                                    position: "bottom" as const,
                                    labels: { colors: "#6b7280" },
                                },
                                tooltip: {
                                    shared: true,
                                    intersect: false,
                                },
                                grid: {
                                    borderColor: "#e5e7eb",
                                    padding: { left: 8, right: 8, top: 0, bottom: 0 },
                                },
                            } as any}
                            height={240}
                        />
                    </div>
                ) : (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="Chưa có dữ liệu hỗ trợ"
                        style={{ marginTop: 16 }}
                    />
                )}
            </div>

            <div className="grid grid-cols-1 gap-3">


                <div className="rounded-xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-4 shadow-md shadow-amber-900/10">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Tháng hỗ trợ gần nhất</p>
                    <p className="mt-2 text-base font-semibold text-amber-900">{latestMonthLabel}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-white/80 p-2.5 ring-1 ring-amber-100">
                            <p className="text-[11px] text-gray-500">Số hộ trong tháng</p>
                            <p className="mt-1 text-sm font-semibold text-amber-700">{supportInsights.latestMonthSupportedCount.toLocaleString("vi-VN")}</p>
                        </div>
                        <div className="rounded-lg bg-white/80 p-2.5 ring-1 ring-orange-100">
                            <p className="text-[11px] text-gray-500">Kinh phí tháng</p>
                            <p className="mt-1 text-sm font-semibold text-orange-700">{formatCurrencyVnd(supportInsights.latestMonthTotalAmount)}</p>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-sky-200/70 bg-gradient-to-br from-sky-50 via-white to-blue-50 p-4 shadow-md shadow-sky-900/10">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">Hộ nổi bật</p>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className="rounded-lg bg-white/80 p-2.5 ring-1 ring-sky-100">
                            <p className="text-[11px] text-gray-500">Hỗ trợ nhiều nhất</p>
                            <p className="mt-1 line-clamp-1 text-sm font-semibold text-gray-900">{getHouseholdLabel(supportInsights.mostSupportedHousehold)}</p>
                            <p className="mt-1 text-xs text-sky-700">{formatCurrencyVnd(Number(supportInsights.mostSupportedHousehold?.supportTotalAmount ?? 0))}</p>
                        </div>
                        <div className="rounded-lg bg-white/80 p-2.5 ring-1 ring-indigo-100">
                            <p className="text-[11px] text-gray-500">Hỗ trợ ít nhất</p>
                            <p className="mt-1 line-clamp-1 text-sm font-semibold text-gray-900">{getHouseholdLabel(supportInsights.leastSupportedHousehold)}</p>
                            <p className="mt-1 text-xs text-indigo-700">{formatCurrencyVnd(Number(supportInsights.leastSupportedHousehold?.supportTotalAmount ?? 0))}</p>
                        </div>
                        <div className="rounded-lg bg-white/80 p-2.5 ring-1 ring-rose-100">
                            <p className="text-[11px] text-gray-500">Lâu chưa hỗ trợ</p>
                            <p className="mt-1 line-clamp-1 text-sm font-semibold text-gray-900">{getHouseholdLabel(supportInsights.longestNoSupportHousehold)}</p>
                            <p className="mt-1 text-xs text-rose-700">
                                {formatSupportDateLabel(supportInsights.longestNoSupportHousehold?.latestSupportDate)}
                                {supportInsights.longestNoSupportDays != null ? ` • ${supportInsights.longestNoSupportDays} ngày` : ""}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

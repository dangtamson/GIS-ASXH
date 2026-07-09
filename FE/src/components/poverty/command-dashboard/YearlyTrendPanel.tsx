"use client";

import { formatNumber } from "@/components/poverty/poverty-utils";
import type { PovertyDashboard } from "@/types/poverty";
import { ConfigProvider, Select, Segmented } from "antd";
import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import {
    MONTH_LABELS,
    type DashboardTrendMode,
    buildMonthlyDashboardTrendPoints,
    buildYearlyDashboardTrendPoints,
    calculateDashboardTrendChangePercent,
} from "./poverty-trend-utils";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
    ssr: false,
    loading: () => <div className="h-[200px] animate-pulse bg-white/50" />,
});

interface YearlyTrendPanelProps {
    yearlyData?: PovertyDashboard["yearlyTrend"];
    monthlyData?: PovertyDashboard["monthlyTrendByYear"];
    availableYears?: number[];
    mode: DashboardTrendMode;
    onModeChange: (mode: DashboardTrendMode) => void;
    selectedYear?: number;
    onSelectedYearChange: (year: number) => void;
    className?: string;
}

export default function YearlyTrendPanel({
    yearlyData = [],
    monthlyData = [],
    availableYears = [],
    mode,
    onModeChange,
    selectedYear,
    onSelectedYearChange,
    className = "",
}: YearlyTrendPanelProps) {
    const yearOptions = useMemo(
        () => {
            const years = availableYears.length > 0
                ? availableYears
                : monthlyData.map((item) => item.year);

            return [...new Set(years)]
                .sort((left, right) => right - left)
                .map((year) => ({ value: year, label: `Năm ${year}` }));
        },
        [availableYears, monthlyData],
    );

    const trendData = useMemo(() => {
        if (mode === "monthly") {
            const monthlyPoints = buildMonthlyDashboardTrendPoints(monthlyData, selectedYear);
            const activeYear = monthlyPoints.year;
            const latestMonthWithData = [...monthlyPoints.points].reverse().find((item) => item.total > 0);
            const poorSeries = monthlyPoints.points.map((item) => item.poor);
            const nearPoorSeries = monthlyPoints.points.map((item) => item.nearPoor);
            const totalSeries = monthlyPoints.points.map((item) => item.total);

            return {
                hasData: monthlyPoints.points.some((item) => item.total > 0),
                title: "Biến động theo tháng",
                emptyMessage: activeYear ? `Chưa có dữ liệu theo tháng cho năm ${activeYear}` : "Chưa có dữ liệu theo tháng",
                categories: MONTH_LABELS,
                poorSeries,
                nearPoorSeries,
                totalSeries,
                latestLabel: latestMonthWithData && activeYear ? `Tháng ${latestMonthWithData.month}/${activeYear}` : "Năm đang chọn",
                latestPoor: latestMonthWithData?.poor ?? 0,
                latestNearPoor: latestMonthWithData?.nearPoor ?? 0,
                periodLabel: activeYear ? `T1 - T12/${activeYear}` : "Chưa xác định",
                changePercent: calculateDashboardTrendChangePercent(totalSeries),
                tooltipPrefix: "Tháng",
            };
        }

        const yearlyPoints = buildYearlyDashboardTrendPoints(yearlyData);
        const categories = yearlyPoints.map((item) => item.year.toString());
        const poorSeries = yearlyPoints.map((item) => item.poor);
        const nearPoorSeries = yearlyPoints.map((item) => item.nearPoor);
        const totalSeries = yearlyPoints.map((item) => item.total);
        const latestPoint = yearlyPoints.at(-1);

        return {
            hasData: yearlyPoints.length > 0,
            title: "Biến động qua các năm",
            emptyMessage: "Chưa có dữ liệu theo năm",
            categories,
            poorSeries,
            nearPoorSeries,
            totalSeries,
            latestLabel: latestPoint ? `Năm ${latestPoint.year} (mới nhất)` : "Năm mới nhất",
            latestPoor: latestPoint?.poor ?? 0,
            latestNearPoor: latestPoint?.nearPoor ?? 0,
            periodLabel: categories.length > 0 ? `${categories[0]} - ${categories[categories.length - 1]}` : "Chưa xác định",
            changePercent: calculateDashboardTrendChangePercent(totalSeries),
            tooltipPrefix: "Năm",
        };
    }, [mode, monthlyData, selectedYear, yearlyData]);

    const chartSeries = [
        {
            name: "Hộ nghèo",
            data: trendData.poorSeries,
            color: "#dc2626",
        },
        {
            name: "Cận nghèo",
            data: trendData.nearPoorSeries,
            color: "#ea580c",
        },
        {
            name: "Tổng cộng",
            data: trendData.totalSeries,
            color: "#0ea5e9",
        },
    ];

    const chartOptions: ApexOptions = {
        chart: {
            type: "line",
            height: 180,
            sparkline: { enabled: false },
            toolbar: { show: false },
            zoom: { enabled: false },
            fontFamily: "Outfit, sans-serif",
        },
        stroke: {
            curve: "smooth",
            width: [2.5, 2.5, 2.5],
        },
        markers: {
            size: 4,
            strokeWidth: 0,
            hover: { size: 6 },
            colors: ["#dc2626", "#ea580c", "#0ea5e9"],
        },
        xaxis: {
            type: "category",
            categories: trendData.categories,
            labels: {
                style: { fontSize: "11px", colors: "#6b7280" },
            },
        },
        yaxis: {
            labels: {
                style: { fontSize: "11px", colors: "#6b7280" },
                formatter: (value: number) => formatNumber(value),
            },
        },
        grid: {
            borderColor: "#e5e7eb",
            padding: { left: 0, right: 0, top: 5, bottom: 0 },
        },
        legend: {
            position: "top",
            horizontalAlign: "right",
            fontSize: "12px",
            fontFamily: "inherit",
            itemMargin: { horizontal: 8 },
        },
        tooltip: {
            theme: "light",
            y: {
                formatter: (value?: number) => `${formatNumber(Number(value ?? 0))} hộ`,
            },
            x: {
                formatter: (_value: number, options?: { dataPointIndex?: number }) =>
                    `${trendData.tooltipPrefix} ${trendData.categories[options?.dataPointIndex ?? 0] ?? ""}`,
            },
        },
        colors: ["#dc2626", "#ea580c", "#0ea5e9"],
    };

    return (
        <div className={`overflow-hidden rounded-lg border border-white/20 bg-white/88 p-4 shadow-lg shadow-orange-950/10 backdrop-blur ${className}`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-gray-900">{trendData.title}</h3>
                    <p className="mt-1 text-xs text-gray-500">Chuyển đổi nhanh giữa xu hướng theo năm và theo tháng.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <ConfigProvider
                        theme={{
                            components: {
                                Segmented: {
                                    trackBg: "#f3f4f6",
                                    itemColor: "#4b5563",
                                    itemSelectedBg: "#fee2e2",
                                    itemSelectedColor: "#b91c1c",
                                },
                            },
                        }}
                    >
                        <Segmented
                            value={mode}
                            className="inline-flex rounded-2xl border border-gray-200 p-1 shadow-sm [&_.ant-segmented-group]:gap-1 [&_.ant-segmented-item]:rounded-xl [&_.ant-segmented-item]:px-3 [&_.ant-segmented-item]:py-2 [&_.ant-segmented-item]:text-sm [&_.ant-segmented-item]:font-semibold [&_.ant-segmented-thumb]:rounded-xl [&_.ant-segmented-thumb]:shadow-[0_4px_12px_rgba(220,38,38,0.2)]"
                            onChange={(value) => onModeChange(value as DashboardTrendMode)}
                            options={[
                                { label: "Theo năm", value: "yearly" },
                                { label: "Theo tháng", value: "monthly" },
                            ]}
                        />
                    </ConfigProvider>
                    {mode === "monthly" ? (
                        <Select
                            value={selectedYear}
                            options={yearOptions}
                            placeholder="Chọn năm"
                            className="min-w-[140px]"
                            disabled={yearOptions.length === 0}
                            onChange={(value) => onSelectedYearChange(Number(value))}
                        />
                    ) : null}
                </div>
            </div>

            <div className="mt-4">
                {trendData.hasData ? (
                    <>
                        <ReactApexChart type="line" series={chartSeries} options={chartOptions} height={240} />
                        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
                                <p className="text-xs text-gray-600">{trendData.latestLabel}</p>
                                <div className="mt-2 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-red-600" />
                                        <span className="text-xs font-semibold text-red-700">
                                            {formatNumber(trendData.latestPoor)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-orange-600" />
                                        <span className="text-xs font-semibold text-orange-700">
                                            {formatNumber(trendData.latestNearPoor)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-lg border border-blue-100 bg-blue-50 p-2.5">
                                <p className="text-xs text-blue-600">Tổng theo xu hướng</p>
                                <p className="mt-2 text-lg font-bold text-blue-700">
                                    {trendData.changePercent.toFixed(1)}%
                                </p>
                            </div>

                            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-2.5">
                                <p className="text-xs text-emerald-600">Khoảng thời gian</p>
                                <p className="mt-2 text-lg font-bold text-emerald-700">{trendData.periodLabel}</p>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex h-[240px] items-center justify-center">
                        <p className="text-sm text-gray-500">{trendData.emptyMessage}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

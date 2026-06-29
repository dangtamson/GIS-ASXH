"use client";

import { formatNumber } from "@/components/poverty/poverty-utils";
import dynamic from "next/dynamic";
import { useMemo } from "react";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
    ssr: false,
    loading: () => <div className="h-[200px] animate-pulse bg-white/50" />,
});

interface YearlyTrendData {
    year: number;
    poor: number;
    nearPoor: number;
    total: number;
}

interface YearlyTrendPanelProps {
    data?: YearlyTrendData[];
}

export default function YearlyTrendPanel({ data = [] }: YearlyTrendPanelProps) {
    const trendData = useMemo(() => {
        if (data.length === 0) {
            return { hasData: false, years: [], poorSeries: [], nearPoorSeries: [], totalSeries: [] };
        }

        const sortedData = [...data].sort((a, b) => a.year - b.year);
        const years = sortedData.map((d) => d.year.toString());
        const poorSeries = sortedData.map((d) => d.poor);
        const nearPoorSeries = sortedData.map((d) => d.nearPoor);
        const totalSeries = sortedData.map((d) => d.total);

        return {
            hasData: true,
            years,
            poorSeries,
            nearPoorSeries,
            totalSeries,
        };
    }, [data]);

    if (!trendData.hasData) {
        return (
            <div className="overflow-hidden rounded-lg border border-white/20 bg-white/88 p-4 shadow-lg shadow-orange-950/10 backdrop-blur">
                <h3 className="text-sm font-semibold text-gray-900">Biến động qua các năm</h3>
                <div className="flex h-[180px] items-center justify-center">
                    <p className="text-sm text-gray-500">Chưa có dữ liệu theo năm</p>
                </div>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-lg border border-white/20 bg-white/88 p-4 shadow-lg shadow-orange-950/10 backdrop-blur">
            <h3 className="text-sm font-semibold text-gray-900">Biến động qua các năm</h3>
            <div className="mt-4">
                <ReactApexChart
                    type="line"
                    series={[
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
                    ]}
                    options={{
                        chart: {
                            type: "line",
                            height: 180,
                            sparkline: { enabled: false },
                            toolbar: { show: false },
                            zoom: { enabled: false },
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
                            categories: trendData.years,
                            labels: {
                                style: { fontSize: "11px", colors: "#6b7280" },
                            },
                        },
                        yaxis: {
                            labels: {
                                style: { fontSize: "11px", colors: "#6b7280" },
                                formatter: (val: number) => formatNumber(val),
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
                            markers: {
                                width: 8,
                                height: 8,
                                strokeWidth: 0,
                                radius: 1,
                            },
                        },
                        tooltip: {
                            theme: "light",
                            y: {
                                formatter: (val: number) => formatNumber(val) + " hộ",
                            },
                            x: {
                                formatter: (val: any) => "Năm " + val,
                            },
                        },
                        colors: ["#dc2626", "#ea580c", "#0ea5e9"],
                    } as any}
                    height={240}
                />

                <div className="mt-4 grid grid-cols-3 gap-2">
                    {trendData.years.map((year, idx) => {
                        const lastIdx = trendData.years.length - 1;
                        if (idx === lastIdx) {
                            return (
                                <div key={year} className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
                                    <p className="text-xs text-gray-600">Năm {year} (mới nhất)</p>
                                    <div className="mt-2 space-y-1">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-red-600" />
                                            <span className="text-xs font-semibold text-red-700">
                                                {formatNumber(trendData.poorSeries[idx])}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-orange-600" />
                                            <span className="text-xs font-semibold text-orange-700">
                                                {formatNumber(trendData.nearPoorSeries[idx])}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })}

                    <div className="rounded-lg border border-blue-100 bg-blue-50 p-2.5">
                        <p className="text-xs text-blue-600">Tổng theo xu hướng</p>
                        <p className="mt-2 text-lg font-bold text-blue-700">
                            {trendData.years.length > 1
                                ? ((trendData.totalSeries[trendData.totalSeries.length - 1] -
                                    trendData.totalSeries[0]) /
                                    trendData.totalSeries[0] *
                                    100).toFixed(1)
                                : "0"}
                            %
                        </p>
                    </div>

                    <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-2.5">
                        <p className="text-xs text-emerald-600">Khoảng thời gian</p>
                        <p className="mt-2 text-lg font-bold text-emerald-700">
                            {trendData.years[0]} - {trendData.years[trendData.years.length - 1]}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

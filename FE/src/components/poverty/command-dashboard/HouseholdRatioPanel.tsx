"use client";

import { formatNumber } from "@/components/poverty/poverty-utils";
import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useMemo } from "react";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
    ssr: false,
    loading: () => <div className="h-[280px] animate-pulse bg-white/50" />,
});

interface HouseholdRatioPanelProps {
    poor: number;
    nearPoor: number;
    totalHouseholds: number;
}

export default function HouseholdRatioPanel({ poor, nearPoor, totalHouseholds }: HouseholdRatioPanelProps) {
    const ratioData = useMemo(() => {
        const other = Math.max(0, totalHouseholds - poor - nearPoor);
        const total = poor + nearPoor + other;

        if (total === 0) {
            return {
                poor,
                nearPoor,
                other,
                percentages: [0, 0, 0],
                labels: ["Hộ nghèo", "Cận nghèo", "Khác"],
            };
        }

        return {
            poor,
            nearPoor,
            other,
            percentages: [
                Math.round((poor / total) * 100),
                Math.round((nearPoor / total) * 100),
                Math.round((other / total) * 100),
            ],
            labels: ["Hộ nghèo", "Cận nghèo", "Khác"],
        };
    }, [poor, nearPoor, totalHouseholds]);

    const chartSeries = [ratioData.poor, ratioData.nearPoor, ratioData.other];
    const chartPalette = ["#e11d48", "#f97316", "#14b8a6"];
    const chartData = chartSeries.filter((value) => value > 0);
    const chartLabels = ratioData.labels.filter((_, idx) => chartSeries[idx] > 0);
    const chartColors = chartPalette.filter((_, idx) => chartSeries[idx] > 0);
    const totalTargetedHouseholds = ratioData.poor + ratioData.nearPoor + ratioData.other;
    const hasData = chartData.length > 0;
    const chartOptions = useMemo<ApexOptions>(() => ({
        chart: {
            type: "donut",
            height: 248,
            toolbar: { show: false },
            fontFamily: "Outfit, sans-serif",
        },
        labels: chartLabels,
        colors: chartColors,
        legend: {
            show: false,
        },
        stroke: {
            width: 4,
            colors: ["#fffaf5"],
        },
        dataLabels: {
            enabled: false,
        },
        states: {
            hover: {
                filter: {
                    type: "darken",
                    value: 0.12,
                },
            },
            active: {
                filter: {
                    type: "darken",
                    value: 0.16,
                },
            },
        },
        plotOptions: {
            pie: {
                expandOnClick: false,
                donut: {
                    size: "72%",
                    background: "transparent",
                    labels: {
                        show: true,
                        name: {
                            show: true,
                            offsetY: 18,
                            fontSize: "12px",
                            fontWeight: 500,
                            color: "#6b7280",
                        },
                        value: {
                            show: true,
                            offsetY: -14,
                            fontSize: "24px",
                            fontWeight: 700,
                            color: "#0f172a",
                            formatter: (val) => formatNumber(Number(val)),
                        },
                        total: {
                            show: true,
                            showAlways: true,
                            label: "Tổng hộ",
                            fontSize: "12px",
                            fontWeight: 500,
                            color: "#6b7280",
                            formatter: () => formatNumber(totalTargetedHouseholds),
                        },
                    },
                },
            },
        },
        tooltip: {
            theme: "light",
            fillSeriesColor: false,
            y: {
                formatter: (val) => `${formatNumber(Number(val))} hộ`,
            },
        },
    }), [chartColors, chartLabels, totalTargetedHouseholds]);

    return (
        <div className="overflow-hidden rounded-xl border border-orange-200/70 bg-gradient-to-br from-rose-50 via-white to-amber-50 p-4 shadow-lg shadow-orange-950/10 backdrop-blur">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Tỷ lệ loại hộ</h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-orange-100">
                    <span className="h-2 w-2 rounded-full bg-orange-400" />
                    Cơ cấu hộ
                </span>
            </div>
            <div className="mt-4">
                {hasData ? (
                    <div className="space-y-4">
                        <ReactApexChart
                            type="donut"
                            series={chartData}
                            options={chartOptions}
                            height={248}
                        />

                        <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-lg border border-rose-200/80 bg-gradient-to-br from-rose-50 to-white p-2.5 shadow-sm shadow-rose-900/5">
                                <div className="flex items-center gap-1.5">
                                    <span className="h-2.5 w-2.5 rounded-full bg-rose-600" />
                                    <p className="text-xs font-medium text-rose-700">Hộ nghèo</p>
                                </div>
                                <p className="mt-2 text-lg font-bold text-rose-700">{formatNumber(ratioData.poor)}</p>
                                <p className="text-xs text-rose-600">{ratioData.percentages[0]}%</p>
                            </div>
                            <div className="rounded-lg border border-orange-200/80 bg-gradient-to-br from-orange-50 to-white p-2.5 shadow-sm shadow-orange-900/5">
                                <div className="flex items-center gap-1.5">
                                    <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                                    <p className="text-xs font-medium text-orange-700">Cận nghèo</p>
                                </div>
                                <p className="mt-2 text-lg font-bold text-orange-700">{formatNumber(ratioData.nearPoor)}</p>
                                <p className="text-xs text-orange-600">{ratioData.percentages[1]}%</p>
                            </div>
                            <div className="rounded-lg border border-teal-200/80 bg-gradient-to-br from-teal-50 to-white p-2.5 shadow-sm shadow-teal-900/5">
                                <div className="flex items-center gap-1.5">
                                    <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
                                    <p className="text-xs font-medium text-teal-700">Khác</p>
                                </div>
                                <p className="mt-2 text-lg font-bold text-teal-700">{formatNumber(ratioData.other)}</p>
                                <p className="text-xs text-teal-600">{ratioData.percentages[2]}%</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex h-[240px] items-center justify-center">
                        <p className="text-sm text-gray-500">Chưa có dữ liệu</p>
                    </div>
                )}
            </div>
        </div>
    );
}

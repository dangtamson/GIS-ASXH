"use client";

import { formatNumber } from "@/components/poverty/poverty-utils";
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

    const chartData = [ratioData.poor, ratioData.nearPoor, ratioData.other].filter(val => val > 0);
    const chartLabels = ratioData.labels.filter((_, idx) => [ratioData.poor, ratioData.nearPoor, ratioData.other][idx] > 0);
    const hasData = chartData.length > 0;

    return (
        <div className="overflow-hidden rounded-xl border border-violet-200/70 bg-gradient-to-br from-rose-50 via-white to-violet-50 p-4 shadow-lg shadow-violet-900/10 backdrop-blur">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Tỷ lệ loại hộ</h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 text-[11px] font-medium text-violet-700 ring-1 ring-violet-100">
                    <span className="h-2 w-2 rounded-full bg-violet-500" />
                    Donut
                </span>
            </div>
            <div className="mt-4">
                {hasData ? (
                    <div className="space-y-4">
                        <ReactApexChart
                            type="donut"
                            series={chartData}
                            options={{
                                chart: {
                                    type: "donut",
                                    height: 240,
                                    sparkline: { enabled: false },
                                    toolbar: { show: false },
                                },
                                labels: chartLabels,
                                colors: ["#d53e3e", "#ea580c", "#35c051"],
                                plotOptions: {
                                    pie: {
                                        donut: {
                                            size: "65%",
                                            labels: {
                                                show: true,
                                                name: {
                                                    show: true,
                                                    fontSize: "12px",
                                                    color: "#fff",
                                                    fontWeight: 600,
                                                },
                                                value: {
                                                    show: true,
                                                    fontSize: "15px",
                                                    fontWeight: 700,
                                                    color: "#fff",
                                                    formatter: (val: any) => formatNumber(val),
                                                },
                                            },
                                        },
                                    },
                                },
                                dataLabels: {
                                    enabled: true,
                                    formatter: (val: number) => val.toFixed(0) + "%",
                                    style: {
                                        fontSize: "13px",
                                        fontWeight: 700,
                                        colors: ["#fff"],
                                    },
                                    dropShadow: {
                                        enabled: true,
                                        top: 2,
                                        left: 2,
                                        blur: 3,
                                        color: "#000",
                                        opacity: 0.25,
                                    },
                                },
                                states: {
                                    hover: {
                                        filter: {
                                            type: "darken",
                                            value: 0.1,
                                        },
                                    },
                                    active: {
                                        filter: {
                                            type: "darken",
                                            value: 0.15,
                                        },
                                    },
                                },
                                tooltip: {
                                    // theme: "light",
                                    // customClass: "household-ratio-tooltip",
                                    y: {
                                        formatter: (val: number) => formatNumber(val) + " hộ",
                                    },
                                    style: {
                                        fontSize: "12px",
                                        fontWeight: 600,
                                    },
                                    borderWidth: 0,
                                },
                            } as any}
                            height={240}
                        />

                        <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-lg border border-red-200/80 bg-gradient-to-br from-red-50 to-rose-50 p-2.5 shadow-sm shadow-red-900/5">
                                <p className="text-xs text-red-700">Hộ nghèo</p>
                                <p className="mt-1 text-lg font-bold text-red-700">{formatNumber(ratioData.poor)}</p>
                                <p className="text-xs text-red-600">{ratioData.percentages[0]}%</p>
                            </div>
                            <div className="rounded-lg border border-orange-200/80 bg-gradient-to-br from-orange-50 to-amber-50 p-2.5 shadow-sm shadow-orange-900/5">
                                <p className="text-xs text-orange-700">Cận nghèo</p>
                                <p className="mt-1 text-lg font-bold text-orange-700">{formatNumber(ratioData.nearPoor)}</p>
                                <p className="text-xs text-orange-600">{ratioData.percentages[1]}%</p>
                            </div>
                            <div className="rounded-lg border border-violet-200/80 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-2.5 shadow-sm shadow-violet-900/5">
                                <p className="text-xs text-violet-700">Khác</p>
                                <p className="mt-1 text-lg font-bold text-violet-700">{formatNumber(ratioData.other)}</p>
                                <p className="text-xs text-violet-600">{ratioData.percentages[2]}%</p>
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

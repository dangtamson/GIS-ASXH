"use client";

import { api, ApiError } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { PovertyDashboard } from "@/types/poverty";
import { formatNumber } from "@/components/poverty/poverty-utils";
import { TitleSpace } from "@/components/controller";
import { App, Spin } from "antd";
import type { ApexOptions } from "apexcharts";
import { Activity, Home, ShieldCheck, UsersRound } from "lucide-react";
import dynamic from "next/dynamic";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import YearlyTrendPanel from "@/components/poverty/command-dashboard/YearlyTrendPanel";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type StatCardProps = {
    label: string;
    value: number;
    helper: string;
    icon: ReactNode;
    tone: {
        card: string;
        icon: string;
        value: string;
        accent: string;
    };
};

function StatCard({ label, value, helper, icon, tone }: StatCardProps) {
    return (
        <div className={`relative min-w-0 overflow-hidden rounded-lg border p-5 ${tone.card}`}>
            <div className={`absolute right-0 top-0 h-20 w-20 translate-x-7 -translate-y-7 rounded-full ${tone.accent}`} />
            <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-600">{label}</p>
                    <p className={`mt-2 break-words text-3xl font-semibold ${tone.value}`}>{formatNumber(value)}</p>
                    <p className="mt-2 line-clamp-2 text-xs text-gray-500">{helper}</p>
                </div>
                <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${tone.icon}`}>
                    {icon}
                </span>
            </div>
        </div>
    );
}

function ChartPanel({
    title,
    description,
    children,
    className = "",
}: {
    title: string;
    description: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={`min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white p-5 shadow-sm ${className}`}>
            <div className="mb-4 min-w-0">
                <h3 className="text-base font-semibold text-gray-900">{title}</h3>
                <p className="mt-1 text-sm text-gray-500">{description}</p>
            </div>
            <div className="min-w-0">
                {children}
            </div>
        </div>
    );
}

export default function PovertyDashboardPage() {
    const { notification } = App.useApp();
    const [data, setData] = useState<PovertyDashboard>({});
    const [loading, setLoading] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await api.get<PovertyDashboard>(endpoints.poverty.dashboard);
            setData(result);
        } catch (error) {
            notification.error({
                message: "Không thể tải dashboard hộ nghèo",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
        } finally {
            setLoading(false);
        }
    }, [notification]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const ratioOptions: ApexOptions = useMemo(() => ({
        labels: ["Hộ nghèo", "Hộ cận nghèo"],
        colors: ["#e63946", "#f77f00"],
        legend: {
            position: "bottom",
            fontSize: "12px",
            labels: { colors: "#4b5563", useSeriesColors: false },
            markers: { size: 7 },
        },
        chart: { toolbar: { show: false }, fontFamily: "Outfit, sans-serif" },
        dataLabels: { enabled: false },
        states: {
            hover: { filter: { type: "darken", value: 0.15 } },
            active: { filter: { type: "darken", value: 0.15 } },
        },
        plotOptions: {
            pie: {
                donut: {
                    size: "68%",
                    background: "transparent",
                    labels: {
                        show: true,
                        total: {
                            show: true,
                            label: "Tổng",
                            fontSize: "14px",
                            fontWeight: 600,
                            color: "#1f2937",
                            formatter: () => formatNumber(Number(data.totals?.poor ?? 0) + Number(data.totals?.nearPoor ?? 0)),
                        },
                    },
                },
            },
        },
        stroke: { width: 2, colors: ["white"] },
        tooltip: {
            theme: "light",
            fillSeriesColor: false,
        },
    }), [data.totals?.nearPoor, data.totals?.poor]);

    const trendOptions: ApexOptions = useMemo(() => ({
        chart: { toolbar: { show: false }, fontFamily: "Outfit, sans-serif" },
        colors: ["#dc2626", "#f59e0b"],
        xaxis: { categories: (data.yearlyTrend ?? []).map((item) => String(item.year)) },
        plotOptions: { bar: { borderRadius: 5, columnWidth: "42%" } },
        dataLabels: { enabled: false },
        grid: { borderColor: "#eef2f7" },
        legend: { position: "top", horizontalAlign: "right" },
    }), [data.yearlyTrend]);

    const areaOptions: ApexOptions = useMemo(() => ({
        chart: { toolbar: { show: false }, fontFamily: "Outfit, sans-serif" },
        colors: ["#2563eb"],
        plotOptions: { bar: { borderRadius: 5, horizontal: true, barHeight: "58%" } },
        xaxis: { categories: (data.byArea ?? []).slice(0, 10).map((item) => item.area) },
        dataLabels: { enabled: false },
        grid: { borderColor: "#eef2f7" },
    }), [data.byArea]);

    const overviewYearLabel = data.overview?.year ? `năm ${data.overview.year}` : "năm đang chọn";

    return (
        <div className="min-w-0 space-y-5">
            <TitleSpace title="Dashboard hộ nghèo" />
            <Spin spinning={loading}>
                <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                    <StatCard
                        label="Tổng số hộ (toàn địa bàn)"
                        value={Number(data.overview?.totalHouseholds ?? 0)}
                        helper={`Theo thông tin chung ${overviewYearLabel}`}
                        icon={<Home size={21} />}
                        tone={{
                            card: "border-sky-100 bg-sky-50/70",
                            icon: "bg-sky-600 text-white",
                            value: "text-sky-700",
                            accent: "bg-sky-200/60",
                        }}
                    />
                    <StatCard
                        label="Tổng số nhân khẩu"
                        value={Number(data.overview?.totalMembers ?? 0)}
                        helper={`Theo thông tin chung ${overviewYearLabel}`}
                        icon={<UsersRound size={21} />}
                        tone={{
                            card: "border-indigo-100 bg-indigo-50/70",
                            icon: "bg-indigo-600 text-white",
                            value: "text-indigo-700",
                            accent: "bg-indigo-200/60",
                        }}
                    />
                    <StatCard
                        label="Tổng hộ nghèo/cận nghèo"
                        value={Number(data.totals?.total ?? 0)}
                        helper="Tổng số hộ nghèo và cận nghèo trong hệ thống quản lý"
                        icon={<Home size={21} />}
                        tone={{
                            card: "border-blue-100 bg-blue-50/70",
                            icon: "bg-blue-600 text-white",
                            value: "text-blue-700",
                            accent: "bg-blue-200/60",
                        }}
                    />
                    <StatCard
                        label="Hộ nghèo"
                        value={Number(data.totals?.poor ?? 0)}
                        helper="Số hộ đang được phân loại hộ nghèo"
                        icon={<UsersRound size={21} />}
                        tone={{
                            card: "border-red-100 bg-red-50/70",
                            icon: "bg-red-600 text-white",
                            value: "text-red-700",
                            accent: "bg-red-200/60",
                        }}
                    />
                    <StatCard
                        label="Hộ cận nghèo"
                        value={Number(data.totals?.nearPoor ?? 0)}
                        helper="Số hộ đang được phân loại cận nghèo"
                        icon={<Activity size={21} />}
                        tone={{
                            card: "border-amber-100 bg-amber-50/80",
                            icon: "bg-amber-500 text-white",
                            value: "text-amber-700",
                            accent: "bg-amber-200/70",
                        }}
                    />
                    <StatCard
                        label="Đang hoạt động"
                        value={Number(data.totals?.active ?? 0)}
                        helper="Hồ sơ hộ còn hiệu lực quản lý"
                        icon={<ShieldCheck size={21} />}
                        tone={{
                            card: "border-emerald-100 bg-emerald-50/70",
                            icon: "bg-emerald-600 text-white",
                            value: "text-emerald-700",
                            accent: "bg-emerald-200/60",
                        }}
                    />
                </div>
                <div className="mt-5 grid min-w-0 gap-4 xl:grid-cols-2">
                    <ChartPanel title="Tỷ lệ loại hộ" description="So sánh cơ cấu hộ nghèo và hộ cận nghèo">
                        <div className="min-h-[300px] min-w-0">
                            <Chart options={ratioOptions} series={[Number(data.totals?.poor ?? 0), Number(data.totals?.nearPoor ?? 0)]} type="donut" height={300} />
                        </div>
                    </ChartPanel>
                    <YearlyTrendPanel data={data.yearlyTrend} />
                </div>
                <div className="mt-5 grid min-w-0 gap-4">
                    <ChartPanel title="Top khu vực theo tổng số hộ" description="10 khu vực có số hộ nghèo/cận nghèo cao nhất" className="">
                        <div className="min-h-[360px] min-w-0">
                            <Chart options={areaOptions} series={[{ name: "Tổng số hộ", data: (data.byArea ?? []).slice(0, 10).map((item) => Number(item.total ?? 0)) }]} type="bar" height={360} />
                        </div>
                    </ChartPanel>
                </div>
            </Spin>
        </div>
    );
}

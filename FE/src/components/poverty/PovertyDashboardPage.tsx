"use client";

import { api, ApiError } from "@/lib/api";
import { getAccount } from "@/lib/auth";
import { endpoints } from "@/lib/endpoints";
import type { PovertyDashboard, ProvinceOption, WardOption } from "@/types/poverty";
import { formatNumber } from "@/components/poverty/poverty-utils";
import {
    buildPovertyDashboardQuery,
    shouldShowPovertyDashboardLocationSelect,
} from "@/components/poverty/poverty-location-utils";
import { type DashboardTrendMode, resolveDefaultDashboardTrendYear } from "@/components/poverty/command-dashboard/poverty-trend-utils";
import { TitleSpace } from "@/components/controller";
import { App, Select, Spin } from "antd";
import type { ApexOptions } from "apexcharts";
import { Activity, Home, ShieldCheck, UsersRound } from "lucide-react";
import dynamic from "next/dynamic";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    const account = useMemo(() => getAccount(), []);
    const showLocationSelect = shouldShowPovertyDashboardLocationSelect(account?.isSuperAdmin);
    const [data, setData] = useState<PovertyDashboard>({});
    const [provinceOptions, setProvinceOptions] = useState<ProvinceOption[]>([]);
    const [wardOptions, setWardOptions] = useState<WardOption[]>([]);
    const [selectedProvinceCode, setSelectedProvinceCode] = useState<string>();
    const [selectedWardCode, setSelectedWardCode] = useState<string>();
    const [loading, setLoading] = useState(false);
    const [trendMode, setTrendMode] = useState<DashboardTrendMode>("yearly");
    const [selectedTrendYear, setSelectedTrendYear] = useState<number>();
    const latestDashboardRequestId = useRef(0);

    const loadData = useCallback(async () => {
        const requestId = ++latestDashboardRequestId.current;
        setLoading(true);
        try {
            const query = buildPovertyDashboardQuery({
                provinceCode: selectedProvinceCode,
                wardCode: selectedWardCode,
            });
            const result = await api.get<PovertyDashboard>(
                query ? `${endpoints.poverty.dashboard}?${query}` : endpoints.poverty.dashboard
            );
            if (requestId !== latestDashboardRequestId.current) {
                return;
            }
            setData(result);
        } catch (error) {
            if (requestId !== latestDashboardRequestId.current) {
                return;
            }
            notification.error({
                message: "Không thể tải dashboard hộ nghèo",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
        } finally {
            if (requestId === latestDashboardRequestId.current) {
                setLoading(false);
            }
        }
    }, [notification, selectedProvinceCode, selectedWardCode]);

    const loadProvinces = useCallback(async () => {
        if (!showLocationSelect) return;

        try {
            const data = await api.get<{ items?: ProvinceOption[] }>(endpoints.poverty.locationProvinces);
            const items = data.items ?? [];
            setProvinceOptions(items);
            setSelectedProvinceCode((current) => {
                if (current && items.some((item) => item.code === current)) {
                    return current;
                }
                return items.length === 1 ? items[0]?.code : undefined;
            });
        } catch (error) {
            notification.error({
                message: "Không thể tải danh sách tỉnh/thành",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
        }
    }, [notification, showLocationSelect]);

    const loadWards = useCallback(async (provinceCode: string) => {
        try {
            const data = await api.get<{ items?: WardOption[] }>(endpoints.poverty.locationWards(provinceCode));
            const items = data.items ?? [];
            setWardOptions(items);
            setSelectedWardCode((current) => (current && items.some((item) => item.code === current) ? current : undefined));
        } catch (error) {
            notification.error({
                message: "Không thể tải danh sách xã/phường",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
        }
    }, [notification]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    useEffect(() => {
        void loadProvinces();
    }, [loadProvinces]);

    useEffect(() => {
        if (!showLocationSelect) return;
        if (!selectedProvinceCode) {
            setWardOptions([]);
            setSelectedWardCode(undefined);
            return;
        }
        void loadWards(selectedProvinceCode);
    }, [loadWards, selectedProvinceCode, showLocationSelect]);

    useEffect(() => {
        const defaultYear = resolveDefaultDashboardTrendYear(data.trendAvailableYears, data.monthlyTrendByYear);

        setSelectedTrendYear((current) => {
            if (!defaultYear) {
                return undefined;
            }

            const availableYears = data.trendAvailableYears ?? [];
            if (current && availableYears.includes(current)) {
                return current;
            }

            return defaultYear;
        });
    }, [data.monthlyTrendByYear, data.trendAvailableYears]);

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
            {showLocationSelect ? (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <Select
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        value={selectedProvinceCode}
                        options={provinceOptions.map((item) => ({
                            value: item.code,
                            label: item.fullName || item.name,
                        }))}
                        placeholder="Tất cả tỉnh/thành"
                        className="min-w-[220px]"
                        onChange={(value) => {
                            setSelectedProvinceCode(value);
                            setSelectedWardCode(undefined);
                        }}
                    />
                    <Select
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        value={selectedWardCode}
                        options={wardOptions.map((item) => ({
                            value: item.code,
                            label: item.fullName || item.name,
                        }))}
                        placeholder="Tất cả xã/phường"
                        className="min-w-[240px]"
                        disabled={!selectedProvinceCode}
                        onChange={setSelectedWardCode}
                    />
                </div>
            ) : null}
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
                <div className="mt-5 grid min-w-0 gap-4 xl:grid-cols-5">
                    <ChartPanel title="Tỷ lệ loại hộ" description="So sánh cơ cấu hộ nghèo và hộ cận nghèo" className="sm:col-span-2 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="min-h-[300px] min-w-0">
                            <Chart options={ratioOptions} series={[Number(data.totals?.poor ?? 0), Number(data.totals?.nearPoor ?? 0)]} type="donut" height={300} />
                        </div>
                    </ChartPanel>
                    <div className="rounded-lg border border-violet-100 bg-violet-50/40 p-4 shadow-sm xl:grid-cols-4 sm:col-span-1">
                        <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-1">
                            <StatCard
                                label="Tổng nhân khẩu nghèo/cận nghèo"
                                value={Number(data.memberTotals?.total ?? 0)}
                                helper="Tổng nhân khẩu của toàn bộ hộ nghèo và cận nghèo"
                                icon={<UsersRound size={21} />}
                                tone={{
                                    card: "border-violet-100 bg-violet-50/80",
                                    icon: "bg-violet-600 text-white",
                                    value: "text-violet-700",
                                    accent: "bg-violet-200/70",
                                }}
                            />
                            <StatCard
                                label="Nhân khẩu hộ nghèo"
                                value={Number(data.memberTotals?.poor ?? 0)}
                                helper=""
                                icon={<Home size={21} />}
                                tone={{
                                    card: "border-fuchsia-100 bg-fuchsia-50/80",
                                    icon: "bg-fuchsia-600 text-white",
                                    value: "text-fuchsia-700",
                                    accent: "bg-fuchsia-200/70",
                                }}
                            />
                            <StatCard
                                label="Nhân khẩu hộ cận nghèo"
                                value={Number(data.memberTotals?.nearPoor ?? 0)}
                                helper=""
                                icon={<Activity size={21} />}
                                tone={{
                                    card: "border-orange-100 bg-orange-50/80",
                                    icon: "bg-orange-500 text-white",
                                    value: "text-orange-700",
                                    accent: "bg-orange-200/70",
                                }}
                            />
                        </div>
                    </div>
                    <YearlyTrendPanel
                        className="sm:col-span-2 xl:grid-cols-6"
                        yearlyData={data.yearlyTrend}
                        monthlyData={data.monthlyTrendByYear}
                        availableYears={data.trendAvailableYears}
                        mode={trendMode}
                        selectedYear={selectedTrendYear}
                        onModeChange={setTrendMode}
                        onSelectedYearChange={setSelectedTrendYear}
                    />
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

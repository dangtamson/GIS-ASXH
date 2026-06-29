"use client";

import { api, ApiError } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { PovertyDashboard, PovertyMarker, PovertyReportRow } from "@/types/poverty";
import { formatNumber, getValidGeoPosition, povertyTypeLabel } from "@/components/poverty/poverty-utils";
import { App, Button, Empty, Select, Spin, Tag } from "antd";
import { MapPin, MapPinned, RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import CommandDashboardActions from "@/components/poverty/command-dashboard/CommandDashboardActions";
import { useCommandDashboardStore } from "@/components/poverty/command-dashboard/useCommandDashboardStore";
import SupportSummaryPanel from "@/components/poverty/command-dashboard/SupportSummaryPanel";
import HouseholdRatioPanel from "@/components/poverty/command-dashboard/HouseholdRatioPanel";
import canThoRegions from "@/components/poverty/command-dashboard/data/cantho-regions.json";

const PovertyCommandMap = dynamic(() => import("@/components/poverty/command-dashboard/PovertyCommandMap"), {
    ssr: false,
    loading: () => (
        <div className="absolute inset-0 flex items-center justify-center bg-orange-50 text-sm text-orange-700">
            Đang tải bản đồ điều hành...
        </div>
    ),
});

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
    ssr: false,
    loading: () => <div className="h-[240px] animate-pulse bg-white/50" />,
});

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="overflow-hidden rounded-lg border border-white/20 bg-white/88 p-4 shadow-lg shadow-orange-950/10 backdrop-blur">
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            <div className="mt-3">{children}</div>
        </div>
    );
}

function buildMarkerQuery() {
    const params = new URLSearchParams();
    params.set("limit", "10000");
    return params.toString();
}

const normalizeLocationName = (value?: string | null) =>
    String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

export default function PovertyCommandDashboardPage() {
    const { notification } = App.useApp();
    const showPanels = useCommandDashboardStore((state) => state.mode);
    const [dashboard, setDashboard] = useState<PovertyDashboard>({});
    const [markers, setMarkers] = useState<PovertyMarker[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedRegionName, setSelectedRegionName] = useState<string>();

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [dashboardData, markerData] = await Promise.all([
                api.get<PovertyDashboard>(endpoints.poverty.dashboard),
                api.get<{ items?: PovertyMarker[] }>(`${endpoints.poverty.gisMarkers}?${buildMarkerQuery()}`),
            ]);
            setDashboard(dashboardData);
            setMarkers(markerData.items ?? []);
        } catch (error) {
            notification.error({
                message: "Không thể tải dashboard điều hành",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
        } finally {
            setLoading(false);
        }
    }, [notification]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const regions = useMemo<PovertyReportRow[]>(() => dashboard.byArea ?? [], [dashboard.byArea]);
    const positionedMarkers = useMemo(
        () => markers.filter((marker) => getValidGeoPosition(marker.latitude, marker.longitude)),
        [markers]
    );
    const regionOptions = useMemo(() => [...canThoRegions]
        .sort((first, second) => first.name.localeCompare(second.name, "vi"))
        .map((region) => ({
            value: region.name,
            label: `${region.name} (${region.level})`,
        })), []);
    const visiblePositionedMarkers = useMemo(() => {
        const selectedKey = normalizeLocationName(selectedRegionName);
        if (!selectedKey) return positionedMarkers;

        return positionedMarkers.filter((marker) =>
            normalizeLocationName(marker.wardName) === selectedKey
            || normalizeLocationName(marker.areaName) === selectedKey
        );
    }, [positionedMarkers, selectedRegionName]);
    const topAreas = useMemo(() => [...regions].sort((a, b) => Number(b.total ?? 0) - Number(a.total ?? 0)).slice(0, 8), [regions]);
    const latestMarkers = useMemo(() => visiblePositionedMarkers.slice(0, 8), [visiblePositionedMarkers]);

    const total = Number(dashboard.totals?.total ?? 0);
    const poor = Number(dashboard.totals?.poor ?? 0);
    const nearPoor = Number(dashboard.totals?.nearPoor ?? 0);
    const active = Number(dashboard.totals?.active ?? 0);
    const totalHouseholds = Number(dashboard.overview?.totalHouseholds ?? 0);
    const totalMembers = Number(dashboard.overview?.totalMembers ?? 0);
    const overviewYear = dashboard.overview?.year;
    const coordinateRatio = markers.length > 0 ? Math.round((positionedMarkers.length / markers.length) * 100) : 0;

    return (
        <div className="min-w-0">
            <Spin spinning={loading}>
                <div className="relative min-h-[calc(100vh-112px)] overflow-hidden rounded-xl border border-orange-100 bg-orange-50">
                    <PovertyCommandMap
                        regions={regions}
                        markers={visiblePositionedMarkers}
                        selectedRegionName={selectedRegionName}
                    />

                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0)_30%,rgba(255,247,237,0.78)_76%)]" />

                    <div className="pointer-events-none relative z-10 flex min-h-[calc(100vh-112px)] flex-col p-4 pb-28 lg:p-5 lg:pb-28">
                        <div className={[
                            "pointer-events-auto flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/30 bg-white/88 px-4 py-3 shadow-lg shadow-orange-950/10 backdrop-blur transition-all duration-500",
                            showPanels ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0 pointer-events-none",
                        ].join(" ")}>
                            <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-orange-700">Trung tâm điều hành</p>
                                <h1 className="text-xl font-semibold text-gray-950 md:text-2xl">Dashboard hộ nghèo Cần Thơ</h1>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                                <Select
                                    allowClear
                                    showSearch
                                    optionFilterProp="label"
                                    value={selectedRegionName}
                                    options={regionOptions}
                                    placeholder="Toàn Cần Thơ"
                                    suffixIcon={<MapPinned size={16} />}
                                    className="min-w-[220px]"
                                    onChange={setSelectedRegionName}
                                />
                                <Tag color="red">Hộ nghèo {formatNumber(poor)}</Tag>
                                <Tag color="orange">Cận nghèo {formatNumber(nearPoor)}</Tag>
                                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs text-gray-600">
                                    <span className="h-2.5 w-2.5 rounded-full bg-rose-600 shadow-[0_0_8px_rgba(225,29,72,0.75)]" />
                                    Điểm hộ nghèo
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs text-gray-600">
                                    <span className="h-2.5 w-2.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.75)]" />
                                    Điểm cận nghèo
                                </span>
                                <Button icon={<RefreshCw size={16} />} loading={loading} onClick={loadData}>
                                    Làm mới
                                </Button>
                            </div>
                        </div>

                        <div className="mt-4 grid flex-1 gap-4 xl:grid-cols-[400px_minmax(0,1fr)_400px]">
                            <div className={[
                                "pointer-events-auto space-y-3 transition-all duration-500",
                                showPanels ? "translate-x-0 opacity-100" : "-translate-x-8 opacity-0 pointer-events-none",
                            ].join(" ")}>
                                <div className="overflow-hidden rounded-xl border border-blue-200/60 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4 shadow-lg shadow-blue-900/10 backdrop-blur">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Quy mô dân cư</p>
                                    <div className="mt-2 flex items-end justify-between gap-3">
                                        <div>
                                            <p className="text-[28px] font-bold leading-none text-blue-800">{formatNumber(totalHouseholds)}</p>
                                            <p className="mt-1 text-xs text-blue-800/80">tổng số hộ {overviewYear ? `năm ${overviewYear}` : ""}</p>
                                        </div>
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                        <div className="rounded-lg bg-white/85 p-2.5 ring-1 ring-blue-100">
                                            <p className="text-[11px] text-gray-500">Tổng nhân khẩu</p>
                                            <p className="mt-1 text-sm font-semibold text-indigo-700">{formatNumber(totalMembers)}</p>
                                        </div>
                                        <div className="rounded-lg bg-white/85 p-2.5 ring-1 ring-sky-100">
                                            <p className="text-[11px] text-gray-500">Bình quân nhân khẩu/hộ</p>
                                            <p className="mt-1 text-sm font-semibold text-sky-700">
                                                {totalHouseholds > 0 ? (totalMembers / totalHouseholds).toFixed(1) : "0.0"}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="overflow-hidden rounded-xl border border-rose-200/60 bg-gradient-to-br from-rose-50 via-white to-amber-50 p-4 shadow-lg shadow-rose-900/10 backdrop-blur">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Phân loại nghèo/cận nghèo</p>
                                    <div className="mt-2 flex items-end justify-between gap-3">
                                        <div>
                                            <p className="text-[28px] font-bold leading-none text-rose-800">{formatNumber(total)}</p>
                                            <p className="mt-1 text-xs text-rose-800/80">tổng hộ nghèo và cận nghèo</p>
                                        </div>
                                        <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                                            {totalHouseholds > 0 ? Math.round((total / totalHouseholds) * 100) : 0}%
                                        </span>
                                    </div>
                                    <div className="mt-3 grid grid-cols-3 gap-2">
                                        <div className="rounded-lg bg-white/85 p-2.5 ring-1 ring-rose-100">
                                            <p className="text-[11px] text-gray-500">Hộ nghèo</p>
                                            <p className="mt-1 text-sm font-semibold text-rose-700">{formatNumber(poor)}</p>
                                        </div>
                                        <div className="rounded-lg bg-white/85 p-2.5 ring-1 ring-orange-100">
                                            <p className="text-[11px] text-gray-500">Cận nghèo</p>
                                            <p className="mt-1 text-sm font-semibold text-orange-700">{formatNumber(nearPoor)}</p>
                                        </div>
                                        <div className="rounded-lg bg-white/85 p-2.5 ring-1 ring-emerald-100">
                                            <p className="text-[11px] text-gray-500">Đang hoạt động</p>
                                            <p className="mt-1 text-sm font-semibold text-emerald-700">{formatNumber(active)}</p>
                                        </div>
                                    </div>
                                </div>
                                <HouseholdRatioPanel
                                    poor={poor}
                                    nearPoor={nearPoor}
                                    totalHouseholds={totalHouseholds}
                                />

                                {/* <Panel title="Điểm hộ có tọa độ">
                                    {latestMarkers.length > 0 ? (
                                        <div className="max-h-[310px] space-y-2 overflow-y-auto pr-1">
                                            {latestMarkers.map((marker) => (
                                                <div key={marker.id} className="rounded-lg border border-gray-100 bg-white p-3">
                                                    <div className="flex items-start gap-2">
                                                        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                                                            <MapPin size={15} />
                                                        </span>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="truncate text-sm font-semibold text-gray-900">{marker.headFullName || marker.code || "Chưa có chủ hộ"}</p>
                                                            <p className="mt-0.5 truncate text-xs text-gray-500">{marker.areaName || marker.wardName || marker.address || "Chưa có khu vực"}</p>
                                                            <div className="mt-2 flex flex-wrap items-center gap-1">
                                                                <Tag color={marker.povertyType === "POOR" ? "red" : marker.povertyType === "NEAR_POOR" ? "orange" : "default"}>{povertyTypeLabel(marker.povertyType)}</Tag>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có hộ được cập nhật tọa độ" />
                                    )}
                                </Panel> */}
                            </div>

                            <div className="hidden xl:block" />

                            <div className={[
                                "pointer-events-auto space-y-3 transition-all duration-500",
                                showPanels ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0 pointer-events-none",
                            ].join(" ")}>
                                {/* <Panel title="Tọa độ bản đồ">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="rounded-lg bg-gray-50 p-3">
                                            <p className="text-xs text-gray-500">Có tọa độ</p>
                                            <p className="mt-1 text-2xl font-semibold text-emerald-700">{formatNumber(visiblePositionedMarkers.length)}</p>
                                        </div>
                                        <div className="rounded-lg bg-gray-50 p-3">
                                            <p className="text-xs text-gray-500">Tỷ lệ</p>
                                            <p className="mt-1 text-2xl font-semibold text-blue-700">{coordinateRatio}%</p>
                                        </div>
                                    </div>
                                </Panel> */}
                                <SupportSummaryPanel markers={visiblePositionedMarkers} />
                            </div>
                        </div>
                    </div>
                    <CommandDashboardActions />
                </div>
            </Spin>
        </div>
    );
}

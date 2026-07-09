"use client";

import { api, ApiError } from "@/lib/api";
import { getAccount } from "@/lib/auth";
import { endpoints } from "@/lib/endpoints";
import type { PovertyDashboard, PovertyMarker, PovertyReportRow, ProvinceOption, WardOption } from "@/types/poverty";
import { formatNumber, getValidGeoPosition } from "@/components/poverty/poverty-utils";
import {
    buildPovertyDashboardQuery,
    resolvePovertyDashboardSelectedWardName,
    shouldShowPovertyDashboardLocationSelect,
} from "@/components/poverty/poverty-location-utils";
import { App, Button, Select, Spin, Tag } from "antd";
import { MapPinned, RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import CommandDashboardActions from "@/components/poverty/command-dashboard/CommandDashboardActions";
import { useCommandDashboardStore } from "@/components/poverty/command-dashboard/useCommandDashboardStore";
import SupportSummaryPanel from "@/components/poverty/command-dashboard/SupportSummaryPanel";
import HouseholdRatioPanel from "@/components/poverty/command-dashboard/HouseholdRatioPanel";

const PovertyCommandMap = dynamic(() => import("@/components/poverty/command-dashboard/PovertyCommandMap"), {
    ssr: false,
    loading: () => (
        <div className="absolute inset-0 flex items-center justify-center bg-orange-50 text-sm text-orange-700">
            Đang tải bản đồ điều hành...
        </div>
    ),
});

function buildMarkerQuery(filters: { provinceCode?: string; wardCode?: string }) {
    const params = new URLSearchParams();
    params.set("limit", "10000");
    if (filters.provinceCode) {
        params.set("provinceCode", filters.provinceCode);
    }
    if (filters.wardCode) {
        params.set("wardCode", filters.wardCode);
    }
    return params.toString();
}

export default function PovertyCommandDashboardPage() {
    const { notification } = App.useApp();
    const showPanels = useCommandDashboardStore((state) => state.mode);
    const account = useMemo(() => getAccount(), []);
    const showLocationSelect = shouldShowPovertyDashboardLocationSelect(account?.isSuperAdmin);
    const [dashboard, setDashboard] = useState<PovertyDashboard>({});
    const [markers, setMarkers] = useState<PovertyMarker[]>([]);
    const [provinceOptions, setProvinceOptions] = useState<ProvinceOption[]>([]);
    const [wardOptions, setWardOptions] = useState<WardOption[]>([]);
    const [selectedProvinceCode, setSelectedProvinceCode] = useState<string>();
    const [selectedWardCode, setSelectedWardCode] = useState<string>();
    const [loading, setLoading] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const query = buildPovertyDashboardQuery({
                provinceCode: selectedProvinceCode,
                wardCode: selectedWardCode,
            });
            const [dashboardData, markerData] = await Promise.all([
                api.get<PovertyDashboard>(query ? `${endpoints.poverty.dashboard}?${query}` : endpoints.poverty.dashboard),
                api.get<{ items?: PovertyMarker[] }>(
                    `${endpoints.poverty.gisMarkers}?${buildMarkerQuery({
                        provinceCode: selectedProvinceCode,
                        wardCode: selectedWardCode,
                    })}`
                ),
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
    }, [notification, selectedProvinceCode, selectedWardCode]);

    const loadProvinces = useCallback(async () => {
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
    }, [notification]);

    const loadWards = useCallback(async (provinceCode: string) => {
        try {
            const data = await api.get<{ items?: WardOption[] }>(endpoints.poverty.locationWards(provinceCode));
            const items = data.items ?? [];
            setWardOptions(items);
            setSelectedWardCode((current) => {
                if (current && items.some((item) => item.code === current)) {
                    return current;
                }
                return items.length === 1 ? items[0]?.code : undefined;
            });
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
        if (!selectedProvinceCode) {
            setWardOptions([]);
            setSelectedWardCode(undefined);
            return;
        }
        void loadWards(selectedProvinceCode);
    }, [loadWards, selectedProvinceCode]);

    const regions = useMemo<PovertyReportRow[]>(() => dashboard.byArea ?? [], [dashboard.byArea]);
    const positionedMarkers = useMemo(
        () => markers.filter((marker) => getValidGeoPosition(marker.latitude, marker.longitude)),
        [markers]
    );
    const selectedWardName = useMemo(
        () => resolvePovertyDashboardSelectedWardName({
            selectedWardCode,
            wardOptions,
            markerWardNames: markers.map((item) => item.wardName),
        }),
        [markers, selectedWardCode, wardOptions]
    );
    const visiblePositionedMarkers = positionedMarkers;
    const total = Number(dashboard.totals?.total ?? 0);
    const poor = Number(dashboard.totals?.poor ?? 0);
    const nearPoor = Number(dashboard.totals?.nearPoor ?? 0);
    const active = Number(dashboard.totals?.active ?? 0);
    const totalHouseholds = Number(dashboard.overview?.totalHouseholds ?? 0);
    const totalMembers = Number(dashboard.overview?.totalMembers ?? 0);
    const targetedMemberTotal = Number(dashboard.memberTotals?.total ?? 0);
    const poorMemberTotal = Number(dashboard.memberTotals?.poor ?? 0);
    const nearPoorMemberTotal = Number(dashboard.memberTotals?.nearPoor ?? 0);
    const overviewYear = dashboard.overview?.year;

    return (
        <div className="min-w-0">
            <Spin spinning={loading}>
                <div className="relative min-h-[calc(100vh-112px)] overflow-hidden rounded-xl border border-orange-100 bg-orange-50">
                    <PovertyCommandMap
                        regions={regions}
                        markers={visiblePositionedMarkers}
                        selectedRegionName={selectedWardName}
                        preferDeepFocus={!showLocationSelect && Boolean(selectedWardName)}
                    />

                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0)_30%,rgba(255,247,237,0.78)_76%)]" />

                    <div className="pointer-events-none relative z-10 flex min-h-[calc(100vh-112px)] flex-col p-4 pb-28 lg:p-5 lg:pb-28">
                        <div className={[
                            "pointer-events-auto flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/30 bg-white/88 px-4 py-3 shadow-lg shadow-orange-950/10 backdrop-blur transition-all duration-500",
                            showPanels ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0 pointer-events-none",
                        ].join(" ")}>
                            <div>
                                <p className="text-xl font-medium uppercase tracking-wide text-orange-700 md:text-2xl">Trung tâm điều hành</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                                {showLocationSelect ? (
                                    <>
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
                                            suffixIcon={<MapPinned size={16} />}
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
                                            suffixIcon={<MapPinned size={16} />}
                                            className="min-w-[220px]"
                                            disabled={!selectedProvinceCode}
                                            onChange={setSelectedWardCode}
                                        />
                                    </>
                                ) : null}
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
                                <div className="overflow-hidden rounded-xl border border-violet-200/60 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-4 shadow-lg shadow-violet-900/10 backdrop-blur">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Nhân khẩu nhóm hộ nghèo/cận nghèo</p>
                                    <div className="mt-2">
                                        <p className="text-[28px] font-bold leading-none text-violet-800">{formatNumber(targetedMemberTotal)}</p>
                                        <p className="mt-1 text-xs text-violet-800/80">tổng nhân khẩu hộ nghèo và cận nghèo</p>
                                    </div>
                                    <div className="mt-3 grid grid-cols-3 gap-2">
                                        <div className="rounded-lg bg-white/85 p-2.5 ring-1 ring-violet-100">
                                            <p className="text-[11px] text-gray-500">Tổng</p>
                                            <p className="mt-1 text-sm font-semibold text-violet-700">{formatNumber(targetedMemberTotal)}</p>
                                        </div>
                                        <div className="rounded-lg bg-white/85 p-2.5 ring-1 ring-rose-100">
                                            <p className="text-[11px] text-gray-500">Nhân khẩu nghèo</p>
                                            <p className="mt-1 text-sm font-semibold text-rose-700">{formatNumber(poorMemberTotal)}</p>
                                        </div>
                                        <div className="rounded-lg bg-white/85 p-2.5 ring-1 ring-orange-100">
                                            <p className="text-[11px] text-gray-500">Nhân khẩu cận nghèo</p>
                                            <p className="mt-1 text-sm font-semibold text-orange-700">{formatNumber(nearPoorMemberTotal)}</p>
                                        </div>
                                    </div>
                                </div>
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

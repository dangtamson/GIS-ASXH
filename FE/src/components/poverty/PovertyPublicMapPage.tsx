"use client";

import canThoBoundaryGeoJson from "@/components/poverty/command-dashboard/data/cantho.json";
import PovertyPublicMapStage from "@/components/poverty/PovertyPublicMapStage";
import {
    buildPublicAreaSlug,
    buildPublicPovertyAreaDetailUrl,
    buildPublicPovertyAreaSummaries,
    buildPublicPovertyHouseholdDetailUrl,
    buildPublicWardBoundaryGeoJson,
    getPublicMapHeightClass,
    buildPublicWardHouseholdListDescription,
    buildPublicWardMapTitle,
    filterPublicPovertyMarkers,
    PUBLIC_MAP_INITIAL_LOADER_EXIT_MS,
    PUBLIC_MAP_INITIAL_LOADER_MIN_MS,
    shouldShowPublicMapHeroLoader,
    shouldStartPublicMapHeroLoaderExit,
} from "@/components/poverty/poverty-public-map-utils";
import { povertyTypeColor, povertyTypeLabel } from "@/components/poverty/poverty-utils";
import { publicApiGet } from "@/lib/public-api";
import { endpoints } from "@/lib/endpoints";
import type { PublicPovertyMarker, PublicPovertyWardResponse } from "@/types/poverty";
import { Alert, Button, Empty, Input, Tabs, Tag } from "antd";
import type { FeatureCollection, Geometry } from "geojson";
import {
    ArrowRight,
    Building2,
    CircleAlert,
    House,
    MapPinned,
    RefreshCcw,
    Search,
    Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type PovertyPublicMapPageProps = {
    slug: string;
};

type PublicExplorerTabKey = "list" | "area";
type PublicPovertyFilter = "ALL" | "POOR" | "NEAR_POOR" | "NONE";
type PublicWardBoundaryProperties = {
    adcode?: number;
    name?: string;
    center?: number[];
    centroid?: number[];
    childrenNum?: number;
    level?: string;
    parent?: { adcode?: number };
    subFeatureIndex?: number;
    acroutes?: number[];
    province?: string;
    mergedFrom?: string;
    population?: number;
    areaKm2?: number;
    densityKm2?: number;
};
const PUBLIC_WARD_BOUNDARY_DATA = canThoBoundaryGeoJson as FeatureCollection<Geometry, PublicWardBoundaryProperties>;

function PublicMapHeroLoader({ exiting }: { exiting: boolean }) {
    return (
        <div
            className={[
                "public-map-hero-loader fixed inset-0 z-[1200] overflow-hidden bg-slate-950/5 px-4 py-4 md:px-6 md:py-6",
                exiting ? "public-map-hero-loader--exit" : "",
            ].join(" ").trim()}
            aria-hidden="true"
        >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.22),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.16),_transparent_28%),linear-gradient(135deg,_#f8fafc,_#ecfeff_48%,_#eff6ff)]" />
            <div className="absolute inset-0 public-map-hero-loader__grid" />
            <div className="relative mx-auto flex h-full w-full max-w-7xl flex-col gap-4">
                <section className="rounded-3xl border border-white/70 bg-white/75 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl md:p-7">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-4">
                            <div className="h-8 w-40 rounded-full bg-sky-100/90 public-map-hero-loader__shimmer" />
                            <div className="h-10 w-[min(28rem,80vw)] rounded-2xl bg-slate-200/90 public-map-hero-loader__shimmer" />
                            <div className="h-5 w-[min(22rem,70vw)] rounded-full bg-slate-200/70 public-map-hero-loader__shimmer" />
                        </div>
                        <div className="h-14 w-44 rounded-2xl bg-white/85 ring-1 ring-sky-100 public-map-hero-loader__shimmer" />
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div key={index} className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
                                <div className="h-3 w-24 rounded-full bg-slate-200/70 public-map-hero-loader__shimmer" />
                                <div className="mt-3 h-8 w-[4.5rem] rounded-full bg-slate-300/80 public-map-hero-loader__shimmer" />
                            </div>
                        ))}
                    </div>
                </section>

                <section className="relative min-h-[420px] flex-1 overflow-hidden rounded-[2rem] border border-white/70 bg-white/70 shadow-[0_24px_80px_rgba(14,165,233,0.14)] backdrop-blur-xl">
                    <div className="absolute inset-0 public-map-hero-loader__map-surface" />
                    <div className="absolute left-5 top-5 h-10 w-40 rounded-2xl bg-white/90 shadow-sm public-map-hero-loader__shimmer" />
                    <div className="absolute right-5 top-5 flex gap-2">
                        <span className="h-10 w-10 rounded-2xl bg-white/90 shadow-sm public-map-hero-loader__shimmer" />
                        <span className="h-10 w-10 rounded-2xl bg-white/90 shadow-sm public-map-hero-loader__shimmer" />
                    </div>
                    <span className="public-map-hero-loader__marker public-map-hero-loader__marker--poor" style={{ left: "23%", top: "40%" }} />
                    <span className="public-map-hero-loader__marker public-map-hero-loader__marker--near-poor" style={{ left: "52%", top: "55%" }} />
                    <span className="public-map-hero-loader__marker public-map-hero-loader__marker--poor" style={{ left: "68%", top: "32%" }} />
                    <div className="absolute bottom-5 left-5 grid w-[min(20rem,calc(100%-2.5rem))] gap-3 md:grid-cols-2">
                        <div className="h-24 rounded-2xl bg-white/88 shadow-sm public-map-hero-loader__shimmer" />
                        <div className="h-24 rounded-2xl bg-white/88 shadow-sm public-map-hero-loader__shimmer" />
                    </div>
                </section>
            </div>
        </div>
    );
}

const POVERTY_FILTER_OPTIONS: Array<{ value: PublicPovertyFilter; label: string }> = [
    { value: "ALL", label: "Tất cả" },
    { value: "POOR", label: "Hộ nghèo" },
    { value: "NEAR_POOR", label: "Hộ cận nghèo" },
    { value: "NONE", label: "Hộ thường" },
];

export default function PovertyPublicMapPage({ slug }: PovertyPublicMapPageProps) {
    const router = useRouter();
    const [data, setData] = useState<PublicPovertyWardResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
    const [minimumDelayReached, setMinimumDelayReached] = useState(false);
    const [isHeroLoaderExiting, setIsHeroLoaderExiting] = useState(false);
    const [activeExplorerTab, setActiveExplorerTab] = useState<PublicExplorerTabKey>("list");
    const [search, setSearch] = useState("");
    const [povertyFilter, setPovertyFilter] = useState<PublicPovertyFilter>("ALL");

    const loadPublicWardMap = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await publicApiGet<PublicPovertyWardResponse>(endpoints.poverty.publicWardBySlug(slug));
            setData(response);
        } catch (loadError) {
            const message = loadError instanceof Error ? loadError.message : "Vui lòng thử lại";
            setError(message);
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [slug]);

    useEffect(() => {
        void loadPublicWardMap();
    }, [loadPublicWardMap]);

    useEffect(() => {
        setHasLoadedOnce(false);
        setMinimumDelayReached(false);
        setIsHeroLoaderExiting(false);
    }, [slug]);

    useEffect(() => {
        if (hasLoadedOnce) {
            return;
        }

        setMinimumDelayReached(false);

        const minimumDelayTimer = window.setTimeout(() => {
            setMinimumDelayReached(true);
        }, PUBLIC_MAP_INITIAL_LOADER_MIN_MS);

        return () => {
            window.clearTimeout(minimumDelayTimer);
        };
    }, [hasLoadedOnce, slug]);

    const share = data?.share;
    const overview = data?.overview;
    const summary = data?.summary;
    const markers = useMemo(() => data?.markers ?? [], [data?.markers]);
    const wardName = share?.wardName || "Xã/Phường";
    const provinceName = share?.provinceName || "";
    const wardBoundaryGeoJson = useMemo(
        () => buildPublicWardBoundaryGeoJson(PUBLIC_WARD_BOUNDARY_DATA, share?.wardName),
        [share?.wardName]
    );
    const normalHouseholdCount = Math.max(Number(summary?.total ?? 0) - Number(summary?.poor ?? 0) - Number(summary?.nearPoor ?? 0), 0);
    const areaSummaries = useMemo(() => buildPublicPovertyAreaSummaries(markers), [markers]);
    const filteredMarkers = useMemo(
        () => filterPublicPovertyMarkers(markers, { search, activeAreaId: null, povertyFilter }),
        [markers, povertyFilter, search]
    );

    const hasData = Boolean(data);
    const hasError = Boolean(error);
    const shouldExitHeroLoader = shouldStartPublicMapHeroLoaderExit({
        loading,
        hasLoadedOnce,
        hasData,
        hasError,
        minimumDelayReached,
    });

    useEffect(() => {
        if (!shouldExitHeroLoader || isHeroLoaderExiting) {
            return;
        }

        setIsHeroLoaderExiting(true);

        const exitTimer = window.setTimeout(() => {
            setIsHeroLoaderExiting(false);
            setHasLoadedOnce(true);
        }, PUBLIC_MAP_INITIAL_LOADER_EXIT_MS);

        return () => {
            window.clearTimeout(exitTimer);
        };
    }, [isHeroLoaderExiting, shouldExitHeroLoader]);

    const showHeroLoader = shouldShowPublicMapHeroLoader({
        loading,
        hasLoadedOnce,
        hasData,
        hasError,
        minimumDelayReached,
        isExitAnimating: isHeroLoaderExiting,
    });

    const openHouseholdDetail = useCallback((marker: PublicPovertyMarker) => {
        router.push(buildPublicPovertyHouseholdDetailUrl(slug, marker.id));
    }, [router, slug]);

    if (error && !data && !showHeroLoader) {
        return (
            <div className="mx-auto max-w-4xl p-4 md:p-6">
                <Alert
                    type="error"
                    showIcon
                    message="Không thể mở bản đồ công khai"
                    description={error}
                    action={(
                        <Button size="small" icon={<RefreshCcw size={14} />} onClick={() => void loadPublicWardMap()}>
                            Thử lại
                        </Button>
                    )}
                />
            </div>
        );
    }

    return (
        <>
            {showHeroLoader ? <PublicMapHeroLoader exiting={isHeroLoaderExiting} /> : null}

            <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.12),_transparent_28%),linear-gradient(135deg,_#f8fafc,_#ecfeff_48%,_#eff6ff)] p-4 md:p-6">
                <div className="pointer-events-none absolute inset-0 public-map-hero-loader__grid opacity-60" />
                <div className="relative mx-auto max-w-7xl space-y-6">
                    <section className="public-hero-shell overflow-hidden rounded-[2rem] border border-blue-100 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.28),_transparent_32%),linear-gradient(180deg,_#2563eb_0%,_#3b82f6_24%,_#dbeafe_72%,_#eff6ff_100%)] p-5 text-white shadow-[0_36px_90px_rgba(37,99,235,0.18)] md:p-7">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2 text-sm text-white/78">
                                    <MapPinned size={14} />
                                    <span>{provinceName || "Đơn vị công khai"}</span>
                                    <span>›</span>
                                    <span className="font-semibold text-white">{wardName}</span>
                                </div>
                                <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">{wardName}</h1>
                                <p className="mt-3 max-w-3xl text-sm leading-6 text-white/82 md:text-base">
                                    {provinceName ? `${wardName}, ${provinceName}` : wardName}. Dữ liệu đang hiển thị cho năm {share?.currentYear ?? new Date().getFullYear()}.
                                </p>
                            </div>
                        </div>

                        <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
                            <div className="public-summary-stat-card public-summary-stat-card--blue relative overflow-hidden">
                                <div className="absolute top-0 right-0 opacity-10 text-blue-600"><House size={60} /></div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className="public-summary-stat-card__icon bg-blue-50 text-blue-600">
                                            <House size={20} />
                                        </span>
                                        <div className="public-summary-stat-card__value text-blue-600 text-lg font-bold">{Number(summary?.total ?? 0).toLocaleString("vi-VN")}</div>
                                    </div>
                                    <p className="public-summary-stat-card__label text-xs">Hộ gia đình</p>
                                </div>
                            </div>
                            <div className="public-summary-stat-card public-summary-stat-card--rose relative overflow-hidden">
                                <div className="absolute top-0 right-0 opacity-10 text-rose-600"><Users size={60} /></div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className="public-summary-stat-card__icon bg-rose-50 text-rose-600">
                                            <Users size={20} />
                                        </span>
                                        <div className="public-summary-stat-card__value text-rose-600 text-lg font-bold">{Number(summary?.poor ?? 0).toLocaleString("vi-VN")}</div>
                                    </div>
                                    <p className="public-summary-stat-card__label text-xs">Hộ nghèo</p>
                                </div>
                            </div>

                            <div className="public-summary-stat-card public-summary-stat-card--amber relative overflow-hidden">
                                <div className="absolute top-0 right-0 opacity-10 text-amber-600"><Users size={60} /></div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className="public-summary-stat-card__icon bg-amber-50 text-amber-600">
                                            <Users size={20} />
                                        </span>
                                        <div className="public-summary-stat-card__value text-amber-600 text-lg font-bold">{Number(summary?.nearPoor ?? 0).toLocaleString("vi-VN")}</div>
                                    </div>
                                    <p className="public-summary-stat-card__label text-xs">Hộ cận nghèo</p>
                                </div>
                            </div>

                            <div className="public-summary-stat-card public-summary-stat-card--emerald relative overflow-hidden">
                                <div className="absolute top-0 right-0 opacity-10 text-emerald-600"><Users size={60} /></div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className="public-summary-stat-card__icon bg-emerald-50 text-emerald-600">
                                            <Users size={20} />
                                        </span>
                                        <div className="public-summary-stat-card__value text-emerald-600 text-lg font-bold">{normalHouseholdCount.toLocaleString("vi-VN")}</div>
                                    </div>
                                    <p className="public-summary-stat-card__label text-xs">Hộ thường</p>
                                </div>
                            </div>
                        </div>
                        <div
                            id="public-note-card"
                            className="rounded-[1.75rem] border border-blue-200 bg-[linear-gradient(180deg,rgba(239,246,255,0.92),rgba(248,250,252,0.96))] p-5 shadow-sm mt-4"
                        >
                            <div className="flex items-start gap-3">
                                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                                    <CircleAlert size={16} />
                                </span>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Ghi chú</p>
                                    <p className="mt-2 text-base leading-7 text-slate-700">
                                        {overview?.note || "Chưa có ghi chú công khai cho xã/phường này."}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>



                    <PovertyPublicMapStage
                        markers={filteredMarkers}
                        boundaryGeoJson={wardBoundaryGeoJson}
                        loading={loading}
                        title={buildPublicWardMapTitle(wardName)}
                        heightClassName={getPublicMapHeightClass("ward")}
                        onSelectHousehold={openHouseholdDetail}
                    />

                    <section className="rounded-[2rem] border border-slate-200 bg-white/92 p-4 shadow-[0_28px_72px_rgba(15,23,42,0.08)] md:p-6">
                        <Tabs
                            activeKey={activeExplorerTab}
                            onChange={(key) => setActiveExplorerTab(key as PublicExplorerTabKey)}
                            items={[
                                {
                                    key: "list",
                                    label: (
                                        <span className="inline-flex items-center gap-2">
                                            <Users size={15} />
                                            Danh sách hộ
                                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                                                {filteredMarkers.length.toLocaleString("vi-VN")}
                                            </span>
                                        </span>
                                    ),
                                    children: (
                                        <div className="space-y-5">
                                            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                                <div>
                                                    <h2 className="text-xl font-semibold text-slate-900">Danh sách hộ gia đình</h2>
                                                    <p className="mt-1 text-sm text-slate-500">
                                                        {buildPublicWardHouseholdListDescription()}
                                                    </p>
                                                </div>
                                                <Input
                                                    value={search}
                                                    onChange={(event) => setSearch(event.target.value)}
                                                    allowClear
                                                    prefix={<Search size={16} className="text-slate-400" />}
                                                    placeholder="Tìm kiếm hộ gia đình..."
                                                    className="xl:max-w-sm"
                                                />
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                {POVERTY_FILTER_OPTIONS.map((item) => (
                                                    <button
                                                        key={item.value}
                                                        type="button"
                                                        onClick={() => setPovertyFilter(item.value)}
                                                        className={povertyFilter === item.value ? "public-filter-pill public-filter-pill--active" : "public-filter-pill"}
                                                    >
                                                        {item.label}
                                                    </button>
                                                ))}
                                            </div>

                                            {filteredMarkers.length > 0 ? (
                                                <div className="grid gap-4 xl:grid-cols-3">
                                                    {filteredMarkers.map((marker) => (
                                                        <button
                                                            key={marker.id}
                                                            type="button"
                                                            onClick={() => openHouseholdDetail(marker)}
                                                            className="public-surface-card text-left"
                                                        >
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                                                                            <Users size={18} />
                                                                        </span>
                                                                        <div className="min-w-0">
                                                                            <p className="truncate text-lg font-semibold text-slate-900">
                                                                                {marker.headFullName || marker.code || "Chưa cập nhật chủ hộ"}
                                                                            </p>
                                                                            <p className="mt-1 truncate text-sm text-slate-400">
                                                                                {marker.code || "Chưa có mã hộ"}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <p className="mt-4 line-clamp-2 text-sm text-slate-500">
                                                                        {marker.address || marker.areaName || marker.wardName || "Chưa cập nhật địa bàn"}
                                                                    </p>
                                                                </div>
                                                                <Tag className="!m-0 !rounded-full" color={povertyTypeColor(marker.povertyType)}>
                                                                    {povertyTypeLabel(marker.povertyType)}
                                                                </Tag>
                                                            </div>

                                                            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500">
                                                                <span>{Number(marker.memberCount ?? 0).toLocaleString("vi-VN")} thành viên</span>
                                                                <span className="font-medium text-blue-600">Xem chi tiết</span>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50/80 p-10">
                                                    <Empty description="Không tìm thấy hộ phù hợp với bộ lọc hiện tại" />
                                                </div>
                                            )}
                                        </div>
                                    ),
                                },
                                {
                                    key: "area",
                                    label: (
                                        <span className="inline-flex items-center gap-2">
                                            <Building2 size={15} />
                                            Khu vực/Ấp
                                            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700">
                                                {areaSummaries.length.toLocaleString("vi-VN")}
                                            </span>
                                        </span>
                                    ),
                                    children: (
                                        <div className="space-y-5">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div>
                                                    <h2 className="text-xl font-semibold text-slate-900">Danh sách khu vực/ấp</h2>
                                                </div>
                                            </div>

                                            {areaSummaries.length > 0 ? (
                                                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                                                    {areaSummaries.map((item) => {
                                                        return (
                                                            <button
                                                                key={item.areaId ?? item.areaName}
                                                                type="button"
                                                                onClick={() => {
                                                                    if (!item.areaId) return;
                                                                    router.push(
                                                                        buildPublicPovertyAreaDetailUrl(
                                                                            slug,
                                                                            buildPublicAreaSlug(item.areaName, item.areaId)
                                                                        )
                                                                    );
                                                                }}
                                                                className="public-surface-card text-left"
                                                            >
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div className="min-w-0">
                                                                        <p className="flex items-center gap-2 truncate text-xl font-semibold text-slate-900"><Building2 size={15} />{item.areaName}</p>
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="text-blue-600">Xem chi tiết</p>
                                                                    </div>
                                                                </div>

                                                                <div className="mt-5 grid grid-cols-3 gap-3">
                                                                    <div className="rounded-2xl bg-blue-50 px-3 py-3">
                                                                        <p className="text-xs uppercase tracking-wide text-blue-400">Tổng</p>
                                                                        <p className="mt-2 text-xl font-semibold text-blue-900">{item.totalCount.toLocaleString("vi-VN")}</p>
                                                                    </div>
                                                                    <div className="rounded-2xl bg-rose-50 px-3 py-3">
                                                                        <p className="text-xs uppercase tracking-wide text-rose-400">Nghèo</p>
                                                                        <p className="mt-2 text-xl font-semibold text-rose-600">{item.poorCount.toLocaleString("vi-VN")}</p>
                                                                    </div>
                                                                    <div className="rounded-2xl bg-amber-50 px-3 py-3">
                                                                        <p className="text-xs uppercase tracking-wide text-amber-400">Cận nghèo</p>
                                                                        <p className="mt-2 text-xl font-semibold text-amber-600">{item.nearPoorCount.toLocaleString("vi-VN")}</p>
                                                                    </div>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50/80 p-10">
                                                    <Empty description="Chưa có dữ liệu khu vực/ấp công khai" />
                                                </div>
                                            )}
                                        </div>
                                    ),
                                },
                            ]}
                        />
                    </section>
                </div>
            </div>
        </>
    );
}

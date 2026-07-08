"use client";

import PovertyPublicAreaAdministrativeModal from "@/components/poverty/PovertyPublicAreaAdministrativeModal";
import PovertyPublicMapStage from "@/components/poverty/PovertyPublicMapStage";
import {
    buildPovertyWardPublicUrl,
    buildPublicPovertyHouseholdDetailUrl,
    filterPublicPovertyMarkers,
    getPublicMapHeightClass,
} from "@/components/poverty/poverty-public-map-utils";
import { povertyTypeColor, povertyTypeLabel } from "@/components/poverty/poverty-utils";
import { endpoints } from "@/lib/endpoints";
import { publicApiGet } from "@/lib/public-api";
import type { PublicPovertyAreaDetailResponse, PublicPovertyMarker } from "@/types/poverty";
import { Alert, Button, Empty, Input, Tag } from "antd";
import {
    ArrowLeft,
    Building2,
    CircleAlert,
    House,
    MapPinned,
    RefreshCcw,
    Search,
    Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type PovertyPublicAreaDetailPageProps = {
    slug: string;
    areaSlug: string;
};

type PublicPovertyFilter = "ALL" | "POOR" | "NEAR_POOR" | "NONE";

const POVERTY_FILTER_OPTIONS: Array<{ value: PublicPovertyFilter; label: string }> = [
    { value: "ALL", label: "Tất cả" },
    { value: "POOR", label: "Hộ nghèo" },
    { value: "NEAR_POOR", label: "Hộ cận nghèo" },
    { value: "NONE", label: "Hộ thường" },
];

export default function PovertyPublicAreaDetailPage({
    slug,
    areaSlug,
}: PovertyPublicAreaDetailPageProps) {
    const router = useRouter();
    const [data, setData] = useState<PublicPovertyAreaDetailResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [povertyFilter, setPovertyFilter] = useState<PublicPovertyFilter>("ALL");
    const [administrativeModalOpen, setAdministrativeModalOpen] = useState(false);

    const loadAreaDetail = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await publicApiGet<PublicPovertyAreaDetailResponse>(
                endpoints.poverty.publicAreaBySlug(slug, areaSlug)
            );
            setData(response);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "Vui lòng thử lại");
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [areaSlug, slug]);

    useEffect(() => {
        void loadAreaDetail();
    }, [loadAreaDetail]);

    const share = data?.share;
    const area = data?.area ?? null;
    const summary = data?.summary;
    const households = useMemo(() => data?.households ?? [], [data?.households]);
    const note = area?.description || area?.note || "Chưa có mô tả công khai cho khu vực này.";

    const filteredHouseholds = useMemo(
        () => filterPublicPovertyMarkers(households, {
            search,
            activeAreaId: area?.id ?? null,
            povertyFilter,
        }),
        [area?.id, households, povertyFilter, search]
    );

    const openHouseholdDetail = useCallback((marker: PublicPovertyMarker) => {
        router.push(buildPublicPovertyHouseholdDetailUrl(slug, marker.id));
    }, [router, slug]);

    if (error && !loading && !data) {
        return (
            <div className="mx-auto max-w-4xl p-4 md:p-6">
                <Alert
                    type="error"
                    showIcon
                    message="Không thể mở khu vực/ấp công khai"
                    description={error}
                    action={(
                        <Button size="small" icon={<RefreshCcw size={14} />} onClick={() => void loadAreaDetail()}>
                            Thử lại
                        </Button>
                    )}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[linear-gradient(180deg,#eef6ff_0%,#f8fbff_18%,#ffffff_100%)] p-4 md:p-6">
            <div className="mx-auto max-w-7xl space-y-6">
                <section className="public-hero-shell overflow-hidden rounded-[2rem] border border-blue-100 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.28),_transparent_32%),linear-gradient(180deg,_#2563eb_0%,_#3b82f6_24%,_#dbeafe_72%,_#eff6ff_100%)] p-5 text-white shadow-[0_36px_90px_rgba(37,99,235,0.18)] md:p-7">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                            <Link
                                href={buildPovertyWardPublicUrl(slug)}
                                className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/12 px-3 py-1 text-sm text-white/88"
                            >
                                <ArrowLeft size={14} />
                                Quay lại bản đồ
                            </Link>
                            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-white/78">
                                <MapPinned size={14} />
                                <span>{share?.provinceName || "Đơn vị công khai"}</span>
                                <span>›</span>
                                <span>{share?.wardName || "Xã/Phường"}</span>
                                <span>›</span>
                                <span className="font-semibold text-white">{area?.name || "Khu vực/Ấp"}</span>
                            </div>
                            <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
                                {area?.name || "Khu vực/Ấp"}
                            </h1>
                            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/82 md:text-base">
                                Dữ liệu công khai của khu vực thuộc {share?.wardName || "xã/phường"} cho năm {share?.currentYear ?? new Date().getFullYear()}.
                            </p>
                        </div>

                        <Button
                            type="default"
                            className="!h-auto !rounded-2xl !border-white/18 !bg-white/12 !px-4 !py-3 !font-medium !text-white hover:!border-white/32 hover:!bg-white/18 hover:!text-white"
                            icon={<Building2 size={16} />}
                            onClick={() => setAdministrativeModalOpen(true)}
                        >
                            Thông tin hành chính
                        </Button>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
                        <div className="public-summary-stat-card public-summary-stat-card--blue">
                            <span className="public-summary-stat-card__icon bg-blue-50 text-blue-600">
                                <House size={20} />
                            </span>
                            <div className="public-summary-stat-card__value text-blue-600">{Number(summary?.total ?? 0).toLocaleString("vi-VN")}</div>
                            <p className="public-summary-stat-card__label">Hộ gia đình</p>
                        </div>
                        <div className="public-summary-stat-card public-summary-stat-card--emerald">
                            <span className="public-summary-stat-card__icon bg-emerald-50 text-emerald-600">
                                <Users size={20} />
                            </span>
                            <div className="public-summary-stat-card__value text-emerald-600">{Number(summary?.normal ?? 0).toLocaleString("vi-VN")}</div>
                            <p className="public-summary-stat-card__label">Hộ thường</p>
                        </div>
                        <div className="public-summary-stat-card public-summary-stat-card--amber">
                            <span className="public-summary-stat-card__icon bg-amber-50 text-amber-600">
                                <CircleAlert size={20} />
                            </span>
                            <div className="public-summary-stat-card__value text-amber-600">{Number(summary?.nearPoor ?? 0).toLocaleString("vi-VN")}</div>
                            <p className="public-summary-stat-card__label">Hộ cận nghèo</p>
                        </div>
                        <div className="public-summary-stat-card public-summary-stat-card--rose">
                            <span className="public-summary-stat-card__icon bg-rose-50 text-rose-600">
                                <CircleAlert size={20} />
                            </span>
                            <div className="public-summary-stat-card__value text-rose-600">{Number(summary?.poor ?? 0).toLocaleString("vi-VN")}</div>
                            <p className="public-summary-stat-card__label">Hộ nghèo</p>
                        </div>
                    </div>
                    <div className="rounded-[1.75rem] border border-blue-200 bg-[linear-gradient(180deg,rgba(239,246,255,0.92),rgba(248,250,252,0.96))] p-5 shadow-sm mt-4">
                        <div className="flex items-start gap-3">
                            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                                <CircleAlert size={16} />
                            </span>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Ghi chú</p>
                                <p className="mt-2 text-base leading-7 text-slate-700">{note}</p>
                            </div>
                        </div>
                    </div>
                </section>



                <section className="rounded-[2rem] border border-slate-200 bg-white/92 p-4 shadow-[0_28px_72px_rgba(15,23,42,0.08)] md:p-6">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div>
                            <h2 className="text-xl font-semibold text-slate-900">Danh sách hộ gia đình</h2>
                            <p className="mt-1 text-sm text-slate-500">
                                Theo dõi các hộ công khai thuộc khu vực {area?.name || "đang chọn"}.
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

                    <div className="mt-5 flex flex-wrap gap-2">
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

                    <div className="mt-6">
                        {filteredHouseholds.length > 0 ? (
                            <div className="grid gap-4 xl:grid-cols-3">
                                {filteredHouseholds.map((marker) => (
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
                                <Empty description="Không có hộ phù hợp trong khu vực này" />
                            </div>
                        )}
                    </div>
                </section>

                <section className="space-y-4">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900">Bản đồ khu vực</h2>
                    </div>
                    <PovertyPublicMapStage
                        markers={filteredHouseholds}
                        loading={loading}
                        title={`Bản đồ khu vực ${area?.name || ""}`.trim()}
                        heightClassName={getPublicMapHeightClass("area")}
                        onSelectHousehold={openHouseholdDetail}
                    />
                </section>
            </div>

            <PovertyPublicAreaAdministrativeModal
                open={administrativeModalOpen}
                onClose={() => setAdministrativeModalOpen(false)}
                area={area}
            />
        </div>
    );
}

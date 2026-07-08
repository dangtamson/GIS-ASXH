"use client";

import PovertyPublicMapStage from "@/components/poverty/PovertyPublicMapStage";
import { getPublicMapHeightClass } from "@/components/poverty/poverty-public-map-utils";
import {
    formatDate,
    getPublicHouseholdTheme,
    householdStatusLabel,
    povertyTypeLabel,
} from "@/components/poverty/poverty-utils";
import { publicApiGet } from "@/lib/public-api";
import { endpoints } from "@/lib/endpoints";
import type { PublicPovertyHouseholdDetailResponse, PublicPovertyMarker } from "@/types/poverty";
import { Alert, Button, Empty, Tabs } from "antd";
import { ArrowLeft, ExternalLink, HeartHandshake, ImageIcon, MapPinned, RefreshCcw, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type PovertyPublicHouseholdDetailPageProps = {
    slug: string;
    householdId: string;
};

const PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "";

function resolvePublicFileUrl(filePath?: string | null): string {
    const value = String(filePath ?? "").trim();
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    if (!PUBLIC_API_BASE_URL) return value;
    return value.startsWith("/") ? `${PUBLIC_API_BASE_URL}${value}` : `${PUBLIC_API_BASE_URL}/${value}`;
}

function buildGoogleMapsUrl(latitude?: number | null, longitude?: number | null): string {
    if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
        return "";
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
}

export default function PovertyPublicHouseholdDetailPage({
    slug,
    householdId,
}: PovertyPublicHouseholdDetailPageProps) {
    const [data, setData] = useState<PublicPovertyHouseholdDetailResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadDetail = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await publicApiGet<PublicPovertyHouseholdDetailResponse>(
                endpoints.poverty.publicHouseholdBySlug(slug, householdId)
            );
            setData(response);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "Vui lòng thử lại");
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [householdId, slug]);

    useEffect(() => {
        void loadDetail();
    }, [loadDetail]);

    const household = data?.household;
    const fieldPhotos = useMemo(() => data?.fieldPhotos ?? [], [data?.fieldPhotos]);
    const supports = useMemo(() => data?.supports ?? [], [data?.supports]);
    const googleMapsUrl = buildGoogleMapsUrl(household?.latitude, household?.longitude);
    const householdTheme = useMemo(() => getPublicHouseholdTheme(household?.povertyType), [household?.povertyType]);
    const detailMarker = useMemo<PublicPovertyMarker[]>(() => {
        if (!household) return [];
        return [{
            id: household.id,
            code: household.code ?? null,
            year: data?.share.currentYear ?? new Date().getFullYear(),
            povertyType: household.povertyType ?? "POOR",
            status: household.status ?? "ACTIVE",
            areaId: household.areaId ?? null,
            areaName: household.areaName ?? null,
            wardName: household.wardName ?? null,
            address: household.address ?? null,
            latitude: household.latitude ?? null,
            longitude: household.longitude ?? null,
            headFullName: household.headFullName ?? null,
            memberCount: household.memberCount ?? 0,
            fieldPhotoCount: data?.summary?.fieldPhotoCount ?? 0,
            supportCount: data?.summary?.supportCount ?? 0,
            supportTotalAmount: 0,
            latestSupportDate: null,
            latestSupportMonthAmount: 0,
        }];
    }, [data?.share.currentYear, data?.summary?.fieldPhotoCount, data?.summary?.supportCount, household]);

    if (error && !loading && !data) {
        return (
            <div className="mx-auto max-w-4xl p-4 md:p-6">
                <Alert
                    type="error"
                    showIcon
                    message="Không thể mở chi tiết hộ công khai"
                    description={error}
                    action={(
                        <Button size="small" icon={<RefreshCcw size={14} />} onClick={() => void loadDetail()}>
                            Thử lại
                        </Button>
                    )}
                />
            </div>
        );
    }

    return (
        <div className={`min-h-screen p-4 transition-colors duration-500 md:p-6 ${householdTheme.pageBackgroundClassName}`}>
            <div className="mx-auto max-w-7xl space-y-6">
                <section className={`overflow-hidden rounded-[2rem] p-6 text-white transition-all duration-500 md:p-8 ${householdTheme.heroClassName}`}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                            <Link
                                href={`/ban-do-ho-ngheo-cong-khai/${slug}`}
                                className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/12 px-3 py-1 text-sm text-white/88"
                            >
                                <ArrowLeft size={14} />
                                Quay lại bản đồ công khai
                            </Link>
                            <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
                                {household?.headFullName || household?.code || "Hộ gia đình"}
                            </h1>
                            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/82 md:text-base">
                                {[data?.share.wardName, data?.share.provinceName].filter(Boolean).join(", ") || "Thông tin hộ công khai"}.
                                {household?.status ? ` Trạng thái: ${householdStatusLabel(household.status)}.` : ""}
                            </p>
                        </div>


                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
                        <div className="public-detail-stat-card">
                            <span>Phân loại hộ</span>
                            <strong>{povertyTypeLabel(household?.povertyType)}</strong>
                        </div>
                        <div className="public-detail-stat-card">
                            <span>Thành viên</span>
                            <strong>{Number(household?.memberCount ?? 0).toLocaleString("vi-VN")}</strong>
                        </div>
                        <div className="public-detail-stat-card">
                            <span>Hình ảnh</span>
                            <strong>{Number(data?.summary?.fieldPhotoCount ?? 0).toLocaleString("vi-VN")}</strong>
                        </div>
                        <div className="public-detail-stat-card">
                            <span>Đợt hỗ trợ</span>
                            <strong>{Number(data?.summary?.supportCount ?? 0).toLocaleString("vi-VN")}</strong>
                        </div>
                    </div>
                </section>

                <section className="rounded-[2rem] border border-slate-200 bg-white/92 p-4 shadow-[0_28px_72px_rgba(15,23,42,0.08)] md:p-6">
                    <Tabs
                        defaultActiveKey="info"
                        items={[
                            {
                                key: "info",
                                label: "Thông tin",
                                children: (
                                    <div className="space-y-6">
                                        <div className={`rounded-[1.75rem] border p-4 ${householdTheme.surfaceClassName}`}>
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-lg font-semibold text-slate-900">Vị trí trên bản đồ</p>
                                                    <p className="mt-1 text-sm text-slate-500">Vị trí công khai của hộ gia đình trên bản đồ số.</p>
                                                </div>
                                                {googleMapsUrl ? (
                                                    <Button
                                                        type="link"
                                                        className={`!px-0 ${householdTheme.linkClassName}`}
                                                        icon={<ExternalLink size={14} />}
                                                        href={googleMapsUrl}
                                                        target="_blank"
                                                    >
                                                        Mở Google Maps
                                                    </Button>
                                                ) : null}
                                            </div>
                                            <div className="mt-4 overflow-hidden rounded-[1.25rem]">
                                                <PovertyPublicMapStage
                                                    markers={detailMarker}
                                                    loading={loading}
                                                    title="Vị trí hộ trên bản đồ"
                                                    heightClassName={getPublicMapHeightClass("household")}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid gap-6 xl:grid-cols-[1.05fr_1fr]">
                                            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${householdTheme.surfaceIconClassName}`}>
                                                        <MapPinned size={18} />
                                                    </span>
                                                    <div>
                                                        <p className="text-xl font-semibold text-slate-900">Thông tin cơ bản</p>
                                                        <p className="text-sm text-slate-500">Thông tin nhận diện công khai của hộ gia đình.</p>
                                                    </div>
                                                </div>

                                                <dl className="mt-6 divide-y divide-slate-100">
                                                    <div className="grid gap-1 py-4 md:grid-cols-[140px_minmax(0,1fr)]">
                                                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Mã hộ</dt>
                                                        <dd className="text-base font-medium text-slate-900">{household?.code || "-"}</dd>
                                                    </div>
                                                    <div className="grid gap-1 py-4 md:grid-cols-[140px_minmax(0,1fr)]">
                                                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Chủ hộ</dt>
                                                        <dd className="text-base font-medium text-slate-900">{household?.headFullName || "-"}</dd>
                                                    </div>
                                                    <div className="grid gap-1 py-4 md:grid-cols-[140px_minmax(0,1fr)]">
                                                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Phân loại</dt>
                                                        <dd className="text-base font-medium text-slate-900">{povertyTypeLabel(household?.povertyType)}</dd>
                                                    </div>
                                                    <div className="grid gap-1 py-4 md:grid-cols-[140px_minmax(0,1fr)]">
                                                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Địa bàn</dt>
                                                        <dd className="text-base font-medium text-slate-900">
                                                            {[household?.wardName, household?.areaName].filter(Boolean).join(" / ") || "-"}
                                                        </dd>
                                                    </div>
                                                    <div className="grid gap-1 py-4 md:grid-cols-[140px_minmax(0,1fr)]">
                                                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Địa chỉ</dt>
                                                        <dd className="text-base font-medium text-slate-900">{household?.address || "-"}</dd>
                                                    </div>
                                                    <div className="grid gap-1 py-4 md:grid-cols-[140px_minmax(0,1fr)]">
                                                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Số thành viên</dt>
                                                        <dd className="text-base font-medium text-slate-900">{Number(household?.memberCount ?? 0).toLocaleString("vi-VN")}</dd>
                                                    </div>
                                                </dl>
                                            </div>

                                            <div className="space-y-6">
                                                <div className={`rounded-[1.75rem] border p-5 shadow-sm ${householdTheme.surfaceClassName}`}>
                                                    <div className="flex items-center gap-3">
                                                        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${householdTheme.surfaceIconClassName}`}>
                                                            <Users size={18} />
                                                        </span>
                                                        <div>
                                                            <p className="text-xl font-semibold text-slate-900">Hoàn cảnh gia đình</p>
                                                            <p className="text-sm text-slate-500">
                                                                {data?.latestContext?.recordedAt ? `Cập nhật ${formatDate(data.latestContext.recordedAt)}` : "Thông tin công khai gần nhất"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <p className="mt-5 text-base leading-7 text-slate-700">
                                                        {data?.latestContext?.familySituation || "Chưa có thông tin hoàn cảnh gia đình công khai."}
                                                    </p>
                                                </div>

                                                <div className={`rounded-[1.75rem] border p-5 shadow-sm ${householdTheme.surfaceClassName}`}>
                                                    <div className="flex items-center gap-3">
                                                        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${householdTheme.surfaceIconClassName}`}>
                                                            <HeartHandshake size={18} />
                                                        </span>
                                                        <div>
                                                            <p className="text-xl font-semibold text-slate-900">Hiện trạng</p>
                                                            <p className="text-sm text-slate-500">Ghi nhận công khai của hộ gia đình.</p>
                                                        </div>
                                                    </div>
                                                    <p className="mt-5 text-base leading-7 text-slate-700">
                                                        {data?.latestContext?.currentStatus || "Chưa có thông tin hiện trạng công khai."}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ),
                            },
                            {
                                key: "photos",
                                label: "Hình ảnh",
                                children: fieldPhotos.length === 0 ? (
                                    <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50/80 p-10">
                                        <Empty description="Chưa có hình ảnh công khai" />
                                    </div>
                                ) : (
                                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                        {fieldPhotos.map((photo) => {
                                            const src = resolvePublicFileUrl(photo.filePath);
                                            return (
                                                <article key={photo.uuid} className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
                                                    {src ? (
                                                        <img src={src} alt={photo.fileName} className="h-64 w-full object-cover" />
                                                    ) : (
                                                        <div className="flex h-64 items-center justify-center bg-slate-100 text-slate-400">
                                                            <ImageIcon size={30} />
                                                        </div>
                                                    )}
                                                    <div className="p-4">
                                                        <p className="truncate text-sm font-medium text-slate-900">{photo.fileName}</p>
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                ),
                            },
                            {
                                key: "supports",
                                label: "Lịch sử hỗ trợ",
                                children: supports.length === 0 ? (
                                    <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50/80 p-10">
                                        <Empty description="Chưa có đợt hỗ trợ công khai" />
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {supports.map((support) => (
                                            <article key={support.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                                                <div className="flex flex-wrap items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-base font-semibold text-slate-900">
                                                            {support.supportTypes.length > 0 ? support.supportTypes.join(", ") : "Đợt hỗ trợ"}
                                                        </p>
                                                        <p className="mt-1 text-sm text-slate-500">
                                                            {support.supportDate ? formatDate(support.supportDate) : "Chưa rõ thời gian"}
                                                        </p>
                                                    </div>
                                                    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${householdTheme.badgeClassName}`}>
                                                        <HeartHandshake size={14} />
                                                        Hỗ trợ
                                                    </span>
                                                </div>
                                                <p className="mt-4 text-sm leading-7 text-slate-600">
                                                    {support.content || support.supportingUnit || "Chưa có nội dung hỗ trợ công khai."}
                                                </p>
                                            </article>
                                        ))}
                                    </div>
                                ),
                            },
                        ]}
                    />
                </section>
            </div>
        </div>
    );
}

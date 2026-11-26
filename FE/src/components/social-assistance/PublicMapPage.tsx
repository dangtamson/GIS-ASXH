"use client";

import canThoBoundaryGeoJson from "@/components/poverty/command-dashboard/data/cantho.json";
import { endpoints } from "@/lib/endpoints";
import {
    buildPublicSocialAssistanceWardSummary,
    getPublicSocialAssistanceMapMeasureValue,
    sortPublicSocialAssistanceWardSummary
} from "@/lib/social-assistance-utils";
import type { SocialAssistanceMapMeasure } from "@/lib/social-assistance-utils";
import { PublicAssistanceLayout, PublicAssistanceToolbar } from "./SocialAssistanceLayout";
import { publicApiGet } from "@/lib/public-api";
import type { SocialAssistancePublicMapItem } from "@/types/social-assistance";
import { Alert, Button, Empty, Select, Spin, Table, Tag } from "antd";
import type { TableColumnsType } from "antd";
import type { FeatureCollection, Geometry } from "geojson";
import { Banknote, Gift, MapPinned, RotateCcw, ShieldCheck, UsersRound } from "lucide-react";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

const ResultsMap = dynamic(() => import("./PublicResultsLeafletMap"), { ssr: false });
type WardProperties = { adcode?: number; name?: string; parent?: { adcode?: number } };
const BOUNDARIES = canThoBoundaryGeoJson as FeatureCollection<Geometry, WardProperties>;
const wardName = (code: string) => BOUNDARIES.features.find((feature) => String(feature.properties?.adcode) === code)?.properties?.name ?? code;
type MapResponse = { items: SocialAssistancePublicMapItem[] };

const currency = (amount: number) => `${amount.toLocaleString("vi-VN")} đ`;

export default function PublicMapPage({ slug }: { slug: string }) {
    const [items, setItems] = useState<SocialAssistancePublicMapItem[]>([]);
    const [loadedSlug, setLoadedSlug] = useState<string | null>(null);
    const [loadFailure, setLoadFailure] = useState<{ slug: string; message: string } | null>(null);
    const [period, setPeriod] = useState<string>();
    const [programId, setProgramId] = useState<string>();
    const [provinceCode, setProvinceCode] = useState<string>();
    const [wardCode, setWardCode] = useState<string>();
    const [measure, setMeasure] = useState<SocialAssistanceMapMeasure>("recipients");

    useEffect(() => {
        let active = true;
        publicApiGet<MapResponse>(endpoints.socialAssistance.publicMap(slug))
            .then((response) => {
                if (!active) return;
                setItems(response.items ?? []);
                setLoadFailure(null);
                setLoadedSlug(slug);
            })
            .catch((loadError: unknown) => {
                if (!active) return;
                setLoadFailure({ slug, message: loadError instanceof Error ? loadError.message : "Không thể tải kết quả công khai." });
                setLoadedSlug(slug);
            });
        return () => { active = false; };
    }, [slug]);

    const loading = loadedSlug !== slug;
    const error = loadFailure?.slug === slug ? loadFailure.message : null;

    const periods = [...new Map(items.map((item) => [`${item.periodStart}/${item.periodEnd}`, item])).values()];
    const programs = [...new Map(items.map((item) => [item.programId, { id: item.programId, title: item.programTitle }])).values()];
    const provinces = [...new Set(items.map((item) => item.provinceCode))];
    const wards = [...new Set(items.filter((item) => !provinceCode || item.provinceCode === provinceCode).map((item) => item.wardCode))];
    const visibleItems = items.filter((item) =>
        (!period || `${item.periodStart}/${item.periodEnd}` === period)
        && (!programId || item.programId === programId)
        && (!provinceCode || item.provinceCode === provinceCode)
        && (!wardCode || item.wardCode === wardCode)
    );
    const mapFeatures = useMemo(() => ({
        type: "FeatureCollection" as const,
        features: BOUNDARIES.features.filter((feature) => visibleItems.some((item) =>
            String(feature.properties?.adcode) === item.wardCode && String(feature.properties?.parent?.adcode) === item.provinceCode
        ))
    }), [visibleItems]);
    const supportedWardCodes = new Set(mapFeatures.features.map((feature) => String(feature.properties?.adcode)));
    const summary = visibleItems.reduce((current, item) => ({
        supportInstances: current.supportInstances + item.recipientCount,
        deliveredCashAmount: current.deliveredCashAmount + item.deliveredCashAmount,
        deliveredItemCount: current.deliveredItemCount + item.deliveredItemCount
    }), { supportInstances: 0, deliveredCashAmount: 0, deliveredItemCount: 0 });
    const wardRows = sortPublicSocialAssistanceWardSummary(buildPublicSocialAssistanceWardSummary(visibleItems), measure);
    const maxWardMeasureValue = Math.max(1, ...wardRows.map((ward) => getPublicSocialAssistanceMapMeasureValue(ward, measure)));
    const columns: TableColumnsType<SocialAssistancePublicMapItem> = [
        { title: "Chương trình", dataIndex: "programTitle", key: "programTitle", render: (value: string) => <span className="font-semibold text-slate-900">{value}</span> },
        { title: "Tỉnh/thành", dataIndex: "provinceCode", key: "provinceCode", render: (value: string) => <span className="text-slate-600">{value}</span> },
        { title: "Xã/phường", dataIndex: "wardCode", key: "wardCode", render: (value: string) => <span className="font-medium text-slate-800">{wardName(value)}</span> },
        { title: "Lượt nhận hỗ trợ", dataIndex: "recipientCount", key: "recipientCount", align: "right", render: (value: number) => <span className="font-semibold tabular-nums text-[#11409a]">{value.toLocaleString("vi-VN")}</span> },
        { title: "Tiền mặt đã trao", dataIndex: "deliveredCashAmount", key: "deliveredCashAmount", align: "right", render: (value: number) => <span className="font-semibold tabular-nums text-emerald-700">{currency(value)}</span> },
        { title: "Lượt trao hiện vật", dataIndex: "deliveredItemCount", key: "deliveredItemCount", align: "right", render: (value: number) => <span className="font-semibold tabular-nums text-amber-700">{value.toLocaleString("vi-VN")}</span> }
    ];

    return (
        <PublicAssistanceLayout
            slug={slug}
            title="Kết quả hỗ trợ cộng đồng"
            badge="Toàn cảnh kết quả GIS"
            subtitle="Số liệu tổng hợp đã được phê duyệt công khai theo chương trình và địa bàn xã/phường."
        >
            <div className="min-w-0 space-y-6">
                <div className="flex items-start gap-3.5 rounded-2xl border border-blue-200/80 bg-gradient-to-r from-blue-50/90 via-white to-emerald-50/60 p-4 shadow-xs sm:px-5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#11409a] text-white shadow-sm shadow-blue-900/20">
                        <ShieldCheck size={20} />
                    </span>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">Số liệu tổng hợp đã được duyệt công khai</p>
                        <p className="mt-0.5 text-xs leading-5 text-slate-600 sm:text-sm">Không hiển thị hồ sơ cá nhân hoặc vị trí hộ gia đình. Dữ liệu được cập nhật sau khi hoàn tất quy trình kiểm duyệt.</p>
                    </div>
                </div>

                {error ? <Alert type="error" showIcon message="Không thể mở bản đồ kết quả" description={error} className="!rounded-xl" /> : null}

                <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                    <MapStatCard
                        icon={<UsersRound size={19} />}
                        iconTone="bg-blue-50 text-[#11409a] ring-blue-100"
                        tone="text-[#11409a]"
                        label="Lượt nhận hỗ trợ"
                        value={summary.supportInstances.toLocaleString("vi-VN")}
                    />
                    <MapStatCard
                        icon={<Banknote size={19} />}
                        iconTone="bg-emerald-50 text-emerald-700 ring-emerald-100"
                        tone="text-emerald-700"
                        label="Tiền mặt đã trao"
                        value={currency(summary.deliveredCashAmount)}
                    />
                    <MapStatCard
                        icon={<Gift size={19} />}
                        iconTone="bg-amber-50 text-amber-700 ring-amber-100"
                        tone="text-amber-700"
                        label="Lượt trao hiện vật"
                        value={summary.deliveredItemCount.toLocaleString("vi-VN")}
                    />
                </section>

                <PublicAssistanceToolbar title="Lớp bản đồ và phạm vi" subtitle="Tùy chỉnh kỳ công khai, chương trình, chỉ số đo và khu vực hành chính" layout="grid">
                    <Select aria-label="Kỳ công khai" allowClear placeholder="Mọi kỳ công khai" value={period} options={periods.map((item) => ({ value: `${item.periodStart}/${item.periodEnd}`, label: `${item.periodStart} – ${item.periodEnd}` }))} onChange={setPeriod} />
                    <Select aria-label="Chương trình" allowClear placeholder="Mọi chương trình" value={programId} options={programs.map((program) => ({ value: program.id, label: program.title }))} onChange={setProgramId} />
                    <Select<SocialAssistanceMapMeasure> aria-label="Chỉ số bản đồ" value={measure} options={[{ value: "recipients", label: "Lượt hỗ trợ" }, { value: "cash", label: "Tiền mặt đã trao" }, { value: "items", label: "Lượt trao hiện vật" }]} onChange={setMeasure} />
                    <Select aria-label="Tỉnh/thành phố" allowClear placeholder="Mọi tỉnh/thành" value={provinceCode} options={provinces.map((code) => ({ value: code, label: `Tỉnh/thành ${code}` }))} onChange={(value) => { setProvinceCode(value); setWardCode(undefined); }} />
                    <Select aria-label="Xã/phường" allowClear placeholder="Mọi xã/phường" value={wardCode} options={wards.map((code) => ({ value: code, label: wardName(code) }))} onChange={setWardCode} />
                    <div className="sm:col-span-2 lg:col-span-1 lg:ml-auto flex justify-end"><Button className="w-full lg:w-auto" icon={<RotateCcw size={15} />} onClick={() => { setPeriod(undefined); setProgramId(undefined); setProvinceCode(undefined); setWardCode(undefined); setMeasure("recipients"); }}>Đặt lại</Button></div>
                </PublicAssistanceToolbar>

                <Spin spinning={loading}>
                    <div className="space-y-6">
                        {mapFeatures.features.length > 0 ? (
                            <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-50/70 px-5 py-4">
                                    <div className="flex items-center gap-3">
                                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#11409a] ring-1 ring-blue-100">
                                            <MapPinned size={18} />
                                        </span>
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#11409a]">Bản đồ không gian</p>
                                            <h2 className="mt-0.5 text-base font-bold text-slate-900">Bản đồ phân bổ hỗ trợ</h2>
                                        </div>
                                    </div>
                                    <Tag className="!m-0 !rounded-full !border-0 !bg-emerald-50 !px-3 !py-0.5 !font-semibold !text-emerald-700" color="green">Dữ liệu đã duyệt</Tag>
                                </div>
                                <div className="grid min-w-0 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,.85fr)]">
                                    <div className="min-w-0 border-b border-slate-200/80 lg:border-b-0 lg:border-r">
                                        <ResultsMap features={mapFeatures} items={visibleItems} measure={measure} heightClassName="h-[380px] sm:h-[500px]" />
                                        <div aria-label={`Chú giải: ${measure}`} className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 bg-slate-50/70 px-5 py-3 text-xs text-slate-600">
                                            <span className="font-semibold text-slate-800">{measure === "cash" ? "Tiền mặt đã trao" : measure === "items" ? "Lượt trao hiện vật" : "Lượt hỗ trợ"}</span>
                                            <div className="flex items-center gap-2">
                                                <span>Ít</span>
                                                <span className="h-2.5 w-6 rounded-full bg-[#7dd3fc]" aria-hidden="true" />
                                                <span className="h-2.5 w-6 rounded-full bg-[#0284c7]" aria-hidden="true" />
                                                <span className="h-2.5 w-6 rounded-full bg-[#e11d48]" aria-hidden="true" />
                                                <span>Nhiều</span>
                                            </div>
                                        </div>
                                    </div>
                                    <aside className="flex min-w-0 flex-col bg-white">
                                        <div className="border-b border-slate-200/80 bg-gradient-to-br from-slate-50 to-blue-50/50 px-5 py-4">
                                            <h3 className="text-base font-bold text-slate-900">Kết quả theo địa bàn</h3>
                                            <p className="mt-0.5 text-xs text-slate-500">Xếp theo {measure === "cash" ? "tiền mặt" : measure === "items" ? "lượt hiện vật" : "lượt hỗ trợ"}</p>
                                        </div>
                                        <div className="max-h-[480px] flex-1 overflow-y-auto divide-y divide-slate-100">
                                            {wardRows.length ? wardRows.map((ward, index) => {
                                                const value = getPublicSocialAssistanceMapMeasureValue(ward, measure);
                                                const pct = Math.max(6, Math.round((value / maxWardMeasureValue) * 100));
                                                const isSelected = wardCode === ward.wardCode;
                                                return (
                                                    <button
                                                        key={`${ward.provinceCode}-${ward.wardCode}`}
                                                        type="button"
                                                        aria-pressed={isSelected}
                                                        onClick={() => setWardCode(isSelected ? undefined : ward.wardCode)}
                                                        className={`group flex w-full flex-col gap-1.5 px-5 py-3 text-left transition-colors ${isSelected ? "bg-blue-50/90" : "bg-white hover:bg-slate-50"}`}
                                                    >
                                                        <div className="flex w-full items-center justify-between gap-3">
                                                            <span className="flex min-w-0 items-center gap-2.5">
                                                                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md font-mono text-[11px] font-bold ${index < 3 ? "bg-blue-100 text-[#11409a]" : "bg-slate-100 text-slate-500"}`}>
                                                                    {String(index + 1).padStart(2, "0")}
                                                                </span>
                                                                <span className="min-w-0 truncate text-sm font-semibold text-slate-900">
                                                                    {wardName(ward.wardCode)}
                                                                    <span className="mt-0.5 block text-xs font-normal text-slate-500">{ward.programCount} chương trình</span>
                                                                </span>
                                                            </span>
                                                            <span className="shrink-0 text-right text-sm font-bold tabular-nums text-[#11409a]">
                                                                {measure === "cash" ? currency(value) : value.toLocaleString("vi-VN")}
                                                                <span className="block text-[11px] font-normal text-slate-500">{measure === "cash" ? "đã trao" : measure === "items" ? "lượt trao" : "lượt hỗ trợ"}</span>
                                                            </span>
                                                        </div>
                                                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-300 ${isSelected ? "bg-[#11409a]" : "bg-sky-500/80 group-hover:bg-[#11409a]"}`}
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                        </div>
                                                    </button>
                                                );
                                            }) : <Empty className="py-10" description="Chưa có số liệu địa bàn" />}
                                        </div>
                                    </aside>
                                </div>
                            </section>
                        ) : null}

                        {!supportedWardCodes.size && visibleItems.length > 0 ? (
                            <Alert type="info" showIcon message="Bản đồ ranh giới chưa có dữ liệu cho địa bàn này" description="Các kết quả tổng hợp vẫn được hiển thị bên dưới." className="!rounded-xl" />
                        ) : null}

                        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-50/70 px-5 py-4">
                                <div className="flex items-center gap-2.5">
                                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                                        <UsersRound size={16} />
                                    </span>
                                    <h2 className="text-base font-bold text-slate-900">Kết quả theo chương trình và địa bàn</h2>
                                </div>
                                <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs font-semibold text-slate-600">{visibleItems.length} dòng tổng hợp</span>
                            </div>
                            <Table<SocialAssistancePublicMapItem>
                                rowKey={(row) => `${row.periodStart}-${row.programId}-${row.provinceCode}-${row.wardCode}`}
                                columns={columns}
                                dataSource={visibleItems}
                                pagination={{ pageSize: 15, showSizeChanger: false }}
                                scroll={{ x: 760 }}
                                locale={{ emptyText: <Empty description="Chưa có kết quả công khai trong phạm vi chọn" /> }}
                            />
                        </section>
                    </div>
                </Spin>

                <p className="rounded-xl border border-slate-200/70 bg-white/80 px-4 py-3 text-xs leading-5 text-slate-500">
                    Lượt nhận hỗ trợ được tổng hợp theo từng chương trình; một người có thể nhận hỗ trợ từ nhiều chương trình. Hiện vật được thể hiện theo lượt trao, không quy đổi thành tiền.
                </p>
            </div>
        </PublicAssistanceLayout>
    );
}

function MapStatCard({ icon, iconTone, tone, label, value }: { icon: ReactNode; iconTone: string; tone: string; label: string; value: string }) {
    return (
        <div className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-shadow hover:shadow-sm">
            <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ${iconTone}`}>{icon}</span>
            </div>
            <p className={`mt-2.5 break-words text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
        </div>
    );
}
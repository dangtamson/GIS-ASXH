"use client";

import canThoBoundaryGeoJson from "@/components/poverty/command-dashboard/data/cantho.json";
import { endpoints } from "@/lib/endpoints";
import {
    buildPublicSocialAssistanceWardSummary,
    getPublicSocialAssistanceMapMeasureValue,
    sortPublicSocialAssistanceWardSummary
} from "@/lib/social-assistance-utils";
import type { SocialAssistanceMapMeasure } from "@/lib/social-assistance-utils";
import { PublicAssistanceLayout, SocialAssistanceToolbar } from "./SocialAssistanceLayout";
import { publicApiGet } from "@/lib/public-api";
import type { SocialAssistancePublicMapItem } from "@/types/social-assistance";
import { Alert, Button, Empty, Select, Spin, Table, Tag } from "antd";
import type { TableColumnsType } from "antd";
import type { FeatureCollection, Geometry } from "geojson";
import { MapPinned, RotateCcw, UsersRound } from "lucide-react";
import dynamic from "next/dynamic";
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
    const columns: TableColumnsType<SocialAssistancePublicMapItem> = [
        { title: "Chương trình", dataIndex: "programTitle", key: "programTitle" },
        { title: "Tỉnh/thành", dataIndex: "provinceCode", key: "provinceCode" },
        { title: "Xã/phường", dataIndex: "wardCode", key: "wardCode", render: wardName },
        { title: "Lượt nhận hỗ trợ", dataIndex: "recipientCount", key: "recipientCount", align: "right" },
        { title: "Tiền mặt đã trao", dataIndex: "deliveredCashAmount", key: "deliveredCashAmount", align: "right", render: currency },
        { title: "Lượt trao hiện vật", dataIndex: "deliveredItemCount", key: "deliveredItemCount", align: "right" }
    ];

    return (
        <PublicAssistanceLayout slug={slug} title="Kết quả hỗ trợ cộng đồng">
            <div className="min-w-0 space-y-5">
                <Alert type="info" showIcon message="Số liệu tổng hợp đã được duyệt công khai" description="Không hiển thị hồ sơ cá nhân hoặc vị trí hộ gia đình." />
                {error ? <Alert type="error" showIcon message="Không thể mở bản đồ kết quả" description={error} /> : null}
                <section className="grid grid-cols-1 gap-3 border-b border-slate-200 pb-5 sm:grid-cols-3">
                    <div className="rounded-lg border border-[#dae2fd] bg-white p-4"><p className="text-sm text-[#444653]">Lượt nhận hỗ trợ</p><p className="mt-1 text-2xl font-semibold text-[#00288e]">{summary.supportInstances.toLocaleString("vi-VN")}</p></div>
                    <div className="rounded-lg border border-[#dae2fd] bg-white p-4"><p className="text-sm text-[#444653]">Tiền mặt đã trao</p><p className="mt-1 break-words text-2xl font-semibold text-[#006c4a]">{currency(summary.deliveredCashAmount)}</p></div>
                    <div className="rounded-lg border border-[#dae2fd] bg-white p-4"><p className="text-sm text-[#444653]">Lượt trao hiện vật</p><p className="mt-1 text-2xl font-semibold text-[#872d00]">{summary.deliveredItemCount.toLocaleString("vi-VN")}</p></div>
                </section>
                <SocialAssistanceToolbar title="Lớp bản đồ và phạm vi" layout="grid">
                    <Select aria-label="Kỳ công khai" allowClear placeholder="Mọi kỳ công khai" value={period} options={periods.map((item) => ({ value: `${item.periodStart}/${item.periodEnd}`, label: `${item.periodStart} – ${item.periodEnd}` }))} onChange={setPeriod} />
                    <Select aria-label="Chương trình" allowClear placeholder="Mọi chương trình" value={programId} options={programs.map((program) => ({ value: program.id, label: program.title }))} onChange={setProgramId} />
                    <Select<SocialAssistanceMapMeasure> aria-label="Chỉ số bản đồ" value={measure} options={[{ value: "recipients", label: "Lượt hỗ trợ" }, { value: "cash", label: "Tiền mặt đã trao" }, { value: "items", label: "Lượt trao hiện vật" }]} onChange={setMeasure} />
                    <Select aria-label="Tỉnh/thành phố" allowClear placeholder="Mọi tỉnh/thành" value={provinceCode} options={provinces.map((code) => ({ value: code, label: `Tỉnh/thành ${code}` }))} onChange={(value) => { setProvinceCode(value); setWardCode(undefined); }} />
                    <Select aria-label="Xã/phường" allowClear placeholder="Mọi xã/phường" value={wardCode} options={wards.map((code) => ({ value: code, label: wardName(code) }))} onChange={setWardCode} />
                    <div className="col-span-2 flex justify-end sm:col-span-1"><Button className="w-full sm:w-auto" icon={<RotateCcw size={15} />} onClick={() => { setPeriod(undefined); setProgramId(undefined); setProvinceCode(undefined); setWardCode(undefined); setMeasure("recipients"); }}>Đặt lại</Button></div>
                </SocialAssistanceToolbar>
                <Spin spinning={loading}>
                    {mapFeatures.features.length > 0 ? (
                        <section className="min-w-0 overflow-hidden rounded-lg border border-[#dae2fd] bg-white">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e2e7ff] px-4 py-4">
                                <div><p className="text-[11px] font-semibold uppercase text-[#00288e]">Bản đồ không gian</p><h2 className="mt-1 flex items-center gap-2 font-semibold"><MapPinned size={17} className="text-[#00288e]" />Bản đồ phân bổ hỗ trợ</h2></div>
                                <Tag color="green">Dữ liệu đã duyệt</Tag>
                            </div>
                            <div className="grid min-w-0 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,.8fr)]">
                                <div className="min-w-0 border-b border-[#e2e7ff] lg:border-b-0 lg:border-r"><ResultsMap features={mapFeatures} items={visibleItems} measure={measure} heightClassName="h-[380px] sm:h-[480px]" /><div aria-label={`Chú giải: ${measure}`} className="flex flex-wrap items-center gap-2 border-t border-[#e2e7ff] px-4 py-3 text-xs text-[#444653]"><span className="font-medium text-[#131b2e]">{measure === "cash" ? "Tiền mặt đã trao" : measure === "items" ? "Lượt trao hiện vật" : "Lượt hỗ trợ"}</span><span>Ít</span><span className="h-2.5 w-5 rounded-sm bg-[#c6e7ff]" aria-hidden="true" /><span className="h-2.5 w-5 rounded-sm bg-[#3dbeff]" aria-hidden="true" /><span className="h-2.5 w-5 rounded-sm bg-[#dc2626]" aria-hidden="true" /><span>Nhiều</span></div></div>
                                <aside className="min-w-0"><div className="border-b border-[#e2e7ff] bg-[#f2f3ff] px-4 py-4"><h3 className="font-semibold">Kết quả theo địa bàn</h3><p className="mt-1 text-xs text-[#444653]">Xếp theo {measure === "cash" ? "tiền mặt" : measure === "items" ? "lượt hiện vật" : "lượt hỗ trợ"}</p></div><div className="max-h-[480px] overflow-y-auto">{wardRows.length ? wardRows.map((ward, index) => <button key={`${ward.provinceCode}-${ward.wardCode}`} type="button" aria-pressed={wardCode === ward.wardCode} onClick={() => setWardCode(wardCode === ward.wardCode ? undefined : ward.wardCode)} className={`flex w-full items-center justify-between gap-3 border-b border-[#f2f3ff] px-4 py-3 text-left hover:bg-[#f2f3ff] ${wardCode === ward.wardCode ? "bg-[#e2e7ff]" : "bg-white"}`}><span className="flex min-w-0 items-center gap-2"><span className="font-mono text-xs text-[#757684]">{String(index + 1).padStart(2, "0")}</span><span className="truncate text-sm font-medium">{wardName(ward.wardCode)}<span className="mt-1 block text-xs font-normal text-[#444653]">{ward.programCount} chương trình</span></span></span><span className="shrink-0 text-right text-sm font-semibold text-[#00288e]">{(measure === "cash" ? currency(getPublicSocialAssistanceMapMeasureValue(ward, measure)) : getPublicSocialAssistanceMapMeasureValue(ward, measure).toLocaleString("vi-VN"))}<span className="block text-[11px] font-normal text-[#444653]">{measure === "cash" ? "đã trao" : measure === "items" ? "lượt trao" : "lượt hỗ trợ"}</span></span></button>) : <Empty className="py-8" description="Chưa có số liệu địa bàn" />}</div></aside>
                            </div>
                        </section>
                    ) : null}
                    {!supportedWardCodes.size && visibleItems.length > 0 ? (
                        <Alert type="info" showIcon message="Bản đồ ranh giới chưa có dữ liệu cho địa bàn này" description="Các kết quả tổng hợp vẫn được hiển thị bên dưới." />
                    ) : null}
                    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                        <div className="flex items-center gap-2 border-b border-slate-200 p-4"><UsersRound size={17} className="text-emerald-700" /><h2 className="font-semibold">Kết quả theo chương trình và địa bàn</h2></div>
                        <Table<SocialAssistancePublicMapItem>
                            rowKey={(row) => `${row.periodStart}-${row.programId}-${row.provinceCode}-${row.wardCode}`}
                            columns={columns}
                            dataSource={visibleItems}
                            pagination={{ pageSize: 15, showSizeChanger: false }}
                            scroll={{ x: 760 }}
                            locale={{ emptyText: <Empty description="Chưa có kết quả công khai trong phạm vi chọn" /> }}
                        />
                    </section>
                </Spin>
                <p className="text-xs text-slate-500">Lượt nhận hỗ trợ được tổng hợp theo từng chương trình; một người có thể nhận hỗ trợ từ nhiều chương trình. Hiện vật được thể hiện theo lượt trao, không quy đổi thành tiền.</p>
            </div>
        </PublicAssistanceLayout>
    );
}
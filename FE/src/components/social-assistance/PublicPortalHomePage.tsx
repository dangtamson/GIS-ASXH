"use client";

import canThoBoundaryGeoJson from "@/components/poverty/command-dashboard/data/cantho.json";
import { endpoints } from "@/lib/endpoints";
import { publicApiGet } from "@/lib/public-api";
import {
    buildPublicSocialAssistanceWardSummary,
    getPublicSocialAssistanceMapMeasureValue,
    getPublicSocialAssistancePortalSummary,
    getSocialAssistanceCategoryLabel,
    sortPublicSocialAssistanceWardSummary
} from "@/lib/social-assistance-utils";
import type { SocialAssistanceMapMeasure } from "@/lib/social-assistance-utils";
import type { SocialAssistanceProgram, SocialAssistancePublicMapItem } from "@/types/social-assistance";
import { Alert, Button, Empty, Select, Spin, Tag } from "antd";
import type { FeatureCollection, Geometry } from "geojson";
import { ArrowRight, HandHeart, MapPinned, RotateCcw, ShieldCheck } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PublicAssistanceLayout, SocialAssistanceToolbar } from "./SocialAssistanceLayout";

const PublicResultsMap = dynamic(() => import("./PublicResultsLeafletMap"), { ssr: false });
type BoundaryProperties = { adcode?: number; name?: string; parent?: { adcode?: number }; center?: number[] };
type ListResponse<T> = { items: T[] };
type OptionalLoadResult<T> = { data: T | null; failed: boolean };
const WARD_BOUNDARIES = canThoBoundaryGeoJson as FeatureCollection<Geometry, BoundaryProperties>;
const WARD_NAMES = new Map(WARD_BOUNDARIES.features.map((feature) => [String(feature.properties?.adcode ?? ""), feature.properties?.name ?? ""]));

export default function PublicPortalHomePage({ slug }: { slug: string }) {
    const [programs, setPrograms] = useState<SocialAssistanceProgram[]>([]);
    const [mapItems, setMapItems] = useState<SocialAssistancePublicMapItem[]>([]);
    const [programsEnabled, setProgramsEnabled] = useState(false);
    const [resultsEnabled, setResultsEnabled] = useState(false);
    const [intakeEnabled, setIntakeEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [serviceErrors, setServiceErrors] = useState({ programs: false, map: false, locations: false });
    const [period, setPeriod] = useState<string>();
    const [programId, setProgramId] = useState<string>();
    const [selectedWard, setSelectedWard] = useState<string>();
    const [measure, setMeasure] = useState<SocialAssistanceMapMeasure>("recipients");
    const basePath = `/an-sinh/${encodeURIComponent(slug)}`;

    useEffect(() => {
        let active = true;
        const loadOptional = async <T,>(path: string): Promise<OptionalLoadResult<T>> => {
            try {
                return { data: await publicApiGet<T>(path), failed: false };
            } catch {
                return { data: null, failed: true };
            }
        };
        void Promise.all([
            loadOptional<ListResponse<SocialAssistanceProgram>>(endpoints.socialAssistance.publicPrograms(slug)),
            loadOptional<ListResponse<SocialAssistancePublicMapItem>>(endpoints.socialAssistance.publicMap(slug)),
            loadOptional<ListResponse<{ code: string }>>(endpoints.socialAssistance.publicProvinces(slug))
        ]).then(([programResult, mapResult, locationResult]) => {
            if (!active) return;
            setPrograms(programResult.data?.items ?? []);
            setMapItems(mapResult.data?.items ?? []);
            setProgramsEnabled(programResult.data !== null);
            setResultsEnabled(mapResult.data !== null);
            setIntakeEnabled(locationResult.data !== null);
            setServiceErrors({
                programs: programResult.failed,
                map: mapResult.failed,
                locations: locationResult.failed
            });
            if (programResult.failed && mapResult.failed && locationResult.failed) {
                setLoadError("Cổng thông tin chưa mở hoặc hiện không kết nối được. Vui lòng thử lại sau.");
            }
        }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [slug]);

    const periodProgramItems = useMemo(() => mapItems.filter((item) =>
        (!period || `${item.periodStart}/${item.periodEnd}` === period)
        && (!programId || item.programId === programId)
    ), [mapItems, period, programId]);
    const visibleItems = useMemo(() => periodProgramItems.filter((item) =>
        !selectedWard || item.wardCode === selectedWard
    ), [periodProgramItems, selectedWard]);
    const summary = getPublicSocialAssistancePortalSummary(programs, visibleItems);
    const wardOptions = useMemo(
        () => buildPublicSocialAssistanceWardSummary(periodProgramItems),
        [periodProgramItems]
    );
    const rankedWardRows = sortPublicSocialAssistanceWardSummary(wardOptions, measure);
    const periods = [...new Set(mapItems.map((item) => `${item.periodStart}/${item.periodEnd}`))];
    const periodLabel = period?.replace("/", " – ") ?? "Tất cả kỳ";
    const selectedBoundary = selectedWard ? WARD_BOUNDARIES.features.find((feature) => String(feature.properties?.adcode ?? "") === selectedWard) : undefined;
    const boundaryCenter = selectedBoundary?.properties?.center;

    const mapFeatures = useMemo(() => {
        const codes = new Set(visibleItems.map((item) => `${item.provinceCode}:${item.wardCode}`));
        return {
            type: "FeatureCollection" as const,
            features: WARD_BOUNDARIES.features.filter((feature) => codes.has(`${String(feature.properties?.parent?.adcode ?? "")}:${String(feature.properties?.adcode ?? "")}`))
        };
    }, [visibleItems]);

    return (
        <PublicAssistanceLayout slug={slug} title="Bản đồ an sinh số">
            <div className="space-y-7">
                {loadError ? <Alert type="warning" showIcon message={loadError} /> : null}
                <header className="flex flex-wrap items-end justify-between gap-3 border-l-4 border-[#00288e] bg-white px-4 py-4 sm:px-5">
                    <div>
                        <p className="text-[11px] font-semibold uppercase text-[#00288e]">Hệ thống thông tin địa lý · GIS 4.0</p>
                        <p className="mt-1 text-sm text-gray-600">Theo dõi nguồn lực và kết quả hỗ trợ theo địa bàn</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2"><Tag color="green">Dữ liệu tổng hợp đã duyệt</Tag><Tag color="blue">Cần Thơ · {periodLabel}</Tag></div>
                </header>

                <SocialAssistanceToolbar title="Lớp bản đồ và phạm vi" layout="grid">
                    <Select aria-label="Kỳ công khai" allowClear placeholder="Tất cả kỳ công khai" value={period} options={periods.map((value) => ({ value, label: value.replace("/", " – ") }))} onChange={(value) => { setPeriod(value); setSelectedWard(undefined); }} />
                    <Select aria-label="Chương trình" allowClear placeholder="Tất cả chương trình" value={programId} options={programs.map((program) => ({ value: program.id, label: program.title }))} onChange={(value) => { setProgramId(value); setSelectedWard(undefined); }} />
                    <Select<SocialAssistanceMapMeasure>
                        aria-label="Chỉ số bản đồ"
                        value={measure}
                        options={[
                            { value: "recipients", label: "Lượt hỗ trợ" },
                            { value: "cash", label: "Tiền mặt đã trao" },
                            { value: "items", label: "Lượt trao hiện vật" }
                        ]}
                        onChange={setMeasure}
                    />
                    <Select aria-label="Địa bàn" allowClear placeholder="Tất cả địa bàn" value={selectedWard} options={wardOptions.map((ward) => ({ value: ward.wardCode, label: WARD_NAMES.get(ward.wardCode) || `Xã/phường ${ward.wardCode}` }))} onChange={setSelectedWard} />
                    <div className="col-span-2 flex justify-end sm:col-span-1"><Button className="w-full sm:w-auto" icon={<RotateCcw size={15} />} onClick={() => { setPeriod(undefined); setProgramId(undefined); setSelectedWard(undefined); setMeasure("recipients"); }}>Đặt lại bộ lọc</Button></div>
                </SocialAssistanceToolbar>

                <section aria-label="Bản đồ kết quả" className="min-w-0 border-y border-gray-200 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-4">
                        <div><p className="text-[11px] font-semibold uppercase tracking-wide text-[#00288e]">Lớp bản đồ không gian</p><h2 className="mt-1 flex items-center gap-2 text-base font-semibold"><MapPinned size={18} className="text-[#00288e]" />Không gian bản đồ chuyên đề · {selectedWard ? WARD_NAMES.get(selectedWard) || `Xã/phường ${selectedWard}` : "Toàn thành phố Cần Thơ"}</h2></div>
                        {resultsEnabled ? <Link className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-[#00288e] hover:underline" href={`${basePath}/ban-do`}>Mở toàn cảnh GIS<ArrowRight size={16} /></Link> : null}
                    </div>
                    {loading ? <div className="grid min-h-80 place-items-center"><Spin /></div> : resultsEnabled ? (
                        <div className="grid min-w-0 lg:grid-cols-[minmax(0,1.8fr)_minmax(300px,.8fr)]">
                            <div className="min-w-0 border-b border-gray-200 lg:border-b-0 lg:border-r">
                                {mapFeatures.features.length ? <PublicResultsMap features={mapFeatures} items={visibleItems} measure={measure} heightClassName="h-[380px] sm:h-[480px]" /> : <div className="grid min-h-80 place-items-center p-5"><Empty description={visibleItems.length ? "Chưa có ranh giới bản đồ cho địa bàn này" : "Chưa có kết quả công khai trong phạm vi chọn"} /></div>}
                                <div aria-label={`Chú giải: ${getMeasureLabel(measure)}`} className="flex flex-wrap items-center gap-3 border-t border-gray-200 px-4 py-3 text-xs text-gray-600">
                                    <span className="font-medium text-gray-800">{getMeasureLabel(measure)}</span>
                                    <span>Ít</span><span className="h-3 w-5 rounded-sm bg-[#c6e7ff]" aria-hidden="true" /><span className="h-3 w-5 rounded-sm bg-[#3dbeff]" aria-hidden="true" /><span className="h-3 w-5 rounded-sm bg-[#dc2626]" aria-hidden="true" /><span>Nhiều</span>
                                </div>
                            </div>
                            <aside className="min-w-0">
                                <div className="border-b border-gray-200 bg-[#f2f3ff] px-4 py-4"><p className="text-[11px] font-semibold uppercase text-[#00288e]">Dữ liệu phân tích GIS</p><h3 className="mt-1 text-base font-semibold">{selectedWard ? WARD_NAMES.get(selectedWard) || `Xã/phường ${selectedWard}` : "Tổng quan địa bàn"}</h3><p className="mt-1 text-xs text-gray-500">Cần Thơ · {programId ? programs.find((program) => program.id === programId)?.title : "Tất cả chương trình"}</p>{boundaryCenter && boundaryCenter.length >= 2 ? <p className="mt-2 font-mono text-[11px] text-gray-600">EPSG:4326 · Lat {boundaryCenter[1].toFixed(4)}° · Lon {boundaryCenter[0].toFixed(4)}°</p> : null}</div>
                                <div aria-label="Chỉ số tổng hợp" className="grid grid-cols-2 border-b border-gray-200">
                                    <PortalStat label="Lượt nhận hỗ trợ" value={resultsEnabled ? summary.supportCount.toLocaleString("vi-VN") : "—"} tone="text-gray-900" />
                                    <PortalStat label="Chương trình mở" value={programsEnabled ? programs.length.toString() : "—"} tone="text-blue-700" />
                                    <PortalStat label="Tiền mặt đã trao" value={resultsEnabled ? formatCompactCurrency(summary.deliveredCashAmount) : "—"} tone="text-emerald-700" />
                                    <PortalStat label="Lượt hiện vật" value={resultsEnabled ? summary.deliveredItemCount.toLocaleString("vi-VN") : "—"} tone="text-amber-700" />
                                </div>
                                <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4"><h4 className="text-sm font-semibold">Kết quả theo địa bàn</h4><span className="text-[11px] text-gray-500">Xếp theo {getMeasureLabel(measure).toLocaleLowerCase("vi")}</span></div>
                                <div className="max-h-[390px] overflow-y-auto">
                                    {rankedWardRows.length ? rankedWardRows.map((ward) => <button key={`${ward.provinceCode}-${ward.wardCode}`} type="button" aria-pressed={selectedWard === ward.wardCode} onClick={() => setSelectedWard(selectedWard === ward.wardCode ? undefined : ward.wardCode)} className={`flex w-full items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 text-left hover:bg-sky-50 ${selectedWard === ward.wardCode ? "bg-sky-50" : "bg-white"}`}><span className="min-w-0"><strong className="block break-words text-sm font-medium">{WARD_NAMES.get(ward.wardCode) || `Xã/phường ${ward.wardCode}`}</strong><span className="mt-1 block text-xs text-gray-500">{ward.programCount} chương trình</span></span><span className="shrink-0 text-right"><strong className="text-base font-semibold text-sky-800">{formatMeasureValue(getPublicSocialAssistanceMapMeasureValue(ward, measure), measure)}</strong><span className="block text-[11px] text-gray-500">{getMeasureUnit(measure)}</span></span></button>) : <Empty className="py-8" image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có số liệu địa bàn" />}
                                </div>
                            </aside>
                        </div>
                    ) : serviceErrors.map ? <div className="p-4"><Alert type="error" showIcon message="Không thể tải kết quả bản đồ" description="Dịch vụ kết quả công khai hiện không khả dụng. Vui lòng thử lại sau." /></div> : <div className="py-10"><Empty description="Kết quả chưa được mở công khai" /></div>}
                    <p className="flex items-start gap-2 border-t border-gray-200 px-4 py-3 text-xs leading-5 text-gray-500"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-700" />Chỉ hiển thị số liệu tổng hợp đã được duyệt, không công khai thông tin cá nhân hoặc vị trí từng hộ.</p>
                </section>

                <section aria-label="Đăng ký hỗ trợ và ủng hộ" className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#dae2fd] bg-[#f2f3ff] px-5 py-5">
                    <div className="flex items-center gap-3"><HandHeart size={24} className="shrink-0 text-[#00288e]" /><div><p className="text-xs font-semibold uppercase text-[#be123c]">Hệ thống trợ giúp hai chiều</p><h2 className="mt-1 text-base font-semibold">Kết nối hỗ trợ cộng đồng</h2><p className="mt-1 text-sm text-gray-600">Theo dõi hành trình hỗ trợ minh bạch theo địa bàn.</p></div></div>
                    <div className="flex w-full flex-wrap gap-3 sm:w-auto">
                        <Button type="primary" className="!bg-[#e11d48] hover:!bg-[#be123c]" disabled={!intakeEnabled || loading} href={intakeEnabled ? `${basePath}/dang-ky?source=WEBSITE` : undefined} icon={<ArrowRight size={16} />}>Đăng ký nhận hỗ trợ</Button>
                        <Button className="!border-[#006c4a] !text-[#006c4a]" disabled={!programsEnabled || loading} href={programsEnabled ? `${basePath}/chuong-trinh#pledge` : undefined} icon={<HandHeart size={16} />}>Đăng ký ủng hộ</Button>
                    </div>
                </section>
                {serviceErrors.locations ? <Alert type="warning" showIcon message="Chưa thể kiểm tra trạng thái tiếp nhận yêu cầu hỗ trợ." description="Vui lòng thử lại sau." /> : null}

                <section aria-label="Chương trình đang mở">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Chương trình đang mở</h2>{programsEnabled ? <Link href={`${basePath}/chuong-trinh`} className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-blue-700 hover:underline">Tất cả chương trình<ArrowRight size={16} /></Link> : null}</div>
                    {loading ? <Spin /> : serviceErrors.programs ? <Alert type="error" showIcon message="Không thể tải danh sách chương trình" description="Dịch vụ chương trình hiện không khả dụng. Vui lòng thử lại sau." /> : programsEnabled && programs.length ? <div className="grid gap-4 md:grid-cols-3">{programs.slice(0, 3).map((program) => <article key={program.id} className="flex min-w-0 flex-col rounded-lg border border-gray-200 bg-white p-5"><Tag className="!mb-3 !w-fit" color="green">{getSocialAssistanceCategoryLabel(program.category)}</Tag><h3 className="text-base font-semibold">{program.title}</h3><p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-600">{program.publicDescription}</p><p className="mb-4 mt-3 text-xs leading-5 text-gray-500">Đối tượng: {program.eligibilitySummary}</p><Link className="mt-auto inline-flex min-h-10 items-center gap-2 text-sm font-medium text-blue-700 hover:underline" href={`${basePath}/chuong-trinh`}>Xem chương trình<ArrowRight size={16} /></Link></article>)}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có chương trình đang công khai" />}
                </section>
            </div>
        </PublicAssistanceLayout>
    );
}

function PortalStat({ label, value, tone }: { label: string; value: string; tone: string }) {
    return <div className="min-w-0 border-b border-r border-gray-100 p-3"><p className="text-xs text-gray-600">{label}</p><p className={`mt-1 break-words text-lg font-semibold ${tone}`}>{value}</p></div>;
}

function getMeasureLabel(measure: SocialAssistanceMapMeasure): string {
    if (measure === "cash") return "Tiền mặt đã trao";
    if (measure === "items") return "Lượt trao hiện vật";
    return "Lượt hỗ trợ";
}

function getMeasureUnit(measure: SocialAssistanceMapMeasure): string {
    if (measure === "cash") return "đồng";
    if (measure === "items") return "lượt trao";
    return "lượt hỗ trợ";
}

function formatMeasureValue(value: number, measure: SocialAssistanceMapMeasure): string {
    return measure === "cash" ? formatCompactCurrency(value) : value.toLocaleString("vi-VN");
}

function formatCompactCurrency(value: number): string {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", notation: "compact", maximumFractionDigits: 1 }).format(value);
}
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
import { ArrowRight, Banknote, FolderHeart, Gift, HandHeart, Layers, MapPinned, RotateCcw, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PublicAssistanceLayout, PublicAssistanceToolbar } from "./SocialAssistanceLayout";

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
    const [allocationsEnabled, setAllocationsEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [serviceErrors, setServiceErrors] = useState({ programs: false, map: false, locations: false, allocations: false });
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
            loadOptional<ListResponse<{ code: string }>>(endpoints.socialAssistance.publicProvinces(slug)),
            loadOptional<ListResponse<{ documentNumber: string }>>(endpoints.socialAssistance.publicAllocations(slug))
        ]).then(([programResult, mapResult, locationResult, allocationResult]) => {
            if (!active) return;
            setPrograms(programResult.data?.items ?? []);
            setMapItems(mapResult.data?.items ?? []);
            setProgramsEnabled(programResult.data !== null);
            setResultsEnabled(mapResult.data !== null);
            setIntakeEnabled(locationResult.data !== null);
            setAllocationsEnabled(allocationResult.data !== null);
            setServiceErrors({
                programs: programResult.failed,
                map: mapResult.failed,
                locations: locationResult.failed,
                allocations: allocationResult.failed
            });
            if (programResult.failed && mapResult.failed && locationResult.failed && allocationResult.failed) {
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
    const maxRankedValue = Math.max(1, ...rankedWardRows.map((ward) => getPublicSocialAssistanceMapMeasureValue(ward, measure)));
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
        <PublicAssistanceLayout slug={slug} title="An sinh cộng đồng" hidePageHeader>
            <div className="space-y-6 lg:space-y-7">
                {loadError ? <Alert type="warning" showIcon message={loadError} className="!rounded-xl" /> : null}

                <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#081c4c] via-[#113a8c] to-[#0b6673] p-6 text-white shadow-xl shadow-blue-950/15 sm:p-8">
                    <div
                        className="pointer-events-none absolute inset-0 opacity-20"
                        style={{
                            backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.14) 1px, transparent 1px)",
                            backgroundSize: "36px 36px"
                        }}
                        aria-hidden="true"
                    />
                    <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-sky-400/20 blur-3xl" aria-hidden="true" />
                    <div className="pointer-events-none absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-teal-400/18 blur-3xl" aria-hidden="true" />

                    <div className="relative z-10 space-y-6">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="max-w-2xl space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-100 ring-1 ring-white/20 backdrop-blur-md">
                                        <Sparkles size={13} />
                                        Hệ thống thông tin địa lý · GIS 4.0
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-400/20 px-3 py-1 text-xs font-semibold text-teal-100 ring-1 ring-teal-300/30 backdrop-blur-md">
                                        <ShieldCheck size={14} aria-label="Dữ liệu tổng hợp công khai" />
                                        Dữ liệu tổng hợp đã duyệt
                                    </span>
                                    <span className="inline-flex items-center rounded-full bg-sky-400/20 px-3 py-1 text-xs font-semibold text-sky-100 ring-1 ring-sky-300/30 backdrop-blur-md">
                                        Cần Thơ · {periodLabel}
                                    </span>
                                </div>
                                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
                                    An sinh cộng đồng
                                </h1>
                                <p className="text-sm leading-6 text-sky-100/90 sm:text-base">
                                    Theo dõi nguồn lực, chương trình đang mở và kết quả hỗ trợ an sinh xã hội minh bạch theo từng địa bàn.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2.5">
                                {intakeEnabled ? (
                                    <Link
                                        href={`${basePath}/dang-ky?source=WEBSITE`}
                                        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold !text-[#0b2f7a] shadow-lg shadow-blue-950/20 transition-all hover:bg-blue-50"
                                    >
                                        <span>Đăng ký nhận hỗ trợ</span>
                                        <ArrowRight size={16} />
                                    </Link>
                                ) : null}
                                {resultsEnabled ? (
                                    <Link
                                        href={`${basePath}/ban-do`}
                                        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/15 px-4 text-sm font-semibold !text-white ring-1 ring-white/30 backdrop-blur-md transition-all hover:bg-white/25"
                                    >
                                        <Layers size={16} />
                                        <span>Toàn cảnh GIS</span>
                                    </Link>
                                ) : null}
                            </div>
                        </div>

                        <div aria-label="Tổng quan nhanh" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                            <HeroStat
                                icon={<UsersRound size={18} />}
                                label="Lượt nhận hỗ trợ"
                                value={resultsEnabled ? summary.supportCount.toLocaleString("vi-VN") : "—"}
                                accent="from-sky-400/25 to-blue-500/25 text-sky-100"
                            />
                            <HeroStat
                                icon={<FolderHeart size={18} />}
                                label="Chương trình mở"
                                value={programsEnabled ? programs.length.toString() : "—"}
                                accent="from-blue-400/25 to-indigo-500/25 text-blue-100"
                            />
                            <HeroStat
                                icon={<Banknote size={18} />}
                                label="Tiền mặt đã trao"
                                value={resultsEnabled ? formatCompactCurrency(summary.deliveredCashAmount) : "—"}
                                accent="from-teal-400/25 to-emerald-500/25 text-teal-100"
                            />
                            <HeroStat
                                icon={<Gift size={18} />}
                                label="Lượt hiện vật"
                                value={resultsEnabled ? summary.deliveredItemCount.toLocaleString("vi-VN") : "—"}
                                accent="from-cyan-400/25 to-sky-500/25 text-cyan-100"
                            />
                        </div>
                    </div>
                </section>

                <PublicAssistanceToolbar title="Lớp bản đồ và phạm vi" subtitle="Lọc nhanh dữ liệu theo kỳ công khai, chương trình, chỉ số và địa bàn" layout="grid">
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
                    <div className="sm:col-span-2 lg:col-span-1 lg:ml-auto flex justify-end"><Button className="w-full lg:w-auto" icon={<RotateCcw size={15} />} onClick={() => { setPeriod(undefined); setProgramId(undefined); setSelectedWard(undefined); setMeasure("recipients"); }}>Đặt lại bộ lọc</Button></div>
                </PublicAssistanceToolbar>

                <section aria-label="Bản đồ kết quả" className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50/70 px-5 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#11409a] ring-1 ring-blue-100">
                                <MapPinned size={19} />
                            </span>
                            <div className="min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#11409a]">Lớp bản đồ không gian</p>
                                <h2 className="mt-0.5 truncate text-base font-bold text-slate-900">
                                    Không gian bản đồ chuyên đề · {selectedWard ? WARD_NAMES.get(selectedWard) || `Xã/phường ${selectedWard}` : "Toàn thành phố Cần Thơ"}
                                </h2>
                            </div>
                        </div>
                        {resultsEnabled ? (
                            <Link className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-blue-50 px-3.5 text-sm font-semibold !text-[#11409a] ring-1 ring-blue-100 transition-colors hover:bg-blue-100" href={`${basePath}/ban-do`}>
                                <span>Mở toàn cảnh GIS</span>
                                <ArrowRight size={15} />
                            </Link>
                        ) : null}
                    </div>
                    {loading ? <div className="grid min-h-96 place-items-center"><Spin size="large" /></div> : resultsEnabled ? (
                        <div className="grid min-w-0 lg:grid-cols-[minmax(0,1.75fr)_minmax(320px,.85fr)]">
                            <div className="min-w-0 border-b border-slate-200/80 lg:border-b-0 lg:border-r">
                                {mapFeatures.features.length ? (
                                    <PublicResultsMap features={mapFeatures} items={visibleItems} measure={measure} heightClassName="h-[380px] sm:h-[520px]" />
                                ) : (
                                    <div className="grid min-h-96 place-items-center p-6">
                                        <Empty description={visibleItems.length ? "Chưa có ranh giới bản đồ cho địa bàn này" : "Chưa có kết quả công khai trong phạm vi chọn"} />
                                    </div>
                                )}
                                <div aria-label={`Chú giải: ${getMeasureLabel(measure)}`} className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 bg-slate-50/70 px-5 py-3 text-xs text-slate-600">
                                    <span className="font-semibold text-slate-800">{getMeasureLabel(measure)}</span>
                                    <div className="flex items-center gap-2">
                                        <span>Ít</span>
                                        <span className="h-2.5 w-6 rounded-full bg-[#7dd3fc]" aria-hidden="true" />
                                        <span className="h-2.5 w-6 rounded-full bg-[#2563eb]" aria-hidden="true" />
                                        <span className="h-2.5 w-6 rounded-full bg-[#0f3a8a]" aria-hidden="true" />
                                        <span>Nhiều</span>
                                    </div>
                                </div>
                            </div>
                            <aside className="flex min-w-0 flex-col bg-white">
                                <div className="border-b border-slate-200/80 bg-gradient-to-br from-slate-50 to-blue-50/50 px-5 py-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#11409a]">Dữ liệu phân tích GIS</p>
                                    <h3 className="mt-1 text-base font-bold text-slate-900">{selectedWard ? WARD_NAMES.get(selectedWard) || `Xã/phường ${selectedWard}` : "Tổng quan địa bàn"}</h3>
                                    <p className="mt-1 text-xs text-slate-500">Cần Thơ · {programId ? programs.find((program) => program.id === programId)?.title : "Tất cả chương trình"}</p>
                                    {boundaryCenter && boundaryCenter.length >= 2 ? (
                                        <p className="mt-2 inline-flex rounded-md bg-white px-2 py-1 font-mono text-[11px] text-slate-600 ring-1 ring-slate-200/80">
                                            EPSG:4326 · Lat {boundaryCenter[1].toFixed(4)}° · Lon {boundaryCenter[0].toFixed(4)}°
                                        </p>
                                    ) : null}
                                </div>
                                <div aria-label="Chỉ số tổng hợp" className="grid grid-cols-2 gap-px border-b border-slate-200/80 bg-slate-200/70">
                                    <PortalStat label="Lượt nhận hỗ trợ" value={resultsEnabled ? summary.supportCount.toLocaleString("vi-VN") : "—"} tone="text-slate-900" />
                                    <PortalStat label="Chương trình mở" value={programsEnabled ? programs.length.toString() : "—"} tone="text-[#11409a]" />
                                    <PortalStat label="Tiền mặt đã trao" value={resultsEnabled ? formatCompactCurrency(summary.deliveredCashAmount) : "—"} tone="text-teal-700" />
                                    <PortalStat label="Lượt hiện vật" value={resultsEnabled ? summary.deliveredItemCount.toLocaleString("vi-VN") : "—"} tone="text-sky-700" />
                                </div>
                                <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
                                    <h4 className="text-sm font-bold text-slate-900">Kết quả theo địa bàn</h4>
                                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">Xếp theo {getMeasureLabel(measure).toLocaleLowerCase("vi")}</span>
                                </div>
                                <div className="max-h-[360px] flex-1 overflow-y-auto divide-y divide-slate-100">
                                    {rankedWardRows.length ? rankedWardRows.map((ward, index) => {
                                        const value = getPublicSocialAssistanceMapMeasureValue(ward, measure);
                                        const pct = Math.max(6, Math.round((value / maxRankedValue) * 100));
                                        const isSelected = selectedWard === ward.wardCode;
                                        return (
                                            <button
                                                key={`${ward.provinceCode}-${ward.wardCode}`}
                                                type="button"
                                                aria-pressed={isSelected}
                                                onClick={() => setSelectedWard(isSelected ? undefined : ward.wardCode)}
                                                className={`group flex w-full flex-col gap-1.5 px-5 py-3 text-left transition-colors ${isSelected ? "bg-blue-50/90" : "bg-white hover:bg-slate-50"}`}
                                            >
                                                <div className="flex w-full items-center justify-between gap-3">
                                                    <span className="flex min-w-0 items-center gap-2.5">
                                                        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md font-mono text-[11px] font-bold ${index < 3 ? "bg-blue-100 text-[#11409a]" : "bg-slate-100 text-slate-500"}`}>
                                                            {String(index + 1).padStart(2, "0")}
                                                        </span>
                                                        <span className="min-w-0">
                                                            <strong className="block break-words text-sm font-semibold text-slate-900">{WARD_NAMES.get(ward.wardCode) || `Xã/phường ${ward.wardCode}`}</strong>
                                                            <span className="block text-xs text-slate-500">{ward.programCount} chương trình</span>
                                                        </span>
                                                    </span>
                                                    <span className="shrink-0 text-right tabular-nums">
                                                        <strong className="text-sm font-bold text-[#11409a]">{formatMeasureValue(value, measure)}</strong>
                                                        <span className="block text-[11px] text-slate-500">{getMeasureUnit(measure)}</span>
                                                    </span>
                                                </div>
                                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-300 ${isSelected ? "bg-[#0f3a8a]" : "bg-[#2563eb]/80 group-hover:bg-[#0f3a8a]"}`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </button>
                                        );
                                    }) : <Empty className="py-10" image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có số liệu địa bàn" />}
                                </div>
                            </aside>
                        </div>
                    ) : serviceErrors.map ? <div className="p-5"><Alert type="error" showIcon message="Không thể tải kết quả bản đồ" description="Dịch vụ kết quả công khai hiện không khả dụng. Vui lòng thử lại sau." /></div> : <div className="py-12"><Empty description="Kết quả chưa được mở công khai" /></div>}
                    <p className="flex items-start gap-2.5 border-t border-slate-200/80 bg-teal-50/40 px-5 py-3 text-xs leading-5 text-slate-600">
                        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-teal-700" />
                        <span>Chỉ hiển thị số liệu tổng hợp đã được duyệt, không công khai thông tin cá nhân hoặc vị trí từng hộ.</span>
                    </p>
                </section>

                <section aria-label="Đăng ký hỗ trợ và ủng hộ" className="relative overflow-hidden rounded-2xl border border-blue-200/70 bg-gradient-to-r from-blue-50/90 via-white to-teal-50/80 p-6 shadow-sm sm:p-7">
                    <div className="relative z-10 flex flex-wrap items-center justify-between gap-5">
                        <div className="flex items-start gap-4">
                            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#0b2f7a] to-[#0d9488] text-white shadow-md shadow-blue-900/15">
                                <HandHeart size={24} />
                            </span>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-[#11409a]">Hệ thống trợ giúp hai chiều</p>
                                <h2 className="mt-1 text-lg font-bold text-slate-900">Kết nối hỗ trợ cộng đồng</h2>
                                <p className="mt-1 text-sm text-slate-600">Theo dõi hành trình hỗ trợ minh bạch theo địa bàn, kết nối trực tiếp nhu cầu và nguồn lực xã hội.</p>
                            </div>
                        </div>
                        <div className="flex w-full flex-wrap gap-2.5 sm:w-auto">
                            <Button type="primary" size="large" className="!border-0 !bg-gradient-to-r !from-[#0b2f7a] !to-[#1346a8] !text-white hover:!from-[#08245e] hover:!to-[#0f3a8a] !shadow-sm" disabled={!intakeEnabled || loading} href={intakeEnabled ? `${basePath}/dang-ky?source=WEBSITE` : undefined} icon={<ArrowRight size={16} />}>Đăng ký nhận hỗ trợ</Button>
                            <Button size="large" className="!border-teal-300 !bg-teal-50 !text-teal-800 hover:!border-teal-400 hover:!bg-teal-100" disabled={!programsEnabled || loading} href={programsEnabled ? `${basePath}/chuong-trinh#pledge` : undefined} icon={<HandHeart size={16} />}>Đăng ký ủng hộ</Button>
                            <Button size="large" className="!border-slate-300 !bg-white !text-slate-700 hover:!border-blue-300 hover:!bg-blue-50 hover:!text-[#11409a]" disabled={!allocationsEnabled || loading} href={allocationsEnabled ? `${basePath}/phan-bo` : undefined} icon={<ArrowRight size={16} />}>Chỉ tiêu phân bổ</Button>
                        </div>
                    </div>
                </section>
                {serviceErrors.locations ? <Alert type="warning" showIcon message="Chưa thể kiểm tra trạng thái tiếp nhận yêu cầu hỗ trợ." description="Vui lòng thử lại sau." className="!rounded-xl" /> : null}

                <section aria-label="Chương trình đang mở" className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Đang tiếp nhận &amp; triển khai</p>
                            <h2 className="mt-0.5 text-xl font-bold text-slate-900">Chương trình đang mở</h2>
                        </div>
                        {programsEnabled ? (
                            <Link href={`${basePath}/chuong-trinh`} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold !text-[#11409a] shadow-xs transition-colors hover:border-blue-200 hover:bg-blue-50">
                                <span>Tất cả chương trình</span>
                                <ArrowRight size={15} />
                            </Link>
                        ) : null}
                    </div>
                    {loading ? (
                        <div className="grid min-h-40 place-items-center rounded-2xl border border-slate-200/80 bg-white"><Spin /></div>
                    ) : serviceErrors.programs ? (
                        <Alert type="error" showIcon message="Không thể tải danh sách chương trình" description="Dịch vụ chương trình hiện không khả dụng. Vui lòng thử lại sau." className="!rounded-xl" />
                    ) : programsEnabled && programs.length ? (
                        <div className="grid gap-5 md:grid-cols-3">
                            {programs.slice(0, 3).map((program) => (
                                <article key={program.id} className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-950/5">
                                    <div className="h-1.5 w-full bg-gradient-to-r from-[#0b2f7a] via-[#1346a8] to-[#0d9488]" aria-hidden="true" />
                                    <div className="flex flex-1 flex-col p-5 sm:p-6">
                                        <div className="mb-3 flex items-center justify-between gap-2">
                                            <Tag className="!m-0 !rounded-full !border-0 !bg-teal-50 !px-3 !py-0.5 !font-semibold !text-teal-700">{getSocialAssistanceCategoryLabel(program.category)}</Tag>
                                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700">
                                                <span className="h-2 w-2 rounded-full bg-teal-500" />
                                                Đang mở
                                            </span>
                                        </div>
                                        <h3 className="text-base font-bold leading-snug text-slate-900 transition-colors group-hover:text-[#11409a]">{program.title}</h3>
                                        <p className="mt-2.5 line-clamp-3 text-sm leading-6 text-slate-600">{program.publicDescription}</p>
                                        <div className="mb-5 mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600 ring-1 ring-slate-200/60">
                                            <span className="font-semibold text-slate-800">Đối tượng: </span>
                                            {program.eligibilitySummary}
                                        </div>
                                        <Link className="mt-auto inline-flex min-h-10 items-center justify-between rounded-xl bg-slate-50 px-3.5 text-sm font-semibold !text-[#11409a] transition-colors group-hover:bg-blue-50" href={`${basePath}/chuong-trinh`}>
                                            <span>Xem chương trình</span>
                                            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                                        </Link>
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-slate-200/80 bg-white py-10">
                            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có chương trình đang công khai" />
                        </div>
                    )}
                </section>
            </div>
        </PublicAssistanceLayout>
    );
}

function HeroStat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
    return (
        <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-white/10 p-3.5 ring-1 ring-white/15 backdrop-blur-md sm:p-4">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${accent}`}>
                {icon}
            </span>
            <div className="min-w-0">
                <p className="truncate text-xs font-medium text-sky-100/80">{label}</p>
                <p className="mt-0.5 truncate text-lg font-bold tabular-nums text-white sm:text-xl">{value}</p>
            </div>
        </div>
    );
}

function PortalStat({ label, value, tone }: { label: string; value: string; tone: string }) {
    return (
        <div className="min-w-0 bg-white p-3.5">
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <p className={`mt-1 break-words text-lg font-bold tabular-nums ${tone}`}>{value}</p>
        </div>
    );
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
"use client";

import canThoBoundaryGeoJson from "@/components/poverty/command-dashboard/data/cantho.json";
import {
    buildPublicSocialAssistanceWardSummary,
    createSocialAssistanceIdempotencyKey,
    getPublicSocialAssistanceProgramSummary,
    getSocialAssistanceCategoryLabel
} from "@/lib/social-assistance-utils";
import { PublicAssistanceLayout } from "./SocialAssistanceLayout";
import { endpoints } from "@/lib/endpoints";
import { publicApiGet, publicApiPost } from "@/lib/public-api";
import type { SocialAssistancePledgeType, SocialAssistanceProgram, SocialAssistancePublicMapItem } from "@/types/social-assistance";
import { Alert, Button, Checkbox, Empty, Form, Input, InputNumber, Modal, Result, Segmented, Select, Spin, Tabs, Tag, Typography } from "antd";
import type { FeatureCollection, Geometry } from "geojson";
import dayjs from "dayjs";
import { Banknote, Calendar, Eye, FolderHeart, HandCoins, MapPin, MapPinned, RotateCcw, Search, Send, UsersRound } from "lucide-react";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type Props = { slug: string };
type ProgramResponse = { items: SocialAssistanceProgram[] };
type MapResponse = { items: SocialAssistancePublicMapItem[] };
type BoundaryProperties = { adcode?: number; name?: string; parent?: { adcode?: number } };
const PublicResultsMap = dynamic(() => import("./PublicResultsLeafletMap"), { ssr: false });
const WARD_BOUNDARIES = canThoBoundaryGeoJson as FeatureCollection<Geometry, BoundaryProperties>;
const WARD_NAMES = new Map(WARD_BOUNDARIES.features.map((feature) => [String(feature.properties?.adcode ?? ""), feature.properties?.name ?? ""]));
type FormValues = {
    programId: string;
    donorType: "INDIVIDUAL" | "ORGANIZATION";
    donorName: string;
    contactPhone: string;
    contactEmail?: string;
    pledgeType: SocialAssistancePledgeType;
    pledgedAmount?: number;
    itemDescription?: string;
    consent: true;
};

export default function PublicProgramsPage({ slug }: Props) {
    const [form] = Form.useForm<FormValues>();
    const pledgeType = Form.useWatch("pledgeType", form);
    const formRef = useRef<HTMLElement>(null);
    const [programs, setPrograms] = useState<SocialAssistanceProgram[]>([]);
    const [mapItems, setMapItems] = useState<SocialAssistancePublicMapItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [pledgeReference, setPledgeReference] = useState<string | null>(null);
    const [pledgeError, setPledgeError] = useState<string | null>(null);
    const [programLoadError, setProgramLoadError] = useState<string | null>(null);
    const [mapError, setMapError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<string>();
    const [selectedWard, setSelectedWard] = useState<string>();
    const [detailProgram, setDetailProgram] = useState<SocialAssistanceProgram | null>(null);
    const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
    const idempotencyKey = useRef(createSocialAssistanceIdempotencyKey());
    const failedSubmission = useRef(false);

    useEffect(() => {
        let active = true;
        void Promise.allSettled([
            publicApiGet<ProgramResponse>(endpoints.socialAssistance.publicPrograms(slug)),
            publicApiGet<MapResponse>(endpoints.socialAssistance.publicMap(slug))
        ]).then(([programResult, mapResult]) => {
            if (!active) return;
            if (programResult.status === "fulfilled") {
                setPrograms(programResult.value.items ?? []);
                setProgramLoadError(null);
            } else {
                setProgramLoadError(programResult.reason instanceof Error ? programResult.reason.message : "Không thể tải chương trình.");
            }
            if (mapResult.status === "fulfilled") setMapItems(mapResult.value.items ?? []);
            else setMapError(mapResult.reason instanceof Error ? mapResult.reason.message : "Không thể tải bản đồ phân bổ.");
        }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [slug]);

    const categoryOptions = [...new Set(programs.map((program) => program.category))].map((category) => ({
        value: category,
        label: getSocialAssistanceCategoryLabel(category)
    }));
    const visiblePrograms = programs.filter((program) => (!categoryFilter || program.category === categoryFilter)
        && `${program.title} ${program.publicDescription} ${program.eligibilitySummary}`.toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi")));
    const visibleProgramIds = new Set(visiblePrograms.map((program) => program.id));
    const filteredMapItems = mapItems.filter((item) => visibleProgramIds.has(item.programId));
    const visibleMapItems = filteredMapItems.filter((item) => !selectedWard || item.wardCode === selectedWard);
    const overview = getPublicSocialAssistanceProgramSummary(visiblePrograms, visibleMapItems);
    const wardRows = buildPublicSocialAssistanceWardSummary(filteredMapItems);
    const wardOptions = [...new Set(wardRows.map((ward) => ward.wardCode))];
    const mapFeatures = useMemo(() => ({
        type: "FeatureCollection" as const,
        features: WARD_BOUNDARIES.features.filter((feature) => visibleMapItems.some((item) =>
            String(feature.properties?.adcode ?? "") === item.wardCode
            && String(feature.properties?.parent?.adcode ?? "") === item.provinceCode
        ))
    }), [visibleMapItems]);
    const detailMapItems = useMemo(
        () => detailProgram ? mapItems.filter((item) => item.programId === detailProgram.id) : [],
        [detailProgram, mapItems]
    );
    const detailMapFeatures = useMemo(() => {
        const codes = new Set(detailMapItems.map((item) => `${item.provinceCode}:${item.wardCode}`));
        return {
            type: "FeatureCollection" as const,
            features: WARD_BOUNDARIES.features.filter((feature) => codes.has(`${String(feature.properties?.parent?.adcode ?? "")}:${String(feature.properties?.adcode ?? "")}`))
        };
    }, [detailMapItems]);
    const detailSummary = getPublicSocialAssistanceProgramSummary(
        detailProgram ? [detailProgram] : [],
        detailMapItems
    );

    const handleValuesChange = () => {
        setPledgeError(null);
        if (failedSubmission.current) {
            idempotencyKey.current = createSocialAssistanceIdempotencyKey();
            failedSubmission.current = false;
        }
    };

    const submitPledge = async () => {
        try {
            const values = await form.validateFields();
            setSubmitting(true);
            setPledgeError(null);
            const response = await publicApiPost<{ pledgeId: string }>(
                endpoints.socialAssistance.publicPledge(slug),
                values,
                { "Idempotency-Key": idempotencyKey.current }
            );
            setPledgeReference(response.pledgeId);
            form.resetFields();
            failedSubmission.current = false;
        } catch (submitError) {
            failedSubmission.current = true;
            setPledgeError(submitError instanceof Error ? submitError.message : "Không thể gửi cam kết.");
        } finally {
            setSubmitting(false);
        }
    };

    if (pledgeReference) {
        return (
            <PublicAssistanceLayout slug={slug} title="Cam kết ủng hộ" badge="Tiếp nhận thành công">
                <section className="mx-auto max-w-2xl rounded-2xl border border-emerald-200/80 bg-white p-6 shadow-sm sm:p-10">
                    <Result
                        status="success"
                        title="Đã tiếp nhận cam kết ủng hộ"
                        subTitle="Cam kết đang chờ cán bộ xác nhận; đây chưa phải là xác nhận đã nhận tiền hoặc hiện vật."
                        extra={
                            <div className="inline-flex flex-col items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50/70 px-5 py-3">
                                <span className="text-xs font-medium text-emerald-700">Mã tham chiếu cam kết</span>
                                <Typography.Text copyable className="break-all font-mono text-base font-bold text-emerald-900">{pledgeReference}</Typography.Text>
                            </div>
                        }
                    />
                </section>
            </PublicAssistanceLayout>
        );
    }

    return (
        <PublicAssistanceLayout
            slug={slug}
            title="Chương trình an sinh xã hội"
            badge="An sinh cộng đồng · GIS"
            subtitle="Chương trình đang công khai, kết quả hỗ trợ đã được duyệt và đăng ký cam kết ủng hộ trực tuyến."
        >
            <div className="space-y-6 lg:space-y-7">
                <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#081c4c] via-[#113a8c] to-[#0b6673] p-5 text-white shadow-md shadow-blue-950/10 sm:px-6">
                    <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wider text-sky-200">Chung tay vì cộng đồng</p>
                        <h2 className="text-lg font-bold text-white sm:text-xl">Danh sách chương trình an sinh xã hội</h2>
                        <p className="text-sm text-sky-100/90">Chọn chương trình phù hợp để xem kết quả phân bổ hoặc đăng ký cam kết đồng hành.</p>
                    </div>
                    <Button
                        size="large"
                        href="#pledge"
                        icon={<HandCoins size={16} />}
                        className="!border-0 !bg-white !font-bold !text-[#0b2f7a] hover:!bg-blue-50 !shadow-md !shadow-blue-950/20"
                    >
                        Ủng hộ chương trình
                    </Button>
                </section>

                <section aria-label="Tổng quan chương trình" className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
                    <ProgramMetric icon={<FolderHeart size={18} />} iconTone="bg-blue-50 text-[#11409a] ring-blue-100" label="Chương trình công khai" value={overview.programCount.toLocaleString("vi-VN")} detail="Đang tiếp nhận ủng hộ" tone="text-[#11409a]" />
                    <ProgramMetric icon={<UsersRound size={18} />} iconTone="bg-slate-100 text-slate-700 ring-slate-200" label="Lượt nhận hỗ trợ" value={overview.supportInstances.toLocaleString("vi-VN")} detail="Tổng hợp theo chương trình" tone="text-slate-900" />
                    <ProgramMetric icon={<Banknote size={18} />} iconTone="bg-teal-50 text-teal-700 ring-teal-100" label="Tiền mặt đã trao" value={formatCurrency(overview.deliveredCashAmount)} detail="Theo kết quả đã duyệt" tone="text-teal-700" />
                    <ProgramMetric icon={<MapPin size={18} />} iconTone="bg-sky-50 text-sky-700 ring-sky-100" label="Địa bàn có kết quả" value={overview.geographyCount.toLocaleString("vi-VN")} detail="Xã/phường có dữ liệu công khai" tone="text-sky-700" />
                </section>

                <section aria-label="Lọc chương trình" className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/50 sm:p-5">
                    <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(220px,1.4fr)_minmax(190px,1fr)_minmax(190px,1fr)_auto]">
                        <Input aria-label="Tìm chương trình" prefix={<Search size={16} className="text-slate-400" />} allowClear placeholder="Tìm chương trình an sinh..." value={search} onChange={(event) => { setSearch(event.target.value); setSelectedWard(undefined); }} />
                        <Select aria-label="Lĩnh vực hỗ trợ" allowClear placeholder="Tất cả lĩnh vực" value={categoryFilter} options={categoryOptions} onChange={(value) => { setCategoryFilter(value); setSelectedWard(undefined); }} />
                        <Select aria-label="Địa bàn trên bản đồ" allowClear placeholder="Tất cả địa bàn bản đồ" value={selectedWard} options={wardOptions.map((wardCode) => ({ value: wardCode, label: WARD_NAMES.get(wardCode) || `Xã/phường ${wardCode}` }))} onChange={setSelectedWard} />
                        <Segmented aria-label="Kiểu hiển thị chương trình" value={viewMode} options={[{ value: "cards", label: "Lưới thẻ" }, { value: "table", label: "Danh sách" }]} onChange={(value) => setViewMode(value as "cards" | "table")} />
                    </div>
                    <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
                        <Button icon={<RotateCcw size={15} />} onClick={() => { setSearch(""); setCategoryFilter(undefined); setSelectedWard(undefined); }}>Đặt lại bộ lọc</Button>
                    </div>
                </section>

                <Spin spinning={loading}>
                    <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(360px,.9fr)]">
                        <section aria-label="Chương trình đang công khai" className="min-w-0 space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <h3 className="text-lg font-bold text-slate-900">Chương trình công khai</h3>
                                <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[#11409a] ring-1 ring-blue-100">
                                    {visiblePrograms.length} / {programs.length} chương trình
                                </span>
                            </div>
                            {programLoadError ? (
                                <Alert type="error" showIcon message="Không thể tải danh sách chương trình" description={programLoadError} className="!rounded-xl" />
                            ) : visiblePrograms.length === 0 ? (
                                <div className="rounded-2xl border border-slate-200/80 bg-white py-12"><Empty description="Không có chương trình phù hợp với bộ lọc" /></div>
                            ) : (
                                <div className={viewMode === "cards" ? "grid gap-5 md:grid-cols-2" : "space-y-4"}>
                                    {visiblePrograms.map((program) => {
                                        const wardCount = new Set(mapItems.filter((item) => item.programId === program.id).map((item) => item.wardCode)).size;
                                        return (
                                            <article key={program.id} className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
                                                <div className="h-1.5 w-full bg-gradient-to-r from-[#11409a] via-sky-500 to-emerald-500" aria-hidden="true" />
                                                <div className="flex flex-1 flex-col p-5">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <Tag className="!m-0 !rounded-full !border-0 !bg-emerald-50 !px-3 !py-0.5 !font-semibold !text-emerald-700" color="green">{getSocialAssistanceCategoryLabel(program.category)}</Tag>
                                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50/70 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                                                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                                            Đang công khai
                                                        </span>
                                                    </div>
                                                    <h3 className="mt-3 text-base font-bold leading-snug text-slate-900 transition-colors group-hover:text-[#11409a]">{program.title}</h3>
                                                    <div className="mt-2.5 flex flex-wrap gap-2 text-xs">
                                                        {wardCount > 0 ? (
                                                            <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 font-medium text-[#11409a]">
                                                                <MapPinned size={13} />
                                                                {wardCount} địa bàn có kết quả
                                                            </span>
                                                        ) : null}
                                                        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
                                                            <Calendar size={13} />
                                                            {dayjs(program.startDate).format("DD/MM/YYYY")} – {dayjs(program.endDate).format("DD/MM/YYYY")}
                                                        </span>
                                                    </div>
                                                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{program.publicDescription}</p>
                                                    <div className="mt-4 rounded-xl bg-slate-50 p-3.5 text-sm ring-1 ring-slate-200/60">
                                                        <span className="font-semibold text-slate-700">Đối tượng: </span>
                                                        <span className="text-slate-600">{program.eligibilitySummary}</span>
                                                    </div>
                                                    <div className="mt-auto flex flex-wrap gap-2.5 border-t border-slate-100 pt-4 mt-5">
                                                        <Button icon={<Eye size={15} />} onClick={() => setDetailProgram(program)}>Xem chi tiết</Button>
                                                        <Button type="primary" icon={<HandCoins size={15} />} onClick={() => { form.setFieldValue("programId", program.id); handleValuesChange(); formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Ủng hộ chương trình</Button>
                                                    </div>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </section>

                        <aside className="min-w-0 space-y-4 xl:sticky xl:top-24">
                            <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                                <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50/70 px-5 py-4">
                                    <div className="flex items-center gap-2.5">
                                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#11409a] ring-1 ring-blue-100">
                                            <MapPinned size={18} />
                                        </span>
                                        <div>
                                            <h3 className="font-bold text-slate-900">Bản đồ phân bổ hỗ trợ</h3>
                                            <p className="text-xs text-slate-500">Kết quả tổng hợp theo địa bàn</p>
                                        </div>
                                    </div>
                                    <Tag className="!m-0 !rounded-full !border-0 !bg-emerald-50 !px-2.5 !py-0.5 !font-semibold !text-emerald-700" color="green">Đã duyệt</Tag>
                                </div>
                                {mapError ? (
                                    <div className="p-4"><Alert type="error" showIcon message="Không thể tải bản đồ phân bổ" description={mapError} /></div>
                                ) : mapFeatures.features.length ? (
                                    <PublicResultsMap features={mapFeatures} items={visibleMapItems} heightClassName="h-[320px] sm:h-[380px]" />
                                ) : (
                                    <div className="grid h-64 place-items-center p-4"><Empty description="Chưa có kết quả địa bàn đã duyệt" /></div>
                                )}
                                <div className="grid grid-cols-2 gap-px border-t border-slate-200/80 bg-slate-200/70">
                                    <div className="bg-white p-4">
                                        <p className="text-xs font-medium text-slate-500">Lượt nhận hỗ trợ</p>
                                        <p className="mt-1 text-lg font-bold tabular-nums text-[#11409a]">{overview.supportInstances.toLocaleString("vi-VN")}</p>
                                    </div>
                                    <div className="bg-white p-4">
                                        <p className="text-xs font-medium text-slate-500">Tiền mặt đã trao</p>
                                        <p className="mt-1 text-lg font-bold tabular-nums text-emerald-700">{formatCurrency(overview.deliveredCashAmount)}</p>
                                    </div>
                                </div>
                                <div className="max-h-56 overflow-y-auto border-t border-slate-200/80 divide-y divide-slate-100">
                                    {wardRows.length ? wardRows.map((ward) => (
                                        <button
                                            key={`${ward.provinceCode}-${ward.wardCode}`}
                                            type="button"
                                            aria-pressed={selectedWard === ward.wardCode}
                                            onClick={() => setSelectedWard(selectedWard === ward.wardCode ? undefined : ward.wardCode)}
                                            className={`flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors ${selectedWard === ward.wardCode ? "bg-blue-50/90" : "bg-white hover:bg-slate-50"}`}
                                        >
                                            <span className="text-sm font-medium text-slate-800">{WARD_NAMES.get(ward.wardCode) || `Xã/phường ${ward.wardCode}`}</span>
                                            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold tabular-nums text-[#11409a]">{ward.recipientCount.toLocaleString("vi-VN")} lượt</span>
                                        </button>
                                    )) : null}
                                </div>
                                <div className="flex items-center gap-2.5 border-t border-slate-200/80 bg-slate-50/70 px-5 py-3 text-xs text-slate-500">
                                    <span>Ít hỗ trợ</span>
                                    <span className="h-2.5 flex-1 rounded-full bg-gradient-to-r from-[#7dd3fc] via-[#2563eb] to-[#0f3a8a]" />
                                    <span>Nhiều hỗ trợ</span>
                                </div>
                            </section>
                        </aside>
                    </div>
                </Spin>

                <section id="pledge" ref={formRef} className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    <div className="flex flex-wrap items-center gap-3.5 border-b border-emerald-100 bg-gradient-to-r from-emerald-50/90 via-teal-50/50 to-white px-5 py-5 sm:px-7">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/25">
                            <HandCoins size={22} />
                        </span>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Đăng ký cam kết ủng hộ</h2>
                            <p className="mt-0.5 text-sm text-slate-600">Cam kết sẽ được cán bộ liên hệ xác nhận; không xử lý thanh toán trực tuyến.</p>
                        </div>
                    </div>
                    <div className="p-5 sm:p-7">
                        {pledgeError ? <Alert className="mb-5 !rounded-xl" type="error" showIcon message="Không thể gửi cam kết" description={pledgeError} /> : null}
                        {programLoadError ? <Alert type="error" showIcon message="Không thể tải chương trình để đăng ký cam kết" description={programLoadError} className="!rounded-xl" /> : programs.length > 0 ? (
                            <Form<FormValues> form={form} layout="vertical" initialValues={{ donorType: "INDIVIDUAL", pledgeType: "CASH" }} onValuesChange={handleValuesChange}>
                                <div className="grid gap-x-5 gap-y-2 md:grid-cols-2">
                                    <Form.Item label="Chương trình" name="programId" rules={[{ required: true, message: "Vui lòng chọn chương trình." }]}><Select options={programs.map((program) => ({ value: program.id, label: program.title }))} placeholder="Chọn chương trình" /></Form.Item>
                                    <Form.Item label="Loại nhà tài trợ" name="donorType" rules={[{ required: true }]}><Segmented block options={[{ value: "INDIVIDUAL", label: "Cá nhân" }, { value: "ORGANIZATION", label: "Tổ chức" }]} /></Form.Item>
                                    <Form.Item label="Tên cá nhân/tổ chức" name="donorName" rules={[{ required: true, whitespace: true }]}><Input autoComplete="name" maxLength={255} placeholder="Nhập tên cá nhân hoặc đơn vị" /></Form.Item>
                                    <Form.Item label="Số điện thoại" name="contactPhone" rules={[{ required: true }, { min: 8, max: 20 }, { pattern: /^\+?[0-9][0-9\s().-]*$/ }]}><Input autoComplete="tel" inputMode="tel" maxLength={20} placeholder="Nhập số điện thoại liên hệ" /></Form.Item>
                                    <Form.Item label="Email (không bắt buộc)" name="contactEmail" rules={[{ type: "email" }]}><Input autoComplete="email" inputMode="email" maxLength={255} placeholder="example@domain.vn" /></Form.Item>
                                    <Form.Item label="Hình thức ủng hộ" name="pledgeType" rules={[{ required: true }]}><Segmented block options={[{ value: "CASH", label: "Tiền mặt" }, { value: "IN_KIND", label: "Hiện vật" }]} /></Form.Item>
                                    {pledgeType === "IN_KIND" ? <Form.Item className="md:col-span-2" label="Mô tả hiện vật" name="itemDescription" rules={[{ required: true, whitespace: true }]}><Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} maxLength={2000} placeholder="Mô tả chủng loại, số lượng hiện vật dự kiến ủng hộ..." /></Form.Item> : <Form.Item label="Số tiền dự kiến (đồng)" name="pledgedAmount" rules={[{ required: true }, { type: "number", min: 1 }]}><InputNumber className="!w-full" min={1} step={1000} placeholder="Nhập số tiền dự kiến" /></Form.Item>}
                                    <Form.Item className="md:col-span-2" name="consent" valuePropName="checked" rules={[{ validator: (_, value) => value ? Promise.resolve() : Promise.reject(new Error("Bạn cần đồng ý để gửi cam kết.")) }]}><Checkbox>Tôi đồng ý để Mặt trận Tổ quốc sử dụng thông tin liên hệ để xác nhận cam kết.</Checkbox></Form.Item>
                                </div>
                                <div className="flex justify-end border-t border-slate-100 pt-5">
                                    <Button type="primary" size="large" icon={<Send size={15} />} loading={submitting} onClick={() => void submitPledge()} className="!border-0 !bg-emerald-600 hover:!bg-emerald-700">Gửi cam kết</Button>
                                </div>
                            </Form>
                        ) : <Empty description="Chưa có chương trình để đăng ký cam kết" />}
                    </div>
                </section>

                <Modal title={detailProgram?.title} open={Boolean(detailProgram)} onCancel={() => setDetailProgram(null)} footer={detailProgram ? <Button type="primary" icon={<HandCoins size={15} />} onClick={() => { form.setFieldValue("programId", detailProgram.id); handleValuesChange(); setDetailProgram(null); formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Ủng hộ chương trình</Button> : null} width="min(960px, calc(100vw - 24px))" destroyOnHidden>
                    {detailProgram ? <>
                        <div className="mb-4 flex flex-wrap items-center gap-2">
                            <Tag className="!m-0 !rounded-full !border-0 !bg-blue-50 !px-3 !py-0.5 !font-semibold !text-[#11409a]" color="blue">{getSocialAssistanceCategoryLabel(detailProgram.category)}</Tag>
                            <Tag className="!m-0 !rounded-full !border-0 !bg-emerald-50 !px-3 !py-0.5 !font-semibold !text-emerald-700" color="green">Đang công khai</Tag>
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                                <Calendar size={13} />
                                {dayjs(detailProgram.startDate).format("DD/MM/YYYY")} – {dayjs(detailProgram.endDate).format("DD/MM/YYYY")}
                            </span>
                        </div>
                        <Tabs items={[
                            { key: "overview", label: "Tổng quan & mục tiêu", children: <div className="space-y-5 py-2"><section><h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Nội dung chương trình</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{detailProgram.publicDescription}</p></section><section className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200/70"><h3 className="text-sm font-bold text-slate-900">Tiêu chí & đối tượng tiếp nhận</h3><p className="mt-2 text-sm leading-6 text-slate-600">{detailProgram.eligibilitySummary}</p></section></div> },
                            { key: "map", label: "Bản đồ không gian & địa bàn", children: <div className="space-y-3 py-2"><p className="text-sm text-slate-600">Vị trí hiển thị là kết quả tổng hợp đã được duyệt theo xã/phường.</p>{detailMapFeatures.features.length ? <div className="overflow-hidden rounded-xl border border-slate-200"><PublicResultsMap features={detailMapFeatures} items={detailMapItems} heightClassName="h-[320px] sm:h-[440px]" /></div> : <Empty description="Chưa có kết quả địa bàn đã duyệt cho chương trình này" />}</div> },
                            { key: "results", label: "Kết quả đã công khai", children: <section aria-label="Kết quả đã duyệt" className="grid grid-cols-1 gap-3.5 py-3 sm:grid-cols-3"><ProgramMetric icon={<UsersRound size={18} />} iconTone="bg-blue-50 text-[#11409a] ring-blue-100" label="Lượt hỗ trợ" value={detailSummary.supportInstances.toLocaleString("vi-VN")} detail="Aggregate đã duyệt" tone="text-[#11409a]" /><ProgramMetric icon={<Banknote size={18} />} iconTone="bg-teal-50 text-teal-700 ring-teal-100" label="Tiền mặt đã trao" value={formatCurrency(detailSummary.deliveredCashAmount)} detail="Aggregate công khai" tone="text-teal-700" /><ProgramMetric icon={<HandCoins size={18} />} iconTone="bg-sky-50 text-sky-700 ring-sky-100" label="Lượt hiện vật" value={detailSummary.deliveredItemCount.toLocaleString("vi-VN")} detail="Aggregate công khai" tone="text-sky-700" /></section> }
                        ]} />
                    </> : null}
                </Modal>
            </div>
        </PublicAssistanceLayout>
    );
}

function ProgramMetric({ icon, iconTone, label, value, detail, tone }: { icon?: ReactNode; iconTone?: string; label: string; value: string; detail: string; tone: string }) {
    return (
        <article className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-shadow hover:shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-500">{label}</p>
                {icon ? <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ring-1 ${iconTone ?? "bg-slate-50 text-slate-600 ring-slate-200"}`}>{icon}</span> : null}
            </div>
            <p className={`mt-2.5 break-words text-xl font-bold tabular-nums sm:text-2xl ${tone}`}>{value}</p>
            <p className="mt-1.5 text-xs text-slate-500">{detail}</p>
        </article>
    );
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", notation: "compact", maximumFractionDigits: 1 }).format(value);
}
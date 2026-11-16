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
import { Eye, HandCoins, MapPinned, RotateCcw, Search, Send } from "lucide-react";
import dynamic from "next/dynamic";
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
            <PublicAssistanceLayout slug={slug} title="Cam kết ủng hộ">
                <section className="mx-auto max-w-2xl py-8">
                    <Result
                        status="success"
                        title="Đã tiếp nhận cam kết ủng hộ"
                        subTitle="Cam kết đang chờ cán bộ xác nhận; đây chưa phải là xác nhận đã nhận tiền hoặc hiện vật."
                        extra={<Typography.Text copyable className="break-all font-mono text-sm">{pledgeReference}</Typography.Text>}
                    />
                </section>
            </PublicAssistanceLayout>
        );
    }

    return (
        <PublicAssistanceLayout slug={slug} title="Chương trình an sinh xã hội">
            <div className="space-y-7">
                <header className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase text-[#006c4a]">Bản đồ an sinh số · GIS</p>
                        <h2 className="mt-1 text-xl font-bold text-[#131b2e] sm:text-2xl">Danh sách chương trình an sinh xã hội</h2>
                        <p className="mt-2 text-sm text-[#444653]">Chương trình đang công khai và kết quả hỗ trợ đã được duyệt.</p>
                    </div>
                    <Button type="primary" href="#pledge" icon={<HandCoins size={16} />}>Ủng hộ chương trình</Button>
                </header>

                <section aria-label="Tổng quan chương trình" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <ProgramMetric label="Chương trình công khai" value={overview.programCount.toLocaleString("vi-VN")} detail="Đang tiếp nhận ủng hộ" tone="text-[#00288e]" />
                    <ProgramMetric label="Lượt nhận hỗ trợ" value={overview.supportInstances.toLocaleString("vi-VN")} detail="Tổng hợp theo chương trình" tone="text-[#131b2e]" />
                    <ProgramMetric label="Tiền mặt đã trao" value={formatCurrency(overview.deliveredCashAmount)} detail="Theo kết quả đã duyệt" tone="text-[#006c4a]" />
                    <ProgramMetric label="Địa bàn có kết quả" value={overview.geographyCount.toLocaleString("vi-VN")} detail="Xã/phường có dữ liệu công khai" tone="text-[#872d00]" />
                </section>

                <section aria-label="Lọc chương trình" className="grid min-w-0 gap-3 border-y border-[#c4c5d5] bg-white p-4 md:grid-cols-[minmax(220px,1.4fr)_minmax(190px,1fr)_minmax(190px,1fr)_auto]">
                    <Input aria-label="Tìm chương trình" prefix={<Search size={16} />} allowClear placeholder="Tìm chương trình an sinh" value={search} onChange={(event) => { setSearch(event.target.value); setSelectedWard(undefined); }} />
                    <Select aria-label="Lĩnh vực hỗ trợ" allowClear placeholder="Tất cả lĩnh vực" value={categoryFilter} options={categoryOptions} onChange={(value) => { setCategoryFilter(value); setSelectedWard(undefined); }} />
                    <Select aria-label="Địa bàn trên bản đồ" allowClear placeholder="Tất cả địa bàn bản đồ" value={selectedWard} options={wardOptions.map((wardCode) => ({ value: wardCode, label: WARD_NAMES.get(wardCode) || `Xã/phường ${wardCode}` }))} onChange={setSelectedWard} />
                    <Segmented aria-label="Kiểu hiển thị chương trình" value={viewMode} options={[{ value: "cards", label: "Lưới thẻ" }, { value: "table", label: "Danh sách" }]} onChange={(value) => setViewMode(value as "cards" | "table")} />
                    <div className="md:col-span-4 flex justify-end"><Button icon={<RotateCcw size={15} />} onClick={() => { setSearch(""); setCategoryFilter(undefined); setSelectedWard(undefined); }}>Đặt lại bộ lọc</Button></div>
                </section>

                <Spin spinning={loading}>
                    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(360px,.9fr)]">
                        <section aria-label="Chương trình đang công khai" className="min-w-0 space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <h3 className="text-base font-semibold">Chương trình công khai</h3>
                                <Tag color="blue">{visiblePrograms.length} / {programs.length} chương trình</Tag>
                            </div>
                            {programLoadError ? <Alert type="error" showIcon message="Không thể tải danh sách chương trình" description={programLoadError} /> : visiblePrograms.length === 0 ? <Empty description="Không có chương trình phù hợp với bộ lọc" /> : (
                                <div className={viewMode === "cards" ? "grid gap-4 md:grid-cols-2" : "space-y-3"}>
                                    {visiblePrograms.map((program) => <article key={program.id} className="flex min-w-0 flex-col rounded-lg border border-[#dae2fd] bg-white p-4 shadow-sm sm:p-5">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <Tag color="green">{getSocialAssistanceCategoryLabel(program.category)}</Tag>
                                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#006c4a]"><span className="h-2 w-2 rounded-full bg-[#006c4a]" />Đang công khai</span>
                                        </div>
                                        <h3 className="mt-3 text-base font-bold leading-6 text-[#131b2e]">{program.title}</h3>
                                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#00288e]">
                                            {wardRows.filter((ward) => mapItems.some((item) => item.programId === program.id && item.wardCode === ward.wardCode)).length > 0 ? <span className="inline-flex items-center gap-1"><MapPinned size={14} />{new Set(mapItems.filter((item) => item.programId === program.id).map((item) => item.wardCode)).size} địa bàn có kết quả</span> : null}
                                            <span>{dayjs(program.startDate).format("DD/MM/YYYY")} – {dayjs(program.endDate).format("DD/MM/YYYY")}</span>
                                        </div>
                                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#444653]">{program.publicDescription}</p>
                                        <div className="mt-3 rounded bg-[#f2f3ff] p-3 text-sm"><span className="text-[#444653]">Đối tượng: </span><span className="font-medium text-[#131b2e]">{program.eligibilitySummary}</span></div>
                                        <div className="mt-auto flex flex-wrap gap-2 border-t border-[#e2e7ff] pt-4 mt-4">
                                            <Button icon={<Eye size={15} />} onClick={() => setDetailProgram(program)}>Xem chi tiết</Button>
                                            <Button type="primary" icon={<HandCoins size={15} />} onClick={() => { form.setFieldValue("programId", program.id); handleValuesChange(); formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Ủng hộ chương trình</Button>
                                        </div>
                                    </article>)}
                                </div>
                            )}
                        </section>

                        <aside className="min-w-0 space-y-4">
                            <section className="overflow-hidden rounded-lg border border-[#dae2fd] bg-white">
                                <div className="flex items-center justify-between gap-3 border-b border-[#e2e7ff] px-4 py-4">
                                    <div><h3 className="flex items-center gap-2 font-semibold"><MapPinned size={18} className="text-[#00288e]" />Bản đồ phân bổ hỗ trợ</h3><p className="mt-1 text-xs text-[#444653]">Kết quả tổng hợp theo địa bàn</p></div>
                                    <Tag color="green">Đã duyệt</Tag>
                                </div>
                                {mapError ? <div className="p-4"><Alert type="error" showIcon message="Không thể tải bản đồ phân bổ" description={mapError} /></div> : mapFeatures.features.length ? <PublicResultsMap features={mapFeatures} items={visibleMapItems} heightClassName="h-[320px] sm:h-[380px]" /> : <div className="grid h-64 place-items-center p-4"><Empty description="Chưa có kết quả địa bàn đã duyệt" /></div>}
                                <div className="grid grid-cols-2 border-t border-[#e2e7ff]">
                                    <ProgramMetric label="Lượt nhận hỗ trợ" value={overview.supportInstances.toLocaleString("vi-VN")} detail="Lượt tổng hợp" tone="text-[#00288e]" />
                                    <ProgramMetric label="Tiền mặt đã trao" value={formatCurrency(overview.deliveredCashAmount)} detail="Số liệu công khai" tone="text-[#006c4a]" />
                                </div>
                                <div className="max-h-52 overflow-y-auto border-t border-[#e2e7ff]">
                                    {wardRows.length ? wardRows.map((ward) => <button key={`${ward.provinceCode}-${ward.wardCode}`} type="button" aria-pressed={selectedWard === ward.wardCode} onClick={() => setSelectedWard(selectedWard === ward.wardCode ? undefined : ward.wardCode)} className={`flex w-full items-center justify-between gap-3 border-b border-[#f2f3ff] px-4 py-3 text-left hover:bg-[#f2f3ff] ${selectedWard === ward.wardCode ? "bg-[#e2e7ff]" : "bg-white"}`}><span className="text-sm font-medium">{WARD_NAMES.get(ward.wardCode) || `Xã/phường ${ward.wardCode}`}</span><span className="text-sm font-semibold text-[#00288e]">{ward.recipientCount.toLocaleString("vi-VN")} lượt</span></button>) : null}
                                </div>
                                <div className="flex items-center gap-2 border-t border-[#e2e7ff] px-4 py-3 text-xs text-[#444653]"><span>Ít hỗ trợ</span><span className="h-2.5 flex-1 rounded-full bg-gradient-to-r from-[#c6e7ff] via-[#3dbeff] to-[#004e9f]" /><span>Nhiều hỗ trợ</span></div>
                            </section>
                        </aside>
                    </div>
                </Spin>

                <section id="pledge" ref={formRef} className="scroll-mt-6 rounded-lg border border-[#dae2fd] bg-white p-4 sm:p-6">
                    {pledgeError ? <Alert className="mb-4" type="error" showIcon message="Không thể gửi cam kết" description={pledgeError} /> : null}
                    <div className="mb-5 flex flex-wrap items-center gap-3 border-b border-[#e2e7ff] pb-4"><HandCoins size={22} className="text-[#006c4a]" /><div><h2 className="font-semibold text-[#131b2e]">Đăng ký cam kết ủng hộ</h2><p className="mt-1 text-sm text-[#444653]">Cam kết sẽ được cán bộ liên hệ xác nhận; không xử lý thanh toán trực tuyến.</p></div></div>
                    {programLoadError ? <Alert type="error" showIcon message="Không thể tải chương trình để đăng ký cam kết" description={programLoadError} /> : programs.length > 0 ? (
                        <Form<FormValues> form={form} layout="vertical" initialValues={{ donorType: "INDIVIDUAL", pledgeType: "CASH" }} onValuesChange={handleValuesChange}>
                            <div className="grid gap-x-5 gap-y-3 md:grid-cols-2">
                                <Form.Item label="Chương trình" name="programId" rules={[{ required: true, message: "Vui lòng chọn chương trình." }]}><Select options={programs.map((program) => ({ value: program.id, label: program.title }))} placeholder="Chọn chương trình" /></Form.Item>
                                <Form.Item label="Loại nhà tài trợ" name="donorType" rules={[{ required: true }]}><Segmented block options={[{ value: "INDIVIDUAL", label: "Cá nhân" }, { value: "ORGANIZATION", label: "Tổ chức" }]} /></Form.Item>
                                <Form.Item label="Tên cá nhân/tổ chức" name="donorName" rules={[{ required: true, whitespace: true }]}><Input autoComplete="name" maxLength={255} /></Form.Item>
                                <Form.Item label="Số điện thoại" name="contactPhone" rules={[{ required: true }, { min: 8, max: 20 }, { pattern: /^\+?[0-9][0-9\s().-]*$/ }]}><Input autoComplete="tel" inputMode="tel" maxLength={20} /></Form.Item>
                                <Form.Item label="Email (không bắt buộc)" name="contactEmail" rules={[{ type: "email" }]}><Input autoComplete="email" inputMode="email" maxLength={255} /></Form.Item>
                                <Form.Item label="Hình thức ủng hộ" name="pledgeType" rules={[{ required: true }]}><Segmented block options={[{ value: "CASH", label: "Tiền mặt" }, { value: "IN_KIND", label: "Hiện vật" }]} /></Form.Item>
                                {pledgeType === "IN_KIND" ? <Form.Item className="md:col-span-2" label="Mô tả hiện vật" name="itemDescription" rules={[{ required: true, whitespace: true }]}><Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} maxLength={2000} /></Form.Item> : <Form.Item label="Số tiền dự kiến (đồng)" name="pledgedAmount" rules={[{ required: true }, { type: "number", min: 1 }]}><InputNumber className="!w-full" min={1} step={1000} /></Form.Item>}
                                <Form.Item className="md:col-span-2" name="consent" valuePropName="checked" rules={[{ validator: (_, value) => value ? Promise.resolve() : Promise.reject(new Error("Bạn cần đồng ý để gửi cam kết.")) }]}><Checkbox>Tôi đồng ý để Mặt trận Tổ quốc sử dụng thông tin liên hệ để xác nhận cam kết.</Checkbox></Form.Item>
                            </div>
                            <div className="flex justify-end border-t border-[#e2e7ff] pt-4"><Button type="primary" icon={<Send size={15} />} loading={submitting} onClick={() => void submitPledge()}>Gửi cam kết</Button></div>
                        </Form>
                    ) : <Empty description="Chưa có chương trình để đăng ký cam kết" />}
                </section>

                <Modal title={detailProgram?.title} open={Boolean(detailProgram)} onCancel={() => setDetailProgram(null)} footer={detailProgram ? <Button type="primary" icon={<HandCoins size={15} />} onClick={() => { form.setFieldValue("programId", detailProgram.id); handleValuesChange(); setDetailProgram(null); formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Ủng hộ chương trình</Button> : null} width="min(960px, calc(100vw - 24px))" destroyOnHidden>
                    {detailProgram ? <>
                        <div className="mb-3 flex flex-wrap items-center gap-2"><Tag color="blue">{getSocialAssistanceCategoryLabel(detailProgram.category)}</Tag><Tag color="green">Đang công khai</Tag><span className="text-xs text-[#444653]">{dayjs(detailProgram.startDate).format("DD/MM/YYYY")} – {dayjs(detailProgram.endDate).format("DD/MM/YYYY")}</span></div>
                        <Tabs items={[
                            { key: "overview", label: "Tổng quan & mục tiêu", children: <div className="space-y-5 py-2"><section><h3 className="font-semibold">Nội dung chương trình</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#444653]">{detailProgram.publicDescription}</p></section><section className="rounded bg-[#f2f3ff] p-4"><h3 className="font-semibold">Tiêu chí & đối tượng tiếp nhận</h3><p className="mt-2 text-sm leading-6 text-[#444653]">{detailProgram.eligibilitySummary}</p></section></div> },
                            { key: "map", label: "Bản đồ không gian & địa bàn", children: <div className="space-y-3 py-2"><p className="text-sm text-[#444653]">Vị trí hiển thị là kết quả tổng hợp đã được duyệt theo xã/phường.</p>{detailMapFeatures.features.length ? <PublicResultsMap features={detailMapFeatures} items={detailMapItems} heightClassName="h-[320px] sm:h-[440px]" /> : <Empty description="Chưa có kết quả địa bàn đã duyệt cho chương trình này" />}</div> },
                            { key: "results", label: "Kết quả đã công khai", children: <section aria-label="Kết quả đã duyệt" className="grid grid-cols-1 gap-3 py-3 sm:grid-cols-3"><ProgramMetric label="Lượt hỗ trợ" value={detailSummary.supportInstances.toLocaleString("vi-VN")} detail="Aggregate đã duyệt" tone="text-[#00288e]" /><ProgramMetric label="Tiền mặt đã trao" value={formatCurrency(detailSummary.deliveredCashAmount)} detail="Aggregate công khai" tone="text-[#006c4a]" /><ProgramMetric label="Lượt hiện vật" value={detailSummary.deliveredItemCount.toLocaleString("vi-VN")} detail="Aggregate công khai" tone="text-[#872d00]" /></section> }
                        ]} />
                    </> : null}
                </Modal>
            </div>
        </PublicAssistanceLayout>
    );
}

function ProgramMetric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
    return <article className="min-w-0 rounded-lg border border-[#dae2fd] bg-white p-4"><p className="text-xs font-medium text-[#444653]">{label}</p><p className={`mt-2 break-words text-xl font-bold ${tone}`}>{value}</p><p className="mt-2 text-xs text-[#444653]">{detail}</p></article>;
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", notation: "compact", maximumFractionDigits: 1 }).format(value);
}
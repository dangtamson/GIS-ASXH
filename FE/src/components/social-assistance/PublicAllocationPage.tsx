"use client";

import { endpoints } from "@/lib/endpoints";
import { publicApiGet, PublicApiError } from "@/lib/public-api";
import {
    filterPublicDistributionBatches,
    summarizePublicDistributionBatches
} from "@/lib/social-assistance-utils";
import type { PublicDistributionOrder, PublicSocialAssistanceDistributionBatch } from "@/types/social-assistance";
import { Alert, Empty, Input, Modal, Select, Spin, Table, Tag, Typography } from "antd";
import type { TableColumnsType } from "antd";
import dayjs from "dayjs";
import { Banknote, Calendar, FileCheck2, FileText, History, Layers, MapPin, Search, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { PublicAssistanceLayout, PublicAssistanceToolbar } from "./SocialAssistanceLayout";

type ListResponse<T> = { items: T[] };
type PublicLine = PublicSocialAssistanceDistributionBatch["lines"][number];
type PublicLineRow = {
    key: string;
    batch: PublicSocialAssistanceDistributionBatch;
    line: PublicLine;
};
type PublicLoadState = {
    slug: string;
    batches: PublicSocialAssistanceDistributionBatch[];
    unavailable: boolean;
    error: string | null;
};

const EMPTY_BATCHES: PublicSocialAssistanceDistributionBatch[] = [];

const currency = (amount: number): string => `${amount.toLocaleString("vi-VN")} đ`;
const dateLabel = (value: string | null | undefined): string => value ? dayjs(value).format("DD/MM/YYYY") : "Chưa quy định";

export default function PublicAllocationPage({ slug }: { slug: string }) {
    const [loadState, setLoadState] = useState<PublicLoadState | null>(null);
    const [selected, setSelected] = useState<PublicSocialAssistanceDistributionBatch | null>(null);
    const loading = loadState?.slug !== slug;
    const batches = loadState?.slug === slug ? loadState.batches : EMPTY_BATCHES;
    const unavailable = loadState?.slug === slug && loadState.unavailable;
    const error = loadState?.slug === slug ? loadState.error : null;
    const [publicOrders, setPublicOrders] = useState<PublicDistributionOrder[]>([]);
    const [year, setYear] = useState<string>();
    const [search, setSearch] = useState("");
    const [programTitle, setProgramTitle] = useState<string>();
    const [provinceCode, setProvinceCode] = useState<string>();
    const [wardCode, setWardCode] = useState<string>();

    useEffect(() => {
        let active = true;
        void Promise.all([
            publicApiGet<ListResponse<PublicSocialAssistanceDistributionBatch>>(endpoints.socialAssistance.publicAllocations(slug)),
            publicApiGet<ListResponse<PublicDistributionOrder>>(endpoints.socialAssistance.publicDistributionOrders(slug)).catch(() => ({ items: [] }))
        ]).then(([batchResponse, orderResponse]) => {
            if (active) {
                setLoadState({ slug, batches: batchResponse.items ?? [], unavailable: false, error: null });
                setPublicOrders(orderResponse.items ?? []);
            }
        }).catch((loadError: unknown) => {
            if (!active) return;
            const isUnavailable = loadError instanceof PublicApiError && loadError.status === 404;
            setLoadState({
                slug,
                batches: [],
                unavailable: isUnavailable,
                error: isUnavailable ? null : "Chỉ tiêu công khai hiện không khả dụng. Vui lòng thử lại sau."
            });
        });
        return () => { active = false; };
    }, [slug]);

    const visibleBatches = useMemo(() => filterPublicDistributionBatches(batches, {
        year,
        search,
        programTitle,
        provinceCode,
        wardCode
    }), [batches, programTitle, provinceCode, search, wardCode, year]);
    const summary = summarizePublicDistributionBatches(visibleBatches);
    const years = [...new Set(batches.map((batch) => batch.documentDate.slice(0, 4)))].sort((left, right) => right.localeCompare(left));
    const programs = [...new Set(batches.map((batch) => batch.programTitle).filter((value): value is string => Boolean(value)))].sort((left, right) => left.localeCompare(right, "vi"));
    const provinces = [...new Map(batches.flatMap((batch) => batch.lines.map((line) => [line.provinceCode, line.provinceName || line.provinceCode] as const))).entries()];
    const wards = [...new Map(batches.flatMap((batch) => batch.lines
        .filter((line) => !provinceCode || line.provinceCode === provinceCode)
        .map((line) => [line.wardCode, line.wardName || line.wardCode] as const))).entries()];

    const rows: PublicLineRow[] = visibleBatches.flatMap((batch) => batch.lines.map((line) => ({
        key: `${batch.documentNumber}:${line.provinceCode}:${line.wardCode}`,
        batch,
        line
    })));
    const columns: TableColumnsType<PublicLineRow> = [
        {
            title: "Công văn",
            key: "document",
            width: 220,
            render: (_, row) => (
                <button type="button" className="group min-w-0 text-left" onClick={() => setSelected(row.batch)}>
                    <strong className="block break-words text-sm font-semibold text-[#11409a] group-hover:underline">{row.batch.documentNumber}</strong>
                    <span className="mt-0.5 block break-words text-xs text-slate-500">{row.batch.title}</span>
                </button>
            )
        },
        { title: "Ngày ban hành", key: "date", width: 125, render: (_, row) => <span className="tabular-nums text-slate-600">{dateLabel(row.batch.documentDate)}</span> },
        {
            title: "Nguồn kinh phí",
            key: "source",
            width: 185,
            render: (_, row) => <span className="break-words text-slate-700">{row.batch.fundingSourceText}</span>
        },
        {
            title: "Địa bàn",
            key: "locality",
            width: 200,
            render: (_, row) => (
                <>
                    <strong className="block break-words font-semibold text-slate-900">{row.line.wardName || `Xã/phường ${row.line.wardCode}`}</strong>
                    <span className="mt-0.5 block break-words text-xs text-slate-500">{row.line.provinceName || row.line.provinceCode}</span>
                </>
            )
        },
        {
            title: "Chỉ tiêu",
            key: "quantity",
            width: 135,
            align: "right",
            render: (_, row) => <span className="font-semibold tabular-nums text-slate-900">{row.line.allocatedQuantity.toLocaleString("vi-VN")} {row.batch.unitLabel}</span>
        },
        {
            title: "Giá trị theo dòng",
            key: "amount",
            width: 165,
            align: "right",
            render: (_, row) => <span className="font-semibold tabular-nums text-emerald-700">{currency(row.line.allocatedQuantity * row.batch.unitAmount)}</span>
        },
        {
            title: "Trạng thái",
            key: "status",
            width: 140,
            render: (_, row) => row.batch.status === "PUBLISHED"
                ? <Tag className="!m-0 !rounded-full !border-0 !bg-emerald-50 !px-2.5 !py-0.5 !font-semibold !text-emerald-700" color="green">Đang thực hiện</Tag>
                : <Tag className="!m-0 !rounded-full !border-0 !bg-slate-100 !px-2.5 !py-0.5 !font-medium !text-slate-600">Đợt lịch sử</Tag>
        }
    ];

    return (
        <PublicAssistanceLayout
            slug={slug}
            title="Phân bổ hỗ trợ theo địa bàn"
            badge="Công khai theo công văn"
            subtitle="Chỉ tiêu được giao đến xã/phường, công khai minh bạch theo công văn và không gắn với danh sách hộ cụ thể."
        >
            <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/90 via-white to-teal-50/70 px-5 py-4 shadow-xs">
                    <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/20">
                            <ShieldCheck size={20} aria-label="Chỉ tiêu công khai đã duyệt" />
                        </span>
                        <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Dữ liệu phân bổ đã được phê duyệt</p>
                            <p className="mt-0.5 text-sm text-slate-600">Nhấn vào số công văn trong bảng để xem chi tiết quyết định, điều kiện hưởng và phân bổ theo từng địa bàn.</p>
                        </div>
                    </div>
                </div>

                {error ? <Alert type="error" showIcon message="Không thể tải chỉ tiêu phân bổ" description={error} className="!rounded-xl" /> : null}
                {unavailable && !loading ? <div className="rounded-2xl border border-slate-200/80 bg-white py-14 shadow-xs"><Empty description="Chỉ tiêu phân bổ chưa được mở công khai" /></div> : null}
                {loading ? <div className="grid min-h-64 place-items-center rounded-2xl border border-slate-200/80 bg-white shadow-xs"><Spin size="large" /></div> : null}

                {!loading && !unavailable && !error ? (
                    <>
                        <section aria-label="Tổng chỉ tiêu đang công khai" className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
                            <PublicStat icon={<FileCheck2 size={18} />} iconTone="bg-blue-50 text-[#11409a] ring-blue-100" tone="text-[#11409a]" label="Công văn đang thực hiện" value={summary.activeBatchCount.toLocaleString("vi-VN")} />
                            <PublicStat icon={<Layers size={18} />} iconTone="bg-sky-50 text-sky-700 ring-sky-100" tone="text-sky-800" label="Chỉ tiêu đang giao" value={summary.activeQuantity.toLocaleString("vi-VN")} />
                            <PublicStat icon={<Banknote size={18} />} iconTone="bg-emerald-50 text-emerald-700 ring-emerald-100" tone="text-emerald-700" label="Kinh phí đang giao" value={currency(summary.activeAmount)} />
                            <PublicStat icon={<History size={18} />} iconTone="bg-slate-100 text-slate-600 ring-slate-200" tone="text-slate-700" label="Công văn lịch sử" value={summary.closedBatchCount.toLocaleString("vi-VN")} />
                        </section>

                        <PublicAssistanceToolbar title="Lọc công văn và địa bàn" subtitle="Tra cứu nhanh theo năm ban hành, chương trình hoặc địa bàn tiếp nhận" layout="grid">
                            <Select aria-label="Năm công văn" allowClear placeholder="Tất cả năm" value={year} options={years.map((value) => ({ value, label: value }))} onChange={setYear} />
                            <Input aria-label="Tìm công văn phân bổ" prefix={<Search size={16} className="text-slate-400" />} allowClear placeholder="Số công văn, tên đợt, nguồn" value={search} onChange={(event) => setSearch(event.target.value)} />
                            <Select aria-label="Chương trình liên kết" allowClear placeholder="Tất cả chương trình" value={programTitle} options={programs.map((value) => ({ value, label: value }))} onChange={setProgramTitle} />
                            <Select aria-label="Tỉnh/thành phố" allowClear placeholder="Tất cả tỉnh/thành phố" value={provinceCode} options={provinces.map(([value, label]) => ({ value, label }))} onChange={(value) => { setProvinceCode(value); setWardCode(undefined); }} />
                            <Select aria-label="Xã/phường" allowClear placeholder="Tất cả xã/phường" value={wardCode} options={wards.map(([value, label]) => ({ value, label }))} onChange={setWardCode} />
                        </PublicAssistanceToolbar>

                        {publicOrders.length ? (
                            <section aria-label="Công văn hỗ trợ đa thành phần" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-50/70 px-5 py-4">
                                    <div className="flex items-center gap-2.5">
                                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#11409a] ring-1 ring-blue-100">
                                            <FileText size={16} />
                                        </span>
                                        <Typography.Text strong className="text-sm text-slate-900">Công văn đa thành phần</Typography.Text>
                                    </div>
                                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-[#11409a] ring-1 ring-blue-100">{publicOrders.length} công văn</span>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {publicOrders.flatMap((order) => order.components.map((component) => (
                                        <div key={`${order.documentNumber}:${component.name}`} className="grid gap-3 px-5 py-4 transition-colors hover:bg-slate-50/70 md:grid-cols-[240px_1fr_220px]">
                                            <div>
                                                <strong className="block text-sm font-bold text-slate-900">{order.documentNumber}</strong>
                                                <span className="mt-0.5 block text-xs text-slate-500">{order.title}</span>
                                            </div>
                                            <div>
                                                <strong className="block text-sm font-semibold text-slate-800">{component.name}</strong>
                                                <span className="mt-1 inline-flex flex-wrap items-center gap-1.5 text-xs font-medium text-emerald-700">
                                                    <span className="rounded-md bg-emerald-50 px-2 py-0.5">{component.declaredTotalQuantity.toLocaleString("vi-VN")} {component.unitLabel}</span>
                                                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">{currency(component.projectedTotalAmount)}</span>
                                                </span>
                                            </div>
                                            <div className="text-sm text-slate-600">{component.targets.map((target) => target.type === "LOCALITY"
                                                ? `${target.wardName || target.wardCode}`
                                                : target.organizationName || "Tổ chức").join("; ")}</div>
                                        </div>
                                    )))}
                                </div>
                            </section>
                        ) : null}

                        {rows.length ? (
                            <section aria-label="Chỉ tiêu theo công văn và xã phường" className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-50/70 px-5 py-4">
                                    <div className="flex items-center gap-2.5">
                                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                                            <Layers size={16} />
                                        </span>
                                        <Typography.Text strong className="text-sm text-slate-900">{visibleBatches.length} công văn phân bổ</Typography.Text>
                                    </div>
                                    <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs font-semibold text-slate-600">{rows.length} dòng địa bàn</span>
                                </div>
                                <Table rowKey="key" columns={columns} dataSource={rows} pagination={{ pageSize: 20, hideOnSinglePage: true }} scroll={{ x: 1130 }} size="middle" />
                            </section>
                        ) : <div className="rounded-2xl border border-slate-200/80 bg-white py-12 shadow-xs"><Empty description={batches.length ? "Không có chỉ tiêu phù hợp bộ lọc" : "Chưa có chỉ tiêu được công khai"} /></div>}

                        <p className="flex items-start gap-2.5 rounded-xl border border-slate-200/70 bg-white/80 px-4 py-3 text-xs leading-5 text-slate-500">
                            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-700" />
                            <span>Số liệu được công khai theo công văn; không bao gồm tên hộ, mã hồ sơ, số điện thoại hoặc địa chỉ cá nhân.</span>
                        </p>
                    </>
                ) : null}

                <Modal
                    open={Boolean(selected)}
                    onCancel={() => setSelected(null)}
                    footer={null}
                    centered
                    destroyOnHidden
                    width="min(1040px, calc(100vw - 32px))"
                    styles={{ body: { maxHeight: "80vh", overflowY: "auto", paddingTop: 8 } }}
                    title={selected ? (
                        <div className="flex flex-wrap items-center gap-2.5 pr-8">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#11409a] ring-1 ring-blue-100">
                                <FileText size={18} />
                            </span>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-base font-bold text-slate-900 sm:text-lg">{selected.documentNumber}</span>
                                    {selected.status === "PUBLISHED"
                                        ? <Tag className="!m-0 !rounded-full !border-0 !bg-teal-50 !px-2.5 !py-0.5 !font-semibold !text-teal-700">Đang thực hiện</Tag>
                                        : <Tag className="!m-0 !rounded-full !border-0 !bg-slate-100 !px-2.5 !py-0.5 !font-medium !text-slate-600">Đợt lịch sử</Tag>}
                                </div>
                                <p className="mt-0.5 text-xs font-normal text-slate-500 sm:text-sm">{selected.title}</p>
                            </div>
                        </div>
                    ) : "Chi tiết công văn"}
                >
                    {selected ? (
                        <div className="space-y-6 pt-3">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                                    <p className="text-xs font-semibold text-slate-500">Tổng chỉ tiêu phân bổ</p>
                                    <p className="mt-1.5 text-xl font-bold tabular-nums text-[#11409a]">
                                        {selected.declaredTotalQuantity.toLocaleString("vi-VN")} {selected.unitLabel}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">{selected.supportItemName} · {currency(selected.unitAmount)}/{selected.unitLabel}</p>
                                </div>
                                <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-4">
                                    <p className="text-xs font-semibold text-slate-500">Tổng kinh phí</p>
                                    <p className="mt-1.5 text-xl font-bold tabular-nums text-teal-700">
                                        {currency(selected.declaredTotalAmount)}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">Theo công văn phê duyệt</p>
                                </div>
                                <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4">
                                    <p className="text-xs font-semibold text-slate-500">Địa bàn tiếp nhận</p>
                                    <p className="mt-1.5 flex items-center gap-1.5 text-xl font-bold tabular-nums text-slate-900">
                                        <MapPin size={18} className="text-[#11409a]" />
                                        <span>{selected.lines.length} xã/phường</span>
                                    </p>
                                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                                        <Calendar size={12} />
                                        <span>Ban hành ngày {dateLabel(selected.documentDate)}</span>
                                    </p>
                                </div>
                            </div>

                            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5">
                                <h3 className="mb-3.5 text-sm font-bold uppercase tracking-wide text-slate-700">Thông tin công văn</h3>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    <DetailItem label="Ngày ban hành" value={dateLabel(selected.documentDate)} />
                                    <DetailItem label="Chương trình liên kết" value={selected.programTitle || "Không liên kết"} />
                                    <DetailItem label="Năm phê duyệt danh sách" value={selected.eligibilityApprovalYear ? String(selected.eligibilityApprovalYear) : "—"} />
                                    <DetailItem label="Hạn nộp hồ sơ" value={dateLabel(selected.submissionDeadline)} />
                                    <DetailItem label="Hạn hoàn thành" value={dateLabel(selected.completionDeadline)} />
                                    <DetailItem label="Hình thức hỗ trợ" value={`${selected.supportItemName} (${currency(selected.unitAmount)}/${selected.unitLabel})`} />
                                    <DetailItem className="sm:col-span-2 lg:col-span-3" label="Nguồn kinh phí" value={selected.fundingSourceText} />
                                </div>
                            </section>

                            <section className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 sm:p-5">
                                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Điều kiện hưởng</h3>
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selected.eligibilitySummary}</p>
                            </section>

                            <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-50/70 px-4 py-3.5 sm:px-5">
                                    <h3 className="text-sm font-bold text-slate-900">Chỉ tiêu phân bổ theo địa bàn</h3>
                                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-[#11409a] ring-1 ring-blue-100">
                                        {selected.lines.length} địa bàn
                                    </span>
                                </div>
                                <Table
                                    rowKey={(line) => `${line.provinceCode}:${line.wardCode}`}
                                    size="middle"
                                    pagination={{ pageSize: 10, hideOnSinglePage: true }}
                                    scroll={{ x: 560 }}
                                    dataSource={selected.lines}
                                    columns={[
                                        { title: "Tỉnh/thành phố", dataIndex: "provinceName", key: "provinceName", render: (value: string | null, line: PublicLine) => <span className="text-slate-600">{value || line.provinceCode}</span> },
                                        { title: "Xã/phường", dataIndex: "wardName", key: "wardName", render: (value: string | null, line: PublicLine) => <span className="font-semibold text-slate-900">{value || line.wardCode}</span> },
                                        { title: "Số lượng", dataIndex: "allocatedQuantity", key: "allocatedQuantity", align: "right", width: 150, render: (value: number) => <span className="font-semibold tabular-nums text-slate-900">{value.toLocaleString("vi-VN")} {selected.unitLabel}</span> },
                                        { title: "Giá trị", key: "amount", align: "right", width: 180, render: (_, line) => <span className="font-semibold tabular-nums text-teal-700">{currency(line.allocatedQuantity * selected.unitAmount)}</span> }
                                    ]}
                                />
                            </section>

                            <Alert type="info" showIcon icon={<FileText size={16} />} message="Theo dõi theo công văn" description="Mỗi địa bàn được hiển thị riêng trong từng công văn để đối chiếu các đợt phân bổ." className="!rounded-xl" />
                        </div>
                    ) : null}
                </Modal>
            </div>
        </PublicAssistanceLayout>
    );
}

function DetailItem({ label, value, className }: { label: string; value: string; className?: string }) {
    return (
        <div className={`min-w-0 rounded-xl bg-slate-50/80 px-3.5 py-2.5 ring-1 ring-slate-200/60 ${className ?? ""}`}>
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <p className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</p>
        </div>
    );
}

function PublicStat({ icon, iconTone, tone, label, value }: { icon: ReactNode; iconTone: string; tone: string; label: string; value: string }) {
    return (
        <div className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-shadow hover:shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-500">{label}</p>
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ring-1 ${iconTone}`}>{icon}</span>
            </div>
            <p className={`mt-2.5 break-words text-lg font-bold tabular-nums sm:text-xl ${tone}`}>{value}</p>
        </div>
    );
}
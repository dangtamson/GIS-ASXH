"use client";

import { endpoints } from "@/lib/endpoints";
import { publicApiGet, PublicApiError } from "@/lib/public-api";
import {
    filterPublicDistributionBatches,
    summarizePublicDistributionBatches
} from "@/lib/social-assistance-utils";
import type { PublicSocialAssistanceDistributionBatch } from "@/types/social-assistance";
import { Alert, Descriptions, Drawer, Empty, Input, Select, Spin, Table, Tag, Typography } from "antd";
import type { TableColumnsType } from "antd";
import dayjs from "dayjs";
import { FileText, Search, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PublicAssistanceLayout, SocialAssistanceToolbar } from "./SocialAssistanceLayout";

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
    const [year, setYear] = useState<string>();
    const [search, setSearch] = useState("");
    const [programTitle, setProgramTitle] = useState<string>();
    const [provinceCode, setProvinceCode] = useState<string>();
    const [wardCode, setWardCode] = useState<string>();

    useEffect(() => {
        let active = true;
        void publicApiGet<ListResponse<PublicSocialAssistanceDistributionBatch>>(
            endpoints.socialAssistance.publicAllocations(slug)
        ).then((response) => {
            if (active) setLoadState({ slug, batches: response.items ?? [], unavailable: false, error: null });
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
            width: 210,
            render: (_, row) => <button type="button" className="min-w-0 text-left" onClick={() => setSelected(row.batch)}><strong className="block break-words text-sm text-gray-900">{row.batch.documentNumber}</strong><span className="mt-1 block break-words text-xs text-gray-600">{row.batch.title}</span></button>
        },
        { title: "Ngày ban hành", key: "date", width: 125, render: (_, row) => dateLabel(row.batch.documentDate) },
        {
            title: "Nguồn kinh phí",
            key: "source",
            width: 180,
            render: (_, row) => <span className="break-words">{row.batch.fundingSourceText}</span>
        },
        {
            title: "Địa bàn",
            key: "locality",
            width: 200,
            render: (_, row) => <><strong className="block break-words">{row.line.wardName || `Xã/phường ${row.line.wardCode}`}</strong><span className="mt-1 block break-words text-xs text-gray-500">{row.line.provinceName || row.line.provinceCode}</span></>
        },
        {
            title: "Chỉ tiêu",
            key: "quantity",
            width: 130,
            align: "right",
            render: (_, row) => `${row.line.allocatedQuantity.toLocaleString("vi-VN")} ${row.batch.unitLabel}`
        },
        {
            title: "Giá trị theo dòng",
            key: "amount",
            width: 165,
            align: "right",
            render: (_, row) => currency(row.line.allocatedQuantity * row.batch.unitAmount)
        },
        {
            title: "Trạng thái",
            key: "status",
            width: 135,
            render: (_, row) => row.batch.status === "PUBLISHED"
                ? <Tag color="green">Đang thực hiện</Tag>
                : <Tag>Đợt lịch sử</Tag>
        }
    ];

    return (
        <PublicAssistanceLayout slug={slug} title="Phân bổ hỗ trợ theo địa bàn">
            <div className="space-y-5">
                <header className="flex flex-wrap items-end justify-between gap-3 border-l-4 border-[#006c4a] bg-white px-4 py-4 sm:px-5">
                    <div className="min-w-0"><p className="text-[11px] font-semibold uppercase text-[#006c4a]">Công khai theo công văn</p><p className="mt-1 text-sm leading-6 text-gray-600">Chỉ tiêu được giao đến xã/phường, không gắn với danh sách hộ cụ thể.</p></div>
                    <ShieldCheck size={20} className="shrink-0 text-[#006c4a]" aria-label="Chỉ tiêu công khai đã duyệt" />
                </header>

                {error ? <Alert type="error" showIcon message="Không thể tải chỉ tiêu phân bổ" description={error} /> : null}
                {unavailable && !loading ? <div className="border-y border-gray-200 bg-white py-12"><Empty description="Chỉ tiêu phân bổ chưa được mở công khai" /></div> : null}
                {loading ? <div className="grid min-h-56 place-items-center border-y border-gray-200 bg-white"><Spin size="large" /></div> : null}

                {!loading && !unavailable && !error ? (
                    <>
                        <section aria-label="Tổng chỉ tiêu đang công khai" className="grid grid-cols-2 border-y border-gray-200 bg-white sm:grid-cols-4">
                            <PublicStat label="Công văn đang thực hiện" value={summary.activeBatchCount.toLocaleString("vi-VN")} />
                            <PublicStat label="Chỉ tiêu đang giao" value={summary.activeQuantity.toLocaleString("vi-VN")} />
                            <PublicStat label="Kinh phí đang giao" value={currency(summary.activeAmount)} />
                            <PublicStat label="Công văn lịch sử" value={summary.closedBatchCount.toLocaleString("vi-VN")} />
                        </section>

                        <SocialAssistanceToolbar title="Lọc công văn và địa bàn" layout="grid">
                            <Select aria-label="Năm công văn" allowClear placeholder="Tất cả năm" value={year} options={years.map((value) => ({ value, label: value }))} onChange={setYear} />
                            <Input aria-label="Tìm công văn phân bổ" prefix={<Search size={16} className="text-gray-400" />} allowClear placeholder="Số công văn, tên đợt, nguồn" value={search} onChange={(event) => setSearch(event.target.value)} />
                            <Select aria-label="Chương trình liên kết" allowClear placeholder="Tất cả chương trình" value={programTitle} options={programs.map((value) => ({ value, label: value }))} onChange={setProgramTitle} />
                            <Select aria-label="Tỉnh/thành phố" allowClear placeholder="Tất cả tỉnh/thành phố" value={provinceCode} options={provinces.map(([value, label]) => ({ value, label }))} onChange={(value) => { setProvinceCode(value); setWardCode(undefined); }} />
                            <Select aria-label="Xã/phường" allowClear placeholder="Tất cả xã/phường" value={wardCode} options={wards.map(([value, label]) => ({ value, label }))} onChange={setWardCode} />
                        </SocialAssistanceToolbar>

                        {rows.length ? (
                            <section aria-label="Chỉ tiêu theo công văn và xã phường" className="min-w-0 border-y border-gray-200 bg-white">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3"><Typography.Text strong>{visibleBatches.length} công văn</Typography.Text><Typography.Text type="secondary">{rows.length} dòng địa bàn</Typography.Text></div>
                                <Table rowKey="key" columns={columns} dataSource={rows} pagination={{ pageSize: 20, hideOnSinglePage: true }} scroll={{ x: 1130 }} size="middle" />
                            </section>
                        ) : <div className="border-y border-gray-200 bg-white py-10"><Empty description={batches.length ? "Không có chỉ tiêu phù hợp bộ lọc" : "Chưa có chỉ tiêu được công khai"} /></div>}

                        <p className="flex items-start gap-2 border-t border-gray-200 px-1 py-3 text-xs leading-5 text-gray-500"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#006c4a]" />Số liệu được công khai theo công văn; không bao gồm tên hộ, mã hồ sơ, số điện thoại hoặc địa chỉ cá nhân.</p>
                    </>
                ) : null}

                <Drawer title={selected?.documentNumber ?? "Chi tiết công văn"} open={Boolean(selected)} onClose={() => setSelected(null)} width="min(700px, calc(100vw - 24px))">
                    {selected ? <div className="space-y-5">
                        <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} items={[
                            { key: "title", label: "Đợt phân bổ", children: selected.title },
                            { key: "date", label: "Ngày ban hành", children: dateLabel(selected.documentDate) },
                            { key: "source", label: "Nguồn kinh phí", children: selected.fundingSourceText },
                            { key: "program", label: "Chương trình", children: selected.programTitle || "Không liên kết" },
                            { key: "item", label: "Hình thức hỗ trợ", children: `${selected.supportItemName} · ${currency(selected.unitAmount)}/${selected.unitLabel}` },
                            { key: "quantity", label: "Tổng chỉ tiêu", children: `${selected.declaredTotalQuantity.toLocaleString("vi-VN")} ${selected.unitLabel}` },
                            { key: "amount", label: "Tổng kinh phí", children: currency(selected.declaredTotalAmount) },
                            { key: "submission", label: "Hạn nộp hồ sơ", children: dateLabel(selected.submissionDeadline) },
                            { key: "completion", label: "Hạn hoàn thành", children: dateLabel(selected.completionDeadline) },
                            { key: "eligibilityYear", label: "Năm phê duyệt danh sách", children: selected.eligibilityApprovalYear ?? "—" },
                            { key: "status", label: "Trạng thái", children: selected.status === "PUBLISHED" ? <Tag color="green">Đang thực hiện</Tag> : <Tag>Đợt lịch sử</Tag> }
                        ]} />
                        <div><Typography.Title level={5}>Điều kiện hưởng</Typography.Title><p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">{selected.eligibilitySummary}</p></div>
                        <div><Typography.Title level={5}>Chỉ tiêu theo địa bàn</Typography.Title><Table rowKey={(line) => `${line.provinceCode}:${line.wardCode}`} size="small" pagination={{ pageSize: 10, hideOnSinglePage: true }} scroll={{ x: 450 }} dataSource={selected.lines} columns={[
                            { title: "Tỉnh/thành phố", dataIndex: "provinceName", key: "provinceName", render: (value: string | null, line: PublicLine) => value || line.provinceCode },
                            { title: "Xã/phường", dataIndex: "wardName", key: "wardName", render: (value: string | null, line: PublicLine) => value || line.wardCode },
                            { title: "Số lượng", dataIndex: "allocatedQuantity", key: "allocatedQuantity", align: "right" },
                            { title: "Giá trị", key: "amount", align: "right", render: (_, line) => currency(line.allocatedQuantity * selected.unitAmount) }
                        ]} /></div>
                        <Alert type="info" showIcon icon={<FileText size={16} />} message="Theo dõi theo công văn" description="Mỗi địa bàn được hiển thị riêng trong từng công văn để đối chiếu các đợt phân bổ." />
                    </div> : null}
                </Drawer>
            </div>
        </PublicAssistanceLayout>
    );
}

function PublicStat({ label, value }: { label: string; value: string }) {
    return <div className="min-w-0 border-b border-r border-gray-100 p-4"><p className="text-xs leading-5 text-gray-600">{label}</p><p className="mt-1 break-words text-lg font-semibold text-[#006c4a]">{value}</p></div>;
}
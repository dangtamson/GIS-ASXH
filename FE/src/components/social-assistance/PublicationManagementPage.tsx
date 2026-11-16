"use client";

import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { SocialAssistancePage } from "./SocialAssistanceLayout";
import type { SocialAssistanceProgram, SocialAssistancePublicationItem } from "@/types/social-assistance";
import { Alert, App, Button, Empty, Input, Popconfirm, Select, Spin, Steps, Table } from "antd";
import type { TableColumnsType } from "antd";
import { Check, Eye, FileCheck2 } from "lucide-react";
import { useEffect, useState } from "react";

type PublicationFilters = {
    periodStart: string;
    periodEnd: string;
    programId?: string;
    provinceCode?: string;
    wardCode?: string;
};
type PreviewResponse = { items: SocialAssistancePublicationItem[] };
type DraftResponse = { publicationBatchId: string; items: SocialAssistancePublicationItem[] };
type ApprovalResponse = DraftResponse & { approvedAt: string };

const year = new Date().getFullYear();
const initialFilters: PublicationFilters = { periodStart: `${year}-01-01`, periodEnd: `${year}-12-31` };
const money = (amount: number) => `${amount.toLocaleString("vi-VN")} đ`;

export default function PublicationManagementPage() {
    const { message } = App.useApp();
    const [filters, setFilters] = useState<PublicationFilters>(initialFilters);
    const [programs, setPrograms] = useState<SocialAssistanceProgram[]>([]);
    const [geographies, setGeographies] = useState<Array<{ provinceCode: string; wardCode: string }>>([]);
    const [preview, setPreview] = useState<SocialAssistancePublicationItem[]>([]);
    const [batchId, setBatchId] = useState<string | null>(null);
    const [published, setPublished] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        api.get<{
            programs?: SocialAssistanceProgram[];
            geographies?: Array<{ provinceCode: string; wardCode: string }>;
        }>(endpoints.socialAssistance.publicationOptions).then((response) => {
            if (!active) return;
            setPrograms(response.programs ?? []);
            setGeographies(response.geographies ?? []);
        }).catch((loadError: unknown) => {
            if (active) setError(loadError instanceof Error ? loadError.message : "Không thể tải bộ lọc công khai.");
        }).finally(() => {
            if (active) setLoading(false);
        });
        return () => { active = false; };
    }, []);
    const provinceCodes = [...new Set(geographies.map((item) => item.provinceCode))];
    const wardCodes = [...new Set(geographies
        .filter((item) => !filters.provinceCode || item.provinceCode === filters.provinceCode)
        .map((item) => item.wardCode))];

    const body = () => ({
        periodStart: filters.periodStart,
        periodEnd: filters.periodEnd,
        ...(filters.programId ? { programId: filters.programId } : {}),
        ...(filters.provinceCode ? { provinceCode: filters.provinceCode } : {}),
        ...(filters.wardCode ? { wardCode: filters.wardCode } : {})
    });

    const runPreview = async () => {
        setSaving(true);
        setError(null);
        setBatchId(null);
        setPublished(false);
        try {
            const response = await api.post<PreviewResponse>(endpoints.socialAssistance.publicationPreview, body());
            setPreview(response.items ?? []);
        } catch (previewError) {
            setError(previewError instanceof Error ? previewError.message : "Không thể tạo bản xem trước.");
        } finally {
            setSaving(false);
        }
    };

    const createDraft = async () => {
        setSaving(true);
        setError(null);
        try {
            const response = await api.post<DraftResponse>(endpoints.socialAssistance.publicationDraft, body());
            setBatchId(response.publicationBatchId);
            setPreview(response.items ?? []);
            message.success("Đã lưu bản nháp. Cần duyệt riêng để công khai.");
        } catch (draftError) {
            setError(draftError instanceof Error ? draftError.message : "Không thể lưu bản nháp.");
        } finally {
            setSaving(false);
        }
    };

    const approveDraft = async () => {
        if (!batchId) return;
        setSaving(true);
        setError(null);
        try {
            const response = await api.post<ApprovalResponse>(endpoints.socialAssistance.publicationApprove(batchId), {});
            setPreview(response.items ?? preview);
            setPublished(true);
            message.success("Kết quả đã được duyệt và công khai.");
        } catch (approveError) {
            setError(approveError instanceof Error ? approveError.message : "Không thể duyệt kết quả.");
        } finally {
            setSaving(false);
        }
    };

    const columns: TableColumnsType<SocialAssistancePublicationItem> = [
        { title: "Chương trình", dataIndex: "programId", key: "programId", render: (id: string) => programs.find((program) => program.id === id)?.title ?? id.slice(0, 8) },
        { title: "Tỉnh/thành", dataIndex: "provinceCode", key: "provinceCode" },
        { title: "Xã/phường", dataIndex: "wardCode", key: "wardCode" },
        { title: "Người nhận", dataIndex: "recipientCount", key: "recipientCount", align: "right" },
        { title: "Tiền mặt đã trao", dataIndex: "deliveredCashAmount", key: "deliveredCashAmount", align: "right", render: money },
        { title: "Lượt trao hiện vật", dataIndex: "deliveredItemCount", key: "deliveredItemCount", align: "right" }
    ];

    return (
        <SocialAssistancePage title="Duyệt kết quả công khai" icon={FileCheck2}>
            <Steps size="small" current={published ? 3 : batchId ? 2 : preview.length ? 1 : 0} items={[{ title: "Xem trước" }, { title: "Lưu bản nháp" }, { title: "Duyệt công khai" }]} />
            {error ? <Alert type="error" showIcon message={error} /> : null}
            <Spin spinning={loading}>
                <section aria-label="Phạm vi công khai" className="grid grid-cols-1 items-end gap-4 border-b border-slate-200 bg-gray-50/70 p-4 sm:grid-cols-2 xl:grid-cols-3">
                    <label className="grid gap-1 text-sm text-slate-600">Từ ngày trao
                        <Input type="date" value={filters.periodStart} onChange={(event) => setFilters((current) => ({ ...current, periodStart: event.target.value }))} />
                    </label>
                    <label className="grid gap-1 text-sm text-slate-600">Đến ngày trao
                        <Input type="date" value={filters.periodEnd} onChange={(event) => setFilters((current) => ({ ...current, periodEnd: event.target.value }))} />
                    </label>
                    <label className="grid min-w-0 gap-1 text-sm text-gray-600">Chương trình<Select allowClear value={filters.programId} placeholder="Tất cả chương trình" options={programs.map((program) => ({ value: program.id, label: program.title }))} onChange={(value) => setFilters((current) => ({ ...current, programId: value }))} /></label>
                    <label className="grid min-w-0 gap-1 text-sm text-gray-600">Tỉnh/thành phố<Select allowClear showSearch optionFilterProp="label" value={filters.provinceCode} placeholder="Tất cả tỉnh/thành" options={provinceCodes.map((code) => ({ value: code, label: `Tỉnh/thành ${code}` }))} onChange={(value) => setFilters((current) => ({ ...current, provinceCode: value, wardCode: undefined }))} /></label>
                    <label className="grid min-w-0 gap-1 text-sm text-gray-600">Xã/phường<Select allowClear showSearch optionFilterProp="label" value={filters.wardCode} placeholder="Tất cả xã/phường" disabled={!filters.provinceCode} options={wardCodes.map((code) => ({ value: code, label: `Xã/phường ${code}` }))} onChange={(value) => setFilters((current) => ({ ...current, wardCode: value }))} /></label>
                    <Button type="primary" icon={<Eye size={15} />} loading={saving} onClick={() => void runPreview()}>Xem trước kết quả</Button>
                </section>
            </Spin>

            {published ? <Alert type="success" showIcon message="Bản công khai đã được duyệt" /> : batchId ? <Alert type="warning" showIcon message="Bản nháp đang chờ duyệt" /> : null}
            <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-base font-semibold text-slate-900">Tổng hợp theo chương trình và địa bàn</h2>
                        <p className="mt-1 text-sm text-slate-500">Chỉ hỗ trợ đã trao hoặc đối soát được đưa vào bản công khai.</p>
                    </div>
                    <div className="flex gap-2">
                        {preview.length > 0 && !batchId ? <Button icon={<FileCheck2 size={15} />} loading={saving} onClick={() => void createDraft()}>Lưu bản nháp</Button> : null}
                        {batchId && !published ? (
                            <Popconfirm title="Công khai bản tổng hợp này?" description="Dữ liệu sẽ hiển thị trên bản đồ công khai." okText="Duyệt công khai" cancelText="Hủy" onConfirm={() => void approveDraft()}>
                                <Button type="primary" icon={<Check size={15} />} loading={saving}>Duyệt công khai</Button>
                            </Popconfirm>
                        ) : null}
                    </div>
                </div>
                <Table<SocialAssistancePublicationItem>
                    rowKey={(row) => row.id || `${row.programId}-${row.provinceCode}-${row.wardCode}`}
                    columns={columns}
                    dataSource={preview}
                    loading={saving}
                    pagination={{ pageSize: 15, showSizeChanger: false }}
                    scroll={{ x: 760 }}
                    locale={{ emptyText: <Empty description="Chưa có dữ liệu đã trao trong phạm vi chọn" /> }}
                />
            </section>
        </SocialAssistancePage>
    );
}
"use client";

import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { SocialAssistanceToolbar } from "./SocialAssistanceLayout";
import DistributionBatchEditorDrawer from "./DistributionBatchEditorDrawer";
import type {
    DistributionBatchCreateInput,
    DistributionBatchLineInput,
    DistributionBatchStatus,
    SocialAssistanceDistributionBatch,
    SocialAssistanceProgram
} from "@/types/social-assistance";
import { Alert, App, Button, Descriptions, Drawer, Empty, Input, Popconfirm, Select, Space, Table, Tag, Tooltip, Typography } from "antd";
import type { TableColumnsType } from "antd";
import dayjs from "dayjs";
import { ChevronRight, CircleCheck, FilePlus2, Plus, Radio, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type BatchResponse = { items: SocialAssistanceDistributionBatch[] };
type BatchItemResponse = { item: SocialAssistanceDistributionBatch };
type ProgramResponse = { items: SocialAssistanceProgram[] };

const STATUS_LABELS: Record<DistributionBatchStatus, string> = {
    DRAFT: "Bản nháp",
    PUBLISHED: "Đang công khai",
    CLOSED: "Đã kết thúc"
};
const STATUS_COLORS: Record<DistributionBatchStatus, string> = {
    DRAFT: "gold",
    PUBLISHED: "green",
    CLOSED: "default"
};
const currency = (amount: number): string => `${amount.toLocaleString("vi-VN")} đ`;
const dateLabel = (value: string | null | undefined): string => value ? dayjs(value).format("DD/MM/YYYY") : "Chưa quy định";

export default function DistributionBatchManagementPage() {
    const { message } = App.useApp();
    const [items, setItems] = useState<SocialAssistanceDistributionBatch[]>([]);
    const [programs, setPrograms] = useState<SocialAssistanceProgram[]>([]);
    const [selected, setSelected] = useState<SocialAssistanceDistributionBatch | null>(null);
    const [editing, setEditing] = useState<SocialAssistanceDistributionBatch | null>(null);
    const [editorOpen, setEditorOpen] = useState(false);
    const [correctionOf, setCorrectionOf] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<DistributionBatchStatus>();
    const [programFilter, setProgramFilter] = useState<string>();

    const loadData = async (): Promise<void> => {
        setLoading(true);
        setError(null);
        try {
            const [batchResponse, programResponse] = await Promise.all([
                api.get<BatchResponse>(endpoints.socialAssistance.distributionBatches()),
                api.get<ProgramResponse>(endpoints.socialAssistance.programs)
            ]);
            setItems(batchResponse.items ?? []);
            setPrograms(programResponse.items ?? []);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "Không thể tải các đợt phân bổ.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void loadData(); }, []);

    const visibleItems = useMemo(() => items.filter((item) =>
        (!statusFilter || item.status === statusFilter)
        && (!programFilter || item.programId === programFilter)
        && `${item.documentNumber} ${item.title} ${item.fundingSourceText}`.toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi"))
    ), [items, programFilter, search, statusFilter]);

    const openCreate = (): void => {
        setEditing(null);
        setCorrectionOf(null);
        setEditorOpen(true);
    };

    const openEdit = (batch: SocialAssistanceDistributionBatch): void => {
        setEditing(batch);
        setCorrectionOf(null);
        setEditorOpen(true);
        setSelected(null);
    };

    const openCorrection = (batch: SocialAssistanceDistributionBatch): void => {
        setEditing(null);
        setCorrectionOf(batch.id);
        setEditorOpen(true);
        setSelected(null);
    };

    const saveDraft = async (input: DistributionBatchCreateInput): Promise<void> => {
        setSaving(true);
        try {
            const response = editing
                ? await api.patch<BatchItemResponse>(endpoints.socialAssistance.distributionBatch(editing.id), input)
                : await api.post<BatchItemResponse>(endpoints.socialAssistance.distributionBatches(), input);
            setItems((current) => editing
                ? current.map((item) => item.id === response.item.id ? response.item : item)
                : [response.item, ...current]);
            setEditorOpen(false);
            setEditing(null);
            setCorrectionOf(null);
            message.success(editing ? "Đã cập nhật bản nháp." : "Đã tạo bản nháp phân bổ.");
            await loadData();
        } catch (saveError) {
            message.error(saveError instanceof Error ? saveError.message : "Không thể lưu bản nháp.");
            throw saveError;
        } finally {
            setSaving(false);
        }
    };

    const transition = async (batch: SocialAssistanceDistributionBatch, nextStatus: "PUBLISHED" | "CLOSED"): Promise<void> => {
        setSaving(true);
        try {
            const path = nextStatus === "PUBLISHED"
                ? endpoints.socialAssistance.distributionBatchPublish(batch.id)
                : endpoints.socialAssistance.distributionBatchClose(batch.id);
            const response = await api.post<BatchItemResponse>(path, {});
            setItems((current) => current.map((item) => item.id === response.item.id ? response.item : item));
            setSelected(response.item);
            message.success(nextStatus === "PUBLISHED" ? "Đã công khai chỉ tiêu." : "Đã kết thúc đợt phân bổ.");
        } catch (transitionError) {
            message.error(transitionError instanceof Error ? transitionError.message : "Không thể cập nhật trạng thái.");
        } finally {
            setSaving(false);
        }
    };

    const columns: TableColumnsType<SocialAssistanceDistributionBatch> = [
        {
            title: "Công văn / đợt",
            key: "document",
            width: 260,
            render: (_, batch) => <button type="button" className="min-w-0 text-left" onClick={() => setSelected(batch)}><strong className="block break-words text-sm text-gray-900">{batch.documentNumber}</strong><span className="mt-1 block break-words text-xs text-gray-600">{batch.title}</span></button>
        },
        { title: "Ngày ban hành", dataIndex: "documentDate", key: "documentDate", width: 130, render: dateLabel },
        {
            title: "Chỉ tiêu",
            key: "quantity",
            width: 170,
            render: (_, batch) => <><strong>{batch.declaredTotalQuantity.toLocaleString("vi-VN")} {batch.unitLabel}</strong><span className="mt-1 block text-xs text-gray-500">{batch.lines.length} địa bàn</span></>
        },
        { title: "Kinh phí", dataIndex: "declaredTotalAmount", key: "amount", width: 170, render: (amount: number) => currency(amount) },
        {
            title: "Hạn hoàn thành",
            dataIndex: "completionDeadline",
            key: "completionDeadline",
            width: 150,
            render: (value: string | null) => value ? dateLabel(value) : "—"
        },
        { title: "Trạng thái", dataIndex: "status", key: "status", width: 140, render: (status: DistributionBatchStatus) => <Tag color={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Tag> },
        {
            title: "",
            key: "actions",
            width: 180,
            render: (_, batch) => (
                <Space wrap>
                    <Tooltip title="Xem chi tiết"><Button aria-label={`Xem ${batch.documentNumber}`} icon={<ChevronRight size={15} />} onClick={() => setSelected(batch)} /></Tooltip>
                    {batch.status === "DRAFT" ? <Tooltip title="Sửa bản nháp"><Button aria-label={`Sửa ${batch.documentNumber}`} icon={<Search size={15} />} onClick={() => openEdit(batch)} /></Tooltip> : null}
                    {batch.status === "DRAFT" ? <Popconfirm title="Công khai chỉ tiêu của công văn này?" okText="Công khai" cancelText="Hủy" onConfirm={() => void transition(batch, "PUBLISHED")}><Button aria-label={`Công khai ${batch.documentNumber}`} icon={<Radio size={15} />} loading={saving}>Công khai</Button></Popconfirm> : null}
                </Space>
            )
        }
    ];

    const detailLineColumns: TableColumnsType<DistributionBatchLineInput> = [
        { title: "Tỉnh/thành phố", dataIndex: "provinceCode", key: "provinceCode" },
        { title: "Mã xã/phường", dataIndex: "wardCode", key: "wardCode" },
        { title: "Chỉ tiêu", dataIndex: "allocatedQuantity", key: "allocatedQuantity", align: "right" }
    ];

    return (
        <section className="min-w-0 space-y-4">
            {error ? <Alert type="error" showIcon message={error} /> : null}
            <div className="flex justify-end">
                <Button type="primary" icon={<Plus size={15} />} onClick={openCreate}>Tạo đợt phân bổ</Button>
            </div>
            <section className="overflow-hidden border-y border-gray-200 bg-white">
                <SocialAssistanceToolbar title="Tìm và lọc đợt phân bổ">
                    <Input aria-label="Tìm công văn phân bổ" prefix={<Search size={16} className="text-gray-400" />} allowClear placeholder="Số công văn, tên đợt, nguồn kinh phí" value={search} onChange={(event) => setSearch(event.target.value)} />
                    <Select aria-label="Trạng thái đợt phân bổ" allowClear placeholder="Tất cả trạng thái" value={statusFilter} options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))} onChange={setStatusFilter} />
                    <Select aria-label="Chương trình liên kết" allowClear placeholder="Tất cả chương trình" value={programFilter} options={programs.map((program) => ({ value: program.id, label: program.title }))} onChange={setProgramFilter} />
                    <span className="self-center text-sm text-gray-500">{visibleItems.length} đợt</span>
                </SocialAssistanceToolbar>
                <Table
                    rowKey="id"
                    columns={columns}
                    dataSource={visibleItems}
                    loading={loading}
                    pagination={{ pageSize: 20, hideOnSinglePage: true }}
                    scroll={{ x: 1080 }}
                    locale={{ emptyText: <Empty description="Không có đợt phân bổ phù hợp" /> }}
                />
            </section>

            <Drawer
                title={selected?.documentNumber ?? "Chi tiết đợt phân bổ"}
                open={Boolean(selected)}
                onClose={() => setSelected(null)}
                width="min(760px, calc(100vw - 24px))"
                extra={selected ? <Space wrap>
                    {selected.status === "DRAFT" ? <Button icon={<Search size={15} />} onClick={() => openEdit(selected)}>Sửa nháp</Button> : null}
                    {selected.status === "PUBLISHED" ? <Popconfirm title="Kết thúc đợt này? Lịch sử công khai sẽ được giữ lại." okText="Kết thúc" cancelText="Hủy" onConfirm={() => void transition(selected, "CLOSED")}><Button danger icon={<X size={15} />} loading={saving}>Kết thúc</Button></Popconfirm> : null}
                    {selected.publishedAt ? <Button icon={<FilePlus2 size={15} />} onClick={() => openCorrection(selected)}>Tạo đợt điều chỉnh</Button> : null}
                    {selected.status === "DRAFT" ? <Popconfirm title="Công khai chỉ tiêu của công văn này?" okText="Công khai" cancelText="Hủy" onConfirm={() => void transition(selected, "PUBLISHED")}><Button type="primary" icon={<CircleCheck size={15} />} loading={saving}>Công khai</Button></Popconfirm> : null}
                </Space> : null}
            >
                {selected ? <div className="space-y-5">
                    <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} items={[
                        { key: "date", label: "Ngày ban hành", children: dateLabel(selected.documentDate) },
                        { key: "status", label: "Trạng thái", children: <Tag color={STATUS_COLORS[selected.status]}>{STATUS_LABELS[selected.status]}</Tag> },
                        { key: "source", label: "Nguồn kinh phí", children: selected.fundingSourceText },
                        { key: "item", label: "Hình thức hỗ trợ", children: `${selected.supportItemName} · ${currency(selected.unitAmount)}/${selected.unitLabel}` },
                        { key: "program", label: "Chương trình", children: programs.find((program) => program.id === selected.programId)?.title ?? "Không liên kết" },
                        { key: "quantity", label: "Tổng chỉ tiêu", children: `${selected.declaredTotalQuantity.toLocaleString("vi-VN")} ${selected.unitLabel}` },
                        { key: "amount", label: "Tổng kinh phí", children: currency(selected.declaredTotalAmount) },
                        { key: "submission", label: "Hạn nộp hồ sơ", children: dateLabel(selected.submissionDeadline) },
                        { key: "completion", label: "Hạn hoàn thành", children: dateLabel(selected.completionDeadline) },
                        { key: "eligibilityYear", label: "Năm phê duyệt danh sách", children: selected.eligibilityApprovalYear ?? "—" },
                        { key: "supersedes", label: "Điều chỉnh công văn", children: selected.supersedesBatchId ?? "Không" },
                        { key: "published", label: "Thời điểm công khai", children: selected.publishedAt ? dayjs(selected.publishedAt).format("DD/MM/YYYY HH:mm") : "Chưa công khai" }
                    ]} />
                    <div><Typography.Title level={5}>Điều kiện hưởng</Typography.Title><p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">{selected.eligibilitySummary}</p></div>
                    <div>
                        <div className="mb-2 flex items-center justify-between gap-2"><Typography.Title level={5} className="!mb-0">Chỉ tiêu theo xã/phường</Typography.Title><Typography.Text type="secondary">{selected.lines.length} địa bàn</Typography.Text></div>
                        <Table rowKey={(line) => `${line.provinceCode}:${line.wardCode}`} size="small" columns={detailLineColumns} dataSource={selected.lines} pagination={{ pageSize: 12, hideOnSinglePage: true }} scroll={{ x: 420 }} />
                    </div>
                    <Alert type="info" showIcon message="Bản xem trước công khai" description="Chỉ gồm công văn, điều kiện hưởng, hạn xử lý và chỉ tiêu theo địa bàn; không hiển thị hồ sơ hộ gia đình." />
                </div> : null}
            </Drawer>

            <DistributionBatchEditorDrawer
                open={editorOpen}
                batch={editing}
                supersedesBatchId={correctionOf}
                programs={programs}
                onClose={() => { setEditorOpen(false); setEditing(null); setCorrectionOf(null); }}
                onSave={saveDraft}
            />
        </section>
    );
}
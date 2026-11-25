"use client";

import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { SocialAssistancePage, SocialAssistanceToolbar } from "./SocialAssistanceLayout";
import type { SocialAssistanceProgram, SocialAssistanceRequest } from "@/types/social-assistance";
import { Alert, App, Button, Drawer, Empty, Form, Input, InputNumber, Select, Space, Steps, Table, Tabs, Tag, Tooltip, Typography } from "antd";
import type { TableColumnsType } from "antd";
import { Check, ChevronRight, HandCoins, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import DistributionBatchManagementPage from "./DistributionBatchManagementPage";

type AllocationStatus = "PLANNED" | "APPROVED" | "DELIVERED" | "RECONCILED";
type Allocation = {
    id: string;
    programId: string;
    requestId: string;
    plannedCashAmount: number | null;
    plannedItemDescription: string | null;
    deliveredCashAmount: number | null;
    deliveredItemDescription: string | null;
    status: AllocationStatus;
    deliveryDate: string | null;
    internalNote: string | null;
};
type AllocationResponse = { items: Allocation[] };
type CreateResponse = { item: Allocation; priorSupportCount: number };
type ItemResponse = { item: Allocation };
type FormValues = {
    programId: string;
    requestId: string;
    allocationType: "CASH" | "IN_KIND";
    plannedCashAmount?: number;
    plannedItemDescription?: string;
    internalNote?: string;
};

const STATUS_LABELS: Record<AllocationStatus, string> = {
    PLANNED: "Dự kiến",
    APPROVED: "Đã duyệt",
    DELIVERED: "Đã thực hiện",
    RECONCILED: "Đã đối soát"
};
const STATUS_COLORS: Record<AllocationStatus, string> = {
    PLANNED: "gold",
    APPROVED: "blue",
    DELIVERED: "green",
    RECONCILED: "cyan"
};
const currency = (amount: number | null) => amount == null ? "—" : `${amount.toLocaleString("vi-VN")} đ`;

export default function AllocationManagementPage() {
    const [form] = Form.useForm<FormValues>();
    const { message } = App.useApp();
    const [activeView, setActiveView] = useState<"requests" | "batches">("requests");
    const allocationType = Form.useWatch("allocationType", form);
    const [allocations, setAllocations] = useState<Allocation[]>([]);
    const [programs, setPrograms] = useState<SocialAssistanceProgram[]>([]);
    const [verifiedRequests, setVerifiedRequests] = useState<SocialAssistanceRequest[]>([]);
    const [selected, setSelected] = useState<Allocation | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [priorSupportCount, setPriorSupportCount] = useState<number | null>(null);
    const [deliveredCashAmount, setDeliveredCashAmount] = useState<number | null>(null);
    const [deliveredItemDescription, setDeliveredItemDescription] = useState("");
    const [internalNote, setInternalNote] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<AllocationStatus>();
    const [programFilter, setProgramFilter] = useState<string>();
    const visibleAllocations = allocations.filter((item) => (!statusFilter || item.status === statusFilter) && (!programFilter || item.programId === programFilter));

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [allocationResponse, programResponse, requestResponse] = await Promise.all([
                api.get<AllocationResponse>(endpoints.socialAssistance.allocations),
                api.get<{ items: SocialAssistanceProgram[] }>(`${endpoints.socialAssistance.programs}?status=PUBLISHED`),
                api.get<{ items: SocialAssistanceRequest[] }>(`${endpoints.socialAssistance.requests}?status=VERIFIED&limit=100`)
            ]);
            setAllocations(allocationResponse.items ?? []);
            setPrograms(programResponse.items ?? []);
            setVerifiedRequests(requestResponse.items ?? []);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "Không thể tải dữ liệu phân bổ.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void loadData(); }, []);

    const createAllocation = async () => {
        try {
            const values = await form.validateFields();
            setSaving(true);
            setPriorSupportCount(null);
            const response = await api.post<CreateResponse>(endpoints.socialAssistance.allocations, {
                programId: values.programId,
                requestId: values.requestId,
                plannedCashAmount: values.allocationType === "CASH" ? values.plannedCashAmount : undefined,
                plannedItemDescription: values.allocationType === "IN_KIND" ? values.plannedItemDescription : undefined,
                internalNote: values.internalNote
            });
            setPriorSupportCount(response.priorSupportCount);
            message.success("Đã tạo phân bổ ở trạng thái dự kiến.");
            form.resetFields();
            setCreateOpen(false);
            await loadData();
        } catch (createError) {
            if (createError instanceof Error && "errorFields" in createError) return;
            message.error(createError instanceof Error ? createError.message : "Không thể tạo phân bổ.");
        } finally {
            setSaving(false);
        }
    };

    const updateAllocation = async (status: AllocationStatus) => {
        if (!selected) return;
        setSaving(true);
        try {
            const response = await api.patch<ItemResponse>(endpoints.socialAssistance.allocationStatus(selected.id), {
                status,
                deliveredCashAmount: selected.plannedCashAmount != null ? deliveredCashAmount ?? undefined : undefined,
                deliveredItemDescription: selected.plannedItemDescription != null ? deliveredItemDescription.trim() || undefined : undefined,
                deliveryDate: status === "DELIVERED" ? new Date().toISOString().slice(0, 10) : undefined,
                internalNote: internalNote.trim() || undefined
            });
            setSelected(response.item);
            message.success("Đã cập nhật phân bổ.");
            await loadData();
        } catch (updateError) {
            message.error(updateError instanceof Error ? updateError.message : "Không thể cập nhật phân bổ.");
        } finally {
            setSaving(false);
        }
    };

    const columns: TableColumnsType<Allocation> = [
        {
            title: "Hồ sơ hỗ trợ", dataIndex: "requestId", key: "requestId", render: (value: string) => {
                const request = verifiedRequests.find((item) => item.id === value);
                return <div><span className="font-medium">{request?.contactName ?? "Hồ sơ hỗ trợ"}</span><span className="mt-1 block font-mono text-xs text-gray-500">{request?.receiptCode ?? value.slice(0, 8)}</span></div>;
            }
        },
        { title: "Chương trình", dataIndex: "programId", key: "programId", render: (value: string) => programs.find((program) => program.id === value)?.title ?? value.slice(0, 8) },
        { title: "Dự kiến", key: "planned", render: (_, row) => row.plannedCashAmount != null ? currency(row.plannedCashAmount) : row.plannedItemDescription },
        { title: "Trạng thái", dataIndex: "status", key: "status", render: (status: AllocationStatus) => <Tag color={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Tag> },
        {
            title: "Thao tác", key: "action", width: 90, render: (_, row) => <Tooltip title="Xem phân bổ"><Button aria-label="Xem phân bổ" icon={<ChevronRight size={15} />} onClick={() => {
                setSelected(row);
                setDeliveredCashAmount(row.deliveredCashAmount);
                setDeliveredItemDescription(row.deliveredItemDescription ?? "");
                setInternalNote(row.internalNote ?? "");
            }} /></Tooltip>
        }
    ];

    return (
        <SocialAssistancePage title="Phân bổ hỗ trợ" icon={HandCoins} actions={activeView === "requests" ? (
            <Button type="primary" icon={<Plus size={15} />} onClick={() => setCreateOpen(true)} disabled={!programs.length || !verifiedRequests.length}>
                Tạo phân bổ
            </Button>
        ) : null}>
            <Tabs
                activeKey={activeView}
                onChange={(key) => setActiveView(key as "requests" | "batches")}
                items={[
                    { key: "requests", label: "Theo hồ sơ" },
                    { key: "batches", label: "Theo công văn" }
                ]}
            />
            {activeView === "batches" ? <DistributionBatchManagementPage /> : (
                <>
                    {error ? <Alert type="error" showIcon message={error} /> : null}
                    {priorSupportCount != null && priorSupportCount > 0 ? (
                        <Alert type="warning" showIcon message={`Đã ghi nhận ${priorSupportCount} đợt hỗ trợ trước đó`} description="Đây là cảnh báo để cán bộ đối chiếu; hệ thống không tự động từ chối phân bổ." />
                    ) : null}
                    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                        <SocialAssistanceToolbar>
                            <Select aria-label="Trạng thái phân bổ" allowClear placeholder="Tất cả trạng thái" value={statusFilter} options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))} onChange={setStatusFilter} />
                            <Select aria-label="Chương trình phân bổ" allowClear placeholder="Tất cả chương trình" value={programFilter} options={[...new Set(allocations.map((item) => item.programId))].map((id) => ({ value: id, label: programs.find((program) => program.id === id)?.title ?? id.slice(0, 8) }))} onChange={setProgramFilter} />
                            <span className="self-center text-sm text-gray-500">{visibleAllocations.length} phân bổ</span>
                        </SocialAssistanceToolbar>
                        <Table rowKey="id" columns={columns} dataSource={visibleAllocations} loading={loading} pagination={{ pageSize: 25, hideOnSinglePage: true }} scroll={{ x: 800 }} locale={{ emptyText: <Empty description="Không có phân bổ phù hợp" /> }} />
                    </section>

                    <Drawer title="Tạo phân bổ" open={createOpen} onClose={() => setCreateOpen(false)} width="min(560px, calc(100vw - 24px))" footer={<Button type="primary" block loading={saving} onClick={() => void createAllocation()}>Lưu phân bổ</Button>}>
                        <Form form={form} layout="vertical" initialValues={{ allocationType: "CASH" }}>
                            <Form.Item label="Chương trình" name="programId" rules={[{ required: true }]}>
                                <Select options={programs.map((program) => ({ value: program.id, label: program.title }))} placeholder="Chọn chương trình đã công khai" />
                            </Form.Item>
                            <Form.Item label="Hồ sơ đã xác minh" name="requestId" rules={[{ required: true }]}>
                                <Select
                                    showSearch
                                    optionFilterProp="label"
                                    options={verifiedRequests.map((request) => ({ value: request.id, label: `${request.receiptCode} · ${request.wardCode} · ${request.contactName}` }))}
                                    placeholder="Chọn hồ sơ trong phạm vi địa bàn"
                                />
                            </Form.Item>
                            <Form.Item label="Hình thức" name="allocationType" rules={[{ required: true }]}>
                                <Select options={[{ value: "CASH", label: "Tiền mặt" }, { value: "IN_KIND", label: "Hiện vật" }]} />
                            </Form.Item>
                            {allocationType === "IN_KIND" ? (
                                <Form.Item label="Hiện vật dự kiến" name="plannedItemDescription" rules={[{ required: true, whitespace: true }]}>
                                    <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} maxLength={2000} />
                                </Form.Item>
                            ) : (
                                <Form.Item label="Số tiền dự kiến (đồng)" name="plannedCashAmount" rules={[{ required: true }, { type: "number", min: 1 }]}>
                                    <InputNumber className="w-full" min={1} step={1000} />
                                </Form.Item>
                            )}
                            <Form.Item label="Ghi chú nội bộ" name="internalNote"><Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} maxLength={2000} /></Form.Item>
                        </Form>
                    </Drawer>

                    <Drawer title="Chi tiết phân bổ" open={Boolean(selected)} onClose={() => setSelected(null)} width="min(560px, calc(100vw - 24px))">
                        {selected ? (
                            <div className="space-y-4">
                                <Steps size="small" current={Object.keys(STATUS_LABELS).indexOf(selected.status)} items={Object.values(STATUS_LABELS).map((title) => ({ title }))} />
                                <div className="flex items-center justify-between"><Typography.Text type="secondary">Yêu cầu {selected.requestId.slice(0, 8)}</Typography.Text><Tag color={STATUS_COLORS[selected.status]}>{STATUS_LABELS[selected.status]}</Tag></div>
                                <p className="text-sm">Dự kiến: {selected.plannedCashAmount != null ? currency(selected.plannedCashAmount) : selected.plannedItemDescription}</p>
                                {selected.status === "APPROVED" && selected.plannedCashAmount != null ? (
                                    <InputNumber className="w-full" min={1} max={selected.plannedCashAmount} value={deliveredCashAmount ?? undefined} onChange={(value) => setDeliveredCashAmount(value)} addonAfter="đ" placeholder="Số tiền thực nhận" />
                                ) : null}
                                {selected.status === "APPROVED" && selected.plannedItemDescription ? (
                                    <Input.TextArea value={deliveredItemDescription} onChange={(event) => setDeliveredItemDescription(event.target.value)} placeholder="Hiện vật đã trao" autoSize={{ minRows: 2, maxRows: 4 }} />
                                ) : null}
                                {selected.status !== "RECONCILED" ? <Input.TextArea value={internalNote} onChange={(event) => setInternalNote(event.target.value)} placeholder="Ghi chú nội bộ" autoSize={{ minRows: 2, maxRows: 4 }} /> : null}
                                <Space wrap>
                                    {selected.status === "PLANNED" ? <Button type="primary" loading={saving} onClick={() => void updateAllocation("APPROVED")}>Duyệt phân bổ</Button> : null}
                                    {selected.status === "APPROVED" ? <Button type="primary" loading={saving} onClick={() => void updateAllocation("DELIVERED")}>Xác nhận đã thực hiện</Button> : null}
                                    {selected.status === "DELIVERED" ? <Button type="primary" icon={<Check size={15} />} loading={saving} onClick={() => void updateAllocation("RECONCILED")}>Đối soát xong</Button> : null}
                                </Space>
                            </div>
                        ) : null}
                    </Drawer>
                </>
            )}
        </SocialAssistancePage>
    );
}
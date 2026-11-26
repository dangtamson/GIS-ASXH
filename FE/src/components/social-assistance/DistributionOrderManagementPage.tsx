"use client";

import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type {
    DistributionBeneficiary,
    DistributionBeneficiaryCreateInput,
    DistributionOrder,
    DistributionOrderCreateInput,
    DistributionOrderStatus
} from "@/types/social-assistance";
import { Alert, App, Button, Drawer, Empty, Form, Input, InputNumber, Select, Space, Table, Tag, Tooltip } from "antd";
import type { TableColumnsType } from "antd";
import { ChevronRight, Plus, Send, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { SocialAssistanceToolbar } from "./SocialAssistanceLayout";

const statusLabels: Record<DistributionOrderStatus, string> = {
    DRAFT: "Bản nháp",
    PUBLISHED: "Đã công khai",
    CLOSED: "Đã kết thúc"
};
const statusColors: Record<DistributionOrderStatus, string> = {
    DRAFT: "default",
    PUBLISHED: "green",
    CLOSED: "blue"
};

type OrderResponse = { items: DistributionOrder[] };
type ItemResponse = { item: DistributionOrder };

export default function DistributionOrderManagementPage() {
    const { message } = App.useApp();
    const [form] = Form.useForm<DistributionOrderCreateInput>();
    const [items, setItems] = useState<DistributionOrder[]>([]);
    const [selected, setSelected] = useState<DistributionOrder | null>(null);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editing, setEditing] = useState<DistributionOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get<OrderResponse>(endpoints.socialAssistance.distributionOrders);
            setItems(response.items ?? []);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "Không thể tải công văn phân bổ.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void load(); }, []);

    const openCreate = () => {
        setEditing(null);
        form.resetFields();
        form.setFieldsValue({
            documentDate: new Date().toISOString().slice(0, 10),
            components: [{
                name: "", unitLabel: "", unitAmount: 0, period: "ONCE", periodCount: 1,
                declaredTotalQuantity: 0, declaredTotalAmount: null, eligibilitySummary: "",
                allocations: [{ type: "LOCALITY", provinceCode: "92", wardCode: "", allocatedQuantity: 0 }]
            }]
        });
        setEditorOpen(true);
    };

    const openEdit = (order: DistributionOrder) => {
        setEditing(order);
        form.setFieldsValue({
            programId: order.programId,
            legacyBatchId: order.legacyBatchId,
            supersedesOrderId: order.supersedesOrderId,
            documentNumber: order.documentNumber,
            documentDate: order.documentDate,
            title: order.title,
            fundingSourceText: order.fundingSourceText,
            submissionDeadline: order.submissionDeadline,
            submissionDeadlineExclusive: order.submissionDeadlineExclusive,
            completionDeadline: order.completionDeadline,
            completionDeadlineExclusive: order.completionDeadlineExclusive,
            components: order.components.map((component) => ({
                name: component.name,
                unitLabel: component.unitLabel,
                unitAmount: component.unitAmount,
                period: component.period,
                periodCount: component.periodCount,
                periodStart: component.periodStart,
                periodEnd: component.periodEnd,
                declaredTotalQuantity: component.declaredTotalQuantity,
                declaredTotalAmount: component.declaredTotalAmount,
                eligibilitySummary: component.eligibilitySummary,
                allocations: component.targets.map((target) => target.type === "LOCALITY"
                    ? { type: "LOCALITY", provinceCode: target.provinceCode, wardCode: target.wardCode, allocatedQuantity: target.allocatedQuantity }
                    : { type: "ORGANIZATION", organizationId: target.organizationId, wardCode: target.organizationId, allocatedQuantity: target.allocatedQuantity })
            }))
        });
        setEditorOpen(true);
    };

    const save = async () => {
        try {
            const values = await form.validateFields();
            const payload: DistributionOrderCreateInput = {
                ...values,
                components: values.components.map((component) => ({
                    ...component,
                    allocations: component.allocations.map((target) => target.type === "ORGANIZATION"
                        ? {
                            type: "ORGANIZATION",
                            organizationId: String((target as { organizationId?: string; wardCode?: string }).organizationId
                                || (target as { wardCode?: string }).wardCode || ""),
                            allocatedQuantity: target.allocatedQuantity
                        }
                        : {
                            type: "LOCALITY",
                            provinceCode: target.provinceCode,
                            wardCode: target.wardCode,
                            allocatedQuantity: target.allocatedQuantity
                        })
                }))
            };
            setSaving(true);
            const response = editing
                ? await api.patch<ItemResponse>(endpoints.socialAssistance.distributionOrder(editing.id), payload)
                : await api.post<ItemResponse>(endpoints.socialAssistance.distributionOrders, payload);
            setItems((current) => editing
                ? current.map((item) => item.id === response.item.id ? response.item : item)
                : [response.item, ...current]);
            setEditorOpen(false);
            setEditing(null);
            message.success(editing ? "Đã cập nhật công văn." : "Đã tạo công văn ở trạng thái bản nháp.");
            await load();
        } catch (saveError) {
            if (saveError instanceof Error && "errorFields" in saveError) return;
            message.error(saveError instanceof Error ? saveError.message : "Không thể lưu công văn.");
        } finally {
            setSaving(false);
        }
    };

    const transition = async (order: DistributionOrder, action: "PUBLISHED" | "CLOSED") => {
        setSaving(true);
        try {
            const path = action === "PUBLISHED"
                ? endpoints.socialAssistance.distributionOrderPublish(order.id)
                : endpoints.socialAssistance.distributionOrderClose(order.id);
            const response = await api.post<ItemResponse>(path, {});
            setItems((current) => current.map((item) => item.id === response.item.id ? response.item : item));
            setSelected(response.item);
            message.success(action === "PUBLISHED" ? "Đã công khai công văn." : "Đã kết thúc công văn.");
        } catch (transitionError) {
            message.error(transitionError instanceof Error ? transitionError.message : "Không thể cập nhật trạng thái công văn.");
        } finally {
            setSaving(false);
        }
    };

    const columns: TableColumnsType<DistributionOrder> = [
        {
            title: "Công văn",
            key: "document",
            width: 260,
            render: (_, order) => <button type="button" className="text-left" onClick={() => setSelected(order)}><strong className="block text-sm text-gray-900">{order.documentNumber}</strong><span className="block text-xs text-gray-600">{order.title}</span></button>
        },
        { title: "Ngày ban hành", dataIndex: "documentDate", key: "documentDate", width: 130 },
        { title: "Thành phần", key: "components", width: 100, render: (_, order) => order.components.length },
        { title: "Trạng thái", dataIndex: "status", key: "status", width: 130, render: (status: DistributionOrderStatus) => <Tag color={statusColors[status]}>{statusLabels[status]}</Tag> },
        {
            title: "Thao tác", key: "actions", width: 180,
            render: (_, order) => <Space>
                {order.status === "DRAFT" ? <Tooltip title="Sửa bản nháp"><Button aria-label="Sửa" size="small" onClick={() => openEdit(order)} icon={<ChevronRight size={14} />} /></Tooltip> : null}
                {order.status === "DRAFT" ? <Tooltip title="Công khai"><Button aria-label="Công khai" size="small" type="primary" loading={saving} onClick={() => void transition(order, "PUBLISHED")} icon={<Send size={14} />} /></Tooltip> : null}
                {order.status === "PUBLISHED" ? <Tooltip title="Kết thúc"><Button aria-label="Kết thúc" size="small" loading={saving} onClick={() => void transition(order, "CLOSED")} icon={<Square size={14} />} /></Tooltip> : null}
            </Space>
        }
    ];

    return (
        <>
            {error ? <Alert type="error" showIcon message={error} /> : null}
            <SocialAssistanceToolbar>
                <Button type="primary" icon={<Plus size={15} />} onClick={openCreate}>Tạo công văn</Button>
                <span className="self-center text-sm text-gray-500">{items.length} công văn</span>
            </SocialAssistanceToolbar>
            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <Table rowKey="id" columns={columns} dataSource={items} loading={loading} pagination={{ pageSize: 25, hideOnSinglePage: true }} scroll={{ x: 900 }} locale={{ emptyText: <Empty description="Chưa có công văn phân bổ" /> }} />
            </section>

            <Drawer title={editing ? "Sửa công văn" : "Tạo công văn phân bổ"} open={editorOpen} onClose={() => setEditorOpen(false)} width="min(900px, calc(100vw - 24px))" footer={<Button type="primary" block loading={saving} onClick={() => void save()}>Lưu bản nháp</Button>}>
                <Form<DistributionOrderCreateInput> form={form} layout="vertical">
                    <div className="grid gap-3 md:grid-cols-2">
                        <Form.Item name="documentNumber" label="Số công văn" rules={[{ required: true }]}><Input /></Form.Item>
                        <Form.Item name="documentDate" label="Ngày ban hành" rules={[{ required: true }]}><Input type="date" /></Form.Item>
                    </div>
                    <Form.Item name="title" label="Tên công văn" rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item name="fundingSourceText" label="Nguồn kinh phí" rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item>
                    <div className="grid gap-3 md:grid-cols-2">
                        <Form.Item name="submissionDeadline" label="Hạn tiếp nhận"><Input type="date" /></Form.Item>
                        <Form.Item name="completionDeadline" label="Hạn hoàn thành"><Input type="date" /></Form.Item>
                    </div>

                    <Form.List name="components">
                        {(componentFields, componentActions) => <div className="space-y-3">
                            {componentFields.map((componentField) => <section key={componentField.key} className="rounded-lg border border-slate-200 p-3">
                                <div className="mb-3 flex items-center justify-between"><strong>Thành phần hỗ trợ</strong><Button danger size="small" onClick={() => componentActions.remove(componentField.name)}>Xóa</Button></div>
                                <div className="grid gap-3 md:grid-cols-2">
                                    <Form.Item name={[componentField.name, "name"]} label="Tên hỗ trợ" rules={[{ required: true }]}><Input /></Form.Item>
                                    <Form.Item name={[componentField.name, "unitLabel"]} label="Đơn vị" rules={[{ required: true }]}><Input placeholder="triệu đồng, căn, xe đạp" /></Form.Item>
                                    <Form.Item name={[componentField.name, "unitAmount"]} label="Giá trị mỗi đơn vị" rules={[{ required: true }]}><InputNumber className="w-full" min={1} /></Form.Item>
                                    <Form.Item name={[componentField.name, "period"]} label="Chu kỳ" rules={[{ required: true }]}><Select options={[{ value: "ONCE", label: "Một lần" }, { value: "MONTHLY", label: "Hàng tháng" }]} /></Form.Item>
                                    <Form.Item name={[componentField.name, "periodCount"]} label="Số kỳ" rules={[{ required: true }]}><InputNumber className="w-full" min={1} max={120} /></Form.Item>
                                    <Form.Item name={[componentField.name, "declaredTotalQuantity"]} label="Tổng số lượng" rules={[{ required: true }]}><InputNumber className="w-full" min={1} /></Form.Item>
                                    <Form.Item name={[componentField.name, "declaredTotalAmount"]} label="Tổng tiền đã công bố"><InputNumber className="w-full" min={1} /></Form.Item>
                                </div>
                                <Form.Item name={[componentField.name, "eligibilitySummary"]} label="Điều kiện ưu tiên" rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item>
                                <Form.List name={[componentField.name, "allocations"]}>
                                    {(targetFields, targetActions) => <div className="space-y-2">
                                        {targetFields.map((targetField) => <div key={targetField.key} className="grid gap-2 md:grid-cols-[140px_1fr_1fr_140px_70px]">
                                            <Form.Item name={[targetField.name, "type"]} noStyle><Select options={[{ value: "LOCALITY", label: "Địa bàn" }, { value: "ORGANIZATION", label: "Tổ chức" }]} /></Form.Item>
                                            <Form.Item name={[targetField.name, "provinceCode"]} noStyle><Input placeholder="Mã tỉnh" /></Form.Item>
                                            <Form.Item name={[targetField.name, "wardCode"]} noStyle><Input placeholder="Mã phường/xã hoặc mã tổ chức" /></Form.Item>
                                            <Form.Item name={[targetField.name, "allocatedQuantity"]} noStyle><InputNumber className="w-full" min={1} placeholder="Số lượng" /></Form.Item>
                                            <Button danger onClick={() => targetActions.remove(targetField.name)}>Xóa</Button>
                                        </div>)}
                                        <Button size="small" onClick={() => targetActions.add({ type: "LOCALITY", provinceCode: "92", wardCode: "", allocatedQuantity: 1 })}>Thêm mục tiêu</Button>
                                    </div>}
                                </Form.List>
                            </section>)}
                            <Button onClick={() => componentActions.add({ name: "", unitLabel: "", unitAmount: 1, period: "ONCE", periodCount: 1, declaredTotalQuantity: 1, declaredTotalAmount: null, eligibilitySummary: "", allocations: [{ type: "LOCALITY", provinceCode: "92", wardCode: "", allocatedQuantity: 1 }] })}>Thêm thành phần hỗ trợ</Button>
                        </div>}
                    </Form.List>
                </Form>
            </Drawer>

            <Drawer title={selected ? `${selected.documentNumber} - ${selected.title}` : "Chi tiết công văn"} open={Boolean(selected)} onClose={() => setSelected(null)} width="min(760px, calc(100vw - 24px))">
                {selected ? <>
                    <Tag color={statusColors[selected.status]}>{statusLabels[selected.status]}</Tag>
                    {selected.components.map((component) => <section key={component.id} className="mt-3 rounded-lg border border-slate-200 p-3">
                        <strong>{component.name}</strong>
                        <p className="mt-1 text-sm text-gray-600">{component.declaredTotalQuantity} {component.unitLabel} x {component.periodCount} kỳ x {component.unitAmount.toLocaleString("vi-VN")} đ</p>
                        <div className="mt-2 space-y-1">
                            {component.targets.map((target) => <div key={target.id} className="flex items-center justify-between text-sm">
                                <span>{target.type === "LOCALITY" ? `${target.wardCode}, ${target.provinceCode}` : target.organizationId}</span>
                                <span className="font-medium">{target.allocatedQuantity} {component.unitLabel}</span>
                            </div>)}
                        </div>
                    </section>)}
                </> : null}
            </Drawer>
        </>
    );
}

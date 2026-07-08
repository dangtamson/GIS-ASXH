"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { App, Button, Form, Input, InputNumber, Modal, Popconfirm, Space, Switch, Table } from "antd";
import type { TableColumnsType } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { PovertyArea } from "@/types/poverty";
import { ActionButton, TitleSpace } from "@/components/controller";
import ActionIcon from "@/components/controller/ActionIcon";
import { usePermission } from "@/hooks/usePermission";

type Props = {
    wardCode: string;
};

type AreaFormValues = {
    code?: string;
    name: string;
    secretaryName?: string;
    secretaryPhone?: string;
    hamletHeadName?: string;
    hamletHeadPhone?: string;
    securityTeamLeaderName?: string;
    securityTeamLeaderPhone?: string;
    naturalArea?: number;
    description?: string;
    note?: string;
    status?: boolean;
};

export default function PovertyAreaManagementPage({ wardCode }: Props) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { notification } = App.useApp();
    const [form] = Form.useForm<AreaFormValues>();
    const [items, setItems] = useState<PovertyArea[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<PovertyArea | null>(null);
    const { can: canCreate } = usePermission("poverty.ward_area.create");
    const { can: canUpdate } = usePermission("poverty.ward_area.update");
    const { can: canDelete } = usePermission("poverty.ward_area.delete");
    const provinceCode = searchParams.get("provinceCode") || "92";
    const wardName = searchParams.get("wardName") || wardCode;

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.get<{ items?: PovertyArea[] }>(endpoints.poverty.wardAreas(wardCode));
            setItems(data.items ?? []);
        } catch (error) {
            notification.error({
                message: "Không thể tải danh sách khu vực/ấp",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
        } finally {
            setLoading(false);
        }
    }, [notification, wardCode]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const resetForm = useCallback(() => {
        setEditing(null);
        form.resetFields();
        form.setFieldsValue({ status: true });
    }, [form]);

    const openCreate = useCallback(() => {
        resetForm();
        setModalOpen(true);
    }, [resetForm]);

    const openEdit = useCallback((record: PovertyArea) => {
        setEditing(record);
        form.setFieldsValue({
            code: record.code ?? undefined,
            name: record.name,
            secretaryName: record.secretaryName ?? undefined,
            secretaryPhone: record.secretaryPhone ?? undefined,
            hamletHeadName: record.hamletHeadName ?? undefined,
            hamletHeadPhone: record.hamletHeadPhone ?? undefined,
            securityTeamLeaderName: record.securityTeamLeaderName ?? undefined,
            securityTeamLeaderPhone: record.securityTeamLeaderPhone ?? undefined,
            naturalArea: record.naturalArea ?? undefined,
            description: record.description ?? undefined,
            note: record.note ?? undefined,
            status: record.status ?? true,
        });
        setModalOpen(true);
    }, [form]);

    const saveArea = async () => {
        try {
            const values = await form.validateFields();
            setSaving(true);
            const payload = { ...values, provinceCode, wardCode };
            if (editing) {
                await api.patch(endpoints.poverty.wardArea(wardCode, editing.id), payload);
            } else {
                await api.post(endpoints.poverty.wardAreas(wardCode), payload);
            }
            notification.success({ message: editing ? "Đã cập nhật khu vực/ấp" : "Đã thêm khu vực/ấp" });
            setModalOpen(false);
            await loadData();
        } catch (error) {
            if (typeof error === "object" && error !== null && "errorFields" in error) return;
            notification.error({
                message: "Không thể lưu khu vực/ấp",
                description: error instanceof ApiError ? error.message : "Vui lòng kiểm tra dữ liệu",
            });
        } finally {
            setSaving(false);
        }
    };

    const deleteArea = useCallback(async (record: PovertyArea) => {
        try {
            await api.delete(endpoints.poverty.wardArea(wardCode, record.id));
            notification.success({ message: "Đã xóa khu vực/ấp" });
            await loadData();
        } catch (error) {
            notification.error({
                message: "Không thể xóa khu vực/ấp",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
        }
    }, [loadData, notification, wardCode]);

    const columns: TableColumnsType<PovertyArea> = useMemo(() => [
        { title: "Mã", dataIndex: "code", width: 100, render: (value?: string | null) => value || "-" },
        { title: "Tên khu vực/ấp", dataIndex: "name", width: 180 },
        { title: "Bí thư", dataIndex: "secretaryName", render: (value?: string | null) => value || "-" },
        { title: "SĐT Bí thư", dataIndex: "secretaryPhone", render: (value?: string | null) => value || "-" },
        { title: "Trưởng ấp/khu vực", dataIndex: "hamletHeadName", render: (value?: string | null) => value || "-" },
        { title: "SĐT Trưởng ấp/khu vực", dataIndex: "hamletHeadPhone", render: (value?: string | null) => value || "-" },
        { title: "Tổ trưởng TANTTCS", dataIndex: "securityTeamLeaderName", render: (value?: string | null) => value || "-" },
        { title: "SĐT Tổ trưởng TANTTCS", dataIndex: "securityTeamLeaderPhone", render: (value?: string | null) => value || "-" },
        { title: "Diện tích tự nhiên", dataIndex: "naturalArea", align: "right", render: (value?: number | null) => value ?? "-" },
        { title: "Mô tả", dataIndex: "description", render: (value?: string | null) => value || "-" },
        { title: "Ghi chú", dataIndex: "note", render: (value?: string | null) => value || "-" },
        { title: "Trạng thái", dataIndex: "status", width: 100, align: "center", render: (value?: boolean) => value ? "Hoạt động" : "Ngưng" },
        {
            title: "Thao tác",
            width: 120,
            align: "center",
            render: (_value, record) => (
                <Space size={4}>
                    <Button type="text" icon={<ActionIcon action="edit" />} disabled={!canUpdate} onClick={() => openEdit(record)} />
                    <Popconfirm
                        title="Xóa khu vực/ấp"
                        description={`Bạn có chắc muốn xóa ${record.name}?`}
                        okText="Xóa"
                        cancelText="Hủy"
                        onConfirm={() => void deleteArea(record)}
                        disabled={!canDelete}
                    >
                        <Button type="text" icon={<ActionIcon action="delete" />} disabled={!canDelete} />
                    </Popconfirm>
                </Space>
            ),
        },
    ], [canDelete, canUpdate, deleteArea, openEdit]);

    return (
        <div className="space-y-4">
            <TitleSpace title={`Khu vực/ấp - ${wardName}`} />
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
                <div className="text-sm text-gray-500">Quản lý danh sách khu vực/ấp của xã/phường đã chọn.</div>
                <Space>
                    <Button onClick={() => router.push("/quan-tri/thong-tin-chung")} style={{ height: 40, borderRadius: 10 }}>Quay lại</Button>
                    <ActionButton type="create" onClick={openCreate} disabled={!canCreate} />
                </Space>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
                <Table rowKey="id" loading={loading} columns={columns} dataSource={items} pagination={{ pageSize: 10 }} scroll={{ x: 1800 }} />
            </div>

            <Modal
                title={editing ? "Cập nhật khu vực/ấp" : "Thêm khu vực/ấp"}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                footer={null}
                width={900}
            >
                <Form form={form} layout="vertical" initialValues={{ status: true }}>
                    <div className="grid gap-4 md:grid-cols-2">
                        <Form.Item name="code" label="Mã"><Input /></Form.Item>
                        <Form.Item name="name" label="Tên khu vực/ấp" rules={[{ required: true, message: "Vui lòng nhập tên khu vực/ấp" }]}><Input /></Form.Item>
                        <Form.Item name="secretaryName" label="Bí thư"><Input /></Form.Item>
                        <Form.Item name="secretaryPhone" label="SĐT Bí thư"><Input /></Form.Item>
                        <Form.Item name="hamletHeadName" label="Trưởng ấp/khu vực"><Input /></Form.Item>
                        <Form.Item name="hamletHeadPhone" label="SĐT Trưởng ấp/khu vực"><Input /></Form.Item>
                        <Form.Item name="securityTeamLeaderName" label="Tổ trưởng TANTTCS"><Input /></Form.Item>
                        <Form.Item name="securityTeamLeaderPhone" label="SĐT Tổ trưởng TANTTCS"><Input /></Form.Item>
                        <Form.Item name="naturalArea" label="Diện tích tự nhiên"><InputNumber className="w-full" min={0} /></Form.Item>
                        <Form.Item name="status" label="Trạng thái" valuePropName="checked"><Switch /></Form.Item>
                    </div>
                    <Form.Item name="description" label="Mô tả"><Input.TextArea rows={3} /></Form.Item>
                    <Form.Item name="note" label="Ghi chú"><Input.TextArea rows={3} /></Form.Item>
                    <div className="flex justify-end gap-2 mt-2">
                        <Button onClick={resetForm}>Làm lại</Button>
                        <Button type="primary" loading={saving} onClick={() => void saveArea()}>
                            {editing ? "Cập nhật" : "Lưu mới"}
                        </Button>
                    </div>
                </Form>
            </Modal>
        </div>
    );
}

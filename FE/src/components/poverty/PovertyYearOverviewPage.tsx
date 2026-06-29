"use client";

import { api, ApiError } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { PovertyYearOverview } from "@/types/poverty";
import { formatNumber } from "@/components/poverty/poverty-utils";
import { ActionButton, TitleSpace } from "@/components/controller";
import ActionIcon from "@/components/controller/ActionIcon";
import { usePermission } from "@/hooks/usePermission";
import { App, Button, Col, Form, Input, InputNumber, Popconfirm, Row, Space, Table, Tooltip } from "antd";
import type { TableColumnsType } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";

type YearOverviewFormValues = {
    year: number;
    population: number;
    totalHouseholds: number;
    totalMembers: number;
    note?: string;
};

const currentYear = new Date().getFullYear();

export default function PovertyYearOverviewPage() {
    const { notification } = App.useApp();
    const [form] = Form.useForm<YearOverviewFormValues>();
    const [items, setItems] = useState<PovertyYearOverview[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const { can: canUpdateOverview } = usePermission("poverty.household.update");
    const { can: canDeleteOverview } = usePermission("poverty.household.delete");

    const selectedItem = useMemo(
        () => items.find((item) => item.id === selectedId) ?? null,
        [items, selectedId]
    );

    const loadYearOverviews = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.get<{ items?: PovertyYearOverview[] }>(endpoints.poverty.yearOverviews);
            setItems(data.items ?? []);
        } catch (error) {
            notification.error({
                message: "Không thể tải thông tin chung theo năm",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
        } finally {
            setLoading(false);
        }
    }, [notification]);

    useEffect(() => {
        loadYearOverviews();
    }, [loadYearOverviews]);

    useEffect(() => {
        if (!selectedItem) return;
        form.setFieldsValue({
            year: selectedItem.year,
            population: selectedItem.population,
            totalHouseholds: selectedItem.totalHouseholds,
            totalMembers: selectedItem.totalMembers,
            note: selectedItem.note ?? "",
        });
    }, [form, selectedItem]);

    const resetFormForCreate = () => {
        setSelectedId(null);
        form.setFieldsValue({
            year: currentYear,
            population: 0,
            totalHouseholds: 0,
            totalMembers: 0,
            note: "",
        });
    };

    const saveOverview = async () => {
        if (!canUpdateOverview) return;

        try {
            const values = await form.validateFields();
            setSaving(true);
            const response = await api.put<{ item?: PovertyYearOverview }>(endpoints.poverty.yearOverviews, values);
            notification.success({ message: "Đã lưu thông tin chung theo năm" });
            await loadYearOverviews();
            if (response.item?.id) {
                setSelectedId(response.item.id);
            }
        } catch (error) {
            if (typeof error === "object" && error !== null && "errorFields" in error) {
                return;
            }
            notification.error({
                message: "Không thể lưu thông tin năm",
                description: error instanceof ApiError ? error.message : "Vui lòng kiểm tra dữ liệu",
            });
        } finally {
            setSaving(false);
        }
    };

    const deleteOverview = async (id: string) => {
        if (!canDeleteOverview) return;
        try {
            setDeletingId(id);
            await api.delete(endpoints.poverty.yearOverview(id));
            notification.success({ message: "Đã xóa thông tin chung theo năm" });
            await loadYearOverviews();
            if (selectedId === id) {
                resetFormForCreate();
            }
        } catch (error) {
            notification.error({
                message: "Không thể xóa thông tin năm",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
        } finally {
            setDeletingId(null);
        }
    };

    const columns: TableColumnsType<PovertyYearOverview> = [
        {
            title: "STT",
            width: 80,
            align: "center",
            render: (_value, _record, index) => index + 1,
        },
        { title: "Năm", dataIndex: "year", width: 120, align: "center" },
        { title: "Dân số", dataIndex: "population", align: "right", render: formatNumber },
        { title: "Số hộ", dataIndex: "totalHouseholds", align: "right", render: formatNumber },
        { title: "Số nhân khẩu", dataIndex: "totalMembers", align: "right", render: formatNumber },
        { title: "Ghi chú", dataIndex: "note", render: (value?: string | null) => value || "-" },
        {
            title: "Thao tác",
            width: 120,
            align: "center",
            render: (_value, record) => (
                <Space size={4} wrap={false}>
                    <Tooltip title="Sửa">
                        <Button
                            type="text"
                            icon={<ActionIcon action="edit" />}
                            disabled={!canUpdateOverview}
                            onClick={() => {
                                setSelectedId(record.id);
                                form.setFieldsValue({
                                    year: record.year,
                                    population: record.population,
                                    totalHouseholds: record.totalHouseholds,
                                    totalMembers: record.totalMembers,
                                    note: record.note ?? "",
                                });
                            }}
                        />
                    </Tooltip>

                    <Popconfirm
                        title="Xóa thông tin năm"
                        description={`Bạn có chắc muốn xóa dữ liệu năm ${record.year}?`}
                        okText="Xóa"
                        cancelText="Hủy"
                        onConfirm={() => deleteOverview(record.id)}
                        disabled={!canDeleteOverview}
                    >
                        <Button
                            type="text"
                            icon={<ActionIcon action="delete" />}
                            loading={deletingId === record.id}
                            disabled={!canDeleteOverview}
                        />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div className="min-w-0 space-y-4">
            <TitleSpace title="Thông tin chung hộ nghèo" />

            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-800">Cấu hình dữ liệu theo năm</h3>
                        <p className="mt-0.5 text-xs text-gray-500">
                            Dùng cho dashboard tổng số hộ/số khẩu và mẫu số tính tỷ lệ hộ nghèo, cận nghèo ở báo cáo.
                        </p>
                    </div>
                    <ActionButton type="create" onClick={resetFormForCreate} />
                </div>

                <Form
                    form={form}
                    layout="vertical"
                    initialValues={{ year: currentYear, population: 0, totalHouseholds: 0, totalMembers: 0, note: "" }}
                >
                    <Row gutter={[16, 0]}>
                        <Col xs={12} md={2}><Form.Item name="year" label="Năm" rules={[{ required: true }]}><InputNumber className="w-full" min={1900} max={2200} style={{ width: "100%" }} /></Form.Item></Col>
                        <Col xs={12} md={2}><Form.Item name="population" label="Dân số" rules={[{ required: true }]}><InputNumber className="w-full" min={0} style={{ width: "100%" }} /></Form.Item></Col>
                        <Col xs={12} md={2}><Form.Item name="totalHouseholds" label="Số hộ" rules={[{ required: true }]}><InputNumber className="w-full" min={0} style={{ width: "100%" }} /></Form.Item></Col>
                        <Col xs={12} md={2}><Form.Item name="totalMembers" label="Số nhân khẩu" rules={[{ required: true }]}><InputNumber className="w-full" min={0} style={{ width: "100%" }} /></Form.Item></Col>
                        <Col xs={24} md={4}><Form.Item name="note" label="Ghi chú"><Input style={{ width: "100%" }} /></Form.Item></Col>
                    </Row>
                    <div className="mt-2 flex flex-wrap justify-end gap-2">
                        <ActionButton type="refresh" variant="outlined" label="Làm lại" onClick={resetFormForCreate} />
                        <Button type="primary" loading={saving} disabled={!canUpdateOverview} onClick={saveOverview} style={{ height: 40 }}>
                            {selectedId ? "Cập nhật" : "Lưu mới"}
                        </Button>
                    </div>
                </Form>
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white p-4">
                <Table
                    rowKey="id"
                    loading={loading}
                    columns={columns}
                    dataSource={items}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 1000 }}
                />
            </div>
        </div>
    );
}

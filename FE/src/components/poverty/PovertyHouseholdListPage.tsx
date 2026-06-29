"use client";

import { api, ApiError } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { ExcelPayload, PaginatedResponse, PoorHousehold } from "@/types/poverty";
import {
    downloadBase64File,
    getValidGeoPosition,
    householdStatusColor,
    householdStatusLabel,
    householdStatusOptions,
    povertyTypeColor,
    povertyTypeLabel,
    povertyTypeOptions,
} from "@/components/poverty/poverty-utils";
import { ActionButton, AppPagination, TitleSpace } from "@/components/controller";
import ActionIcon from "@/components/controller/ActionIcon";
import SharedSpreadsheetImport from "@/components/imports/SharedSpreadsheetImport";
import PovertyAssessmentTimelineModal from "@/components/poverty/PovertyAssessmentTimelineModal";
import PovertySupportTimelineModal from "@/components/poverty/PovertySupportTimelineModal";
import { usePovertyCategoryOptions } from "@/components/poverty/usePovertyCategoryOptions";
import { usePermission } from "@/hooks/usePermission";
import { App, Button, Col, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Table, Tag, Tooltip } from "antd";
import type { TableColumnsType } from "antd";
import { ChevronDown, ChevronUp, LocateFixed, MapPinned, SlidersHorizontal } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type HouseholdForm = {
    code?: string;
    year?: number;
    povertyType?: string;
    status?: string;
    provinceName?: string;
    wardName?: string;
    areaName?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
};

const currentYear = new Date().getFullYear();

const PovertyCoordinatePicker = dynamic(() => import("@/components/poverty/PovertyCoordinatePicker"), {
    ssr: false,
    loading: () => (
        <div className="flex h-[260px] items-center justify-center rounded-lg border border-gray-200 bg-white text-sm text-gray-500">
            Đang tải bản đồ chọn tọa độ...
        </div>
    ),
});

function buildQuery(values: Record<string, unknown>, page: number, limit: number): string {
    const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sortBy: "updatedAt",
        sortOrder: "desc",
    });
    Object.entries(values).forEach(([key, value]) => {
        const text = String(value ?? "").trim();
        if (text) params.set(key, text);
    });
    return params.toString();
}

export default function PovertyHouseholdListPage() {
    const router = useRouter();
    const { notification } = App.useApp();
    const [filterForm] = Form.useForm();
    const [form] = Form.useForm<HouseholdForm>();
    const [items, setItems] = useState<PoorHousehold[]>([]);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<PoorHousehold | null>(null);
    const [timelineHousehold, setTimelineHousehold] = useState<PoorHousehold | null>(null);
    const [supportTimelineHousehold, setSupportTimelineHousehold] = useState<PoorHousehold | null>(null);
    const [filters, setFilters] = useState<Record<string, unknown>>({ year: currentYear });
    const [filtersCollapsed, setFiltersCollapsed] = useState(false);
    const [coordinatePickerOpen, setCoordinatePickerOpen] = useState(false);
    const areaOptions = usePovertyCategoryOptions("AREA");
    const { can: canCreateHousehold } = usePermission("poverty.household.create");
    const { can: canUpdateHousehold } = usePermission("poverty.household.update");
    const { can: canDeleteHousehold } = usePermission("poverty.household.delete");
    const { can: canImportHousehold } = usePermission("poverty.household.import");
    const { can: canExportHousehold } = usePermission("poverty.household.export");
    const { can: canViewHouseholdDetail } = usePermission("poverty.household.detail.view");
    const { can: canViewMap } = usePermission("poverty.map.read");
    const latitudeValue = Form.useWatch("latitude", form);
    const longitudeValue = Form.useWatch("longitude", form);

    const activeFilterCount = useMemo(
        () => Object.values(filters).filter((value) => String(value ?? "").trim()).length,
        [filters]
    );

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const query = buildQuery(filters, page, limit);
            const data = await api.get<PaginatedResponse<PoorHousehold>>(`${endpoints.poverty.households}?${query}`);
            setItems(data.items ?? []);
            setTotal(data.pagination?.total ?? 0);
        } catch (error) {
            notification.error({
                message: "Không thể tải danh sách hộ",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
        } finally {
            setLoading(false);
        }
    }, [filters, limit, notification, page]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const openCreate = useCallback(() => {
        setEditing(null);
        form.resetFields();
        form.setFieldsValue({
            year: currentYear,
            povertyType: "POOR",
            status: "ACTIVE",
        });
        setCoordinatePickerOpen(false);
        setModalOpen(true);
    }, [form]);

    const openEdit = useCallback((record: PoorHousehold) => {
        setEditing(record);
        form.setFieldsValue({
            code: record.code ?? undefined,
            year: record.year,
            povertyType: String(record.povertyType ?? "POOR"),
            status: String(record.status ?? "ACTIVE"),
            provinceName: record.provinceName ?? undefined,
            wardName: record.wardName ?? undefined,
            areaName: record.areaName ?? undefined,
            address: record.address ?? undefined,
            latitude: record.latitude ?? undefined,
            longitude: record.longitude ?? undefined,
        });
        setCoordinatePickerOpen(false);
        setModalOpen(true);
    }, [form]);

    const updateFormCoordinates = useCallback((latitude: number, longitude: number) => {
        form.setFieldsValue({ latitude, longitude });
    }, [form]);

    const saveHousehold = async () => {
        const values = await form.validateFields();
        setSaving(true);
        try {
            if (editing) {
                await api.patch(endpoints.poverty.household(editing.id), values);
            } else {
                await api.post(endpoints.poverty.households, values);
            }
            notification.success({ message: editing ? "Đã cập nhật hộ" : "Đã thêm hộ" });
            setModalOpen(false);
            await loadData();
        } catch (error) {
            notification.error({
                message: "Không thể lưu hộ",
                description: error instanceof ApiError ? error.message : "Vui lòng kiểm tra dữ liệu",
            });
        } finally {
            setSaving(false);
        }
    };

    const deactivate = useCallback(async (record: PoorHousehold) => {
        try {
            await api.delete(endpoints.poverty.household(record.id));
            notification.success({ message: "Đã ngưng hoạt động hộ" });
            await loadData();
        } catch (error) {
            notification.error({
                message: "Không thể ngưng hộ",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
        }
    }, [loadData, notification]);

    const openOnMap = useCallback((record: PoorHousehold) => {
        if (!getValidGeoPosition(record.latitude, record.longitude)) {
            notification.warning({ message: "Hộ này chưa cập nhật tọa độ" });
            return;
        }
        router.push(`/ho-ngheo/ban-do?householdId=${record.id}`);
    }, [notification, router]);

    const exportExcel = async () => {
        try {
            const query = buildQuery(filters, 1, limit);
            const data = await api.get<ExcelPayload>(`${endpoints.poverty.exportExcel}?${query}`);
            downloadBase64File(data.fileName, data.mimeType, data.fileContentBase64);
        } catch (error) {
            notification.error({
                message: "Không thể xuất Excel",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
        }
    };

    const columns: TableColumnsType<PoorHousehold> = useMemo(() => [
        {
            title: "STT",
            width: 80,
            align: "center",
            fixed: "left",
            render: (_value, _record, index) => ((page - 1) * limit) + index + 1,
        },
        { title: "Mã hộ", dataIndex: "code", width: 130, render: (value) => value || "-" },
        { title: "Năm", dataIndex: "year", width: 90 },
        {
            title: "Loại hộ",
            dataIndex: "povertyType",
            width: 140,
            render: (value) => <Tag color={povertyTypeColor(value)}>{povertyTypeLabel(value)}</Tag>,
        },

        { title: "Chủ hộ", dataIndex: "headFullName", width: 200, ellipsis: true, render: (value) => value || "-" },
        { title: "CCCD chủ hộ", dataIndex: "headCitizenId", width: 150, render: (value) => value || "-" },
        { title: "Nhân khẩu", dataIndex: "memberCount", width: 110, align: "right", render: (value) => Number(value ?? 0).toLocaleString("vi-VN") },
        {
            title: "Địa bàn",
            width: 260,
            ellipsis: true,
            render: (_, row) => [row.provinceName, row.wardName, row.areaName].filter(Boolean).join(" / ") || "-",
        },
        { title: "Địa chỉ", dataIndex: "address", width: 280, ellipsis: true, render: (value) => value || "-" },
        {
            title: "Tọa độ",
            width: 150,
            render: (_, row) => {
                const position = getValidGeoPosition(row.latitude, row.longitude);
                return position ? `${position.latitude}, ${position.longitude}` : "-";
            },
        },
        {
            title: "Trạng thái",
            dataIndex: "status",
            width: 120,
            render: (value) => <Tag color={householdStatusColor(value)}>{householdStatusLabel(value)}</Tag>,
        },
        {
            title: "Thao tác",
            width: 256,
            fixed: "right",
            render: (_, record) => (
                <Space size={4} wrap={false}>
                    <Button type="text" icon={<ActionIcon action="view" />} onClick={() => router.push(`/ho-ngheo/${record.id}`)} />
                    {canViewHouseholdDetail ? <Tooltip title="Xem timeline đánh giá">
                        <Button
                            type="text"
                            aria-label="Xem timeline đánh giá"
                            icon={<ActionIcon action="timeline" />}
                            onClick={() => setTimelineHousehold(record)}
                        />
                    </Tooltip> : null}
                    {canViewHouseholdDetail ? <Tooltip title="Xem timeline hỗ trợ">
                        <Button
                            type="text"
                            aria-label="Xem timeline hỗ trợ"
                            icon={<ActionIcon action="supportTimeline" />}
                            onClick={() => setSupportTimelineHousehold(record)}
                        />
                    </Tooltip> : null}
                    {canViewMap ? <Tooltip title="Xem trên bản đồ">
                        <Button
                            type="text"
                            aria-label="Xem trên bản đồ"
                            icon={<span aria-hidden="true" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-emerald-50 text-emerald-600"><MapPinned size={18} strokeWidth={2.2} /></span>}
                            onClick={() => openOnMap(record)}
                        />
                    </Tooltip> : null}
                    {canUpdateHousehold ? <Button type="text" icon={<ActionIcon action="edit" />} onClick={() => openEdit(record)} /> : null}
                    {canDeleteHousehold ? <Popconfirm title="Ngưng hoạt động hộ này?" okText="Ngưng" cancelText="Hủy" onConfirm={() => deactivate(record)}>
                        <Button type="text" icon={<ActionIcon action="delete" />} />
                    </Popconfirm> : null}
                </Space>
            ),
        },
    ], [canDeleteHousehold, canUpdateHousehold, canViewHouseholdDetail, canViewMap, deactivate, limit, openEdit, openOnMap, page, router]);

    return (
        <div className="min-w-0 space-y-4 overflow-hidden">
            <TitleSpace
                title="Quản lý hộ nghèo/cận nghèo"
                actions={
                    <div
                        className="grid grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end [&_.ant-btn]:w-full sm:[&_.ant-btn]:w-auto"
                        style={{ width: "min(100vw - 32px, 520px)" }}
                    >
                        {canImportHousehold ? <div className="min-w-0">
                            <SharedSpreadsheetImport moduleKey="poverty-households" onCommitted={loadData} />
                        </div> : null}
                        {canExportHousehold ? <ActionButton type="export-excel" onClick={exportExcel} /> : null}
                        {canCreateHousehold ? <ActionButton className="col-span-2 sm:col-span-1" type="create" onClick={openCreate} /> : null}
                    </div>
                }
            />

            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-700">
                            <SlidersHorizontal size={16} />
                        </span>
                        <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-gray-800">Bộ lọc tìm kiếm</h3>
                            <p className="mt-0.5 text-xs text-gray-500">
                                {activeFilterCount > 0 ? `${activeFilterCount} điều kiện đang áp dụng` : "Tìm theo mã hộ, địa bàn, loại hộ và trạng thái"}
                            </p>
                        </div>
                    </div>
                    <Button
                        icon={filtersCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                        onClick={() => setFiltersCollapsed((value) => !value)}
                    >
                    </Button>
                </div>

                {!filtersCollapsed ? (
                    <div className="p-4">
                        <Form form={filterForm} layout="vertical" initialValues={{ year: currentYear }} onFinish={(values) => { setPage(1); setFilters(values); }}>
                            <Row gutter={[16, 0]}>
                                <Col xs={24} md={8} lg={6}><Form.Item name="search" label="Tìm kiếm"><Input placeholder="Mã hộ, địa chỉ, địa bàn" /></Form.Item></Col>

                                <Col xs={12} md={2} lg={2}><Form.Item name="povertyType" label="Loại hộ"><Select allowClear options={povertyTypeOptions} /></Form.Item></Col>
                                <Col xs={12} md={2} lg={2}><Form.Item name="status" label="Trạng thái"><Select allowClear options={householdStatusOptions} /></Form.Item></Col>
                                {/* <Col xs={12} md={6} lg={4}><Form.Item name="provinceName" label="Tỉnh/Thành phố"><Input /></Form.Item></Col> */}
                                <Col xs={12} md={3} lg={3}><Form.Item name="wardName" label="Xã/Phường"><Input /></Form.Item></Col>
                                <Col xs={12} md={3} lg={3}><Form.Item name="areaName" label="Khu vực"><Select allowClear showSearch optionFilterProp="label" options={areaOptions} /></Form.Item></Col>
                                <Col xs={12} md={2} lg={2}><Form.Item name="year" label="Năm"><InputNumber className="w-full" min={1900} max={2200} /></Form.Item></Col>
                            </Row>
                            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end [&_.ant-btn]:w-full sm:[&_.ant-btn]:w-auto mt-2">
                                <ActionButton type="search" htmlType="submit" />
                                <ActionButton type="refresh" variant="outlined" onClick={() => { filterForm.resetFields(); setFilters({ year: currentYear }); setPage(1); }} />
                            </div>
                        </Form>
                    </div>
                ) : null}
            </div>

            <div className="min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white">
                <Table rowKey="id" loading={loading} columns={columns} dataSource={items} pagination={false} scroll={{ x: 1820 }} size="middle" />
                <AppPagination
                    currentPage={page}
                    totalPages={Math.max(1, Math.ceil(total / limit))}
                    totalRows={total}
                    rowsPerPage={limit}
                    onRowsPerPageChange={(value) => { setLimit(value); setPage(1); }}
                    onPageChange={setPage}
                />
            </div>

            <Modal
                title={editing ? "Cập nhật hộ" : "Thêm mới hộ"}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={saveHousehold}
                confirmLoading={saving}
                width={900}
                style={{ maxWidth: "calc(100vw - 32px)" }}
                styles={{ body: { maxHeight: "calc(100vh - 220px)", overflowX: "hidden", overflowY: "auto" } }}
                okText="Lưu"
                cancelText="Hủy"
            >
                <Form form={form} layout="vertical" className="[&_.ant-form-item]:mb-0">
                    <div className="space-y-5">
                        <section className="min-w-0">
                            <div className="mb-3 text-sm font-semibold text-gray-800">Thông tin hộ</div>
                            <Row gutter={[16, 16]}>
                                <Col xs={24} md={8}><Form.Item name="code" label="Mã hộ"><Input /></Form.Item></Col>
                                <Col xs={24} sm={12} md={6}><Form.Item name="povertyType" label="Loại hộ" rules={[{ required: true }]}><Select options={povertyTypeOptions} /></Form.Item></Col>
                                <Col xs={24} sm={12} md={6}><Form.Item name="status" label="Trạng thái"><Select options={householdStatusOptions} /></Form.Item></Col>
                                <Col xs={24} sm={12} md={4}><Form.Item name="year" label="Năm" rules={[{ required: true }]}><InputNumber className="w-full" min={1900} max={2200} /></Form.Item></Col>
                            </Row>
                        </section>

                        <section className="min-w-0 border-t border-gray-100 pt-4">
                            <div className="mb-3 text-sm font-semibold text-gray-800">Địa bàn cư trú</div>
                            <Row gutter={[16, 16]}>
                                <Col xs={24} sm={12} md={8}><Form.Item name="provinceName" label="Tỉnh/Thành phố"><Input /></Form.Item></Col>
                                <Col xs={24} sm={12} md={8}><Form.Item name="wardName" label="Xã/Phường"><Input /></Form.Item></Col>
                                <Col xs={24} sm={12} md={8}><Form.Item name="areaName" label="Thôn/Khu vực"><Select allowClear showSearch optionFilterProp="label" options={areaOptions} /></Form.Item></Col>
                                <Col xs={24}><Form.Item name="address" label="Địa chỉ cụ thể"><Input /></Form.Item></Col>
                            </Row>
                        </section>

                        <section className="min-w-0 border-t border-gray-100 pt-4">
                            <div className="mb-3">
                                <div>
                                    <div className="text-sm font-semibold text-gray-800">Tọa độ bản đồ</div>
                                    <p className="mt-1 text-xs text-gray-500">Nhập trực tiếp hoặc chọn vị trí trên bản đồ.</p>
                                </div>
                            </div>
                            <Row align="bottom" gutter={[16, 16]}>
                                <Col xs={24} sm={12} md={8} lg={8}><Form.Item name="latitude" label="Vĩ độ"><InputNumber className="w-full" style={{ width: "100%" }} min={-90} max={90} precision={7} /></Form.Item></Col>
                                <Col xs={24} sm={12} md={8} lg={8}><Form.Item name="longitude" label="Kinh độ"><InputNumber className="w-full" style={{ width: "100%" }} min={-180} max={180} precision={7} /></Form.Item></Col>
                                <Col xs={24} md={8} lg={8}>
                                    <Button
                                        className="w-full"
                                        icon={<LocateFixed size={16} />}
                                        onClick={() => setCoordinatePickerOpen((value) => !value)}
                                    >
                                        {coordinatePickerOpen ? "Ẩn bản đồ" : "Chọn trên bản đồ"}
                                    </Button>
                                </Col>
                            </Row>
                            {coordinatePickerOpen ? (
                                <div className="mt-4">
                                    <PovertyCoordinatePicker
                                        latitude={typeof latitudeValue === "number" ? latitudeValue : null}
                                        longitude={typeof longitudeValue === "number" ? longitudeValue : null}
                                        onChange={updateFormCoordinates}
                                    />
                                </div>
                            ) : null}
                        </section>
                    </div>
                </Form>
            </Modal>

            <PovertyAssessmentTimelineModal
                household={timelineHousehold}
                open={Boolean(timelineHousehold)}
                onClose={() => setTimelineHousehold(null)}
            />
            <PovertySupportTimelineModal
                household={supportTimelineHousehold}
                open={Boolean(supportTimelineHousehold)}
                onClose={() => setSupportTimelineHousehold(null)}
            />
        </div>
    );
}

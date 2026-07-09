"use client";

import { api, ApiError } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { ExcelPayload, PaginatedResponse, PoorHousehold, PovertyArea, ProvinceOption, WardOption } from "@/types/poverty";
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
import PovertyHouseholdGridView from "@/components/poverty/PovertyHouseholdGridView";
import { getVisibleHouseholdExtraActions } from "@/components/poverty/poverty-household-action-utils";
import { buildHouseholdAreaLabel } from "@/components/poverty/poverty-household-list-view-utils";
import PovertySupportTimelineModal from "@/components/poverty/PovertySupportTimelineModal";
import { DEFAULT_CANTHO_PROVINCE_CODE, getInitialProvinceCode, hasUnresolvedStandardizedLocation } from "@/components/poverty/poverty-location-utils";
import { usePermission } from "@/hooks/usePermission";
import { createInFlightRequestCache } from "@/lib/inflight-request-cache";
import { Alert, App, Button, Col, Dropdown, Form, Input, InputNumber, Modal, Row, Select, Space, Table, Tag } from "antd";
import type { MenuProps, TableColumnsType } from "antd";
import { ChevronDown, ChevronUp, LayoutGrid, List, LocateFixed, MapPinned, SlidersHorizontal, Smartphone } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type HouseholdForm = {
    code?: string;
    year?: number;
    povertyType?: string;
    status?: string;
    provinceCode?: string;
    wardCode?: string;
    areaId?: string;
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
    const [filters, setFilters] = useState<Record<string, unknown>>({ year: currentYear, provinceCode: DEFAULT_CANTHO_PROVINCE_CODE });
    const [filtersCollapsed, setFiltersCollapsed] = useState(false);
    const [viewMode, setViewMode] = useState<"table" | "grid">("table");
    const [coordinatePickerOpen, setCoordinatePickerOpen] = useState(false);
    const [provinceOptions, setProvinceOptions] = useState<ProvinceOption[]>([]);
    const [formWardOptions, setFormWardOptions] = useState<WardOption[]>([]);
    const [formAreaOptions, setFormAreaOptions] = useState<PovertyArea[]>([]);
    const [filterWardOptions, setFilterWardOptions] = useState<WardOption[]>([]);
    const [filterAreaOptions, setFilterAreaOptions] = useState<PovertyArea[]>([]);
    const requestCacheRef = useRef(createInFlightRequestCache());
    const { can: canCreateHousehold } = usePermission("poverty.household.create");
    const { can: canUpdateHousehold } = usePermission("poverty.household.update");
    const { can: canDeleteHousehold } = usePermission("poverty.household.delete");
    const { can: canImportHousehold } = usePermission("poverty.household.import");
    const { can: canExportHousehold } = usePermission("poverty.household.export");
    const { can: canViewHouseholdDetail } = usePermission("poverty.household.detail.view");
    const { can: canViewMap } = usePermission("poverty.map.read");
    const latitudeValue = Form.useWatch("latitude", form);
    const longitudeValue = Form.useWatch("longitude", form);
    const selectedFormProvinceCode = Form.useWatch("provinceCode", form);
    const selectedFormWardCode = Form.useWatch("wardCode", form);
    const selectedFilterProvinceCode = Form.useWatch("provinceCode", filterForm);
    const selectedFilterWardCode = Form.useWatch("wardCode", filterForm);

    const activeFilterCount = useMemo(
        () => Object.values(filters).filter((value) => String(value ?? "").trim()).length,
        [filters]
    );
    const provinceSelectOptions = useMemo(
        () => provinceOptions.map((item) => ({ value: item.code, label: item.fullName || item.name })),
        [provinceOptions]
    );
    const formWardSelectOptions = useMemo(
        () => formWardOptions.map((item) => ({ value: item.code, label: item.fullName || item.name })),
        [formWardOptions]
    );
    const formAreaSelectOptions = useMemo(
        () => formAreaOptions.map((item) => ({ value: item.id, label: item.name })),
        [formAreaOptions]
    );
    const filterWardSelectOptions = useMemo(
        () => filterWardOptions.map((item) => ({ value: item.code, label: item.fullName || item.name })),
        [filterWardOptions]
    );
    const filterAreaSelectOptions = useMemo(
        () => filterAreaOptions.map((item) => ({ value: item.id, label: item.name })),
        [filterAreaOptions]
    );

    const fetchProvinces = useCallback(async () => {
        return requestCacheRef.current.run("poverty:location:provinces", async () => {
            const data = await api.get<{ items?: ProvinceOption[] }>(endpoints.poverty.locationProvinces);
            return data.items ?? [];
        });
    }, []);

    const fetchWardsByProvince = useCallback(async (provinceCode: string) => {
        return requestCacheRef.current.run(`poverty:location:wards:${provinceCode}`, async () => {
            const data = await api.get<{ items?: WardOption[] }>(endpoints.poverty.locationWards(provinceCode));
            return data.items ?? [];
        });
    }, []);

    const fetchAreasByWard = useCallback(async (wardCode: string) => {
        return requestCacheRef.current.run(`poverty:location:areas:${wardCode}`, async () => {
            const data = await api.get<{ items?: PovertyArea[] }>(endpoints.poverty.locationAreas(wardCode));
            return data.items ?? [];
        });
    }, []);

    const loadProvinces = useCallback(async () => {
        try {
            const items = await fetchProvinces();
            setProvinceOptions(items);
        } catch (error) {
            notification.error({
                message: "Không thể tải tỉnh/thành phố",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
        }
    }, [fetchProvinces, notification]);

    const loadWardsByProvince = useCallback(async (provinceCode: string, target: "form" | "filter") => {
        try {
            const items = await fetchWardsByProvince(provinceCode);
            if (target === "form") {
                setFormWardOptions(items);
            } else {
                setFilterWardOptions(items);
            }
        } catch (error) {
            notification.error({
                message: "Không thể tải xã/phường",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
        }
    }, [fetchWardsByProvince, notification]);

    const loadAreasByWard = useCallback(async (wardCode: string, target: "form" | "filter") => {
        try {
            const items = await fetchAreasByWard(wardCode);
            if (target === "form") {
                setFormAreaOptions(items);
            } else {
                setFilterAreaOptions(items);
            }
        } catch (error) {
            notification.error({
                message: "Không thể tải khu vực/ấp",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
        }
    }, [fetchAreasByWard, notification]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const query = buildQuery(filters, page, limit);
            const data = await requestCacheRef.current.run(`poverty:households:${query}`, async () => {
                return api.get<PaginatedResponse<PoorHousehold>>(`${endpoints.poverty.households}?${query}`);
            });
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
        void loadProvinces();
    }, [loadProvinces]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        if (!modalOpen) return;
        const provinceCode = getInitialProvinceCode(selectedFormProvinceCode);
        if (!provinceCode) return;
        void loadWardsByProvince(provinceCode, "form");
    }, [loadWardsByProvince, modalOpen, selectedFormProvinceCode]);

    useEffect(() => {
        if (!modalOpen) return;
        if (!selectedFormWardCode) {
            setFormAreaOptions([]);
            return;
        }
        void loadAreasByWard(String(selectedFormWardCode), "form");
    }, [loadAreasByWard, modalOpen, selectedFormWardCode]);

    useEffect(() => {
        const provinceCode = getInitialProvinceCode(selectedFilterProvinceCode);
        if (!provinceCode) return;
        void loadWardsByProvince(provinceCode, "filter");
    }, [loadWardsByProvince, selectedFilterProvinceCode]);

    useEffect(() => {
        if (!selectedFilterWardCode) {
            setFilterAreaOptions([]);
            return;
        }
        void loadAreasByWard(String(selectedFilterWardCode), "filter");
    }, [loadAreasByWard, selectedFilterWardCode]);

    const openCreate = useCallback(() => {
        setEditing(null);
        setFormAreaOptions([]);
        form.resetFields();
        form.setFieldsValue({
            year: currentYear,
            povertyType: "POOR",
            status: "ACTIVE",
            provinceCode: DEFAULT_CANTHO_PROVINCE_CODE,
        });
        setCoordinatePickerOpen(false);
        setModalOpen(true);
    }, [form]);

    const openEdit = useCallback((record: PoorHousehold) => {
        setEditing(record);
        setFormAreaOptions([]);
        form.setFieldsValue({
            code: record.code ?? undefined,
            year: record.year,
            povertyType: String(record.povertyType ?? "POOR"),
            status: String(record.status ?? "ACTIVE"),
            provinceCode: record.provinceCode ?? undefined,
            wardCode: record.wardCode ?? undefined,
            areaId: record.areaId ?? undefined,
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

    const openCollectionApp = useCallback((householdId?: string) => {
        if (householdId) {
            router.push(`/ho-ngheo/thu-thap?householdId=${householdId}`);
            return;
        }
        router.push("/ho-ngheo/thu-thap");
    }, [router]);

    const openView = useCallback((record: PoorHousehold) => {
        router.push(`/ho-ngheo/${record.id}`);
    }, [router]);

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

    const buildExtraActionMenuItems = useCallback((record: PoorHousehold): MenuProps["items"] => {
        const visibleActions = getVisibleHouseholdExtraActions([
            {
                key: "collection",
                label: "Thu thập hiện trường",
                iconAction: "more",
                visible: canUpdateHousehold,
            },
            {
                key: "assessmentTimeline",
                label: "Xem timeline đánh giá",
                iconAction: "timeline",
                visible: canViewHouseholdDetail,
            },
            {
                key: "supportTimeline",
                label: "Xem timeline hỗ trợ",
                iconAction: "supportTimeline",
                visible: canViewHouseholdDetail,
            },
            {
                key: "map",
                label: "Xem trên bản đồ",
                iconAction: "more",
                visible: canViewMap,
            },
            {
                key: "delete",
                label: "Ngưng hoạt động",
                iconAction: "delete",
                visible: canDeleteHousehold,
                danger: true,
            },
        ]);

        return visibleActions.map((action) => ({
            key: action.key,
            danger: action.danger,
            icon: action.key === "collection"
                ? <span aria-hidden="true" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-sky-50 text-sky-600"><Smartphone size={18} strokeWidth={2.2} /></span>
                : action.key === "map"
                    ? <span aria-hidden="true" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-emerald-50 text-emerald-600"><MapPinned size={18} strokeWidth={2.2} /></span>
                    : <ActionIcon action={action.iconAction} />,
            label: action.label,
            onClick: () => {
                if (action.key === "collection") {
                    openCollectionApp(record.id);
                    return;
                }
                if (action.key === "assessmentTimeline") {
                    setTimelineHousehold(record);
                    return;
                }
                if (action.key === "supportTimeline") {
                    setSupportTimelineHousehold(record);
                    return;
                }
                if (action.key === "map") {
                    openOnMap(record);
                    return;
                }
                Modal.confirm({
                    title: "Ngưng hoạt động hộ này?",
                    okText: "Ngưng",
                    cancelText: "Hủy",
                    okButtonProps: { danger: true },
                    onOk: async () => deactivate(record),
                });
            },
        }));
    }, [canDeleteHousehold, canUpdateHousehold, canViewHouseholdDetail, canViewMap, deactivate, openCollectionApp, openOnMap]);

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
            render: (_, row) => buildHouseholdAreaLabel(row),
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
            width: 176,
            fixed: "right",
            render: (_, record) => {
                const extraMenuItems = buildExtraActionMenuItems(record) ?? [];

                return (
                    <Space size={4} wrap={false}>
                        <Button type="text" icon={<ActionIcon action="view" />} onClick={() => openView(record)} />
                        {canUpdateHousehold ? <Button type="text" icon={<ActionIcon action="edit" />} onClick={() => openEdit(record)} /> : null}
                        {extraMenuItems.length > 0 ? (
                            <Dropdown menu={{ items: extraMenuItems }} trigger={["click"]} placement="bottomRight">
                                <Button type="text" aria-label="Thêm thao tác" icon={<ActionIcon action="more" />} />
                            </Dropdown>
                        ) : null}
                    </Space>
                );
            },
        },
    ], [buildExtraActionMenuItems, canUpdateHousehold, limit, openEdit, openView, page]);

    return (
        <div className="min-w-0 space-y-4 overflow-hidden">
            <TitleSpace
                title="Quản lý hộ nghèo/cận nghèo"
                actions={
                    <div
                        className="grid grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end [&_.ant-btn]:w-full sm:[&_.ant-btn]:w-auto"
                        style={{ width: "min(100vw - 32px, 620px)" }}
                    >
                        {canImportHousehold ? <div className="min-w-0">
                            <SharedSpreadsheetImport moduleKey="poverty-households" onCommitted={loadData} />
                        </div> : null}
                        {canExportHousehold ? <ActionButton type="export-excel" onClick={exportExcel} /> : null}
                        {(canCreateHousehold || canUpdateHousehold) ? (
                            <Button
                                className="col-span-2 sm:col-span-1 bg-blue-500 hover:bg-blue-600 text-white"
                                style={{ padding: "19px", borderRadius: "10px", backgroundColor: "#0095fb", color: "#fff" }}
                                icon={<Smartphone size={16} />}
                                onClick={() => openCollectionApp()}
                            >
                                Thu thập
                            </Button>
                        ) : null}
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
                        <Form
                            form={filterForm}
                            layout="vertical"
                            initialValues={{ year: currentYear, provinceCode: DEFAULT_CANTHO_PROVINCE_CODE }}
                            onFinish={(values) => { setPage(1); setFilters(values); }}
                        >
                            <Row gutter={[16, 0]}>
                                <Col xs={24} md={8} lg={6}><Form.Item name="search" label="Tìm kiếm"><Input placeholder="Mã hộ, địa chỉ, địa bàn" /></Form.Item></Col>

                                <Col xs={12} md={2} lg={2}><Form.Item name="povertyType" label="Loại hộ"><Select allowClear options={povertyTypeOptions} /></Form.Item></Col>
                                <Col xs={12} md={2} lg={2}><Form.Item name="status" label="Trạng thái"><Select allowClear options={householdStatusOptions} /></Form.Item></Col>
                                <Col xs={12} md={4} lg={4}>
                                    <Form.Item name="provinceCode" label="Tỉnh/Thành phố">
                                        <Select
                                            showSearch
                                            optionFilterProp="label"
                                            options={provinceSelectOptions}
                                            onChange={() => filterForm.setFieldsValue({ wardCode: undefined, areaId: undefined })}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col xs={12} md={3} lg={3}>
                                    <Form.Item name="wardCode" label="Xã/Phường">
                                        <Select
                                            allowClear
                                            showSearch
                                            optionFilterProp="label"
                                            options={filterWardSelectOptions}
                                            onChange={() => filterForm.setFieldsValue({ areaId: undefined })}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col xs={12} md={3} lg={3}>
                                    <Form.Item name="areaId" label="Khu vực">
                                        <Select allowClear showSearch optionFilterProp="label" options={filterAreaSelectOptions} />
                                    </Form.Item>
                                </Col>
                                <Col xs={12} md={2} lg={2}><Form.Item name="year" label="Năm"><InputNumber className="w-full" min={1900} max={2200} /></Form.Item></Col>
                            </Row>
                            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end [&_.ant-btn]:w-full sm:[&_.ant-btn]:w-auto mt-2">
                                <ActionButton type="search" htmlType="submit" />
                                <ActionButton
                                    type="refresh"
                                    variant="outlined"
                                    onClick={() => {
                                        filterForm.resetFields();
                                        filterForm.setFieldsValue({ year: currentYear, provinceCode: DEFAULT_CANTHO_PROVINCE_CODE });
                                        setFilters({ year: currentYear, provinceCode: DEFAULT_CANTHO_PROVINCE_CODE });
                                        setPage(1);
                                    }}
                                />
                            </div>
                        </Form>
                    </div>
                ) : null}
            </div>

            <div className="min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
                    <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-gray-800">Danh sách hộ</h3>
                        <p className="mt-0.5 text-xs text-gray-500">
                            {total.toLocaleString("vi-VN")} hộ phù hợp với bộ lọc hiện tại
                        </p>
                    </div>
                    <Space.Compact>
                        <Button type={viewMode === "table" ? "primary" : "default"} icon={<List size={16} />} onClick={() => setViewMode("table")}>
                            Bảng
                        </Button>
                        <Button type={viewMode === "grid" ? "primary" : "default"} icon={<LayoutGrid size={16} />} onClick={() => setViewMode("grid")}>
                            Lưới
                        </Button>
                    </Space.Compact>
                </div>
                {viewMode === "table" ? (
                    <Table rowKey="id" loading={loading} columns={columns} dataSource={items} pagination={false} scroll={{ x: 1820 }} size="middle" />
                ) : (
                    <PovertyHouseholdGridView
                        items={items}
                        loading={loading}
                        canUpdateHousehold={canUpdateHousehold}
                        onViewHousehold={openView}
                        onEditHousehold={openEdit}
                        buildExtraActionMenuItems={buildExtraActionMenuItems}
                    />
                )}
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
                            {editing && hasUnresolvedStandardizedLocation(editing) ? (
                                <Alert
                                    className="mb-4"
                                    type="warning"
                                    showIcon
                                    message="Địa bàn cũ chưa chuẩn hóa hoàn toàn, vui lòng chọn lại theo danh mục chuẩn."
                                    description={[editing.provinceName, editing.wardName, editing.areaName].filter(Boolean).join(" / ")}
                                />
                            ) : null}
                            <Row gutter={[16, 16]}>
                                <Col xs={24} sm={12} md={8}>
                                    <Form.Item name="provinceCode" label="Tỉnh/Thành phố" rules={[{ required: true }]}>
                                        <Select
                                            showSearch
                                            optionFilterProp="label"
                                            options={provinceSelectOptions}
                                            onChange={() => form.setFieldsValue({ wardCode: undefined, areaId: undefined })}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12} md={8}>
                                    <Form.Item name="wardCode" label="Xã/Phường" rules={[{ required: true }]}>
                                        <Select
                                            showSearch
                                            optionFilterProp="label"
                                            options={formWardSelectOptions}
                                            onChange={() => form.setFieldsValue({ areaId: undefined })}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12} md={8}>
                                    <Form.Item name="areaId" label="Thôn/Khu vực" rules={[{ required: true }]}>
                                        <Select showSearch optionFilterProp="label" options={formAreaSelectOptions} />
                                    </Form.Item>
                                </Col>
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

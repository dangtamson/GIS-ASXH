"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, App, Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tooltip } from "antd";
import type { TableColumnsType } from "antd";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { PovertyWardOverview, PovertyWardPublicLink, ProvinceOption, WardOption } from "@/types/poverty";
import { DEFAULT_CANTHO_PROVINCE_CODE, getInitialProvinceCode } from "./poverty-location-utils";
import { buildWardFilterOptions, filterWardItems } from "./poverty-admin-general-info-utils";
import { TitleSpace } from "@/components/controller";
import ActionIcon from "@/components/controller/ActionIcon";
import { usePermission } from "@/hooks/usePermission";
import { buildPovertyWardPublicUrl } from "@/components/poverty/poverty-public-map-utils";

type WardListItem = WardOption;

type WardOverviewFormValues = {
    year: number;
    population: number;
    totalHouseholds: number;
    totalMembers: number;
    naturalArea: number;
    note?: string;
};

const currentYear = new Date().getFullYear();

export default function PovertyAdminGeneralInfoPage() {
    const router = useRouter();
    const { notification } = App.useApp();
    const [overviewForm] = Form.useForm<WardOverviewFormValues>();
    const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
    const [wards, setWards] = useState<WardListItem[]>([]);
    const [selectedProvinceCode, setSelectedProvinceCode] = useState<string>(DEFAULT_CANTHO_PROVINCE_CODE);
    const [selectedWardCode, setSelectedWardCode] = useState<string | undefined>();
    const [selectedWard, setSelectedWard] = useState<WardOption | null>(null);
    const [overviews, setOverviews] = useState<PovertyWardOverview[]>([]);
    const [loading, setLoading] = useState(false);
    const [overviewLoading, setOverviewLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [overviewModalOpen, setOverviewModalOpen] = useState(false);
    const [selectedOverviewId, setSelectedOverviewId] = useState<string | null>(null);
    const [deletingOverviewId, setDeletingOverviewId] = useState<string | null>(null);
    const [wardPublicLink, setWardPublicLink] = useState<PovertyWardPublicLink | null>(null);
    const [publicLinkLoading, setPublicLinkLoading] = useState(false);
    const [publicLinkSaving, setPublicLinkSaving] = useState(false);
    const [publicLinkError, setPublicLinkError] = useState<string | null>(null);
    const { can: canViewOverview } = usePermission("poverty.ward_overview.view");
    const { can: canUpdateOverview } = usePermission("poverty.ward_overview.update");
    const { can: canDeleteOverview } = usePermission("poverty.ward_overview.delete");
    const { can: canViewArea } = usePermission("poverty.ward_area.view");

    const selectedProvinceOptions = useMemo(
        () => provinces.map((item) => ({ value: item.code, label: item.fullName || item.name })),
        [provinces]
    );

    const wardFilterOptions = useMemo(() => buildWardFilterOptions(wards), [wards]);

    const filteredWards = useMemo(() => filterWardItems(wards, selectedWardCode), [selectedWardCode, wards]);

    const selectedOverview = useMemo(
        () => overviews.find((item) => item.id === selectedOverviewId) ?? null,
        [overviews, selectedOverviewId]
    );
    const publicLinkUrl = useMemo(() => {
        if (!wardPublicLink?.publicSlug) return "";
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        return buildPovertyWardPublicUrl(wardPublicLink.publicSlug, origin);
    }, [wardPublicLink?.publicSlug]);

    const loadProvinces = useCallback(async () => {
        try {
            const data = await api.get<{ items?: ProvinceOption[] }>(endpoints.poverty.locationProvinces);
            const items = data.items ?? [];
            setProvinces(items);
            setSelectedProvinceCode((prev) => getInitialProvinceCode(items.some((item) => item.code === prev) ? prev : undefined));
        } catch (error) {
            notification.error({
                message: "Không thể tải danh sách tỉnh/thành",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
        }
    }, [notification]);

    const loadWards = useCallback(async (provinceCode: string) => {
        setLoading(true);
        try {
            const data = await api.get<{ items?: WardOption[] }>(endpoints.poverty.locationWards(provinceCode));
            const wardItems = data.items ?? [];
            setWards(wardItems);
            setSelectedWardCode((prev) => (prev && wardItems.some((item) => item.code === prev) ? prev : undefined));
        } catch (error) {
            notification.error({
                message: "Không thể tải danh sách xã/phường",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
        } finally {
            setLoading(false);
        }
    }, [notification]);

    const loadWardOverviews = useCallback(async (provinceCode: string, ward: WardOption) => {
        setOverviewModalOpen(true);
        setOverviewLoading(true);
        setPublicLinkLoading(true);
        setWardPublicLink(null);
        setPublicLinkError(null);
        setSelectedWard(ward);
        setSelectedOverviewId(null);
        overviewForm.setFieldsValue({
            year: currentYear,
            population: 0,
            totalHouseholds: 0,
            totalMembers: 0,
            naturalArea: 0,
            note: "",
        });
        try {
            const [overviewData, publicLinkData] = await Promise.all([
                api.get<{ items?: PovertyWardOverview[] }>(
                    endpoints.poverty.wardOverviews(provinceCode, ward.code)
                ),
                api.get<{ item?: PovertyWardPublicLink | null }>(
                    `${endpoints.poverty.wardPublicLinks}?provinceCode=${provinceCode}&wardCode=${ward.code}`
                ),
            ]);
            setPublicLinkError(null);
            setWardPublicLink(publicLinkData.item ?? null);
            const data = overviewData;
            setOverviews(data.items ?? []);
        } catch (error) {
            setOverviewModalOpen(false);
            notification.error({
                message: "Không thể tải thông tin chung xã/phường",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
        } finally {
            setOverviewLoading(false);
            setPublicLinkLoading(false);
        }
    }, [notification, overviewForm]);

    useEffect(() => {
        void loadProvinces();
    }, [loadProvinces]);

    useEffect(() => {
        if (!selectedProvinceCode) return;
        void loadWards(selectedProvinceCode);
    }, [loadWards, selectedProvinceCode]);

    useEffect(() => {
        if (!selectedOverview) return;
        overviewForm.setFieldsValue({
            year: selectedOverview.year,
            population: selectedOverview.population,
            totalHouseholds: selectedOverview.totalHouseholds,
            totalMembers: selectedOverview.totalMembers,
            naturalArea: selectedOverview.naturalArea,
            note: selectedOverview.note ?? "",
        });
    }, [overviewForm, selectedOverview]);

    const resetOverviewForm = useCallback(() => {
        setSelectedOverviewId(null);
        overviewForm.setFieldsValue({
            year: currentYear,
            population: 0,
            totalHouseholds: 0,
            totalMembers: 0,
            naturalArea: 0,
            note: "",
        });
    }, [overviewForm]);

    const saveWardPublicLink = useCallback(async (isPublic: boolean) => {
        if (!selectedWard) return;
        const previous = wardPublicLink;
        setPublicLinkSaving(true);
        setPublicLinkError(null);
        setWardPublicLink((current) => current ? { ...current, isPublic } : current);

        try {
            const data = await api.put<{ item?: PovertyWardPublicLink }>(endpoints.poverty.wardPublicLinks, {
                provinceCode: selectedProvinceCode,
                wardCode: selectedWard.code,
                isPublic,
            });
            setWardPublicLink(data.item ?? null);
            notification.success({
                message: isPublic ? "Đã bật công khai bản đồ" : "Đã tắt công khai bản đồ",
            });
        } catch (error) {
            setWardPublicLink(previous);
            setPublicLinkError(error instanceof ApiError ? error.message : "Vui lòng thử lại");
            notification.error({
                message: "Không thể cập nhật trạng thái công khai",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
        } finally {
            setPublicLinkSaving(false);
        }
    }, [notification, selectedProvinceCode, selectedWard, wardPublicLink]);

    const copyPublicLink = useCallback(async () => {
        if (!publicLinkUrl) return;
        try {
            await navigator.clipboard.writeText(publicLinkUrl);
            notification.success({ message: "Đã sao chép liên kết công khai" });
        } catch {
            notification.error({ message: "Không thể sao chép, vui lòng sao chép thủ công" });
        }
    }, [notification, publicLinkUrl]);

    const saveOverview = async () => {
        if (!selectedWard) return;
        try {
            const values = await overviewForm.validateFields();
            setSaving(true);
            const response = await api.put<{ item?: PovertyWardOverview }>(endpoints.poverty.wardOverviewsBase, {
                provinceCode: selectedProvinceCode,
                wardCode: selectedWard.code,
                ...values,
            });
            notification.success({ message: "Đã lưu thông tin chung xã/phường" });
            await loadWardOverviews(selectedProvinceCode, selectedWard);
            if (response.item?.id) setSelectedOverviewId(response.item.id);
        } catch (error) {
            if (typeof error === "object" && error !== null && "errorFields" in error) return;
            notification.error({
                message: "Không thể lưu thông tin chung xã/phường",
                description: error instanceof ApiError ? error.message : "Vui lòng kiểm tra dữ liệu",
            });
        } finally {
            setSaving(false);
        }
    };

    const deleteOverview = async (id: string) => {
        try {
            setDeletingOverviewId(id);
            await api.delete(endpoints.poverty.wardOverviewById(id));
            notification.success({ message: "Đã xóa thông tin năm" });
            if (selectedWard) {
                await loadWardOverviews(selectedProvinceCode, selectedWard);
            }
        } catch (error) {
            notification.error({
                message: "Không thể xóa thông tin năm",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
        } finally {
            setDeletingOverviewId(null);
        }
    };

    const columns: TableColumnsType<WardListItem> = [
        { title: "Tên xã/phường", dataIndex: "fullName", render: (value, record) => value || record.name },
        { title: "Đơn vị hành chính", dataIndex: "administrativeUnitName", width: 180, render: (value?: string | null) => value || "-" },
        {
            title: "Thao tác",
            width: 140,
            align: "center",
            render: (_value, record) => (
                <Space size={4}>
                    <Tooltip title="Thông tin chung theo năm">
                        <Button
                            type="text"
                            icon={<ActionIcon action="edit" />}
                            disabled={!canViewOverview}
                            onClick={() => void loadWardOverviews(selectedProvinceCode, record)}
                        />
                    </Tooltip>
                    <Tooltip title="Quản lý khu vực/ấp">
                        <Button
                            type="text"
                            icon={<ActionIcon action="document" />}
                            disabled={!canViewArea}
                            onClick={() =>
                                router.push(
                                    `/quan-tri/thong-tin-chung/${record.code}/khu-vuc-ap?provinceCode=${selectedProvinceCode}&wardName=${encodeURIComponent(
                                        record.fullName || record.name
                                    )}`
                                )
                            }
                        />
                    </Tooltip>
                </Space>
            ),
        },
    ];

    const overviewColumns: TableColumnsType<PovertyWardOverview> = [
        { title: "Năm", dataIndex: "year", width: 100, align: "center" },
        { title: "Dân số", dataIndex: "population", align: "right" },
        { title: "Số hộ", dataIndex: "totalHouseholds", align: "right" },
        { title: "Số nhân khẩu", dataIndex: "totalMembers", align: "right" },
        { title: "Diện tích", dataIndex: "naturalArea", align: "right" },
        { title: "Ghi chú", dataIndex: "note", render: (value?: string | null) => value || "-" },
        {
            title: "Thao tác",
            width: 120,
            align: "center",
            render: (_value, record) => (
                <Space size={4}>
                    <Button
                        type="text"
                        icon={<ActionIcon action="edit" />}
                        disabled={!canUpdateOverview}
                        onClick={() => setSelectedOverviewId(record.id)}
                    />
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
                            loading={deletingOverviewId === record.id}
                            disabled={!canDeleteOverview}
                        />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div className="space-y-4">
            <TitleSpace title="Thông tin chung" />

            <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="grid gap-4 md:grid-cols-[280px_280px_1fr] md:items-end">
                    <div>
                        <p className="mb-2 text-sm font-medium text-gray-700">Tỉnh/Thành phố</p>
                        <Select
                            value={selectedProvinceCode}
                            options={selectedProvinceOptions}
                            onChange={(value) => {
                                setSelectedProvinceCode(value);
                                setSelectedWardCode(undefined);
                                setSelectedWard(null);
                                setOverviews([]);
                                setWardPublicLink(null);
                                setPublicLinkError(null);
                                setOverviewModalOpen(false);
                            }}
                            className="w-full"
                        />
                    </div>
                    <div>
                        <p className="mb-2 text-sm font-medium text-gray-700">Xã/Phường</p>
                        <Select
                            allowClear
                            placeholder="Tất cả xã/phường"
                            value={selectedWardCode}
                            options={wardFilterOptions}
                            onChange={(value) => setSelectedWardCode(value)}
                            className="w-full"
                        />
                    </div>
                </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm text-gray-500">
                        {selectedWardCode
                            ? `Đang lọc 1 xã/phường trong tổng số ${wards.length} xã/phường.`
                            : `Hiển thị ${filteredWards.length} xã/phường của tỉnh/thành đã chọn.`}
                    </div>
                </div>
                <Table rowKey="code" loading={loading} columns={columns} dataSource={filteredWards} pagination={{ pageSize: 10 }} />
            </div>

            <Modal
                title={selectedWard ? `Thông tin chung: ${selectedWard.fullName || selectedWard.name}` : "Thông tin chung xã/phường"}
                open={overviewModalOpen}
                onCancel={() => setOverviewModalOpen(false)}
                width={960}
                footer={null}
                destroyOnHidden
            >
                <div className="space-y-4">
                    <div className="rounded-lg border border-sky-200 bg-sky-50/70 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h3 className="text-sm font-semibold text-slate-900">Công khai bản đồ</h3>
                                <p className="mt-1 text-xs text-slate-600">
                                    Cho phép người ngoài truy cập bản đồ số hộ nghèo của xã/phường này ở chế độ chỉ xem.
                                </p>
                            </div>
                            <Switch
                                checked={Boolean(wardPublicLink?.isPublic)}
                                loading={publicLinkSaving}
                                disabled={!canUpdateOverview || publicLinkLoading}
                                onChange={(checked) => void saveWardPublicLink(checked)}
                            />
                        </div>

                        {publicLinkError ? (
                            <Alert
                                className="mt-3"
                                type="error"
                                showIcon
                                message="Không thể tải hoặc cập nhật liên kết công khai"
                                description={publicLinkError}
                            />
                        ) : null}

                        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                            <Input
                                readOnly
                                value={publicLinkUrl}
                                placeholder="Bật công khai để tạo liên kết cố định cho xã/phường"
                            />
                            <Button disabled={!publicLinkUrl} onClick={() => void copyPublicLink()}>
                                Copy
                            </Button>
                            <Button
                                disabled={!publicLinkUrl}
                                onClick={() => {
                                    if (!publicLinkUrl) return;
                                    window.open(publicLinkUrl, "_blank", "noopener,noreferrer");
                                }}
                            >
                                Mở thử
                            </Button>
                        </div>
                    </div>
                    <Form
                        form={overviewForm}
                        layout="vertical"
                        initialValues={{ year: currentYear, population: 0, totalHouseholds: 0, totalMembers: 0, naturalArea: 0 }}
                    >
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                                <Form.Item name="year" label="Năm" rules={[{ required: true }]}>
                                    <InputNumber className="w-full" min={1900} max={2200} style={{ width: "100%" }} />
                                </Form.Item>
                                <Form.Item name="population" label="Dân số" rules={[{ required: true }]}>
                                    <InputNumber className="w-full" min={0} style={{ width: "100%" }} />
                                </Form.Item>
                                <Form.Item name="totalHouseholds" label="Số hộ" rules={[{ required: true }]}>
                                    <InputNumber className="w-full" min={0} style={{ width: "100%" }} />
                                </Form.Item>
                                <Form.Item name="totalMembers" label="Số nhân khẩu" rules={[{ required: true }]}>
                                    <InputNumber className="w-full" min={0} style={{ width: "100%" }} />
                                </Form.Item>
                                <Form.Item name="naturalArea" label="Diện tích" rules={[{ required: true }]}>
                                    <InputNumber className="w-full" min={0} style={{ width: "100%" }} />
                                </Form.Item>
                                <Form.Item name="note" label="Ghi chú" className="md:col-span-12 xl:col-span-12">
                                    <Input />
                                </Form.Item>
                            </div>
                        </div>
                        <div className="mt-4 flex flex-wrap justify-end gap-2">
                            <Button onClick={resetOverviewForm}>Làm lại</Button>
                            <Button type="primary" loading={saving} disabled={!canUpdateOverview || overviewLoading} onClick={() => void saveOverview()}>
                                {selectedOverviewId ? "Cập nhật" : "Lưu mới"}
                            </Button>
                        </div>
                    </Form>
                    <Table
                        rowKey="id"
                        loading={overviewLoading}
                        columns={overviewColumns}
                        dataSource={overviews}
                        pagination={false}
                        scroll={{ x: 720 }}
                        className="mt-4"
                    />
                </div>
            </Modal>
        </div>
    );
}

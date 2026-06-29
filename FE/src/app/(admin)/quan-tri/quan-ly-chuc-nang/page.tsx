"use client";

import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {api} from "@/lib/api";
import {getWorkspaceId} from "@/lib/auth";
import {endpoints} from "@/lib/endpoints";
import {App, Checkbox, Col, ConfigProvider, Divider, Form, Modal, Row, Switch, Table, Tag} from "antd";
import {RefreshCw, Search as SearchIcon, Settings2} from "lucide-react";
import type {ColumnsType} from "antd/es/table";
import ActionIcon from "@/components/controller/ActionIcon";
import {ActionButton, ActionModal, AppInput, AppPagination, AppSelect, TitleSpace} from "@/components/controller";
import WorkspaceSelect from "@/components/controller/input/WorkspaceSelect";

// Custom hook for debouncing
const useDebounce = (value: string, delay: number = 300) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        debounceTimer.current = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
        };
    }, [value, delay]);

    return debouncedValue;
};

interface Feature {
    uuid: string;
    name: string;
    description?: string;
    code: string;
    path: string;
    groupName: string;
    enabled: boolean;
    requiredPermissionCode?: string | null;
    requiresSuperAdmin?: boolean;
    requiresWorkspaceAdmin?: boolean;
    orderIndex?: number;
    icon?: string;
    workspaces?: string[];
}

const FEATURE_GROUPS = [
    { label: "Tính năng chính", value: "main" },
    { label: "Quản lý", value: "admin" },
    { label: "Hệ thống", value: "system" },
    { label: "Danh mục", value: "categories" },
    { label: "Báo cáo", value: "reports" },
    { label: "Hộ nghèo", value: "poverty" },
];

export default function FeaturesManagementPage() {
    const [features, setFeatures] = useState<Feature[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingFeature, setEditingFeature] = useState<Feature | null>(null);
    const [form] = Form.useForm();
    const [query, setQuery] = useState("");
    const debouncedQuery = useDebounce(query, 300);
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const { notification } = App.useApp();
    const workspaceId = getWorkspaceId();

    const loadFeatures = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.get<Feature[]>(endpoints.admin.features);
            const featureList = Array.isArray(data) ? data : [];
            setFeatures(featureList.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)));
        } catch (error) {
            notification.error({
                title: "Lỗi",
                description: "Không thể tải danh sách chức năng",
            });
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [notification]);

    useEffect(() => {
        loadFeatures();
    }, [workspaceId, loadFeatures]);

    const filteredFeatures = useMemo(() => {
        const q = debouncedQuery.trim().toLowerCase();
        if (!q) return features;
        return features.filter((f) =>
            f.name.toLowerCase().includes(q) ||
            f.code.toLowerCase().includes(q) ||
            f.path.toLowerCase().includes(q) ||
            f.groupName.toLowerCase().includes(q)
        );
    }, [features, debouncedQuery]);

    const totalPages = Math.max(1, Math.ceil(filteredFeatures.length / rowsPerPage));
    const pagedFeatures = useMemo(() => {
        const start = (page - 1) * rowsPerPage;
        return filteredFeatures.slice(start, start + rowsPerPage);
    }, [filteredFeatures, page, rowsPerPage]);

    useEffect(() => {
        setPage(1);
    }, [rowsPerPage, debouncedQuery]);

    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

    const enabledCount = useMemo(() => features.filter((f) => f.enabled).length, [features]);
    const requiresSuperAdminCount = useMemo(() => features.filter((f) => f.requiresSuperAdmin).length, [features]);

    const cardClassName =
        "rounded-2xl border border-sky-200/70 bg-white/95 shadow-sm dark:border-sky-900/50 dark:bg-gray-900";

    // Static color mappings for Tailwind JIT
    const colorClasses: Record<string, { text: string; bg: string }> = {
        sky: { text: "text-sky-600 dark:text-sky-400", bg: "bg-sky-100 dark:bg-sky-900/20" },
        green: { text: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/20" },
        red: { text: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/20" },
        blue: { text: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/20" },
    };

    const handleAddNew = useCallback(() => {
        setEditingFeature(null);
        form.resetFields();
        setIsModalVisible(true);
    }, [form]);

    const handleEdit = useCallback((feature: Feature) => {
        setEditingFeature(feature);
        form.setFieldsValue({
            name: feature.name,
            description: feature.description,
            code: feature.code,
            path: feature.path,
            groupName: feature.groupName,
            enabled: feature.enabled,
            requiredPermissionCode: feature.requiredPermissionCode,
            requiresSuperAdmin: feature.requiresSuperAdmin,
            requiresWorkspaceAdmin: feature.requiresWorkspaceAdmin,
            orderIndex: feature.orderIndex,
            icon: feature.icon,
            workspaces: feature.workspaces,
        });
        setIsModalVisible(true);
    }, [form]);

    const handleDelete = useCallback(async (featureId: string) => {
        Modal.confirm({
            title: "Xóa chức năng",
            content: "Bạn có chắc chắn muốn xóa chức năng này không?",
            okText: "Xóa",
            cancelText: "Huỷ",
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    await api.delete(`${endpoints.admin.features}/${featureId}`);
                    notification.success({
                        title: "Thành công",
                        description: "Xóa chức năng thành công",
                    });
                    await loadFeatures();
                } catch (error) {
                    notification.error({
                        title: "Lỗi",
                        description: "Không thể xóa chức năng",
                    });
                    console.error(error);
                }
            },
        });
    }, [loadFeatures, notification]);

    const handleSubmit = useCallback(async (values: Record<string, unknown>) => {
        try {
            setLoading(true);

            // Convert types for proper validation
            const payload = {
                ...values,
                orderIndex: values.orderIndex ? Number(values.orderIndex) : 0,
                enabled: Boolean(values.enabled),
                requiredPermissionCode: null,
                requiresSuperAdmin: Boolean(values.requiresSuperAdmin),
                requiresWorkspaceAdmin: Boolean(values.requiresWorkspaceAdmin),
            };

            if (editingFeature) {
                await api.put(`${endpoints.admin.features}/${editingFeature.uuid}`, payload);
                notification.success({
                    title: "Thành công",
                    description: "Chỉnh sửa chức năng thành công",
                });
            } else {
                await api.post(endpoints.admin.features, payload);
                notification.success({
                    title: "Thành công",
                    description: "Thêm chức năng thành công",
                });
            }
            setIsModalVisible(false);
            form.resetFields();
            await loadFeatures();
        } catch (error) {
            notification.error({
                title: "Lỗi",
                description: editingFeature ? "Chỉnh sửa thất bại" : "Thêm mới thất bại",
            });
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [editingFeature, form, loadFeatures, notification]);

    const handleToggleFeature = useCallback(async (featureId: string, currentEnabled: boolean) => {
        try {
            await api.patch(`${endpoints.admin.features}/${featureId}/toggle`, {});
            notification.success({
                title: "Thành công",
                description: `Chức năng được ${!currentEnabled ? "bật" : "tắt"}`,
            });
            await loadFeatures();
        } catch (error) {
            notification.error({
                title: "Lỗi",
                description: "Cập nhật trạng thái thất bại",
            });
            console.error(error);
        }
    }, [loadFeatures, notification]);

    const getGroupLabel = useCallback((value: string) => {
        return FEATURE_GROUPS.find((g) => g.value === value)?.label ?? value;
    }, []);

    const getGroupColor = useCallback((group: string) => {
        const colors: Record<string, string> = {
            main: "blue",
            admin: "orange",
            system: "red",
            categories: "purple",
            reports: "cyan",
        };
        return colors[group] ?? "default";
    }, []);

    const columns: ColumnsType<Feature> = useMemo(() => [
        {
            title: "Tên chức năng",
            dataIndex: "name",
            key: "name",
            width: 200,
            render: (name) => <span className="font-medium text-gray-900 dark:text-white">{name}</span>,
        },
        {
            title: "Code",
            dataIndex: "code",
            key: "code",
            width: 140,
            render: (code) => (
                <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs text-gray-700 dark:text-gray-300">
                    {code}
                </code>
            ),
        },
        {
            title: "Đường dẫn",
            dataIndex: "path",
            key: "path",
            width: 160,
            render: (path) => (
                <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs text-gray-700 dark:text-gray-300">
                    {path}
                </code>
            ),
        },
        {
            title: "Nhóm",
            dataIndex: "groupName",
            key: "groupName",
            width: 120,
            render: (group) => (
                <Tag color={getGroupColor(group)} className="font-medium">
                    {getGroupLabel(group)}
                </Tag>
            ),
        },
        {
            title: "Trạng thái",
            dataIndex: "enabled",
            key: "enabled",
            width: 100,
            render: (enabled, record) => (
                <div className="flex items-center gap-2">
                    <Switch
                        checked={enabled}
                        onChange={() => handleToggleFeature(record.uuid, enabled)}
                        disabled={loading}
                        size="small"
                    />
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                        {enabled ? "Bật" : "Tắt"}
                    </span>
                </div>
            ),
        },
        {
            title: "Quyền hạn",
            key: "permissions",
            width: 220,
            render: (_, record) => (
                <div className="flex flex-wrap gap-1">
                    {record.requiresSuperAdmin && <Tag color="red" className="text-xs">Super Admin</Tag>}
                    {record.requiresWorkspaceAdmin && <Tag color="orange" className="text-xs">Workspace Admin</Tag>}
                    {!record.requiresSuperAdmin && !record.requiresWorkspaceAdmin && (
                        <span className="text-xs text-gray-400">-</span>
                    )}
                </div>
            ),
        },
        {
            title: "Thứ tự",
            dataIndex: "orderIndex",
            key: "orderIndex",
            width: 80,
            render: (orderIndex) => (
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {orderIndex ?? 0}
                </span>
            ),
        },
        {
            title: "Hành động",
            key: "actions",
            width: 100,
            fixed: "right",
            render: (_, record) => (
                <div className="flex gap-1">
                    <button
                        title={'Chỉnh sửa'}
                        onClick={() => handleEdit(record)} >
                    <ActionIcon
                        action="edit"

                    />
                    </button>
                    <button
                        title={'Xóa'}
                        onClick={() => handleDelete(record.uuid)}
                    >
                        <ActionIcon action='delete' />

                    </button>
                </div>
            ),
        },
    ], [handleToggleFeature, handleEdit, handleDelete, getGroupColor, getGroupLabel, loading]);

    return (
        <div className="space-y-4">

            <TitleSpace title={'Quản Lý Chức Năng'} actions={<ActionButton type={'create'} onClick={handleAddNew}/>}/>


            {/* Stats Section */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                    { label: "Tổng chức năng", value: features.length, color: "sky", icon: Settings2 },
                    { label: "Đã bật", value: enabledCount, color: "green", icon: RefreshCw },
                    { label: "Yêu cầu Super Admin", value: requiresSuperAdminCount, color: "red", icon: Settings2 },
                    { label: "Kết quả tìm kiếm", value: filteredFeatures.length, color: "blue", icon: SearchIcon },
                ].map((stat, index) => {
                    const Icon = stat.icon;
                    const colors = colorClasses[stat.color];
                    return (
                        <div key={index} className={`${cardClassName} p-4`}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.label}</p>
                                    <p className={`text-2xl font-bold ${colors.text}`}>
                                        {stat.value}
                                    </p>
                                </div>
                                <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${colors.bg}`}>
                                    <Icon className={`h-6 w-6 ${colors.text}`} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Search & Filter Section */}
            <div className={`${cardClassName} p-4`}>
                <AppInput
                    value={query}
                    onChange={(e) => setQuery(e)}
                    placeholder="Tìm kiếm theo tên, mã, đường dẫn hoặc nhóm..."

                />
            </div>

            {/* Table Section */}
            <div className={cardClassName}>
                <ConfigProvider
                    theme={{ components:
                            { Table:
                                    {
                                        headerBg: "#d4a574",
                                        headerSplitColor: "transparent",
                                        borderColor: "transparent",
                                        lineWidth: 0,
                                        cellPaddingBlock:16,
                                        cellPaddingInline: 16,
                                        headerBorderRadius: 4,
                                    }
                            }
                    }}>
                <Table
                    columns={columns}
                    dataSource={pagedFeatures}
                    loading={loading}
                    rowKey="uuid"
                    pagination={false}
                    scroll={{x: "max-content"}}
                />
                <AppPagination
                    currentPage={page}
                    totalPages={totalPages}
                    totalRows={filteredFeatures.length}
                    rowsPerPage={rowsPerPage}
                    rowsPerPageOptions={[5, 10, 20, 50]}
                    summaryLabel={`Tổng ${filteredFeatures.length} chức năng`}
                    onRowsPerPageChange={(value) => setRowsPerPage(value)}
                    onPageChange={(nextPage) => setPage(nextPage)}
                />
                </ConfigProvider>
            </div>

            <ActionModal
                open={isModalVisible}
                onCancel={() => {
                setIsModalVisible(false);
                setEditingFeature(null);
                form.resetFields();
            }}
                width={800}
                actions={<>
                    <ActionButton type={'close'} onClick={() => {
                        setIsModalVisible(false);
                        setEditingFeature(null);
                        form.resetFields();
                    }}/>
                    <ActionButton type={'save'} onClick={() => form.submit()}/>
                </>}
                title={editingFeature ? "Chỉnh sửa chức năng" : "Thêm chức năng mới"}
            >

                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                >
                    <Row gutter={[16,16]}>
                        <Col md={24} lg={12}><Form.Item
                            label="Tên chức năng"
                            name="name"
                            rules={[{ required: true, message: "Vui lòng nhập tên chức năng" }]}
                            className="mb-4"
                        >
                            <AppInput placeholder="Nhập tên chức năng" />
                        </Form.Item>
                        </Col>
                        <Col md={24} lg={12}><Form.Item
                            label="Mã chức năng"
                            name="code"
                            rules={[{ required: true, message: "Vui lòng nhập mã chức năng" }]}
                            className="mb-4"
                        >
                            <AppInput placeholder="Nhập mã chức năng" />
                        </Form.Item>
                        </Col>
                        <Col md={24} lg={12}><Form.Item
                            label="Đường dẫn"
                            name="path"
                            rules={[{ required: true, message: "Vui lòng nhập đường dẫn" }]}
                            className="mb-4"
                        >
                            <AppInput placeholder="vd: /admin/users" />
                        </Form.Item>
                        </Col>
                        <Col md={24} lg={12}><Form.Item
                            label="Nhóm"
                            name="groupName"
                            rules={[{ required: true, message: "Vui lòng chọn nhóm" }]}
                            className="mb-4"
                        >
                            <AppSelect
                                hideTitle
                                placeholder="Chọn nhóm"
                                options={FEATURE_GROUPS}
                            />
                        </Form.Item>
                        </Col>

                        <Col md={24} lg={12}><Form.Item label="Biểu tượng" name="icon" className="mb-4">
                            <AppInput placeholder="vd: GridIcon" />
                        </Form.Item>
                        </Col>
                        <Col md={24} lg={12}><Form.Item label="Thứ tự" name="orderIndex" className="mb-4">
                            <AppInput placeholder="0" type="number" />
                        </Form.Item>
                        </Col>
                        <Col md={24} lg={12}><Form.Item label="Workspace" name="workspaces" className="mb-4">
                            <WorkspaceSelect hideTitle multiple includeAllOption allOptionValue={'all'}/>
                        </Form.Item>
                        </Col>
                        <Col md={24} lg={24}><Form.Item
                            label="Mô tả"
                            name="description"
                            className="mb-4"
                        >
                            <AppInput type={'textarea'} placeholder="Nhập mô tả (không bắt buộc)" />
                        </Form.Item>
                        </Col>
                        <Divider />
                        <Col md={24} lg={8}><Form.Item name="enabled" valuePropName="checked" >
                            <Checkbox>Trạng thái</Checkbox>
                        </Form.Item>
                        </Col>
                        <Col md={24} lg={8}><Form.Item name="requiresSuperAdmin" valuePropName="checked" >
                            <Checkbox>Yêu cầu Super Admin</Checkbox>
                        </Form.Item>
                        </Col>
                        <Col md={24} lg={8}><Form.Item name="requiresWorkspaceAdmin" valuePropName="checked" className="mb-0">
                            <Checkbox>Yêu cầu Workspace Admin</Checkbox>
                        </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </ActionModal>


        </div>
    );
}

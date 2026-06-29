"use client";

import {api, ApiError} from "@/lib/api";
import {endpoints} from "@/lib/endpoints";
import {AppPagination} from "@/components/controller";
import {App, Button, Card, Checkbox, Empty, Input, Select, Spin, Table, Tag} from "antd";
import {ChevronLeft, RefreshCw, Save} from "lucide-react";
import {useRouter} from "next/navigation";
import {useCallback, useEffect, useMemo, useState} from "react";

type Role = {
    id?: number;
    name?: string;
    code?: string;
    description?: string;
    [key: string]: unknown;
};

type Feature = {
    uuid?: string;
    name?: string;
    code?: string;
    description?: string;
    icon?: string;
    path?: string;
    groupName?: string;
    enabled?: boolean;
    orderIndex?: number;
    [key: string]: unknown;
};

type RoleFeatureMapping = {
    featureId?: string;
    roleFeaturesCreatedAt?: string;
    feature?: Feature;
    [key: string]: unknown;
};

export default function QuanLyNhomQuyenChucNangPage() {
    const router = useRouter();
    const { notification } = App.useApp();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [roles, setRoles] = useState<Role[]>([]);
    const [availableFeatures, setAvailableFeatures] = useState<Feature[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
    const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(new Set());
    const [roleFeatures, setRoleFeatures] = useState<RoleFeatureMapping[]>([]);

    const [search, setSearch] = useState("");
    const [groupFilter, setGroupFilter] = useState<string | undefined>(undefined);
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const selectedRole = useMemo(() => {
        return roles.find((r) => r.id === selectedRoleId);
    }, [roles, selectedRoleId]);

    const featureGroups = useMemo(() => {
        const groups = new Map<string, Feature[]>();
        availableFeatures.forEach((feature) => {
            const group = feature.groupName || "Khác";
            if (!groups.has(group)) {
                groups.set(group, []);
            }
            groups.get(group)!.push(feature);
        });
        return groups;
    }, [availableFeatures]);

    const filteredFeatures = useMemo(() => {
        const filtered = availableFeatures.filter((feature) => {
            const nameMatch = feature.name?.toLowerCase().includes(search.toLowerCase());
            const codeMatch = feature.code?.toLowerCase().includes(search.toLowerCase());
            const groupMatch = !groupFilter || feature.groupName === groupFilter;
            return (nameMatch || codeMatch) && groupMatch;
        });
        return filtered;
    }, [availableFeatures, search, groupFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredFeatures.length / rowsPerPage));
    const pagedFeatures = useMemo(() => {
        const start = (page - 1) * rowsPerPage;
        return filteredFeatures.slice(start, start + rowsPerPage);
    }, [filteredFeatures, page, rowsPerPage]);

    useEffect(() => {
        setPage(1);
    }, [search, groupFilter, rowsPerPage, selectedRoleId]);

    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

    const loadInitialData = useCallback(async () => {
        setLoading(true);
        try {
            const [rolesRes, featuresRes] = await Promise.all([
                api.get<unknown>(`${endpoints.admin.roles}?page=1&limit=100`),
                api.get<unknown>(endpoints.admin.getAvailableFeatures),
            ]);

            const rolesList = extractList<Role>(rolesRes);
            const featuresList = extractList<Feature>(featuresRes);

            setRoles(rolesList);
            setAvailableFeatures(featuresList);

            if (rolesList.length > 0) {
                setSelectedRoleId(rolesList[0].id ?? null);
            }
        } catch (err) {
            notification.error({
                message: "Lỗi",
                description: err instanceof ApiError ? err.message : "Không thể tải dữ liệu",
            });
        } finally {
            setLoading(false);
        }
    }, [notification]);

    const loadRoleFeatures = useCallback(async (roleId: number) => {
        try {
            const res = await api.get<unknown>(`${endpoints.admin.getRoleFeatures(roleId)}`);
            const mappings = extractList<RoleFeatureMapping>(res);
            const featureIds = new Set(mappings.map((m) => m.featureId).filter(Boolean));
            setSelectedFeatures(featureIds as Set<string>);
            setRoleFeatures(mappings);
        } catch (err) {
            notification.error({
                message: "Lỗi",
                description: err instanceof ApiError ? err.message : "Không thể tải chức năng của nhóm",
            });
        }
    }, [notification]);

    useEffect(() => {
        loadInitialData();
    }, [loadInitialData]);

    useEffect(() => {
        if (selectedRoleId) {
            loadRoleFeatures(selectedRoleId);
        }
    }, [selectedRoleId, loadRoleFeatures]);

    const handleToggleFeature = (featureId: string, checked: boolean) => {
        const next = new Set(selectedFeatures);
        if (checked) {
            next.add(featureId);
        } else {
            next.delete(featureId);
        }
        setSelectedFeatures(next);
    };

    const handleSaveFeatures = async () => {
        if (!selectedRoleId) {
            notification.error({ message: "Lỗi", description: "Chưa chọn nhóm quyền" });
            return;
        }

        setSaving(true);
        try {
            await api.put(`${endpoints.admin.updateRoleFeatures(selectedRoleId)}`, {
                featureIds: Array.from(selectedFeatures),
            });

            notification.success({
                message: "Thành công",
                description: "Cập nhật chức năng cho nhóm quyền thành công",
            });

            await loadRoleFeatures(selectedRoleId);
        } catch (err) {
            notification.error({
                message: "Lỗi",
                description: err instanceof ApiError ? err.message : "Không thể cập nhật chức năng",
            });
        } finally {
            setSaving(false);
        }
    };

    const tableColumns = [
        {
            title: "",
            key: "select",
            width: 50,
            render: (_: unknown, record: Feature) => (
                <Checkbox
                    checked={selectedFeatures.has(record.uuid || "")}
                    onChange={(e) => handleToggleFeature(record.uuid || "", e.target.checked)}
                />
            ),
        },
        {
            title: "Tên Chức Năng",
            key: "name",
            render: (_: unknown, record: Feature) => (
                <div>
                    <div className="font-medium">{record.name}</div>
                    <div className="text-xs text-gray-500">{record.code}</div>
                </div>
            ),
        },
        {
            title: "Nhóm",
            key: "groupName",
            width: 150,
            render: (_: unknown, record: Feature) => (
                <Tag color="blue">{record.groupName}</Tag>
            ),
        },
        {
            title: "Mô Tả",
            key: "description",
            render: (_: unknown, record: Feature) => (
                <span className="text-sm text-gray-600">{record.description}</span>
            ),
        },
    ];

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="inline-flex items-center justify-center rounded-lg p-2 hover:bg-gray-100"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold">Quản Lý Chức Năng Nhóm Quyền</h1>
                        <p className="text-gray-500">Cấu hình chức năng được phép truy cập cho mỗi nhóm quyền</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-4 gap-6">
                {/* Role Selection */}
                <Card className="col-span-1 h-fit">
                    <div className="space-y-4">
                        <h2 className="font-semibold">Chọn Nhóm Quyền</h2>
                        <Spin spinning={loading}>
                            <div className="max-h-96 space-y-2 overflow-y-auto">
                                {roles.map((role) => (
                                    <button
                                        key={role.id}
                                        onClick={() => setSelectedRoleId(role.id ?? null)}
                                        className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${selectedRoleId === role.id
                                            ? "bg-blue-500 text-white font-medium"
                                            : "bg-gray-100 hover:bg-gray-200"
                                            }`}
                                    >
                                        {role.name}
                                    </button>
                                ))}
                            </div>
                        </Spin>
                    </div>
                </Card>

                {/* Feature Selection */}
                <Card className="col-span-3">
                    <Spin spinning={loading}>
                        <div className="space-y-4">
                            {selectedRole ? (
                                <>
                                    <div>
                                        <h2 className="text-lg font-semibold">{selectedRole.name}</h2>
                                        {selectedRole.description && (
                                            <p className="text-sm text-gray-600">{selectedRole.description}</p>
                                        )}
                                    </div>

                                    {/* Filters */}
                                    <div className="flex gap-3">
                                        <Input
                                            placeholder="Tìm kiếm chức năng..."
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            className="flex-1"
                                        />
                                        <Select
                                            placeholder="Lọc theo nhóm"
                                            allowClear
                                            value={groupFilter}
                                            onChange={setGroupFilter}
                                            style={{ width: 200 }}
                                            options={Array.from(featureGroups.keys()).map((group) => ({
                                                label: group,
                                                value: group,
                                            }))}
                                        />
                                        <Button
                                            type="primary"
                                            icon={<RefreshCw className="h-4 w-4" />}
                                            onClick={() => loadInitialData()}
                                        />
                                    </div>

                                    {/* Features Table */}
                                    {filteredFeatures.length > 0 ? (
                                        <>
                                            <Table
                                                columns={tableColumns}
                                                dataSource={pagedFeatures}
                                                rowKey={(record) => record.uuid || ""}
                                                pagination={false}
                                                size="small"
                                                style={{ maxHeight: 500, overflow: "auto" }}
                                            />
                                            <AppPagination
                                                currentPage={page}
                                                totalPages={totalPages}
                                                totalRows={filteredFeatures.length}
                                                rowsPerPage={rowsPerPage}
                                                rowsPerPageOptions={[5, 10, 20, 50]}
                                                summaryLabel={`Có ${filteredFeatures.length} chức năng`}
                                                onRowsPerPageChange={(value) => setRowsPerPage(value)}
                                                onPageChange={(nextPage) => setPage(nextPage)}
                                            />
                                        </>
                                    ) : (
                                        <Empty description="Không có chức năng" />
                                    )}

                                    {/* Save Button */}
                                    <div className="flex justify-end gap-2 border-t pt-4">
                                        <Button onClick={() => router.back()}>Hủy</Button>
                                        <Button
                                            type="primary"
                                            icon={<Save className="h-4 w-4" />}
                                            loading={saving}
                                            onClick={handleSaveFeatures}
                                        >
                                            Lưu Chức Năng
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <Empty description="Chọn nhóm quyền" />
                            )}
                        </div>
                    </Spin>
                </Card>
            </div>
        </div>
    );
}

function extractList<T = unknown>(data: unknown): T[] {
    if (Array.isArray(data)) return data as T[];
    if (data && typeof data === "object") {
        const obj = data as Record<string, unknown>;
        if (Array.isArray(obj.data)) return obj.data as T[];
        if (Array.isArray(obj.list)) return obj.list as T[];
    }
    return [];
}

"use client";

import {api, ApiError} from "@/lib/api";
import {getAccount} from "@/lib/auth";
import {extractList, getRowId} from "@/lib/data-utils";
import {endpoints} from "@/lib/endpoints";
import {ChevronDown, ChevronRight, ShieldCheck,} from "lucide-react";
import {App, Col, ConfigProvider, Empty, Row, Select, Table, Tag} from "antd";
import {useCallback, useEffect, useMemo, useState} from "react";
import ActionIcon from "@/components/controller/ActionIcon";
import {
    ActionButton,
    ActionModal,
    AppPagination,
    AppInput,
    ConfirmModal,
    FilterSpace,
    SearchBox,
    TitleSpace,
} from "@/components/controller";

type Role = {
    id?: string | number;
    uuid?: string;
    name?: string;
    code?: string;
    description?: string;
    status?: string;
    [key: string]: unknown;
};

type Permission = {
    id?: string | number;
    uuid?: string;
    name?: string;
    code?: string;
    [key: string]: unknown;
};

type RolePermission = {
    roleId?: string | number;
    permissionId?: string | number;
    role?: { id?: string | number; uuid?: string };
    permission?: { id?: string | number; uuid?: string };
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

type PaginationMeta = {
    page: number;
    limit: number;
    total: number;
    pages: number;
};

function parsePositiveInt(value: unknown): number | null {
    if (typeof value === "number" && Number.isInteger(value) && value > 0) {
        return value;
    }

    const str = String(value ?? "").trim();
    if (!/^\d+$/.test(str)) {
        return null;
    }

    const parsed = Number(str);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeStatus(value: unknown): string {
    const raw = String(value ?? "").trim().toLowerCase();
    if (["inactive", "disabled", "ngung", "ngưng"].includes(raw)) {
        return "Ngưng";
    }
    return "Hoạt động";
}

function extractPagination(input: unknown): PaginationMeta | null {
    if (!input || typeof input !== "object") {
        return null;
    }
    const root = input as Record<string, unknown>;
    const data = root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : root;
    const pagination =
        data.pagination && typeof data.pagination === "object"
            ? (data.pagination as Record<string, unknown>)
            : null;
    if (!pagination) {
        return null;
    }
    return {
        page: Number(pagination.page ?? 1) || 1,
        limit: Number(pagination.limit ?? 10) || 10,
        total: Number(pagination.total ?? 0) || 0,
        pages: Number(pagination.pages ?? 1) || 1,
    };
}

function permissionGroupPrefix(permission: Permission): string {
    const rawCode = String(permission.code ?? "").trim().toLowerCase();
    if (!rawCode) {
        return "khac";
    }
    const [prefix] = rawCode.split(".");
    return prefix || "khac";
}

function isSuperAdminRole(role: Role): boolean {
    return String(role.code ?? "").trim().toUpperCase() === "SUPER_ADMIN";
}

async function resolveRoleNumericIdAfterCreate(code: string, name: string): Promise<number | null> {
    const searchKeyword = code.trim() || name.trim();
    if (!searchKeyword) {
        return null;
    }

    const params = new URLSearchParams({
        page: "1",
        limit: "20",
        search: searchKeyword,
        sortBy: "createdAt",
        sortOrder: "desc",
    });

    const response = await api.get<unknown>(`${endpoints.admin.roles}?${params.toString()}`);
    const roleItems = extractList<Role>(response);

    const matchedRole = roleItems.find((item) => {
        const itemCode = String(item.code ?? "").trim().toLowerCase();
        const itemName = String(item.name ?? "").trim().toLowerCase();

        return (
            itemCode === code.trim().toLowerCase() ||
            (itemCode === code.trim().toLowerCase() && itemName === name.trim().toLowerCase())
        );
    });

    return parsePositiveInt(matchedRole?.id) ?? null;
}

export default function QuanLyNhomQuyenPage() {
    const currentAccount = useMemo(() => getAccount(), []);
    const isSuperAdmin = Boolean(currentAccount?.isSuperAdmin);
    const [roles, setRoles] = useState<Role[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [features, setFeatures] = useState<Feature[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const { notification } = App.useApp();

    const [search, setSearch] = useState("");
    const [searchDraft, setSearchDraft] = useState("");
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalRoles, setTotalRoles] = useState(0);

    const [showModal, setShowModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingRoleNumericId, setEditingRoleNumericId] = useState<number | null>(null);
    const [editingExistingPermissionIds, setEditingExistingPermissionIds] = useState<Set<number>>(new Set());
    const [editingExistingFeatureIds, setEditingExistingFeatureIds] = useState<Set<string>>(new Set());

    const [activeTab, setActiveTab] = useState<"permissions" | "features">("permissions");

    const [formValues, setFormValues] = useState<Record<string, string>>({
        code: "",
        name: "",
        status: "Hoạt động",
        description: "",
    });
    const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
    const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(new Set());
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [permissionSearch, setPermissionSearch] = useState("");
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

    const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);

    const permissionCanonicalKeyByAnyId = useMemo(() => {
        const map = new Map<string, string>();
        permissions.forEach((permission) => {
            const canonical = getRowId(permission);
            if (!canonical) {
                return;
            }

            [permission.id, permission.uuid, canonical]
                .map((value) => String(value ?? "").trim())
                .filter(Boolean)
                .forEach((value) => map.set(value, canonical));
        });
        return map;
    }, [permissions]);

    const permissionNumericIdByCanonicalKey = useMemo(() => {
        const map = new Map<string, number>();
        permissions.forEach((permission) => {
            const canonical = getRowId(permission);
            const permissionId = parsePositiveInt(permission.id);
            if (canonical && permissionId) {
                map.set(canonical, permissionId);
            }
        });
        return map;
    }, [permissions]);

    const loadData = useCallback(async () => {
        setLoading(true);

        try {
            const roleParams = new URLSearchParams({
                page: String(page),
                limit: String(rowsPerPage),
                sortBy: "createdAt",
                sortOrder: "desc",
            });
            if (search.trim()) {
                roleParams.set("search", search.trim());
            }

            const [rolesData, permissionsData, featuresData] = await Promise.all([
                api.get<unknown>(`${endpoints.admin.roles}?${roleParams.toString()}`),
                api.get<unknown>(`${endpoints.admin.permissions}?page=1&limit=100`),
                api.get<unknown>(endpoints.admin.getAvailableFeatures),
            ]);

            const roleItems = extractList<Role>(rolesData);
            const rolePagination = extractPagination(rolesData);
            setRoles(roleItems);
            setPermissions(extractList<Permission>(permissionsData));
            setFeatures(extractList<Feature>(featuresData));
            setTotalRoles(rolePagination?.total ?? roleItems.length);
        } catch (err) {
            if (err instanceof ApiError) {
                notification.error({
                    title: "Lỗi",
                    description: err.message,
                });
            } else {
                notification.error({
                    title: "Lỗi",
                    description: "Không thể tải dữ liệu nhóm quyền.",
                });
            }
            setRoles([]);
            setPermissions([]);
            setTotalRoles(0);
        } finally {
            setLoading(false);
        }
    }, [notification, page, rowsPerPage, search]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const totalPages = Math.max(1, Math.ceil(totalRoles / rowsPerPage));

    useEffect(() => {
        setPage(1);
    }, [rowsPerPage]);

    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

    const visibleRoles = useMemo(() => {
        if (isSuperAdmin) {
            return roles;
        }
        return roles.filter((role) => !isSuperAdminRole(role));
    }, [isSuperAdmin, roles]);

    const visiblePermissions = useMemo(() => {
        if (isSuperAdmin) {
            return permissions;
        }
        return permissions.filter((permission) => {
            const prefix = permissionGroupPrefix(permission);
            return prefix !== "audit" && prefix !== "workspace";
        });
    }, [isSuperAdmin, permissions]);

    const visiblePermissionKeys = useMemo(
        () => visiblePermissions.map((permission) => getRowId(permission)).filter(Boolean),
        [visiblePermissions]
    );

    const allPermissionKeys = useMemo(
        () => visiblePermissionKeys,
        [visiblePermissionKeys]
    );

    const filteredPermissions = useMemo(() => {
        const keyword = permissionSearch.trim().toLowerCase();
        if (!keyword) {
            return visiblePermissions;
        }

        return visiblePermissions.filter((permission) => {
            const code = String(permission.code ?? "").toLowerCase();
            const name = String(permission.name ?? "").toLowerCase();
            return code.includes(keyword) || name.includes(keyword);
        });
    }, [permissionSearch, visiblePermissions]);

    const groupedPermissions = useMemo(() => {
        const grouped = new Map<string, Permission[]>();
        filteredPermissions.forEach((permission) => {
            const prefix = permissionGroupPrefix(permission);
            const bucket = grouped.get(prefix) || [];
            bucket.push(permission);
            grouped.set(prefix, bucket);
        });

        return Array.from(grouped.entries())
            .sort(([a], [b]) => a.localeCompare(b, "vi"))
            .map(([prefix, items]) => ({
                prefix,
                items: [...items].sort((left, right) =>
                    String(left.code ?? getRowId(left)).localeCompare(String(right.code ?? getRowId(right)), "vi")
                ),
            }));
    }, [filteredPermissions]);

    const selectedPermissionCount = useMemo(
        () => visiblePermissionKeys.filter((permissionKey) => selectedPermissions.has(permissionKey)).length,
        [selectedPermissions, visiblePermissionKeys]
    );

    const openCreateModal = () => {
        setIsEditMode(false);
        setEditingId(null);
        setEditingRoleNumericId(null);
        setEditingExistingPermissionIds(new Set());
        setEditingExistingFeatureIds(new Set());
        setFormValues({ code: "", name: "", status: "Hoạt động", description: "" });
        setSelectedPermissions(new Set());
        setSelectedFeatures(new Set());
        setFormErrors({});
        setPermissionSearch("");
        setCollapsedGroups(new Set());
        setActiveTab("permissions");
        setShowModal(true);
    };

    const openEditModal = useCallback(async (role: Role) => {
        const roleKey = getRowId(role);
        const roleNumericId = parsePositiveInt(role.id);

        setIsEditMode(true);
        setEditingId(roleKey);
        setEditingRoleNumericId(roleNumericId);
        setEditingExistingPermissionIds(new Set());
        setEditingExistingFeatureIds(new Set());
        setFormValues({
            code: String(role.code ?? ""),
            name: String(role.name ?? ""),
            status: normalizeStatus(role.status),
            description: String(role.description ?? ""),
        });
        setSelectedPermissions(new Set());
        setSelectedFeatures(new Set());
        setFormErrors({});
        setPermissionSearch("");
        setCollapsedGroups(new Set());
        setActiveTab("permissions");
        setShowModal(true);

        if (!roleNumericId) {
            return;
        }

        try {
            const [mappingData, featureData] = await Promise.all([
                api.get<unknown>(
                    `${endpoints.admin.rolePermissions}?roleId=${roleNumericId}&page=1&limit=100&sortBy=permissionId&sortOrder=asc`
                ),
                api.get<unknown>(`/admin/roles/${roleNumericId}/features`),
            ]);

            const mappings = extractList<RolePermission>(mappingData);
            const roleFeatureMappings = extractList<Record<string, unknown>>(featureData);

            const existingIds = new Set<number>();
            const selectedCanonicalKeys = new Set<string>();

            mappings.forEach((mapping) => {
                const permissionId = parsePositiveInt(mapping.permissionId ?? mapping.permission?.id);
                if (permissionId) {
                    existingIds.add(permissionId);
                }

                [mapping.permissionId, mapping.permission?.id, mapping.permission?.uuid]
                    .map((value) => String(value ?? "").trim())
                    .filter(Boolean)
                    .forEach((idLike) => {
                        const canonical = permissionCanonicalKeyByAnyId.get(idLike);
                        if (canonical) {
                            selectedCanonicalKeys.add(canonical);
                        }
                    });
            });

            const existingFeatureIds = new Set<string>(
                roleFeatureMappings
                    .map((mapping) => {
                        const record = mapping as Record<string, unknown>;
                        const featureRecord = record.feature as Record<string, unknown> | undefined;
                        const featureId = record.featureId ?? featureRecord?.uuid;
                        return typeof featureId === "string" ? featureId : "";
                    })
                    .filter(Boolean)
            );

            setEditingExistingPermissionIds(existingIds);
            setSelectedPermissions(selectedCanonicalKeys);
            setEditingExistingFeatureIds(existingFeatureIds);
            setSelectedFeatures(existingFeatureIds);
        } catch (err) {
            if (err instanceof ApiError) {
                setFormErrors({ submit: err.message });
            } else {
                setFormErrors({ submit: "Không thể tải thông tin của nhóm đang sửa." });
            }
        }
    }, [permissionCanonicalKeyByAnyId]);

    const validateForm = (): boolean => {
        const nextErrors: Record<string, string> = {};

        if (!formValues.code?.trim()) {
            nextErrors.code = "Mã nhóm quyền không được để trống";
        }

        if (!formValues.name?.trim()) {
            nextErrors.name = "Tên nhóm quyền không được để trống";
        }

        setFormErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const syncRolePermissions = async (roleId: unknown): Promise<void> => {
        // Strict validation - ensure roleId is a positive integer
        const roleIdNum = typeof roleId === "number" && Number.isInteger(roleId) && roleId > 0 ? roleId : null;

        if (!roleIdNum) {
            console.warn("Cannot sync permissions: invalid roleId", { receivedValue: roleId, type: typeof roleId });
            return;
        }

        const nextPermissionIds = new Set<number>();

        selectedPermissions.forEach((permissionCanonicalKey) => {
            const permissionId = permissionNumericIdByCanonicalKey.get(permissionCanonicalKey);
            if (permissionId && Number.isInteger(permissionId) && permissionId > 0) {
                nextPermissionIds.add(permissionId);
            }
        });

        const toCreate = [...nextPermissionIds].filter((id) => !editingExistingPermissionIds.has(id));
        const toDelete = [...editingExistingPermissionIds].filter((id) => !nextPermissionIds.has(id));

        if (toCreate.length > 0) {
            console.debug(`Syncing ${toCreate.length} permissions for roleId=${roleIdNum}`);
            await Promise.all(
                toCreate.map((permissionId) => {
                    console.debug(`Creating role permission: roleId=${roleIdNum}, permissionId=${permissionId}`);
                    return api.post<unknown>(endpoints.admin.rolePermissions, {
                        roleId: roleIdNum,
                        permissionId: permissionId,
                    });
                })
            );
        }

        if (toDelete.length > 0) {
            console.debug(`Deleting ${toDelete.length} permissions for roleId=${roleIdNum}`);
            await Promise.all(
                toDelete.map((permissionId) => {
                    console.debug(`Deleting role permission: roleId=${roleIdNum}, permissionId=${permissionId}`);
                    return api.delete<unknown>(`${endpoints.admin.rolePermissions}/${roleIdNum}/${permissionId}`);
                })
            );
        }
    };

    const syncRoleFeatures = async (roleId: unknown): Promise<void> => {
        // Strict validation - ensure roleId is a positive integer
        const roleIdNum = typeof roleId === "number" && Number.isInteger(roleId) && roleId > 0 ? roleId : null;

        if (!roleIdNum) {
            console.warn("Cannot sync features: invalid roleId", { receivedValue: roleId, type: typeof roleId });
            return;
        }

        // Only sync if there are actual changes
        if (selectedFeatures.size === 0 && editingExistingFeatureIds.size === 0) {
            console.debug("No feature changes to sync");
            return;
        }

        try {
            const featureIds = Array.from(selectedFeatures);
            console.debug(`Syncing ${featureIds.length} features for roleId=${roleIdNum}`, { featureIds });

            await api.put(`/admin/roles/${roleIdNum}/features`, {
                featureIds: featureIds,
            });
        } catch (err) {
            console.error("Failed to sync role features:", err);
            throw err;
        }
    };

    const handleCreateOrUpdate = async () => {
        if (!validateForm()) {
            return;
        }

        setSaving(true);

        try {
            const payload = {
                code: formValues.code.trim(),
                name: formValues.name.trim(),
                status: formValues.status || "Hoạt động",
                description: formValues.description?.trim() || "",
            };

            let roleNumericId: number | null = editingRoleNumericId;

            if (isEditMode && editingId) {
                console.debug("Editing role", { editingId, roleNumericId });
                await api.patch<unknown>(`${endpoints.admin.roles}/${editingId}`, payload);
            } else {
                console.debug("Creating new role");
                const created = await api.post<unknown>(endpoints.admin.roles, payload);

                // Handle single item response { data: { item: {...} } }
                let createdRole: Record<string, unknown> | null = null;

                if (created && typeof created === "object") {
                    const createdObj = created as Record<string, unknown>;

                    // Check for data.item (single item response)
                    if (createdObj.data && typeof createdObj.data === "object") {
                        const dataObj = createdObj.data as Record<string, unknown>;
                        if (dataObj.item && typeof dataObj.item === "object") {
                            createdRole = dataObj.item as Record<string, unknown>;
                        }
                    }
                }

                if (!createdRole) {
                    console.warn("Could not extract created role from response", { created });
                } else {
                    console.debug("Role created, extracting ID", { createdRole });

                    // Try to get numeric ID from response with multiple fallbacks
                    roleNumericId =
                        parsePositiveInt(createdRole.id) ||
                        parsePositiveInt(createdRole.numericId) ||
                        null;

                    if (!roleNumericId) {
                        console.warn("Created role but could not extract numeric ID", {
                            createdRole,
                            attemptedFields: {
                                id: createdRole.id,
                                numericId: createdRole.numericId,
                                allKeys: Object.keys(createdRole)
                            }
                        });
                    } else {
                        console.debug("Successfully extracted roleId", { roleNumericId });
                    }
                }

                if (!roleNumericId) {
                    roleNumericId = await resolveRoleNumericIdAfterCreate(payload.code, payload.name);
                }
            }

            // Sync permissions and features only if we have a valid roleNumericId
            if (roleNumericId && typeof roleNumericId === "number" && Number.isInteger(roleNumericId) && roleNumericId > 0) {
                console.debug("About to sync permissions and features with valid roleId", { roleNumericId });
                try {
                    await syncRolePermissions(roleNumericId);
                    await syncRoleFeatures(roleNumericId);
                    console.debug("Sync completed successfully");
                } catch (syncErr) {
                    console.error("Error syncing permissions/features:", syncErr);
                    // Don't throw here, still show success message as role was created
                }
            } else {
                console.warn("Skipping sync: invalid or missing roleNumericId", {
                    roleNumericId,
                    isValid: roleNumericId && typeof roleNumericId === "number" && Number.isInteger(roleNumericId) && roleNumericId > 0
                });
            }

            notification.success({
                title: "Thành công",
                description: isEditMode ? "Cập nhật nhóm quyền thành công." : "Tạo nhóm quyền thành công.",
            });
            setShowModal(false);
            setEditingId(null);
            setEditingRoleNumericId(null);
            setEditingExistingPermissionIds(new Set());
            setEditingExistingFeatureIds(new Set());
            setSelectedPermissions(new Set());
            setSelectedFeatures(new Set());
            setFormValues({ code: "", name: "", status: "Hoạt động", description: "" });
            await loadData();
        } catch (err) {
            if (err instanceof ApiError) {
                setFormErrors({ submit: err.message });
            } else {
                setFormErrors({ submit: isEditMode ? "Không thể cập nhật nhóm quyền." : "Không thể tạo nhóm quyền." });
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteRole = async () => {
        if (!deleteTarget) {
            return;
        }

        setSaving(true);

        try {
            await api.delete<unknown>(`${endpoints.admin.roles}/${deleteTarget.id}`);
            setDeleteTarget(null);
            notification.success({
                title: "Thành công",
                description: "Đã xóa nhóm quyền.",
            });
            await loadData();
        } catch (err) {
            if (err instanceof ApiError) {
                notification.error({
                    title: "Lỗi",
                    description: err.message,
                });
            } else {
                notification.error({
                    title: "Lỗi",
                    description: "Không thể xóa nhóm quyền.",
                });
            }
        } finally {
            setSaving(false);
        }
    };

    const onTogglePermission = (permissionKey: string) => {
        setSelectedPermissions((prev) => {
            const next = new Set(prev);
            if (next.has(permissionKey)) {
                next.delete(permissionKey);
            } else {
                next.add(permissionKey);
            }
            return next;
        });
    };

    const onToggleGroupPermissions = (permissionKeys: string[], checked: boolean) => {
        setSelectedPermissions((prev) => {
            const next = new Set(prev);
            permissionKeys.forEach((permissionKey) => {
                if (checked) {
                    next.add(permissionKey);
                } else {
                    next.delete(permissionKey);
                }
            });
            return next;
        });
    };

    const onToggleGroupCollapse = (groupPrefix: string) => {
        setCollapsedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(groupPrefix)) {
                next.delete(groupPrefix);
            } else {
                next.add(groupPrefix);
            }
            return next;
        });
    };

    const onSelectAllPermissions = () => {
        setSelectedPermissions(new Set(allPermissionKeys));
    };

    const onClearAllPermissions = () => {
        setSelectedPermissions(new Set());
    };

    const handleSearch = () => {
        const nextSearch = searchDraft.trim();

        if (page !== 1) {
            setPage(1);
        }

        if (nextSearch !== search) {
            setSearch(nextSearch);
            return;
        }

        void loadData();
    };

    const columns = useMemo(() => [
        {
            key: "stt",
            title: "STT",
            align: "center" as const,
            render: (_: unknown, __: Role, index: number) => ((page - 1) * rowsPerPage) + index + 1,
        },
        {
            key: "code",
            dataIndex: "code",
            title: "Mã nhóm",
            render: (value: Role["code"]) => value || "-",
        },
        {
            key: "name",
            dataIndex: "name",
            title: "Tên nhóm",
            render: (value: Role["name"]) => value || "-",
        },
        {
            key: "description",
            dataIndex: "description",
            title: "Mô tả",
            render: (value: Role["description"]) => value || "-",
        },
        {
            key: "status",
            dataIndex: "status",
            title: "Trạng thái",
            render: (value: Role["status"]) => {
                const status = normalizeStatus(value);

                return status === "Hoạt động"
                    ? <Tag color="success">Hoạt động</Tag>
                    : <Tag>Ngưng</Tag>;
            },
        },
        {
            key: "actions",
            title: "Hành động",
            render: (_: unknown, record: Role) => {
                const roleId = getRowId(record);
                const label = String(record.name || record.code || roleId);

                return (
                    <div className={'flex gap-1'}>
                        <button type="button" onClick={() => void openEditModal(record)}>
                            <ActionIcon action="edit"/>
                        </button>
                        <button type="button" onClick={() => setDeleteTarget({ id: roleId, label })}>
                            <ActionIcon action="delete"/>
                        </button>
                    </div>
                );
            },
        },
    ], [openEditModal, page, rowsPerPage]);

    return (
            <Row gutter={[16, 16]}>
                <Col span={24}>
                    <TitleSpace
                        title="Quản Lý Nhóm Quyền"
                        description="Quản lý vai trò, quyền hạn và chức năng truy cập của hệ thống."
                        actions={<ActionButton type="create" onClick={openCreateModal} />}
                    />
                </Col>

                <Col span={24}>
                    <FilterSpace
                        responsive={{ xs: 24, md: 24, lg: 12 }}
                        actionsPosition="bottom-right"
                        actions={
                            <>
                                <ActionButton type="refresh" variant="outlined" onClick={() => void loadData()} />
                                <ActionButton type="search" onClick={handleSearch} />
                            </>
                        }
                    >
                        <SearchBox
                            value={searchDraft}
                            onChange={setSearchDraft}
                            placeholder="Tìm theo mã, tên, mô tả"
                            bold
                        />
                    </FilterSpace>
                </Col>

                <Col span={24}>
                    <ConfigProvider
                theme={{
                    components: {
                        Table: {
                            headerBg: "#d4a574",
                            headerSplitColor: "transparent",
                            borderColor: "transparent",
                            lineWidth: 0,
                            cellPaddingBlock: 16,
                            cellPaddingInline: 16,
                            headerBorderRadius: 4,
                        },
                    },
                }}
                    >
                        <Table
                            size="small"
                            rowKey={(record) => getRowId(record)}
                            columns={columns}
                            dataSource={visibleRoles}
                            loading={loading}
                            pagination={false}
                            locale={{ emptyText: <Empty description="Không có nhóm quyền phù hợp." /> }}
                            scroll={{ x: "max-content" }}
                        />
                        <AppPagination
                            currentPage={page}
                            totalPages={totalPages}
                            totalRows={totalRoles}
                            rowsPerPage={rowsPerPage}
                            rowsPerPageOptions={[5, 10, 20, 50]}
                            onRowsPerPageChange={(value) => setRowsPerPage(value)}
                            onPageChange={(nextPage) => setPage(nextPage)}
                        />
                    </ConfigProvider>
                </Col>

                <Col span={24}>
                    <ActionModal
                open={showModal}
                title={isEditMode ? "Cập nhật" : "Thêm mới"}
                width={980}
                spinning={saving}
                onCancel={() => setShowModal(false)}
                onOk={() => {
                    void handleCreateOrUpdate();
                }}
                okText={isEditMode ? "Lưu thay đổi" : "Tạo nhóm"}
                cancelText="Hủy"
            >
                {formErrors.submit ? (
                    <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                        {formErrors.submit}
                    </p>
                ) : null}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                        <AppInput
                            title="Mã nhóm quyền"
                            required
                            type="text"
                            value={formValues.code || ""}
                            onChange={(value) => setFormValues((prev) => ({ ...prev, code: value }))}
                        />
                        {formErrors.code ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.code}</p> : null}
                    </div>

                    <div>
                        <AppInput
                            title="Tên nhóm quyền"
                            required
                            type="text"
                            value={formValues.name || ""}
                            onChange={(value) => setFormValues((prev) => ({ ...prev, name: value }))}
                        />
                        {formErrors.name ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.name}</p> : null}
                    </div>

                    <div>
                        <label className="block w-full">
                            <span className="block text-sm mb-1" style={{fontWeight: 400}}>Trạng thái</span>
                            <Select
                                value={formValues.status || "Hoạt động"}
                                onChange={(value) => setFormValues((prev) => ({ ...prev, status: value }))}
                                options={[
                                    { label: "Hoạt động", value: "Hoạt động" },
                                    { label: "Ngưng", value: "Ngưng" },
                                ]}
                                style={{ width: '100%' }}
                                size="large"
                            />
                        </label>
                    </div>

                    <div className="md:col-span-2">
                        <AppInput
                            title="Mô tả"
                            type="textarea"
                            value={formValues.description || ""}
                            onChange={(value) => setFormValues((prev) => ({ ...prev, description: value }))}
                        />
                    </div>
                </div>

                        {/* Tabs */}
                        <div className="mt-4 flex gap-2 border-b border-gray-200 dark:border-gray-700">
                            <button
                                type="button"
                                onClick={() => setActiveTab("permissions")}
                                className={`px-4 py-2 text-sm font-medium transition ${activeTab === "permissions"
                                    ? "border-b-2 border-amber-600 text-amber-600 dark:border-amber-500 dark:text-amber-400"
                                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                                    }`}
                            >
                                🔐 Quyền
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("features")}
                                className={`px-4 py-2 text-sm font-medium transition ${activeTab === "features"
                                    ? "border-b-2 border-amber-600 text-amber-600 dark:border-amber-500 dark:text-amber-400"
                                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                                    }`}
                            >
                                ⚙️ Chức Năng
                            </button>
                        </div>

                        {/* Permissions Tab */}
                        {activeTab === "permissions" ? (
                            <div className="mt-4 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                                <div className="mb-2 flex items-center justify-between">
                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Quyền áp dụng</p>
                                    <div className="flex items-center gap-2">
                                        <p className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                            <ShieldCheck className="h-3.5 w-3.5" />
                                            Đã chọn: {selectedPermissionCount}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={onSelectAllPermissions}
                                            className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                                        >
                                            Chọn tất cả
                                        </button>
                                        <button
                                            type="button"
                                            onClick={onClearAllPermissions}
                                            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                                        >
                                            Hủy tất cả
                                        </button>
                                    </div>
                                </div>

                                <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/40">
                                    <div className="mb-2">
                                        <SearchBox
                                            value={permissionSearch}
                                            onChange={setPermissionSearch}
                                            placeholder="Tìm theo mã quyền hoặc tên quyền"
                                            hideTitle
                                        />
                                    </div>
                                    {visiblePermissions.length === 0 ? (
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Không có quyền khả dụng.</p>
                                    ) : (
                                        groupedPermissions.map((group) => (
                                            <div key={group.prefix} className="rounded-lg border border-gray-200 bg-white/80 p-2 dark:border-gray-700 dark:bg-gray-900/50">
                                                {(() => {
                                                    const groupPermissionKeys = group.items
                                                        .map((permission) => getRowId(permission))
                                                        .filter(Boolean);
                                                    const selectedCount = groupPermissionKeys.filter((key) => selectedPermissions.has(key)).length;
                                                    const allSelected = groupPermissionKeys.length > 0 && selectedCount === groupPermissionKeys.length;
                                                    const collapsed = collapsedGroups.has(group.prefix);

                                                    return (
                                                        <>
                                                            <div className="mb-1 flex items-center justify-between gap-2 px-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onToggleGroupCollapse(group.prefix)}
                                                                    className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
                                                                >
                                                                    {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                                                    {group.prefix}
                                                                </button>

                                                                <label className="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={allSelected}
                                                                        onChange={(event) => onToggleGroupPermissions(groupPermissionKeys, event.target.checked)}
                                                                        className="h-3.5 w-3.5"
                                                                    />
                                                                    Chọn nhóm ({selectedCount}/{groupPermissionKeys.length})
                                                                </label>
                                                            </div>

                                                            {!collapsed ? (
                                                                <div className="space-y-1">
                                                                    {group.items.map((permission) => {
                                                                        const permissionKey = getRowId(permission);
                                                                        const checked = selectedPermissions.has(permissionKey);

                                                                        return (
                                                                            <label key={permissionKey} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={checked}
                                                                                    onChange={() => onTogglePermission(permissionKey)}
                                                                                    className="h-4 w-4"
                                                                                />
                                                                                <span className="font-medium text-gray-800 dark:text-gray-100">{permission.code || permissionKey}</span>
                                                                                <span className="text-gray-500 dark:text-gray-400">- {permission.name || "Không tên"}</span>
                                                                            </label>
                                                                        );
                                                                    })}
                                                                </div>
                                                            ) : null}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ) : null}

                        {/* Features Tab */}
                        {activeTab === "features" ? (
                            <div className="mt-4 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                                <div className="mb-2 flex items-center justify-between">
                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Chức năng được phép truy cập</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Đã chọn: {selectedFeatures.size}</p>
                                </div>

                                <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/40">
                                    {features.length === 0 ? (
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Không có chức năng khả dụng.</p>
                                    ) : (
                                        features.map((feature) => {
                                            const featureId = String(feature.uuid ?? "");
                                            const isChecked = selectedFeatures.has(featureId);
                                            return (
                                                <label key={featureId} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={(e) => {
                                                            const nextFeatures = new Set(selectedFeatures);
                                                            if (e.target.checked) {
                                                                nextFeatures.add(featureId);
                                                            } else {
                                                                nextFeatures.delete(featureId);
                                                            }
                                                            setSelectedFeatures(nextFeatures);
                                                        }}
                                                        className="h-4 w-4"
                                                    />
                                                    <span className="font-medium text-gray-800 dark:text-gray-100">{feature.name || featureId}</span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">({feature.groupName})</span>
                                                </label>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        ) : null}

                    </ActionModal>
                </Col>
                <ConfirmModal
                    open={Boolean(deleteTarget)}
                    title="Xác nhận xóa nhóm quyền"
                    variant="danger"
                    loading={saving}
                    spinning={saving}
                    okText="Xóa"
                    cancelText="Hủy"
                    onOk={() => {
                        void handleDeleteRole();
                    }}
                    onCancel={() => setDeleteTarget(null)}
                    content={deleteTarget ? (
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            Bạn có chắc muốn xóa nhóm quyền <span className="font-semibold text-gray-900 dark:text-white">{deleteTarget.label}</span>?
                        </p>
                    ) : null}
                />
            </Row>
    );
}

"use client";

import {api, ApiError} from "@/lib/api";
import { getAccountEmailValidationMessage, isValidAccountEmailInput, normalizeAccountEmail } from "@/lib/accountEmail";
import {extractList, getCategoryLabel, getRowId} from "@/lib/data-utils";
import {endpoints} from "@/lib/endpoints";
import {getOrganizationId as getCurrentOrganizationId, getWorkspaceId} from "@/lib/auth";
import {useCallback, useEffect, useMemo, useState} from "react";
import {ChevronDown, ChevronRight, Search} from "lucide-react";
import {TreeSelect} from "antd";
import ActionIcon from "@/components/controller/ActionIcon";
import TitleSpace from "@/components/controller/space/TitleSpace";
import ActionButton from "@/components/controller/ActionButton";
import SearchBox from "@/components/controller/input/SearchBox";
import Select from "@/components/controller/input/Select";
import {ActionModal, AppInput, AppPagination, AppSelect, ConfirmModal, FilterSpace, ViewModal,} from "@/components/controller";
import {AppSpinner} from "@/components/app/AppSpinner";

export type DataRow = Record<string, unknown>;

export type SelectOption = {
    label: string;
    value: string;
};

export type FormField = {
    key: string;
    label: string;
    type: "text" | "email" | "tel" | "password" | "textarea" | "select"| "number"| "boolean";
    required?: boolean;
    placeholder?: string;
    options?: SelectOption[];
    valueType?: "string" | "boolean" | "number";
};

export type PageConfig = {
    title: string;
    endpoint: string;
    formFields: FormField[];
    dynamicCategoryId?: string;
    dynamicWorkspaceId?: string | null;
};

export type OrganizationHierarchy = {
    childrenByParent: Map<string, DataRow[]>;
    idToItem: Map<string, DataRow>;
};

export type TreeSelectNode = {
    value: string;
    label: string;
    children: TreeSelectNode[];
    disabled?: boolean;
};

export type VisibleOrganizationRow = {
    item: DataRow;
    depth: number;
    rowNumber: string;
};

type PaginationSummary = {
    total: number;
    pages: number;
};

const technicalFields = new Set([
    "id",
    "uuid",
    "_id",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "categoryId",
    "category_id",
    "categoryUUID",
    "categoryUuid",
]);

const vietnameseLabels: Record<string, string> = {
    username: "Tên đăng nhập",
    fullName: "Họ và tên",
    email: "Email",
    phone: "Số điện thoại",
    unit: "Đơn vị",
    position: "Chức vụ",
    status: "Trạng thái",
    name: "Tên",
    code: "Mã",
    description: "Mô tả",
    title: "Tiêu đề",
    value: "Giá trị",
    note: "Ghi chú",
    address: "Địa chỉ",
    provinceCode: "Mã tỉnh/thành",
    provinceName: "Tỉnh/Thành phố",
    wardCode: "Mã xã/phường",
    wardName: "Xã/Phường",
    areaId: "Mã khu vực",
    areaName: "Khu vực/Ấp",
    sortOrder: "Sắp xếp",
};

export const statusOptions: SelectOption[] = [
    { label: "Hoạt động", value: "active" },
    { label: "Không hoạt động", value: "inactive" },
    { label: "Tạm khóa", value: "suspended" },
];

export const booleanStatusOptions: SelectOption[] = [
    { label: "Hoạt động", value: "true" },
    { label: "Ngừng", value: "false" },
];

export function getDisplayValue(item: DataRow, key: string): string {
    const value = key === "sortOrder" ? (item[key] ?? item.sort_order) : item[key];
    if (value === null || value === undefined) {
        return "-";
    }
    if (typeof value === "object") {
        return JSON.stringify(value);
    }
    return String(value);
}

export function toLabel(key: string): string {
    return vietnameseLabels[key] || key;
}

export function getStatusBadgeClass(statusValue: string): string {
    const value = statusValue.toLowerCase();
    if (["true", "1"].includes(value)) {
        return "bg-green-500 text-white";
    }
    if (["false", "0"].includes(value)) {
        return "bg-red-500 text-white";
    }
    if (["active", "hoạt động", "enabled", "open"].includes(value)) {
        return "bg-green-500 text-white";
    }
    if (["suspended", "inactive", "disabled", "locked", "tạm khóa"].includes(value)) {
        return "bg-red-500 text-white";
    }
    if (["pending", "draft", "inprogress", "processing"].includes(value)) {
        return "bg-yellow-500 text-white";
    }
    return "bg-gray-500 text-white";
}

export function toBooleanFromFormValue(value: string): boolean {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "active";
}

export function toStatusLabel(statusValue: unknown): string {
    if (typeof statusValue === "boolean") {
        return statusValue ? "Hoạt động" : "Ngừng";
    }

    const raw = String(statusValue ?? "").trim();
    if (!raw) {
        return "-";
    }

    const lower = raw.toLowerCase();
    if (["true", "1"].includes(lower)) {
        return "Hoạt động";
    }
    if (["false", "0"].includes(lower)) {
        return "Ngừng";
    }
    return raw;
}

export function inferColumns(rows: DataRow[]): string[] {
    if (!rows.length) {
        return ["name", "code", "description", "status"];
    }

    return Object.keys(rows[0])
        .filter((key) => !technicalFields.has(key))
        .slice(0, 7);
}

export function createBlankForm(fields: FormField[], seed?: DataRow): Record<string, string> {
    const next: Record<string, string> = {};
    for (const field of fields) {
        const value = seed?.[field.key];
        next[field.key] = value === undefined || value === null ? "" : String(value);
    }
    return next;
}

export function getOrganizationId(item: DataRow): string {
    return String(item.id ?? item.uuid ?? item._id ?? "");
}

export function getOrganizationParentId(item: DataRow): string {
    const parent = typeof item.parent === "object" && item.parent ? (item.parent as DataRow) : null;

    return String(
        item.parentId ??
        item.parent_id ??
        item.parentUUID ??
        item.parentUuid ??
        item.parentOrganizationId ??
        item.parentOrgId ??
        parent?.id ??
        parent?.uuid ??
        ""
    );
}

function getOrganizationParent(item: DataRow): DataRow | null {
    return typeof item.parent === "object" && item.parent ? (item.parent as DataRow) : null;
}

export function getOrganizationName(item: DataRow): string {
    return String(item.name ?? item.fullName ?? item.code ?? "Đơn vị");
}

export function getOrganizationSortOrder(item: DataRow): number {
    const rawValue = item.sortOrder ?? item.sort_order;
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
        return rawValue;
    }

    if (typeof rawValue === "string" && rawValue.trim() !== "" && !Number.isNaN(Number(rawValue))) {
        return Number(rawValue);
    }

    return Number.MAX_SAFE_INTEGER;
}

function extractPaginationSummary(input: unknown): PaginationSummary | null {
    if (!input || typeof input !== "object") {
        return null;
    }

    const record = input as Record<string, unknown>;
    if (!record.pagination || typeof record.pagination !== "object") {
        return null;
    }

    const pagination = record.pagination as Record<string, unknown>;
    return {
        total: Number(pagination.total ?? 0) || 0,
        pages: Math.max(1, Number(pagination.pages ?? 1) || 1),
    };
}

function compareOrganizations(a: DataRow, b: DataRow): number {
    const sortOrderDiff = getOrganizationSortOrder(a) - getOrganizationSortOrder(b);
    if (sortOrderDiff !== 0) {
        return sortOrderDiff;
    }

    return getOrganizationName(a).localeCompare(getOrganizationName(b), "vi");
}

function normalizeOrganizationRow(row: DataRow): DataRow {
    return {
        ...row,
        sortOrder: row.sortOrder ?? row.sort_order ?? null,
    };
}

export function buildOrganizationHierarchy(items: DataRow[]): OrganizationHierarchy {
    const idToItem = new Map<string, DataRow>();
    const childrenByParent = new Map<string, DataRow[]>();

    items.forEach((item) => {
        const id = getOrganizationId(item);
        if (!id) {
            return;
        }
        idToItem.set(id, item);
    });

    items.forEach((item) => {
        const id = getOrganizationId(item);
        if (!id) {
            return;
        }

        const rawParentId = getOrganizationParentId(item);
        const parentId = rawParentId && idToItem.has(rawParentId) ? rawParentId : "ROOT";
        const list = childrenByParent.get(parentId) || [];
        list.push(item);
        childrenByParent.set(parentId, list);
    });

    childrenByParent.forEach((list) => {
        list.sort(compareOrganizations);
    });

    return { childrenByParent, idToItem };
}

export function collectOrganizationDescendants(
    organizationId: string,
    childrenByParent: Map<string, DataRow[]>,
    descendants: Set<string>
) {
    const children = childrenByParent.get(organizationId) || [];
    children.forEach((child) => {
        const childId = getOrganizationId(child);
        if (!childId || descendants.has(childId)) {
            return;
        }

        descendants.add(childId);
        collectOrganizationDescendants(childId, childrenByParent, descendants);
    });
}

export function buildPageConfig(slug: string, categories: DataRow[]): PageConfig {
    if (slug === "nguoi-dung") {
        return {
            title: "Danh mục người dùng",
            endpoint: endpoints.admin.accounts,
            formFields: [
                {
                    key: "username",
                    label: "Tên đăng nhập",
                    type: "text",
                    required: true,
                    placeholder: "Nhập tên đăng nhập",
                },
                {
                    key: "fullName",
                    label: "Họ và tên",
                    type: "text",
                    required: true,
                    placeholder: "Nhập họ và tên",
                },
                {
                    key: "email",
                    label: "Email",
                    type: "text",
                    required: true,
                    placeholder: "nntruyen027 hoặc nntruyen027@gmail.com",
                },
                {
                    key: "phone",
                    label: "Số điện thoại",
                    type: "tel",
                    placeholder: "Nhập số điện thoại",
                },
                {
                    key: "status",
                    label: "Trạng thái",
                    type: "select",
                    valueType: "string",
                    options: statusOptions,
                },
                {
                    key: "password",
                    label: "Mật khẩu",
                    type: "password",
                    required: true,
                    placeholder: "Nhập mật khẩu",
                },
            ],
        };
    }

    if (slug === "don-vi") {
        return {
            title: "Danh mục đơn vị",
            endpoint: endpoints.admin.organizations,
            dynamicWorkspaceId: getWorkspaceId(),
            formFields: [
                {
                    key: "name",
                    label: "Tên đơn vị",
                    type: "text",
                    required: true,
                    placeholder: "Nhập tên đơn vị",
                },
                {
                    key: "code",
                    label: "Mã đơn vị",
                    type: "text",
                    required: true,
                    placeholder: "Nhập mã đơn vị",
                },
                {
                    key: "address",
                    label: "Địa chỉ",
                    type: "textarea",
                    placeholder: "Nhập địa chỉ",
                },
                {
                    key: "provinceCode",
                    label: "Tỉnh/Thành phố",
                    type: "select",
                    placeholder: "Chọn tỉnh/thành phố",
                },
                {
                    key: "wardCode",
                    label: "Xã/Phường",
                    type: "select",
                    placeholder: "Chọn xã/phường",
                },
                {
                    key: "areaId",
                    label: "Khu vực/Ấp",
                    type: "select",
                    placeholder: "Chọn khu vực/ấp",
                },
                {
                    key: "email",
                    label: "Email",
                    type: "email",
                    placeholder: "example@email.com",
                },
                {
                    key: "phone",
                    label: "Số điện thoại",
                    type: "tel",
                    placeholder: "Nhập số điện thoại",
                },
                {
                    key: "parentId",
                    label: "Đơn vị cha",
                    type: "select",
                    options: [],
                },
                {
                    key: "status",
                    label: "Trạng thái",
                    type: "select",
                    valueType: "boolean",
                    options: booleanStatusOptions,
                },
                {
                    key: "sortOrder",
                    label: "Thứ tự hiển thị",
                    type: "number",
                    valueType: "number",
                    placeholder: "Nhập số thứ tự cùng cấp",
                },
            ],
        };
    }

    if (slug.startsWith("cat-")) {
        const categoryId = slug.slice(4);
        const category = categories.find((item) => String(item.id ?? item.uuid ?? "") === categoryId);
        return {
            title: getCategoryLabel(category || {}) || "Danh mục",
            endpoint: endpoints.admin.categoryItems,
            dynamicCategoryId: categoryId,
            formFields: [
                {
                    key: "name",
                    label: "Tên danh mục",
                    type: "text",
                    required: true,
                    placeholder: "Nhập tên danh mục",
                },
                {
                    key: "code",
                    label: "Mã",
                    type: "text",
                    placeholder: "Nhập mã",
                },
                {
                    key: "description",
                    label: "Mô tả",
                    type: "textarea",
                    placeholder: "Nhập mô tả",
                },
                {
                    key: "status",
                    label: "Trạng thái",
                    type: "select",
                    valueType: "boolean",
                    options: booleanStatusOptions,
                },
                {
                    key: "sortOrder",
                    label: "Sắp xếp",
                    type: "number",
                    valueType: "number",
                    placeholder: "Nhập số sắp xếp",
                },
            ],
        };
    }

    if (slug === "quan-tri-quyen") {
        return {
            title: "Quản lý quyền",
            endpoint: endpoints.admin.permissions,
            formFields: [
                {
                    key: "code",
                    label: "Mã quyền",
                    type: "text",
                    required: true,
                    placeholder: "Nhập mã quyền",
                },
                {
                    key: "name",
                    label: "Tên quyền",
                    type: "text",
                    required: true,
                    placeholder: "Nhập tên quyền",
                },
                {
                    key: "description",
                    label: "Mô tả",
                    type: "textarea",
                    placeholder: "Nhập mô tả",
                }
            ],
        };
    }

    return {
        title: "Danh mục dữ liệu",
        endpoint: endpoints.admin.categories,
        dynamicWorkspaceId: getWorkspaceId(),
        formFields: [
            {
                key: "name",
                label: "Tên loại danh mục",
                type: "text",
                required: true,
                placeholder: "Nhập tên loại danh mục",
            },
            {
                key: "code",
                label: "Mã",
                type: "text",
                placeholder: "Nhập mã",
            },
            {
                key: "description",
                label: "Mô tả",
                type: "textarea",
                placeholder: "Nhập mô tả",
            }
        ],
    };
}

export function useCategoriesTablePage(slug: string, source: "danh-muc" | "quan-tri" = "danh-muc") {
    void source;
    const isOrganizationMode = slug === "don-vi";
    const [categories, setCategories] = useState<DataRow[]>([]);
    const [rows, setRows] = useState<DataRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<string>("");
    const [showModal, setShowModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isViewMode, setIsViewMode] = useState(false);
    const [editingId, setEditingId] = useState("");
    const [editingRow, setEditingRow] = useState<DataRow | null>(null);
    const [formValues, setFormValues] = useState<Record<string, string>>({});
    const [sortKey, setSortKey] = useState("name");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRows, setTotalRows] = useState(0);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
    const [expandedOrganizationIds, setExpandedOrganizationIds] = useState<Record<string, boolean>>({});
    const [provinceOptions, setProvinceOptions] = useState<SelectOption[]>([]);
    const [wardOptions, setWardOptions] = useState<SelectOption[]>([]);
    const [areaOptions, setAreaOptions] = useState<SelectOption[]>([]);
    const currentOrganizationId = useMemo(() => getCurrentOrganizationId(), []);

    useEffect(() => {
        const loadCategories = async () => {
            try {
                const data = await api.get(endpoints.admin.categories);
                const list = extractList(data);
                setCategories(list);
            } catch {
                // ignore errors
            }
        };
        void loadCategories();
    }, []);

    useEffect(() => {
        if (!isOrganizationMode) {
            return;
        }

        const loadProvinceOptions = async () => {
            try {
                const data = await api.get<unknown>(endpoints.poverty.locationProvinces);
                const nextOptions = extractList<DataRow>(data).map((item) => ({
                    value: String(item.code ?? ""),
                    label: String(item.fullName ?? item.name ?? item.code ?? "")
                })).filter((item) => item.value && item.label);
                setProvinceOptions(nextOptions);
            } catch {
                setProvinceOptions([]);
            }
        };

        void loadProvinceOptions();
    }, [isOrganizationMode]);

    useEffect(() => {
        if (!isOrganizationMode) {
            return;
        }

        const provinceCode = (formValues.provinceCode || "").trim();
        if (!provinceCode) {
            setWardOptions([]);
            setAreaOptions([]);
            return;
        }

        const loadWardOptions = async () => {
            try {
                const data = await api.get<unknown>(endpoints.poverty.locationWards(provinceCode));
                const nextOptions = extractList<DataRow>(data).map((item) => ({
                    value: String(item.code ?? ""),
                    label: String(item.fullName ?? item.name ?? item.code ?? "")
                })).filter((item) => item.value && item.label);
                setWardOptions(nextOptions);
            } catch {
                setWardOptions([]);
            }
        };

        void loadWardOptions();
    }, [formValues.provinceCode, isOrganizationMode]);

    useEffect(() => {
        if (!isOrganizationMode) {
            return;
        }

        const wardCode = (formValues.wardCode || "").trim();
        if (!wardCode) {
            setAreaOptions([]);
            return;
        }

        const loadAreaOptions = async () => {
            try {
                const data = await api.get<unknown>(endpoints.poverty.locationAreas(wardCode));
                const nextOptions = extractList<DataRow>(data).map((item) => ({
                    value: String(item.id ?? ""),
                    label: String(item.name ?? item.code ?? item.id ?? "")
                })).filter((item) => item.value && item.label);
                setAreaOptions(nextOptions);
            } catch {
                setAreaOptions([]);
            }
        };

        void loadAreaOptions();
    }, [formValues.wardCode, isOrganizationMode]);

    const pageConfig = useMemo<PageConfig>(() => buildPageConfig(slug, categories), [categories, slug]);

    const sortedRows = useMemo(() => {
        const list = [...rows];
        list.sort((a, b) => {
            const left = String(a[sortKey] ?? "").toLowerCase();
            const right = String(b[sortKey] ?? "").toLowerCase();
            if (left === right) {
                return 0;
            }
            const result = left > right ? 1 : -1;
            return sortDirection === "asc" ? result : -result;
        });
        return list;
    }, [rows, sortDirection, sortKey]);

    const columns = useMemo(() => {
        if (slug === "nguoi-dung") {
            return ["username", "fullName", "email", "phone", "status"];
        }
        if (slug === "don-vi") {
            return ["name", "code", "provinceName", "wardName", "areaName", "sortOrder", "address", "email", "phone", "status"];
        }
        return inferColumns(rows);
    }, [rows, slug]);

    const organizationHierarchy = useMemo(() => {
        if (!isOrganizationMode) {
            return { childrenByParent: new Map<string, DataRow[]>(), idToItem: new Map<string, DataRow>() };
        }

        return buildOrganizationHierarchy(sortedRows);
    }, [isOrganizationMode, sortedRows]);

    const organizationRowsBySearch = useMemo(() => {
        if (!isOrganizationMode) {
            return new Set<string>();
        }

        const keyword = search.trim().toLowerCase();
        if (!keyword) {
            return new Set(sortedRows.map((item) => getOrganizationId(item)).filter(Boolean));
        }

        return new Set(
            sortedRows
                .filter((item) =>
                    Object.values(item).some((value) => String(value ?? "").toLowerCase().includes(keyword))
                )
                .map((item) => getOrganizationId(item))
                .filter(Boolean)
        );
    }, [isOrganizationMode, sortedRows, search]);

    const organizationVisibleRows = useMemo<VisibleOrganizationRow[]>(() => {
        if (!isOrganizationMode) {
            return [];
        }

        const visibleAncestors = new Set<string>();
        organizationRowsBySearch.forEach((id) => {
            let cursor = organizationHierarchy.idToItem.get(id);
            while (cursor) {
                const cursorId = getOrganizationId(cursor);
                if (!cursorId || visibleAncestors.has(cursorId)) {
                    break;
                }
                visibleAncestors.add(cursorId);
                const parentId = getOrganizationParentId(cursor);
                cursor = parentId ? organizationHierarchy.idToItem.get(parentId) : undefined;
            }
        });

        const result: VisibleOrganizationRow[] = [];

        const traverse = (parentId: string, depth: number, parentRowNumber?: string) => {
            const children = organizationHierarchy.childrenByParent.get(parentId) || [];
            const sortedChildren = [...children].sort((a, b) => {
                const left = String(a[sortKey] ?? "").toLowerCase();
                const right = String(b[sortKey] ?? "").toLowerCase();
                if (left === right) {
                    return 0;
                }
                const result = left > right ? 1 : -1;
                return sortDirection === "asc" ? result : -result;
            });
            sortedChildren.forEach((child, childIndex) => {
                const childId = getOrganizationId(child);
                if (!childId) {
                    return;
                }

                const visibleForSearch = !search.trim() || visibleAncestors.has(childId);
                if (!visibleForSearch) {
                    return;
                }

                const rowNumber = parentRowNumber
                    ? `${parentRowNumber}.${childIndex + 1}`
                    : String(childIndex + 1);
                result.push({ item: child, depth, rowNumber });
                if (expandedOrganizationIds[childId]) {
                    traverse(childId, depth + 1, rowNumber);
                }
            });
        };

        traverse("ROOT", 0);
        return result;
    }, [expandedOrganizationIds, isOrganizationMode, organizationHierarchy, organizationRowsBySearch, search, sortDirection, sortKey]);

    const organizationParentOptions = useMemo(() => {
        if (!isOrganizationMode) {
            return [] as Array<{ value: string; label: string }>;
        }

        const descendants = new Set<string>();
        if (editingId) {
            descendants.add(editingId);
            collectOrganizationDescendants(editingId, organizationHierarchy.childrenByParent, descendants);
        }

        const options: Array<{ value: string; label: string }> = [];

        const traverse = (parentId: string, depth: number) => {
            const children = organizationHierarchy.childrenByParent.get(parentId) || [];
            children.forEach((child) => {
                const id = getOrganizationId(child);
                if (!id || descendants.has(id)) {
                    return;
                }

                const prefix = depth > 0 ? `${"- ".repeat(depth)}` : "";
                options.push({
                    value: id,
                    label: `${prefix}${getOrganizationName(child)}`,
                });
                traverse(id, depth + 1);
            });
        };

        traverse("ROOT", 0);
        return options;
    }, [editingId, isOrganizationMode, organizationHierarchy]);

    const organizationParentTree = useMemo<TreeSelectNode[]>(() => {
        if (!isOrganizationMode) {
            return [];
        }

        const descendants = new Set<string>();
        if (editingId) {
            descendants.add(editingId);
            collectOrganizationDescendants(editingId, organizationHierarchy.childrenByParent, descendants);
        }

        const buildNodes = (parentId: string): TreeSelectNode[] => {
            const children = organizationHierarchy.childrenByParent.get(parentId) || [];

            return children
                .filter((child) => {
                    const id = getOrganizationId(child);
                    return Boolean(id) && !descendants.has(id);
                })
                .map((child) => {
                    const id = getOrganizationId(child);
                    return {
                        value: id,
                        label: getOrganizationName(child),
                        children: buildNodes(id),
                    };
                });
        };

        const tree = buildNodes("ROOT");
        const currentParentId = editingRow ? getOrganizationParentId(editingRow) : "";
        const currentParent = editingRow ? getOrganizationParent(editingRow) : null;

        const hasNode = (nodes: TreeSelectNode[], value: string): boolean =>
            nodes.some((node) => node.value === value || (node.children.length > 0 && hasNode(node.children, value)));

        if (
            currentParentId &&
            currentParent &&
            !descendants.has(currentParentId) &&
            !hasNode(tree, currentParentId)
        ) {
            return [
                {
                    value: currentParentId,
                    label: getOrganizationName(currentParent),
                    children: [],
                    disabled: true,
                },
                ...tree,
            ];
        }

        return tree;
    }, [editingId, editingRow, isOrganizationMode, organizationHierarchy]);

    const isEditingCurrentOrganization = useMemo(
        () => Boolean(isEditMode && currentOrganizationId && editingId && editingId === currentOrganizationId),
        [currentOrganizationId, editingId, isEditMode]
    );

    const organizationChildrenCount = useMemo(() => {
        if (!isOrganizationMode) {
            return {} as Record<string, number>;
        }

        const counts: Record<string, number> = {};
        organizationHierarchy.childrenByParent.forEach((items, key) => {
            counts[key] = items.length;
        });
        return counts;
    }, [isOrganizationMode, organizationHierarchy]);

    const expandableOrganizationIds = useMemo(() => {
        if (!isOrganizationMode) {
            return [] as string[];
        }

        return Object.entries(organizationChildrenCount)
            .filter(([id, count]) => id !== "ROOT" && count > 0)
            .map(([id]) => id);
    }, [isOrganizationMode, organizationChildrenCount]);

    const filteredRows = useMemo(() => {
        if (slug !== "don-vi") return sortedRows;
        const keyword = search.trim().toLowerCase();
        let baseRows = rows;
        if (keyword) {
            baseRows = rows.filter((item) =>
                Object.values(item).some((value) => String(value ?? "").toLowerCase().includes(keyword))
            );
        }
        const list = [...baseRows];
        list.sort((a, b) => {
            const left = String(a[sortKey] ?? "").toLowerCase();
            const right = String(b[sortKey] ?? "").toLowerCase();
            if (left === right) {
                return 0;
            }
            const result = left > right ? 1 : -1;
            return sortDirection === "asc" ? result : -result;
        });
        return list;
    }, [search, rows, sortDirection, sortKey, slug, sortedRows]);

    const pagedRows = useMemo(() => {
        if (slug !== "don-vi") return filteredRows;
        const start = (currentPage - 1) * pageSize;
        return filteredRows.slice(start, start + pageSize);
    }, [currentPage, filteredRows, pageSize, slug]);

    const visibleRows = useMemo<VisibleOrganizationRow[]>(() => {
        if (isOrganizationMode) {
            return organizationVisibleRows;
        }
        return pagedRows.map((item, index) => ({
            item,
            depth: 0,
            rowNumber: String((currentPage - 1) * pageSize + index + 1),
        }));
    }, [currentPage, isOrganizationMode, organizationVisibleRows, pageSize, pagedRows]);

    const loadData = useCallback(async (searchCurrent?: string, statusCurrent?: string, pageCurrent?: number, sizeCurrent?: number) => {
        setLoading(true);
        setError(null);
        try {
            const nextStatus = statusCurrent ?? status;
            const nextSearch = searchCurrent ?? search;
            const nextPage = pageCurrent ?? currentPage;
            const nextSize = sizeCurrent ?? pageSize;
            let urlSearch = pageConfig.endpoint;
            if (slug.startsWith("cat-")) {
                urlSearch += `?categoryId=${pageConfig.dynamicCategoryId}&page=${nextPage}&limit=${nextSize}&search=${nextSearch}`;
                if (nextStatus !== "") {
                    if (nextStatus === "true") {
                        urlSearch += `&status=true`;
                    } else if (nextStatus === "false") {
                        urlSearch += `&status=`;
                    }
                }
            }

            if (slug === "nguoi-dung") {
                urlSearch += `?page=${nextPage}&limit=${nextSize}&status=${nextStatus}&search=${nextSearch}`;
            }

            if (slug === "loai-danh-muc") {
                urlSearch += `?workspaceId=${pageConfig.dynamicWorkspaceId}&page=${nextPage}&limit=${nextSize}&search=${nextSearch}`;
            }

            if (slug === "don-vi") {
                urlSearch += `?workspaceId=${pageConfig.dynamicWorkspaceId}`;
            }

            if (slug === "quan-tri-quyen") {
                urlSearch += `?page=${nextPage}&limit=${nextSize}&search=${nextSearch}`;
            }

            const data = await api.get<unknown>(urlSearch);
            const pagination = extractPaginationSummary(data);
            if (pagination) {
                setTotalPages(pagination.pages);
                setTotalRows(pagination.total);
            }
            const list = extractList(data).map((item) => (slug === "don-vi" ? normalizeOrganizationRow(item) : item));
            setRows(list);
        } catch (err) {
            if (err instanceof ApiError) {
                setError(err.message);
            } else {
                setError("Không thể tải dữ liệu danh mục.");
            }
        } finally {
            setLoading(false);
        }
    }, [pageConfig.dynamicCategoryId, pageConfig.dynamicWorkspaceId, pageConfig.endpoint, pageSize, search, status, currentPage, slug]);

    useEffect(() => {
        void loadData(search, status, currentPage, pageSize);
    }, [currentPage, pageSize, loadData, search, status]);

    useEffect(() => {
        const initialValues = createBlankForm(pageConfig.formFields);
        if (isOrganizationMode) {
            initialValues.status = "true";
        }
        setFormValues(initialValues);
    }, [isOrganizationMode, pageConfig.formFields]);

    useEffect(() => {
        if (slug === "don-vi") {
            setTotalRows(filteredRows.length);
            setTotalPages(Math.ceil(filteredRows.length / pageSize));
        }
    }, [filteredRows.length, pageSize, slug]);

    const handleSearch = () => {
        setCurrentPage(1);
        void loadData(search, status, 1, pageSize);
    };

    const refreshData = () => {
        setSearch("");
        setStatus("");
        setCurrentPage(1);
        setPageSize(10);
        void loadData("", "", 1, 10);
    };

    const openCreateModal = () => {
        setIsEditMode(false);
        setIsViewMode(false);
        setEditingId("");
        setEditingRow(null);

        const initialValues = createBlankForm(pageConfig.formFields);
        if (isOrganizationMode) {
            initialValues.parentId = "";
            initialValues.status = "true";
        }

        setFormValues(initialValues);
        setFormErrors({});
        setShowModal(true);
    };

    const openEditModal = (row: DataRow) => {
        setIsEditMode(true);
        setIsViewMode(false);
        setEditingId(getRowId(row));
        setEditingRow(row);

        const nextValues = createBlankForm(pageConfig.formFields, row);
        if (isOrganizationMode) {
            nextValues.parentId = getOrganizationParentId(row);
            nextValues.sortOrder = String(row.sortOrder ?? row.sort_order ?? "");
        }

        setFormValues(nextValues);
        setFormErrors({});
        setShowModal(true);
    };

    const openViewModal = (row: DataRow) => {
        setIsEditMode(false);
        setIsViewMode(true);
        setEditingId(getRowId(row));
        setEditingRow(row);

        const nextValues = createBlankForm(pageConfig.formFields, row);
        if (isOrganizationMode) {
            nextValues.parentId = getOrganizationParentId(row);
            nextValues.sortOrder = String(row.sortOrder ?? row.sort_order ?? "");
        }

        setFormValues(nextValues);
        setFormErrors({});
        setShowModal(true);
    };

    const buildPayload = () => {
        const payload: Record<string, unknown> = {};

        for (const field of pageConfig.formFields) {
            const value = formValues[field.key];

            if (field.key === "parentId" && isOrganizationMode) {
                payload.parentId = value || null;
                continue;
            }

            if (isOrganizationMode && ["provinceCode", "wardCode", "areaId"].includes(field.key)) {
                const trimmedValue = String(value || "").trim();
                if (!trimmedValue) {
                    if (isEditMode) {
                        payload[field.key] = null;
                    }
                    continue;
                }
            }

            switch (field.valueType) {
                case "number":
                    payload[field.key] = Number(value);
                    break;
                case "boolean":
                    payload[field.key] = toBooleanFromFormValue(value);
                    break;
                default:
                    payload[field.key] = slug === "nguoi-dung" && field.key === "email"
                        ? normalizeAccountEmail(value)
                        : value;
            }
        }

        if (pageConfig.dynamicCategoryId) {
            payload.categoryId = pageConfig.dynamicCategoryId;
        }

        return payload;
    };

    const handleCreateOrUpdate = async () => {
        const errors: Record<string, string> = {};

        for (const field of pageConfig.formFields) {
            const value = (formValues[field.key] || "").trim();
            if (field.type === "number" && value && isNaN(Number(value))) {
                errors[field.key] = `${field.label} phải là một số hợp lệ.`;
            }
            if (field.required && !value) {
                errors[field.key] = `${field.label} là bắt buộc.`;
            }
            if (field.key === "email" && value) {
                const isValidEmail = slug === "nguoi-dung"
                    ? isValidAccountEmailInput(value)
                    : /^\S+@\S+\.\S+$/.test(value);
                if (!isValidEmail) {
                    errors[field.key] = slug === "nguoi-dung"
                        ? getAccountEmailValidationMessage()
                        : "Email không hợp lệ.";
                }
            }
            if (isEditMode && field.key === "password" && !value) {
                delete errors[field.key];
            }
        }

        setFormErrors(errors);
        if (Object.keys(errors).length > 0) {
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const payload = buildPayload();
            if (isEditMode && editingId) {
                await api.patch(`${pageConfig.endpoint}/${editingId}`, payload);
            } else {
                await api.post(pageConfig.endpoint, payload);
            }

            setShowModal(false);
            await loadData(search, status, currentPage, pageSize);
        } catch (err) {
            if (err instanceof ApiError) {
                setError(err.message);
            } else {
                setError(isEditMode ? "Không thể cập nhật dữ liệu." : "Không thể tạo mới dữ liệu.");
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!id) {
            return;
        }

        setError(null);
        try {
            await api.delete(`${pageConfig.endpoint}/${id}`);
            setDeleteTarget(null);
            await loadData(search, status, currentPage, pageSize);
        } catch (err) {
            if (err instanceof ApiError) {
                setError(err.message);
            } else {
                setError("Không thể xóa dữ liệu.");
            }
        }
    };

    const toggleSort = (column: string) => {
        if (sortKey === column) {
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
            return;
        }
        setSortKey(column);
        setSortDirection("asc");
    };

    const toggleOrganization = (organizationId: string) => {
        setExpandedOrganizationIds((prev) => ({
            ...prev,
            [organizationId]: !prev[organizationId],
        }));
    };

    const expandAllOrganizations = () => {
        setExpandedOrganizationIds(
            expandableOrganizationIds.reduce<Record<string, boolean>>((acc, id) => {
                acc[id] = true;
                return acc;
            }, {})
        );
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingRow(null);
    };
    const closeDeleteModal = () => setDeleteTarget(null);
    const updateFieldValue = (key: string, value: string) =>
        setFormValues((prev) => {
            if (key === "provinceCode") {
                return {
                    ...prev,
                    provinceCode: value,
                    wardCode: "",
                    areaId: "",
                };
            }

            if (key === "wardCode") {
                return {
                    ...prev,
                    wardCode: value,
                    areaId: "",
                };
            }

            return {
                ...prev,
                [key]: value,
            };
        });

    return {
        columns,
        currentPage,
        deleteTarget,
        error,
        expandedOrganizationIds,
        formErrors,
        formValues,
        isEditMode,
        isOrganizationMode,
        isEditingCurrentOrganization,
        isViewMode,
        loading,
        organizationChildrenCount,
        organizationParentOptions,
        organizationParentTree,
        pageConfig,
        pageSize,
        provinceOptions,
        saving,
        search,
        status,
        showModal,
        sortDirection,
        sortKey,
        areaOptions,
        totalPages,
        totalRows,
        visibleRows,
        wardOptions,
        closeDeleteModal,
        closeModal,
        expandAllOrganizations,
        handleCreateOrUpdate,
        handleDelete,
        loadData,
        openCreateModal,
        openEditModal,
        openViewModal,
        setCurrentPage,
        setDeleteTarget,
        setExpandedOrganizationIds,
        setPageSize,
        setSearch,
        toggleOrganization,
        toggleSort,
        updateFieldValue,
        setStatus,
        handleSearch,
        refreshData,
    };
}

type CategoriesTableViewProps = {
    columns: string[];
    currentPage: number;
    deleteTarget: { id: string; label: string } | null;
    error: string | null;
    expandedOrganizationIds: Record<string, boolean>;
    formErrors: Record<string, string>;
    formFields: FormField[];
    formValues: Record<string, string>;
    isEditMode: boolean;
    isOrganizationMode: boolean;
    isEditingCurrentOrganization: boolean;
    isViewMode: boolean;
    loading: boolean;
    organizationChildrenCount: Record<string, number>;
    organizationParentOptions: SelectOption[];
    organizationParentTree: TreeSelectNode[];
    pageSize: number;
    provinceOptions: SelectOption[];
    wardOptions: SelectOption[];
    areaOptions: SelectOption[];
    saving: boolean;
    search: string;
    status: string;
    showModal: boolean;
    sortDirection: "asc" | "desc";
    sortKey: string;
    title: string;
    totalPages: number;
    totalRows: number;
    visibleRows: VisibleOrganizationRow[];
    slug: string;
    onChangePage: (page: number) => void;
    onChangePageSize: (size: number) => void;
    onChangeSearch: (value: string) => void;
    onCloseDeleteModal: () => void;
    onCloseModal: () => void;
    onConfirmDelete: (id: string) => Promise<void>;
    onExpandAllOrganizations: () => void;
    onOpenCreateModal: () => void;
    onOpenEditModal: (item: DataRow) => void;
    onOpenViewModal: (item: DataRow) => void;
    onSetDeleteTarget: (value: { id: string; label: string } | null) => void;
    onSetExpandedOrganizationIds: (value: Record<string, boolean>) => void;
    onSubmit: () => Promise<void>;
    onToggleOrganization: (organizationId: string) => void;
    onToggleSort: (column: string) => void;
    onUpdateFieldValue: (key: string, value: string) => void;
    setStatus: (value: string) => void;
    handleSearch: () => void;
    refreshData: () => void;
};

function TableToolbar({
    isOrganizationMode,
    onChangeSearch,
    onExpandAllOrganizations,
    onSetExpandedOrganizationIds,
    search,
    status,
    setStatus,
    handleSearch,
    refreshData,
    formFields,
}: Pick<
    CategoriesTableViewProps,
    | "isOrganizationMode"
    | "onChangeSearch"
    | "onExpandAllOrganizations"
    | "onSetExpandedOrganizationIds"
    | "search"
    | "status"
    | "setStatus"
    | "handleSearch"
    | "refreshData"
    | "formFields"
>) {
    return isOrganizationMode ? (
        <FilterSpace
            actionsPosition="bottom-right"
            actions={
                <>
                    <ActionButton type="refresh" onClick={handleSearch} label="Tải lại" variant="outlined" />
                    <ActionButton
                        type="refresh"
                        onClick={onExpandAllOrganizations}
                        label="Mở tất cả"
                        icon={<ChevronDown className="h-4 w-4" />}
                        variant="outlined"
                    />
                    <ActionButton
                        type="refresh"
                        onClick={() => onSetExpandedOrganizationIds({})}
                        label="Thu gọn tất cả"
                        icon={<ChevronRight className="h-4 w-4" />}
                        variant="outlined"
                    />
                </>
            }
        >
            <SearchBox
                value={search}
                bold
                placeholder="Nhập từ khóa tìm kiếm"
                onChange={onChangeSearch}
            />
        </FilterSpace>
    ) : (
        <FilterSpace
            actionsPosition="bottom-right"
            actions={
                <>
                    <ActionButton type="search" onClick={handleSearch} label="Tìm kiếm" />
                    <ActionButton type="refresh" onClick={refreshData} label="Làm mới" variant="outlined" />
                </>
            }
        >
            <SearchBox
                value={search}
                bold
                placeholder="Nhập từ khóa tìm kiếm"
                onChange={onChangeSearch}
                onPressEnter={handleSearch}
            />

            {formFields.find((field) => field.key === "status") ? (
                <div>
                    <Select
                        title="Trạng thái"
                        bold
                        value={status}
                        onChange={(value) => {
                            setStatus(value ?? "");
                        }}
                        includeAllOption
                        allOptionLabel="Tất cả"
                        placeholder="Chọn trạng thái"
                        allOptionValue=""
                        extraOptions={(formFields.find((field) => field.key === "status")?.options ?? []).map((option) => ({
                            label: option.label,
                            value: option.value,
                        }))}
                    />
                </div>
            ) : null}
        </FilterSpace>
    );
}

function CategoriesDataTable({
    columns,
    currentPage,
    expandedOrganizationIds,
    isOrganizationMode,
    loading,
    organizationChildrenCount,
    pageSize,
    sortDirection,
    sortKey,
    totalPages,
    totalRows,
    visibleRows,
    slug,
    onChangePage,
    onChangePageSize,
    onOpenEditModal,
    onOpenViewModal,
    onSetDeleteTarget,
    onToggleOrganization,
    onToggleSort,
}: Pick<
    CategoriesTableViewProps,
    | "columns"
    | "currentPage"
    | "expandedOrganizationIds"
    | "isOrganizationMode"
    | "loading"
    | "organizationChildrenCount"
    | "pageSize"
    | "sortDirection"
    | "sortKey"
    | "totalPages"
    | "totalRows"
    | "visibleRows"
    | "slug"
    | "onChangePage"
    | "onChangePageSize"
    | "onOpenEditModal"
    | "onOpenViewModal"
    | "onSetDeleteTarget"
    | "onToggleOrganization"
    | "onToggleSort"
>) {
    return (
        <div className="data-table-shell">
            <div className="data-table-wrap">
                <table className="data-table">
                    <thead className="data-table-head bg-[#d4a574]">
                        <tr>
                            <th className="data-table-th">STT</th>
                            {columns
                            .filter((column) => slug.startsWith("cat-") ? column !== "parentId" : true)
                            .map((column) => (
                                <th key={column} className="data-table-th">
                                    <button
                                        type="button"
                                        className="data-table-sort-btn"
                                        onClick={() => onToggleSort(column)}
                                    >
                                        {toLabel(column)}
                                        {sortKey === column ? (sortDirection === "asc" ? "▲" : "▼") : ""}
                                    </button>
                                </th>
                            ))}
                            <th className="data-table-th-action">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={columns.length + 2} className="px-4 py-4 text-center text-gray-500">
                                    <AppSpinner/>
                                </td>
                            </tr>
                        ) : totalRows === 0 ? (
                            <tr>
                                <td colSpan={columns.length + 2} className="px-4 py-12">
                                    <div className="flex flex-col items-center justify-center">
                                        <div className="rounded-full bg-gray-100 p-4 dark:bg-gray-800">
                                            <Search className="h-8 w-8 text-gray-400 dark:text-gray-600" />
                                        </div>
                                        <p className="mt-3 text-base font-semibold text-gray-700 dark:text-gray-300">
                                            Không có dữ liệu
                                        </p>
                                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                            Hãy tạo bản ghi mới hoặc điều chỉnh bộ lọc
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            visibleRows.map(({ item, depth, rowNumber }, index) => {
                                const id = getRowId(item);
                                const organizationId = getOrganizationId(item);
                                const hasChildren = Boolean(organizationChildrenCount[organizationId]);
                                const isExpanded = Boolean(expandedOrganizationIds[organizationId]);
                                const rowClassName =
                                    isOrganizationMode && hasChildren && isExpanded
                                        ? "data-table-row-expanded"
                                        : "data-table-row";

                                return (
                                    <tr
                                        key={id || `${index}`}
                                        className={rowClassName}
                                    >
                                        <td className="data-table-cell">{rowNumber}</td>
                                        {columns
                                        .filter((column) => slug.startsWith("cat-") ? column !== "parentId" : true)
                                        .map((column) => (
                                            <td
                                                key={`${id}-${column}`}
                                                className="data-table-cell"
                                                title={getDisplayValue(item, column)}
                                            >
                                                {isOrganizationMode && column === "name" ? (
                                                    <div
                                                        className="flex items-center gap-1"
                                                        style={{ paddingLeft: `${depth * 20}px` }}
                                                    >
                                                        {hasChildren ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => onToggleOrganization(organizationId)}
                                                                className="rounded p-0.5 text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
                                                                title={isExpanded ? "Thu gọn" : "Mở rộng"}
                                                            >
                                                                {isExpanded ? (
                                                                    <ChevronDown className="h-4 w-4" />
                                                                ) : (
                                                                    <ChevronRight className="h-4 w-4" />
                                                                )}
                                                            </button>
                                                        ) : (
                                                            <span className="inline-block h-4 w-4" />
                                                        )}
                                                        <span className="truncate">{getDisplayValue(item, column)}</span>
                                                    </div>
                                                ) : column === "status" ? (
                                                    <span
                                                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusBadgeClass(
                                                            getDisplayValue(item, column)
                                                        )}`}
                                                    >
                                                        {toStatusLabel(item[column])}
                                                    </span>
                                                ) : (
                                                    getDisplayValue(item, column)
                                                )}
                                            </td>
                                        ))}
                                        <td className="data-table-cell">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenViewModal(item)}
                                                    title="Xem chi tiết"
                                                >
                                                    <ActionIcon action="view"/>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenEditModal(item)}
                                                    title="Sửa"
                                                >
                                                    <ActionIcon action="edit"/>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        onSetDeleteTarget({
                                                            id,
                                                            label:
                                                                getDisplayValue(item, "name") !== "-"
                                                                    ? getDisplayValue(item, "name")
                                                                    : getDisplayValue(item, "fullName"),
                                                        })
                                                    }
                                                    title="Xóa"
                                                >
                                                    <ActionIcon action="delete" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {isOrganizationMode ? (
                <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-400">
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                        Có {totalRows} kết quả
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        Chế độ cây đơn vị: dùng mũi tên để mở/thu gọn đơn vị con.
                    </span>
                </div>
            ) : (
                <AppPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalRows={totalRows}
                    rowsPerPage={pageSize}
                    rowsPerPageOptions={[10, 20, 50]}
                    onRowsPerPageChange={(nextSize) => {
                        onChangePageSize(nextSize);
                        onChangePage(1);
                    }}
                    onPageChange={onChangePage}
                />
            )}
        </div>
    );
}

function RecordModal({
    formErrors,
    formFields,
    formValues,
    isEditMode,
    isOrganizationMode,
    isEditingCurrentOrganization,
    isViewMode,
    organizationParentOptions,
    organizationParentTree,
    saving,
    showModal,
    provinceOptions,
    wardOptions,
    areaOptions,
    onCloseModal,
    onSubmit,
    onUpdateFieldValue,
}: Pick<
    CategoriesTableViewProps,
    | "formErrors"
    | "formFields"
    | "formValues"
    | "isEditMode"
    | "isOrganizationMode"
    | "isEditingCurrentOrganization"
    | "isViewMode"
    | "organizationParentOptions"
    | "organizationParentTree"
    | "provinceOptions"
    | "wardOptions"
    | "areaOptions"
    | "saving"
    | "showModal"
    | "onCloseModal"
    | "onSubmit"
    | "onUpdateFieldValue"
>) {
    const content = (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {formFields.map((field) => {
                const options =
                    isOrganizationMode && field.key === "parentId"
                        ? organizationParentOptions
                        : isOrganizationMode && field.key === "provinceCode"
                            ? provinceOptions
                            : isOrganizationMode && field.key === "wardCode"
                                ? wardOptions
                                : isOrganizationMode && field.key === "areaId"
                                    ? areaOptions
                        : field.options || [];
                const disabled =
                    isViewMode ||
                    (isOrganizationMode && field.key === "parentId" && isEditingCurrentOrganization) ||
                    (isOrganizationMode && field.key === "wardCode" && !formValues.provinceCode) ||
                    (isOrganizationMode && field.key === "areaId" && !formValues.wardCode);

                return (
                    <div
                        key={field.key}
                        className={field.type === "textarea" ? "sm:col-span-2" : ""}
                    >
                        <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                            {field.label}
                            {field.required ? <span className="ml-1 text-error-500">*</span> : null}
                        </label>

                        {isOrganizationMode && field.key === "parentId" ? (
                            <TreeSelect
                                placeholder={field.placeholder || "Chọn đơn vị"}
                                treeData={organizationParentTree}
                                value={formValues[field.key] || undefined}
                                onChange={(value) => onUpdateFieldValue(field.key, value)}
                                allowClear={!disabled}
                                disabled={disabled}
                                style={{ width: "100%", height: "40px" }}
                            />
                        ) : field.type === "select" ? (
                            <AppSelect hideTitle options={options} disabled={disabled} value={formValues[field.key] || ""}
                                onChange={(value) => onUpdateFieldValue(field.key, value || "")}
                            />
                        ) : field.type === "textarea" ? (
                            <AppInput disabled={disabled} value={formValues[field.key] || ""}
                                onChange={value => onUpdateFieldValue(field.key, value || "")}
                                      type={'textarea'}
                                      placeholder={field.placeholder || ""}
                            />
                        ) : field.type === "number" ? (
                            <AppInput
                                disabled={disabled}
                                value={Number(formValues[field.key]) || 0}
                                onChange={(value) => onUpdateFieldValue(field.key, String(value) || "0")}
                                type={'number'}
                                placeholder={field.placeholder || ""}
                            />
                        ) : (
                            <AppInput
                                disabled={disabled}
                                value={formValues[field.key] || ""}
                                onChange={(event) => onUpdateFieldValue(field.key, event)}
                                placeholder={field.placeholder}
                            />
                        )}

                        {formErrors[field.key] ? (
                            <p className="mt-1 text-xs text-error-600">{formErrors[field.key]}</p>
                        ) : null}
                    </div>
                );
            })}
        </div>
    );

    if (isViewMode) {
        return (
            <ViewModal
                open={showModal}
                title="Chi tiết bản ghi"
                width={900}
                onCancel={onCloseModal}
                footer={
                    <div className="popup-footer-actions">
                        <ActionButton type="close" onClick={onCloseModal} label="Đóng" variant="outlined" />
                    </div>
                }
            >
                {content}
            </ViewModal>
        );
    }

    return (
        <ActionModal
            open={showModal}
            title={isEditMode ? "Cập nhật bản ghi" : "Tạo bản ghi mới"}
            okText={saving ? "Đang lưu..." : isEditMode ? "Cập nhật" : "Lưu"}
            cancelText="Đóng"
            loading={saving}
            spinning={saving}
            variant="danger"
            width={900}
            onOk={() => void onSubmit()}
            onCancel={onCloseModal}
        >
            {content}
        </ActionModal>
    );
}

export default function CategoriesTablePage({ slug, source = "danh-muc" }: { slug: string; source?: "danh-muc" | "quan-tri" }) {
    const state = useCategoriesTablePage(slug, source);

    return (
        <div className="w-full space-y-4">
            <TitleSpace
                title={state.pageConfig.title}
                actions={
                    <ActionButton type="create" onClick={state.openCreateModal} label="Thêm mới" />
                }
            />

            <TableToolbar
                isOrganizationMode={state.isOrganizationMode}
                onChangeSearch={state.setSearch}
                onExpandAllOrganizations={state.expandAllOrganizations}
                onSetExpandedOrganizationIds={state.setExpandedOrganizationIds}
                search={state.search}
                status={state.status}
                setStatus={state.setStatus}
                handleSearch={state.handleSearch}
                refreshData={state.refreshData}
                formFields={state.pageConfig.formFields}
            />

            {state.error ? (
                <p className="rounded border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700">
                    {state.error}
                </p>
            ) : null}

            <CategoriesDataTable
                columns={state.columns}
                currentPage={state.currentPage}
                expandedOrganizationIds={state.expandedOrganizationIds}
                isOrganizationMode={state.isOrganizationMode}
                loading={state.loading}
                organizationChildrenCount={state.organizationChildrenCount}
                pageSize={state.pageSize}
                sortDirection={state.sortDirection}
                sortKey={state.sortKey}
                totalPages={state.totalPages}
                totalRows={state.totalRows}
                visibleRows={state.visibleRows}
                slug={slug}
                onChangePage={state.setCurrentPage}
                onChangePageSize={state.setPageSize}
                onOpenEditModal={state.openEditModal}
                onOpenViewModal={state.openViewModal}
                onSetDeleteTarget={state.setDeleteTarget}
                onToggleOrganization={state.toggleOrganization}
                onToggleSort={state.toggleSort}
            />

            <RecordModal
                formErrors={state.formErrors}
                formFields={state.pageConfig.formFields}
                formValues={state.formValues}
                isEditMode={state.isEditMode}
                isOrganizationMode={state.isOrganizationMode}
                isEditingCurrentOrganization={state.isEditingCurrentOrganization}
                isViewMode={state.isViewMode}
                organizationParentOptions={state.organizationParentOptions}
                organizationParentTree={state.organizationParentTree}
                provinceOptions={state.provinceOptions}
                wardOptions={state.wardOptions}
                areaOptions={state.areaOptions}
                saving={state.saving}
                showModal={state.showModal}
                onCloseModal={state.closeModal}
                onSubmit={state.handleCreateOrUpdate}
                onUpdateFieldValue={state.updateFieldValue}
            />

            <ConfirmModal
                open={Boolean(state.deleteTarget)}
                onOk={() => void (state.deleteTarget && state.handleDelete(state.deleteTarget.id))}
                onCancel={() => state.setDeleteTarget(null)}
                variant="danger"
                descriptionPrefix="Bạn có chắc chắn muốn xóa"
                subject={state.deleteTarget?.label}
                descriptionSuffix="?"
                okText="Xóa"
                loading={state.saving}
                spinning={state.saving}
            />
        </div>
    );
}

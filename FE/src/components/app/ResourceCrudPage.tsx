"use client";

import {api, ApiError} from "@/lib/api";
import {extractList} from "@/lib/data-utils";
import {endpoints} from "@/lib/endpoints";
import DatePickerInput from "@/components/form/DatePickerInput";
import {
    ColumnConfig,
    DetailSectionConfig,
    FilterFieldConfig,
    formatValue,
    FormFieldConfig,
    SelectOption,
} from "@/lib/column-config";
import {
    AlertCircle,
    CalendarClock,
    CalendarDays,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    CircleDashed,
    Clock3,
    Eye,
    File,
    FileSpreadsheet,
    FileText,
    History,
    Pencil,
    Plus,
    RefreshCw,
    Search,
    Trash2,
    Upload,
    X,
} from "lucide-react";
import {
    type ChangeEvent,
    type Dispatch,
    type SetStateAction,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

type ResourceCrudPageProps = {
    title: string;
    endpoint: string;
    description?: string;
    defaultCreatePayload?: string;
    columns?: ColumnConfig[];
    detailFields?: ColumnConfig[];
    detailSections?: DetailSectionConfig[];
    formFields?: FormFieldConfig[];
    filterFields?: FilterFieldConfig[];
    moduleType?: "tasks" | "assignments" | "evaluations";
};

type JsonRecord = Record<string, unknown>;

type UploadAttachment = {
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    fileContentBase64: string;
};

type ExistingAttachment = {
    key: string;
    id?: string;
    fileName: string;
    fileSize?: number;
    mimeType?: string;
};

type OrganizationTreeNode = {
    value: string;
    label: string;
    children: OrganizationTreeNode[];
};

function getEntityId(item: JsonRecord): string {
    const candidate = item.id ?? item.uuid ?? item._id ?? "";
    return String(candidate);
}

function parseInputJson(raw: string): JsonRecord | null {
    if (!raw.trim()) {
        return null;
    }
    return JSON.parse(raw) as JsonRecord;
}

function safeStringify(value: unknown): string {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return "{}";
    }
}

function isPlainObject(value: unknown): value is JsonRecord {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function trimObjectByIdFields(item: JsonRecord): JsonRecord {
    const result: JsonRecord = { ...item };
    ["id", "uuid", "_id", "createdAt", "updatedAt"].forEach((key) => {
        delete result[key];
    });
    return result;
}

function toFormValue(value: unknown): string {
    if (value === null || value === undefined) {
        return "";
    }
    if (typeof value === "string") {
        return value;
    }
    return String(value);
}

function buildPayloadFromForm(fields: FormFieldConfig[], values: JsonRecord): JsonRecord {
    const payload: JsonRecord = {};
    fields.forEach((field) => {
        const rawValue = values[field.key];
        if (rawValue === undefined || rawValue === null || rawValue === "") {
            return;
        }

        if (field.valueType === "boolean") {
            const normalized = String(rawValue).trim().toLowerCase();
            payload[field.key] = normalized === "true" || normalized === "1" || normalized === "yes";
            return;
        }

        if (field.type === "number" || field.valueType === "number") {
            const numValue = Number(rawValue);
            if (!Number.isNaN(numValue)) {
                payload[field.key] = numValue;
            }
            return;
        }

        payload[field.key] = rawValue;
    });

    return payload;
}

function validateRequiredFields(fields: FormFieldConfig[], values: JsonRecord): string | null {
    const missingField = fields.find((field) => field.required && !String(values[field.key] ?? "").trim());
    if (!missingField) {
        return null;
    }

    return `Vui lòng nhập trường bắt buộc: ${missingField.label}.`;
}

function normalizeText(value: unknown): string {
    return String(value ?? "").toLowerCase().trim();
}

function formatFileSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return "0 KB";
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || "");
            const commaIndex = result.indexOf(",");
            resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
        };
        reader.onerror = () => reject(new Error("Không thể đọc file."));
        reader.readAsDataURL(file);
    });
}

function getAttachmentName(value: unknown): string {
    if (typeof value === "string") {
        return value;
    }
    if (!value || typeof value !== "object") {
        return "";
    }

    const item = value as JsonRecord;
    return String(item.fileName ?? item.name ?? item.originalName ?? item.filePath ?? "").trim();
}

function getFileExtension(fileName: string): string {
    const name = fileName.trim().toLowerCase();
    const dotIndex = name.lastIndexOf(".");
    if (dotIndex < 0 || dotIndex === name.length - 1) {
        return "";
    }
    return name.slice(dotIndex + 1);
}

function parseExistingAttachments(item: JsonRecord): ExistingAttachment[] {
    const groups = [item.attachments, item.files, item.fileList];
    const result: ExistingAttachment[] = [];

    groups.forEach((group, groupIndex) => {
        if (!Array.isArray(group)) {
            return;
        }

        group.forEach((entry, entryIndex) => {
            if (typeof entry === "string") {
                const fileName = entry.trim();
                if (!fileName) {
                    return;
                }
                result.push({
                    key: `${groupIndex}-${entryIndex}-${fileName}`,
                    fileName,
                });
                return;
            }

            if (!entry || typeof entry !== "object") {
                return;
            }

            const data = entry as JsonRecord;
            const id = String(data.uuid ?? data.id ?? data._id ?? "").trim();
            const fileName = getAttachmentName(data);
            if (!fileName) {
                return;
            }

            const sizeRaw = data.fileSize ?? data.size;
            const parsedSize = Number(sizeRaw);

            result.push({
                key: id ? `id-${id}` : `${groupIndex}-${entryIndex}-${fileName}`,
                id: id || undefined,
                fileName,
                fileSize: Number.isFinite(parsedSize) ? parsedSize : undefined,
                mimeType: String(data.mimeType ?? data.type ?? "").trim() || undefined,
            });
        });
    });

    const deduped = new Map<string, ExistingAttachment>();
    result.forEach((attachment) => {
        const dedupeKey = attachment.id || attachment.fileName;
        if (!dedupeKey || deduped.has(dedupeKey)) {
            return;
        }
        deduped.set(dedupeKey, attachment);
    });

    return Array.from(deduped.values());
}

export default function ResourceCrudPage({
    title,
    endpoint,
    description,
    defaultCreatePayload = "{}",
    columns: configColumns,
    detailFields,
    detailSections = [],
    formFields = [],
    filterFields = [],
    moduleType,
}: ResourceCrudPageProps) {
    const [items, setItems] = useState<JsonRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mutationError, setMutationError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [filterValues, setFilterValues] = useState<JsonRecord>({});
    const [optionsByFieldKey, setOptionsByFieldKey] = useState<Record<string, SelectOption[]>>({});
    const [organizationTreeByFieldKey, setOrganizationTreeByFieldKey] = useState<Record<string, OrganizationTreeNode[]>>({});
    const [loadingFieldOptions, setLoadingFieldOptions] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const [createPayload, setCreatePayload] = useState(defaultCreatePayload);
    const [updatePayload, setUpdatePayload] = useState("{}");
    const [createFormValues, setCreateFormValues] = useState<JsonRecord>({});
    const [editFormValues, setEditFormValues] = useState<JsonRecord>({});
    const [showCreateRawEditor, setShowCreateRawEditor] = useState(false);
    const [showEditRawEditor, setShowEditRawEditor] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
    const [detailItem, setDetailItem] = useState<JsonRecord | null>(null);
    const [mutating, setMutating] = useState(false);
    const [createAttachments, setCreateAttachments] = useState<UploadAttachment[]>([]);
    const [editAttachments, setEditAttachments] = useState<UploadAttachment[]>([]);
    const [editExistingAttachments, setEditExistingAttachments] = useState<ExistingAttachment[]>([]);
    const [removingExistingAttachmentKey, setRemovingExistingAttachmentKey] = useState<string | null>(null);
    const [openTreeSelectKey, setOpenTreeSelectKey] = useState<string | null>(null);
    const [expandedTreeNodes, setExpandedTreeNodes] = useState<Record<string, boolean>>({});
    const createAttachmentInputRef = useRef<HTMLInputElement | null>(null);
    const editAttachmentInputRef = useRef<HTMLInputElement | null>(null);

    const cardClassName =
        "rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900";
    const useAssignedListStyle = moduleType === "assignments" || moduleType === "evaluations";
    const maxUploadSizeBytes = 50 * 1024 * 1024;

    // Use provided columns config, or auto-detect if not provided
    const columns: ColumnConfig[] = useMemo(() => {
        if (configColumns && configColumns.length > 0) {
            return configColumns;
        }

        // Fallback: auto-detect columns from first 8 items
        if (!items.length) {
            return [] as ColumnConfig[];
        }
        const mergedKeys = new Set<string>();
        items.slice(0, 8).forEach((item) => {
            Object.keys(item).forEach((key) => mergedKeys.add(key));
        });
        const autoKeys = Array.from(mergedKeys).slice(0, 7);
        return autoKeys.map((key) => ({ key, label: key, format: undefined }));
    }, [items, configColumns]);

    const allSelectableFields = useMemo(
        () => [...formFields, ...filterFields].filter((field) => field.type === "select" && field.optionSource),
        [formFields, filterFields]
    );

    useEffect(() => {
        if (!allSelectableFields.length) {
            return;
        }

        let cancelled = false;

        const toOption = (row: JsonRecord, labelKeys?: string[]): SelectOption => {
            const value = String(row.uuid ?? row.id ?? row._id ?? row.code ?? "");
            const labels = (labelKeys && labelKeys.length
                ? labelKeys
                : ["name", "title", "code", "email", "documentNumber"])
                .map((key) => String(row[key] ?? "").trim())
                .filter(Boolean);
            return {
                value,
                label: labels.join(" - ") || value,
            };
        };

        const buildOrganizationTree = (rows: JsonRecord[], labelKeys?: string[]): OrganizationTreeNode[] => {
            const getNodeId = (row: JsonRecord) => String(row.uuid ?? row.id ?? row._id ?? "").trim();
            const getParentId = (row: JsonRecord) =>
                String(
                    row.parentId ??
                    row.parent_id ??
                    row.parentUUID ??
                    row.parentUuid ??
                    row.parentOrganizationId ??
                    row.parentOrgId ??
                    ""
                ).trim();

            const idToRow = new Map<string, JsonRecord>();
            rows.forEach((row) => {
                const id = getNodeId(row);
                if (id) {
                    idToRow.set(id, row);
                }
            });

            const childrenByParent = new Map<string, JsonRecord[]>();
            rows.forEach((row) => {
                const id = getNodeId(row);
                if (!id) {
                    return;
                }

                const rawParentId = getParentId(row);
                const parentId = rawParentId && idToRow.has(rawParentId) ? rawParentId : "ROOT";
                const list = childrenByParent.get(parentId) || [];
                list.push(row);
                childrenByParent.set(parentId, list);
            });

            childrenByParent.forEach((list) => {
                list.sort((a, b) =>
                    toOption(a, labelKeys).label.localeCompare(toOption(b, labelKeys).label, "vi")
                );
            });

            const visited = new Set<string>();
            const buildNodes = (parentId: string): OrganizationTreeNode[] => {
                const children = childrenByParent.get(parentId) || [];
                const nodes: OrganizationTreeNode[] = [];

                children.forEach((row) => {
                    const id = getNodeId(row);
                    if (!id || visited.has(id)) {
                        return;
                    }

                    visited.add(id);
                    const base = toOption(row, labelKeys);
                    nodes.push({
                        value: base.value,
                        label: base.label,
                        children: buildNodes(id),
                    });
                });
                return nodes;
            };

            return buildNodes("ROOT");
        };

        const flattenOrganizationTree = (nodes: OrganizationTreeNode[]): SelectOption[] => {
            const options: SelectOption[] = [];
            const walk = (items: OrganizationTreeNode[]) => {
                items.forEach((node) => {
                    options.push({ value: node.value, label: node.label });
                    if (node.children.length) {
                        walk(node.children);
                    }
                });
            };
            walk(nodes);
            return options;
        };

        const loadFieldOptions = async () => {
            setLoadingFieldOptions(true);
            try {
                const nextOptions: Record<string, SelectOption[]> = {};
                const nextOrganizationTree: Record<string, OrganizationTreeNode[]> = {};

                const categoryBasedFields = allSelectableFields.filter(
                    (field) => field.optionSource?.source === "category-items"
                );

                if (categoryBasedFields.length > 0) {
                    const [categoriesRaw, categoryItemsRaw] = await Promise.all([
                        api.get<unknown>("/admin/categories?page=1&limit=100"),
                        api.get<unknown>("/admin/category-items?page=1&limit=100"),
                    ]);

                    const categories = extractList<JsonRecord>(categoriesRaw);
                    const categoryItems = extractList<JsonRecord>(categoryItemsRaw);
                    const categoryCodeToIds = new Map<string, string[]>();

                    const semanticAliases: Record<string, string[]> = {
                        status: ["status", "trạng thái", "doc_status", "task_status"],
                        priority: ["priority", "mức độ ưu tiên", "task_priority"],
                        documentType: ["document type", "loại văn bản", "doc_type"],
                        field: ["field", "lĩnh vực", "task_field"],
                    };

                    const findCategoryIdsByHints = (hints: string[]): string[] => {
                        const normalizedHints = hints.map((hint) => normalizeText(hint)).filter(Boolean);
                        if (!normalizedHints.length) {
                            return [];
                        }

                        return categories
                            .filter((cat) => {
                                const searchable = [cat.code, cat.name, cat.description]
                                    .map((value) => normalizeText(value))
                                    .join(" ");
                                return normalizedHints.some((hint) => searchable.includes(hint));
                            })
                            .map((cat) => String(cat.uuid ?? cat.id ?? ""))
                            .filter(Boolean);
                    };

                    categories.forEach((cat) => {
                        const code = String(cat.code ?? "").toUpperCase();
                        const id = String(cat.uuid ?? cat.id ?? "");
                        if (!code || !id) {
                            return;
                        }
                        const current = categoryCodeToIds.get(code) || [];
                        current.push(id);
                        categoryCodeToIds.set(code, current);
                    });

                    categoryBasedFields.forEach((field) => {
                        const source = field.optionSource;
                        if (!source || source.source !== "category-items") {
                            return;
                        }

                        let categoryIds = source.categoryCodes
                            .flatMap((code) => categoryCodeToIds.get(code.toUpperCase()) || []);

                        if (!categoryIds.length && source.categoryHints?.length) {
                            categoryIds = findCategoryIdsByHints(source.categoryHints);
                        }

                        if (!categoryIds.length) {
                            const key = normalizeText(field.key);
                            if (key.includes("status")) {
                                categoryIds = findCategoryIdsByHints(semanticAliases.status);
                            } else if (key.includes("priority")) {
                                categoryIds = findCategoryIdsByHints(semanticAliases.priority);
                            } else if (key.includes("documenttype") || key.includes("doctype")) {
                                categoryIds = findCategoryIdsByHints(semanticAliases.documentType);
                            } else if (key.includes("field")) {
                                categoryIds = findCategoryIdsByHints(semanticAliases.field);
                            }
                        }

                        const matchedItems = categoryItems.filter((item) => {
                            if (!categoryIds.length) {
                                return false;
                            }
                            return categoryIds.includes(String(item.categoryId ?? ""));
                        });

                        nextOptions[field.key] = matchedItems
                            .map((item) => toOption(item, ["name", "code"]))
                            .filter((option) => option.value)
                            .slice(0, 200);
                    });
                }

                const endpointBasedFields = allSelectableFields.filter(
                    (field) => field.optionSource?.source === "endpoint"
                );

                const endpointCache = new Map<string, JsonRecord[]>();

                for (const field of endpointBasedFields) {
                    const source = field.optionSource;
                    if (!source || source.source !== "endpoint") {
                        continue;
                    }

                    const endpointKey = source.endpoint;
                    if (!endpointCache.has(endpointKey)) {
                        const raw = await api.get<unknown>(`${endpointKey}?page=1&limit=100`);
                        endpointCache.set(endpointKey, extractList<JsonRecord>(raw));
                    }

                    const rows = endpointCache.get(endpointKey) || [];

                    // Render organizations as tree-select with parent-child indentation.
                    if (endpointKey === "/admin/organizations") {
                        const treeNodes = buildOrganizationTree(rows, source.labelKeys);
                        nextOrganizationTree[field.key] = treeNodes;
                        nextOptions[field.key] = flattenOrganizationTree(treeNodes)
                            .filter((option) => option.value)
                            .slice(0, 200);
                        continue;
                    }

                    nextOptions[field.key] = rows
                        .map((row) => toOption(row, source.labelKeys))
                        .filter((option) => option.value)
                        .slice(0, 200);
                }

                if (!cancelled) {
                    setOptionsByFieldKey(nextOptions);
                    setOrganizationTreeByFieldKey(nextOrganizationTree);
                }
            } catch {
                if (!cancelled) {
                    setOptionsByFieldKey({});
                    setOrganizationTreeByFieldKey({});
                }
            } finally {
                if (!cancelled) {
                    setLoadingFieldOptions(false);
                }
            }
        };

        void loadFieldOptions();

        return () => {
            cancelled = true;
        };
    }, [allSelectableFields]);

    const filteredItems = useMemo(() => {
        const q = query.trim().toLowerCase();
        return items.filter((item) => {
            const matchesQuery =
                !q ||
                Object.values(item).some((value) => {
                    if (value == null) {
                        return false;
                    }
                    if (typeof value === "object") {
                        return safeStringify(value).toLowerCase().includes(q);
                    }
                    return String(value).toLowerCase().includes(q);
                });

            if (!matchesQuery) {
                return false;
            }

            return filterFields.every((field) => {
                const filterValue = String(filterValues[field.key] ?? "").trim();
                if (!filterValue) {
                    return true;
                }

                const targetKey = field.targetKey || field.key;
                const itemValue = item[targetKey];
                if (itemValue == null) {
                    return false;
                }

                if (field.type === "select") {
                    return String(itemValue) === filterValue;
                }

                if (field.type === "date-from") {
                    const itemTime = new Date(String(itemValue)).getTime();
                    const filterTime = new Date(filterValue).getTime();
                    if (Number.isNaN(itemTime) || Number.isNaN(filterTime)) {
                        return false;
                    }
                    return itemTime >= filterTime;
                }

                if (field.type === "date-to") {
                    const itemTime = new Date(String(itemValue)).getTime();
                    const filterTime = new Date(filterValue).getTime();
                    if (Number.isNaN(itemTime) || Number.isNaN(filterTime)) {
                        return false;
                    }
                    return itemTime <= filterTime + 24 * 60 * 60 * 1000 - 1;
                }

                if (field.type === "date") {
                    return String(itemValue).startsWith(filterValue);
                }

                return String(itemValue).toLowerCase().includes(filterValue.toLowerCase());
            });
        });
    }, [items, query, filterFields, filterValues]);

    const activeFilterChips = useMemo(() => {
        const chips: Array<{ key: string; label: string; value: string }> = [];

        const trimmedQuery = query.trim();
        if (trimmedQuery) {
            chips.push({
                key: "__query__",
                label: "Tìm kiếm",
                value: trimmedQuery,
            });
        }

        filterFields.forEach((field) => {
            const raw = String(filterValues[field.key] ?? "").trim();
            if (!raw) {
                return;
            }

            let displayValue = raw;
            if (field.type === "select") {
                const options = field.options || optionsByFieldKey[field.key] || [];
                const matched = options.find((option) => option.value === raw);
                if (matched) {
                    displayValue = matched.label;
                }
            }

            if (field.type === "date-from") {
                displayValue = `Từ ${displayValue}`;
            } else if (field.type === "date-to") {
                displayValue = `Đến ${displayValue}`;
            }

            chips.push({
                key: field.key,
                label: field.label,
                value: displayValue,
            });
        });

        return chips;
    }, [query, filterFields, filterValues, optionsByFieldKey]);

    const totalPages = Math.max(1, Math.ceil(filteredItems.length / rowsPerPage));
    const pagedItems = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return filteredItems.slice(start, start + rowsPerPage);
    }, [filteredItems, currentPage, rowsPerPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [query, rowsPerPage, filterValues]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const loadData = useCallback(async (silent = false) => {
        if (silent) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        setError(null);
        try {
            const data = await api.get<unknown>(endpoint);
            const list = extractList<JsonRecord>(data);
            if (list.length) {
                setItems(list);
            } else if (isPlainObject(data)) {
                setItems([data]);
            } else {
                setItems([]);
            }
        } catch (err) {
            if (err instanceof ApiError) {
                setError(err.message);
            } else {
                setError("Không thể tải dữ liệu.");
            }
        } finally {
            if (silent) {
                setRefreshing(false);
            } else {
                setLoading(false);
            }
        }
    }, [endpoint]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const openCreateModal = () => {
        setCreatePayload(defaultCreatePayload);
        setShowCreateRawEditor(false);
        setCreateAttachments([]);
        setEditExistingAttachments([]);
        if (formFields.length > 0) {
            const parsedDefault = parseInputJson(defaultCreatePayload) || {};
            const nextValues: JsonRecord = {};
            formFields.forEach((field) => {
                nextValues[field.key] = toFormValue(parsedDefault[field.key]);
            });
            setCreateFormValues(nextValues);
        }
        setMutationError(null);
        setCreateOpen(true);
    };

    const openEditModal = (item: JsonRecord) => {
        const id = getEntityId(item);
        if (!id) {
            setMutationError("Không xác định được ID bản ghi.");
            return;
        }
        setEditingId(id);
        const cleanedItem = trimObjectByIdFields(item);
        setUpdatePayload(safeStringify(cleanedItem));
        setShowEditRawEditor(false);
        setEditAttachments([]);
        setEditExistingAttachments(parseExistingAttachments(item));
        if (formFields.length > 0) {
            const nextValues: JsonRecord = {};
            formFields.forEach((field) => {
                nextValues[field.key] = toFormValue(cleanedItem[field.key]);
            });
            setEditFormValues(nextValues);
        }
        setMutationError(null);
        setEditOpen(true);
    };

    const handleCreate = async () => {
        setMutationError(null);
        setMessage(null);
        setMutating(true);
        try {
            const requiredError = formFields.length
                ? validateRequiredFields(formFields, createFormValues)
                : null;
            if (requiredError) {
                setMutationError(requiredError);
                return;
            }

            const payload = formFields.length
                ? buildPayloadFromForm(formFields, createFormValues)
                : {};

            await api.post(endpoint, payload || {});
            setCreateOpen(false);
            setMessage("Tạo bản ghi thành công.");
            await loadData(true);
        } catch (err) {
            if (err instanceof ApiError) {
                setMutationError(err.message);
            } else {
                setMutationError("Tạo mới thất bại.");
            }
        } finally {
            setMutating(false);
        }
    };

    const handleUpdate = async () => {
        setMutationError(null);
        setMessage(null);
        try {
            if (!editingId?.trim()) {
                setMutationError("Vui lòng nhập ID bản ghi để cập nhật.");
                return;
            }

            const requiredError = formFields.length
                ? validateRequiredFields(formFields, editFormValues)
                : null;
            if (requiredError) {
                setMutationError(requiredError);
                return;
            }

            const payload = formFields.length
                ? buildPayloadFromForm(formFields, editFormValues)
                : {};

            setMutating(true);
            await api.patch(`${endpoint}/${editingId.trim()}`, payload || {});
            setEditOpen(false);
            setEditingId(null);
            setMessage("Cập nhật bản ghi thành công.");
            await loadData(true);
        } catch (err) {
            if (err instanceof ApiError) {
                setMutationError(err.message);
            } else {
                setMutationError("Cập nhật thất bại.");
            }
        } finally {
            setMutating(false);
        }
    };

    const handleDelete = async () => {
        setMutationError(null);
        setMessage(null);
        if (!deleteTarget?.id.trim()) {
            setMutationError("Vui lòng chọn bản ghi để xóa.");
            return;
        }

        try {
            setDeletingId(deleteTarget.id);
            await api.delete(`${endpoint}/${deleteTarget.id.trim()}`);
            setDeleteTarget(null);
            setMessage("Xóa bản ghi thành công.");
            await loadData(true);
        } catch (err) {
            if (err instanceof ApiError) {
                setMutationError(err.message);
            } else {
                setMutationError("Xóa thất bại.");
            }
        } finally {
            setDeletingId(null);
        }
    };

    const renderFormFields = (
        values: JsonRecord,
        setValues: Dispatch<SetStateAction<JsonRecord>>
    ) => {
        if (!formFields.length) {
            return null;
        }

        return (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {formFields.map((field) => (
                    <label key={field.key} className={field.type === "textarea" ? "md:col-span-2" : ""}>
                        <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                            {field.label}
                            {field.required ? <span className="text-error-600"> *</span> : null}
                        </span>
                        {field.type === "textarea" ? (
                            <textarea
                                value={toFormValue(values[field.key])}
                                placeholder={field.placeholder}
                                onChange={(event) =>
                                    setValues((prev) => ({
                                        ...prev,
                                        [field.key]: event.target.value,
                                    }))
                                }
                                rows={4}
                                className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-sky-600 dark:focus:ring-sky-900/50"
                            />
                        ) : field.type === "select" ? (
                            field.optionSource?.source === "endpoint" && field.optionSource.endpoint === "/admin/organizations" ? (
                                renderTreeSelect(
                                    `form-${field.key}`,
                                    field.key,
                                    toFormValue(values[field.key]),
                                    (nextValue) =>
                                        setValues((prev) => ({
                                            ...prev,
                                            [field.key]: nextValue,
                                        })),
                                    field.placeholder || "-- Chọn --"
                                )
                            ) : (
                                <select
                                    value={toFormValue(values[field.key])}
                                    onChange={(event) =>
                                        setValues((prev) => ({
                                            ...prev,
                                            [field.key]: event.target.value,
                                        }))
                                    }
                                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-sky-600 dark:focus:ring-sky-900/50"
                                >
                                    <option value="">-- Chọn --</option>
                                    {(field.options || optionsByFieldKey[field.key] || []).map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            )
                        ) : field.type === "date" ? (
                            <DatePickerInput
                                value={toFormValue(values[field.key])}
                                onChange={(newValue) =>
                                    setValues((prev) => ({
                                        ...prev,
                                        [field.key]: newValue,
                                    }))
                                }
                                placeholder={field.placeholder || "Chọn ngày"}
                            />
                        ) : (
                            <input
                                type={field.type || "text"}
                                value={toFormValue(values[field.key])}
                                placeholder={field.placeholder}
                                onChange={(event) =>
                                    setValues((prev) => ({
                                        ...prev,
                                        [field.key]: event.target.value,
                                    }))
                                }
                                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-sky-600 dark:focus:ring-sky-900/50"
                            />
                        )}
                    </label>
                ))}
            </div>
        );
    };

    const detailColumns = detailFields && detailFields.length ? detailFields : columns;

    const handleAttachmentSelect = async (
        event: ChangeEvent<HTMLInputElement>,
        target: "create" | "edit"
    ) => {
        const selectedFiles = Array.from(event.target.files || []);
        event.target.value = "";

        if (!selectedFiles.length) {
            return;
        }

        const validFiles = selectedFiles.filter((file) => file.size <= maxUploadSizeBytes);
        if (validFiles.length !== selectedFiles.length) {
            setMutationError("Một số file vượt quá dung lượng 50MB và đã bị bỏ qua.");
        }

        if (!validFiles.length) {
            return;
        }

        try {
            const uploaded = await Promise.all(
                validFiles.map(async (file, index) => ({
                    id: `${Date.now()}-${index}-${file.name}`,
                    fileName: file.name,
                    fileSize: file.size,
                    mimeType: file.type || "application/octet-stream",
                    fileContentBase64: await fileToBase64(file),
                }))
            );

            if (target === "create") {
                setCreateAttachments((prev) => [...prev, ...uploaded]);
                const firstName = uploaded[0]?.fileName;
                if (firstName) {
                    setCreateFormValues((prev) => {
                        if (String(prev.filePath ?? "").trim()) {
                            return prev;
                        }
                        return { ...prev, filePath: firstName };
                    });
                }
            } else {
                setEditAttachments((prev) => [...prev, ...uploaded]);
                const firstName = uploaded[0]?.fileName;
                if (firstName) {
                    setEditFormValues((prev) => {
                        if (String(prev.filePath ?? "").trim()) {
                            return prev;
                        }
                        return { ...prev, filePath: firstName };
                    });
                }
            }
        } catch {
            setMutationError("Không thể đọc file tải lên. Vui lòng thử lại.");
        }
    };

    const removeAttachment = (target: "create" | "edit", attachmentId: string) => {
        if (target === "create") {
            setCreateAttachments((prev) => {
                const next = prev.filter((item) => item.id !== attachmentId);
                setCreateFormValues((values) => {
                    const currentFilePath = String(values.filePath ?? "").trim();
                    const removed = prev.find((item) => item.id === attachmentId);
                    if (!removed || currentFilePath !== removed.fileName) {
                        return values;
                    }
                    return { ...values, filePath: next[0]?.fileName || "" };
                });
                return next;
            });
            return;
        }
        setEditAttachments((prev) => {
            const next = prev.filter((item) => item.id !== attachmentId);
            setEditFormValues((values) => {
                const currentFilePath = String(values.filePath ?? "").trim();
                const removed = prev.find((item) => item.id === attachmentId);
                if (!removed || currentFilePath !== removed.fileName) {
                    return values;
                }
                const fallback = next[0]?.fileName || editExistingAttachments[0]?.fileName || "";
                return { ...values, filePath: fallback };
            });
            return next;
        });
    };

    const removeExistingAttachment = async (attachment: ExistingAttachment) => {
        if (!attachment.id) {
            setMutationError("File cũ không có định danh nên chưa thể xóa qua API.");
            return;
        }

        try {
            setRemovingExistingAttachmentKey(attachment.key);
            setMutationError(null);
            await api.delete(`${endpoints.admin.files}/${attachment.id}`);

            setEditExistingAttachments((prev) => {
                const next = prev.filter((item) => item.key !== attachment.key);
                setEditFormValues((values) => {
                    const currentFilePath = String(values.filePath ?? "").trim();
                    if (currentFilePath !== attachment.fileName) {
                        return values;
                    }
                    const fallback = next[0]?.fileName || editAttachments[0]?.fileName || "";
                    return { ...values, filePath: fallback };
                });
                return next;
            });
        } catch (err) {
            if (err instanceof ApiError) {
                setMutationError(err.message);
            } else {
                setMutationError("Không thể xóa file cũ.");
            }
        } finally {
            setRemovingExistingAttachmentKey(null);
        }
    };

    const getAttachmentTypeView = (fileName: string) => {
        const ext = getFileExtension(fileName);
        if (ext === "pdf") {
            return {
                icon: <FileText className="h-4 w-4 text-red-500" />,
                label: "PDF",
            };
        }
        if (ext === "xls" || ext === "xlsx") {
            return {
                icon: <FileSpreadsheet className="h-4 w-4 text-emerald-600" />,
                label: ext.toUpperCase(),
            };
        }
        if (ext === "doc" || ext === "docx") {
            return {
                icon: <FileText className="h-4 w-4 text-sky-600" />,
                label: ext.toUpperCase(),
            };
        }
        return {
            icon: <File className="h-4 w-4 text-gray-500" />,
            label: ext ? ext.toUpperCase() : "FILE",
        };
    };

    const renderTreeSelect = (
        selectKey: string,
        fieldKey: string,
        value: string,
        onChange: (nextValue: string) => void,
        placeholder: string
    ) => {
        const treeNodes = organizationTreeByFieldKey[fieldKey] || [];
        if (!treeNodes.length) {
            return null;
        }

        const options = optionsByFieldKey[fieldKey] || [];
        const selectedLabel = options.find((option) => option.value === value)?.label || "";
        const isOpen = openTreeSelectKey === selectKey;

        const findSelectedPath = (
            nodes: OrganizationTreeNode[],
            selectedValue: string,
            parentPath: string[] = []
        ): string[] | null => {
            for (const node of nodes) {
                const currentPath = [...parentPath, node.value];
                if (node.value === selectedValue) {
                    return currentPath;
                }

                if (node.children.length > 0) {
                    const childPath = findSelectedPath(node.children, selectedValue, currentPath);
                    if (childPath) {
                        return childPath;
                    }
                }
            }

            return null;
        };

        const expandSelectedPath = () => {
            if (!value) {
                return;
            }

            const path = findSelectedPath(treeNodes, value);
            if (!path?.length) {
                return;
            }

            setExpandedTreeNodes((prev) => {
                const next = { ...prev };
                path.forEach((nodeValue) => {
                    next[`${selectKey}:${nodeValue}`] = true;
                });
                return next;
            });
        };

        const renderNodes = (nodes: OrganizationTreeNode[], depth: number) =>
            nodes.map((node) => {
                const nodeExpandKey = `${selectKey}:${node.value}`;
                const isExpanded = Boolean(expandedTreeNodes[nodeExpandKey]);
                const hasChildren = node.children.length > 0;
                const isSelected = value === node.value;

                return (
                    <div key={nodeExpandKey}>
                        <button
                            type="button"
                            onClick={() => {
                                onChange(node.value);
                                setOpenTreeSelectKey(null);
                            }}
                            className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-gray-100 dark:hover:bg-gray-700 ${isSelected ? "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" : ""
                                }`}
                        >
                            <span className="flex min-w-0 items-center gap-1" style={{ paddingLeft: `${depth * 14}px` }}>
                                {hasChildren ? (
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            setExpandedTreeNodes((prev) => ({
                                                ...prev,
                                                [nodeExpandKey]: !prev[nodeExpandKey],
                                            }));
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key !== "Enter" && event.key !== " ") {
                                                return;
                                            }
                                            event.preventDefault();
                                            event.stopPropagation();
                                            setExpandedTreeNodes((prev) => ({
                                                ...prev,
                                                [nodeExpandKey]: !prev[nodeExpandKey],
                                            }));
                                        }}
                                        className="rounded p-0.5 text-gray-500 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-600"
                                        aria-label={isExpanded ? "Thu gọn node" : "Mở node con"}
                                    >
                                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                    </span>
                                ) : (
                                    <span className="inline-block h-3.5 w-3.5" />
                                )}
                                <span className="truncate">{node.label}</span>
                            </span>

                            {isSelected ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                        </button>

                        {hasChildren && isExpanded ? <div>{renderNodes(node.children, depth + 1)}</div> : null}
                    </div>
                );
            });

        return (
            <div className="relative">
                <button
                    type="button"
                    onClick={() => {
                        if (isOpen) {
                            setOpenTreeSelectKey(null);
                            return;
                        }

                        expandSelectedPath();
                        setOpenTreeSelectKey(selectKey);
                    }}
                    className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-left text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-sky-600 dark:focus:ring-sky-900/50"
                >
                    <span className={`truncate ${selectedLabel ? "text-gray-800 dark:text-gray-100" : "text-gray-400"}`}>
                        {selectedLabel || placeholder}
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-gray-500 transition ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {isOpen ? (
                    <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                        <button
                            type="button"
                            onClick={() => {
                                onChange("");
                                setOpenTreeSelectKey(null);
                            }}
                            className="mb-1 w-full rounded-md px-2 py-1.5 text-left text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                            -- Chọn --
                        </button>
                        {renderNodes(treeNodes, 0)}
                    </div>
                ) : null}
            </div>
        );
    };

    const renderAttachmentUploader = (
        target: "create" | "edit",
        attachments: UploadAttachment[],
        existingAttachments: ExistingAttachment[] = []
    ) => {
        const fileInputRef = target === "create" ? createAttachmentInputRef : editAttachmentInputRef;

        return (
            <section className="mt-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Tệp đính kèm</p>

                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    className="hidden"
                    onChange={(event) => void handleAttachmentSelect(event, target)}
                />

                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-orange-300 bg-orange-50/50 px-4 py-4 text-sm font-medium text-orange-700 transition hover:bg-orange-100/60 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-300"
                >
                    <Upload className="h-4 w-4" />
                    Tải file lên
                </button>

                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Hỗ trợ tải nhiều file. Mỗi file tối đa 50MB.
                </p>

                {existingAttachments.length > 0 && (
                    <div className="mt-3 space-y-2">
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-300">File hiện có:</p>
                        {existingAttachments.map((attachment) => {
                            const typeView = getAttachmentTypeView(attachment.fileName);
                            return (
                                <div
                                    key={attachment.key}
                                    className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            {typeView.icon}
                                            <p className="truncate font-medium">{attachment.fileName}</p>
                                            <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                                                {typeView.label}
                                            </span>
                                        </div>
                                        {attachment.fileSize ? (
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {formatFileSize(attachment.fileSize)}
                                            </p>
                                        ) : null}
                                    </div>

                                    {target === "edit" ? (
                                        <button
                                            type="button"
                                            onClick={() => void removeExistingAttachment(attachment)}
                                            disabled={!attachment.id || removingExistingAttachmentKey === attachment.key}
                                            className="rounded-md p-1.5 text-error-600 transition hover:bg-error-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-error-900/30"
                                            title={attachment.id ? "Xóa file cũ" : "File này không có ID để xóa qua API"}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                )}

                {attachments.length > 0 && (
                    <div className="mt-3 space-y-2">
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-300">File mới tải lên:</p>
                        {attachments.map((attachment) => {
                            const typeView = getAttachmentTypeView(attachment.fileName);
                            return (
                                <div
                                    key={attachment.id}
                                    className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                                >
                                    <div className="min-w-0 text-sm text-gray-700 dark:text-gray-200">
                                        <div className="flex items-center gap-2">
                                            {typeView.icon}
                                            <p className="truncate font-medium">{attachment.fileName}</p>
                                            <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                                                {typeView.label}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {formatFileSize(attachment.fileSize)}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeAttachment(target, attachment.id)}
                                        className="rounded-md p-1.5 text-error-600 transition hover:bg-error-50 dark:hover:bg-error-900/30"
                                        title="Xóa file"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        );
    };

    const renderModuleDetailExtras = (item: JsonRecord) => {
        if (moduleType === "tasks" || moduleType === "evaluations") {
            const progress = String(item.progress ?? "").trim();
            const statusRaw = normalizeText(item.statusId ?? item.status ?? "");
            const statusLabel = statusRaw || "chưa xác định";

            const timeline = [
                { label: "Khởi tạo", value: item.createdAt, icon: <History className="h-4 w-4 text-gray-500" /> },
                { label: "Đang xử lý", value: item.startDate ?? item.updatedAt, icon: <Clock3 className="h-4 w-4 text-sky-600" /> },
                { label: "Mốc hạn", value: item.dueDate, icon: <CalendarDays className="h-4 w-4 text-amber-600" /> },
                { label: "Hoàn thành", value: item.completedAt, icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" /> },
                { label: "Phê duyệt", value: item.approvedAt, icon: <CalendarClock className="h-4 w-4 text-violet-600" /> },
            ].filter((entry) => entry.value);

            const statusBadgeClass = statusLabel.includes("done") || statusLabel.includes("complete")
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                : statusLabel.includes("progress") || statusLabel.includes("processing")
                    ? "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
                    : statusLabel.includes("overdue") || statusLabel.includes("late")
                        ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";

            return (
                <section className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Tiến độ và lịch sử</p>
                    <div className="mt-2 space-y-2">
                        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800">
                            <span>
                                Tiến độ hiện tại: <span className="font-medium">{progress ? `${progress}%` : "-"}</span>
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass}`}>
                                {statusLabel}
                            </span>
                        </div>
                        {timeline.length ? (
                            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
                                {timeline.map((entry, index) => (
                                    <div key={entry.label} className="flex items-start gap-2">
                                        <div className="mt-0.5 flex flex-col items-center">
                                            {entry.icon}
                                            {index < timeline.length - 1 ? (
                                                <div className="mt-1 h-6 w-px bg-gray-300 dark:bg-gray-600" />
                                            ) : (
                                                <CircleDashed className="mt-1 h-3 w-3 text-gray-300 dark:text-gray-600" />
                                            )}
                                        </div>
                                        <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                                            <p className="font-medium">{entry.label}</p>
                                            <p>{formatValue(entry.value)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400">Chưa có lịch sử cập nhật.</p>
                        )}
                    </div>
                </section>
            );
        }

        return null;
    };

    return (
        <div className="space-y-4 p-4 sm:p-6">
            <div className="relative overflow-hidden rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 via-cyan-50 to-white p-5 shadow-sm dark:border-sky-900/60 dark:from-sky-950/50 dark:via-cyan-950/40 dark:to-gray-900 sm:p-7">
                <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-cyan-300/30 blur-2xl dark:bg-cyan-500/20" />
                <div className="pointer-events-none absolute -left-8 bottom-0 h-28 w-28 rounded-full bg-sky-300/30 blur-2xl dark:bg-sky-500/20" />
                <div className="relative flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                            {title}
                        </h1>
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 sm:text-base">
                            {description || "Dữ liệu được đồng bộ trực tiếp từ API."} Endpoint: <span className="font-medium">{endpoint}</span>
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => void loadData(true)}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                        Tải lại
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className={`${cardClassName} p-4`}>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Tổng bản ghi</p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{items.length}</p>
                </div>
                <div className={`${cardClassName} p-4`}>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Kết quả lọc</p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{filteredItems.length}</p>
                </div>
                <div className={`${cardClassName} p-4`}>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Trang hiện tại</p>
                    <p className="mt-2 text-2xl font-semibold text-sky-600 dark:text-sky-300">{currentPage}/{totalPages}</p>
                </div>
            </div>

            {error && (
                <p className="flex items-start gap-2 rounded-xl border border-error-200 bg-error-50 p-3 text-sm text-error-700 dark:border-error-900 dark:bg-error-950/40 dark:text-error-300">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    {error}
                </p>
            )}

            {message && (
                <p className="flex items-start gap-2 rounded-xl border border-success-200 bg-success-50 p-3 text-sm text-success-700 dark:border-success-900 dark:bg-success-950/40 dark:text-success-300">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    {message}
                </p>
            )}

            {mutationError && (
                <p className="flex items-start gap-2 rounded-xl border border-error-200 bg-error-50 p-3 text-sm text-error-700 dark:border-error-900 dark:bg-error-950/40 dark:text-error-300">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    {mutationError}
                </p>
            )}

            {filterFields.length > 0 && (
                <div className={`${cardClassName} p-4`}>
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                            Bộ lọc nghiệp vụ
                        </p>
                        {loadingFieldOptions && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">Đang tải danh mục...</span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                        {filterFields.map((field) => (
                            <label key={field.key}>
                                <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                                    {field.label}
                                </span>

                                {field.type === "select" ? (
                                    field.optionSource?.source === "endpoint" && field.optionSource.endpoint === "/admin/organizations" ? (
                                        renderTreeSelect(
                                            `filter-${field.key}`,
                                            field.key,
                                            toFormValue(filterValues[field.key]),
                                            (nextValue) =>
                                                setFilterValues((prev) => ({
                                                    ...prev,
                                                    [field.key]: nextValue,
                                                })),
                                            field.placeholder || "-- Tất cả --"
                                        )
                                    ) : (
                                        <select
                                            value={toFormValue(filterValues[field.key])}
                                            onChange={(event) =>
                                                setFilterValues((prev) => ({
                                                    ...prev,
                                                    [field.key]: event.target.value,
                                                }))
                                            }
                                            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-sky-600 dark:focus:ring-sky-900/50"
                                        >
                                            <option value="">-- Tất cả --</option>
                                            {(field.options || optionsByFieldKey[field.key] || []).map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    )
                                ) : field.type === "date" || field.type === "date-from" || field.type === "date-to" ? (
                                    <DatePickerInput
                                        value={toFormValue(filterValues[field.key])}
                                        onChange={(newValue) =>
                                            setFilterValues((prev) => ({
                                                ...prev,
                                                [field.key]: newValue,
                                            }))
                                        }
                                        placeholder={field.placeholder || "Chọn ngày"}
                                    />
                                ) : (
                                    <input
                                        type="text"
                                        value={toFormValue(filterValues[field.key])}
                                        placeholder={field.placeholder}
                                        onChange={(event) =>
                                            setFilterValues((prev) => ({
                                                ...prev,
                                                [field.key]: event.target.value,
                                            }))
                                        }
                                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-sky-600 dark:focus:ring-sky-900/50"
                                    />
                                )}
                            </label>
                        ))}
                    </div>

                    <div className="mt-3 flex justify-end">
                        <button
                            type="button"
                            onClick={() => setFilterValues({})}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                            Xóa bộ lọc
                        </button>
                    </div>
                </div>
            )}

            {useAssignedListStyle && (
                <div className={`${cardClassName} p-4`}>
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Tìm kiếm nhanh</p>
                    </div>

                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="relative w-full md:max-w-md">
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Tìm theo bất kỳ trường nào"
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-10 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-sky-600 dark:focus:ring-sky-900/50"
                            />
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        </div>

                        <button
                            type="button"
                            onClick={openCreateModal}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                        >
                            <Plus className="h-4 w-4" />
                            Thêm bản ghi
                        </button>
                    </div>
                </div>
            )}



            {!useAssignedListStyle && (
                <div className={`${cardClassName} p-4`}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="relative w-full md:max-w-md">
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Tìm theo bất kỳ trường nào"
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-10 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-sky-600 dark:focus:ring-sky-900/50"
                            />
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        </div>

                        <button
                            type="button"
                            onClick={openCreateModal}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                        >
                            <Plus className="h-4 w-4" />
                            Thêm bản ghi
                        </button>
                    </div>
                </div>
            )}

            {activeFilterChips.length > 0 && (
                <div className={`${cardClassName} p-4`}>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            Bộ lọc đang áp dụng:
                        </span>
                        {activeFilterChips.map((chip) => (
                            <button
                                key={chip.key}
                                type="button"
                                onClick={() => {
                                    if (chip.key === "__query__") {
                                        setQuery("");
                                        return;
                                    }

                                    setFilterValues((prev) => {
                                        const next = { ...prev };
                                        delete next[chip.key];
                                        return next;
                                    });
                                }}
                                className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-300 dark:hover:bg-sky-900/50"
                            >
                                <span className="font-medium">{chip.label}:</span>
                                <span>{chip.value}</span>
                                <X className="h-3 w-3" />
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => {
                                setQuery("");
                                setFilterValues({});
                            }}
                            className="ml-auto rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                            Xóa tất cả
                        </button>
                    </div>
                </div>
            )}

            <div className={`${cardClassName} ${useAssignedListStyle ? "overflow-hidden p-0" : "p-4"}`}>
                {loading ? (
                    <div className={`flex flex-col items-center justify-center py-12 ${useAssignedListStyle ? "px-4" : ""}`}>
                        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500 dark:border-gray-700 dark:border-t-brand-400"></div>
                        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Đang tải dữ liệu...</p>
                    </div>
                ) : filteredItems.length === 0 ? (
                    useAssignedListStyle ? (
                        <>
                            <div className="hidden overflow-x-auto md:block">
                                <table className="min-w-full border-collapse text-sm">
                                    <thead>
                                        <tr>
                                            <th className="border border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                                ID
                                            </th>
                                            {columns.map((column) => (
                                                <th
                                                    key={column.key}
                                                    className="border border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                                >
                                                    {column.label}
                                                </th>
                                            ))}
                                            <th className="border border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                                Thao tác
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td colSpan={columns.length + 2} className="px-4 py-20 text-center text-base text-gray-500 dark:text-gray-400">
                                                Không có dữ liệu phù hợp
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400 md:hidden">
                                Không có dữ liệu phù hợp
                            </div>

                            <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-300 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-2">
                                    <span>Có {filteredItems.length} kết quả</span>
                                    <span>|</span>
                                    <span>Hiển thị</span>
                                    <select
                                        value={rowsPerPage}
                                        onChange={(event) => setRowsPerPage(Number(event.target.value))}
                                        className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
                                    >
                                        {[5, 10, 20, 50].map((value) => (
                                            <option key={value} value={value}>
                                                {value}
                                            </option>
                                        ))}
                                    </select>
                                    <span>dòng/trang</span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                        disabled={currentPage <= 1}
                                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                    >
                                        Trước
                                    </button>
                                    <span className="text-sm text-gray-600 dark:text-gray-300">
                                        Trang {currentPage}/{totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                        disabled={currentPage >= totalPages}
                                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                    >
                                        Sau
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className={`flex flex-col items-center justify-center py-16 ${useAssignedListStyle ? "px-4" : ""}`}>
                            <div className="rounded-full bg-gray-100 p-4 dark:bg-gray-800">
                                <Search className="h-8 w-8 text-gray-400 dark:text-gray-600" />
                            </div>
                            <p className="mt-4 text-base font-semibold text-gray-700 dark:text-gray-300">Không có dữ liệu</p>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Hãy thêm bản ghi mới hoặc thử điều chỉnh bộ lọc</p>
                        </div>
                    )
                ) : (
                    <>
                        <div className="hidden overflow-x-auto md:block">
                            <table className="min-w-full border-collapse text-sm">
                                <thead>
                                    <tr>
                                        <th className="border border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                            ID
                                        </th>
                                        {columns.map((column) => (
                                            <th
                                                key={column.key}
                                                className="border border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                            >
                                                {column.label}
                                            </th>
                                        ))}
                                        <th className="border border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                            Thao tác
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedItems.map((item) => {
                                        const id = getEntityId(item);
                                        return (
                                            <tr key={id || JSON.stringify(item)} className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
                                                <td className="border border-gray-200 px-3 py-2 text-xs font-mono text-gray-500 dark:border-gray-700">
                                                    {id}
                                                </td>
                                                {columns.map((column) => (
                                                    <td
                                                        key={`${id}-${column.key}`}
                                                        className="border border-gray-200 px-3 py-2 dark:border-gray-700"
                                                        title={String(item[column.key] ?? "")}
                                                    >
                                                        {column.format
                                                            ? column.format(item[column.key])
                                                            : formatValue(item[column.key])}
                                                    </td>
                                                ))}
                                                <td className="border border-gray-200 px-3 py-2 dark:border-gray-700">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            onClick={() => setDetailItem(item)}
                                                            title="Xem chi tiết"
                                                            className="rounded-full bg-gray-100 p-2.5 text-gray-700 shadow-sm transition hover:scale-110 hover:bg-gray-200 hover:shadow-md dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => openEditModal(item)}
                                                            title="Sửa"
                                                            className={
                                                                useAssignedListStyle
                                                                    ? "rounded p-1 text-warning-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                                                                    : "rounded-full bg-gradient-to-br from-warning-500 to-warning-600 p-2.5 text-white shadow-md transition hover:scale-110 hover:shadow-lg"
                                                            }
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteTarget({ id, label: String(item.name || item.title || id || "bản ghi") })}
                                                            title="Xóa"
                                                            className={
                                                                useAssignedListStyle
                                                                    ? "rounded p-1 text-error-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                                                                    : "rounded-full bg-gradient-to-br from-error-500 to-error-600 p-2.5 text-white shadow-md transition hover:scale-110 hover:shadow-lg"
                                                            }
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:hidden">
                            {pagedItems.map((item) => {
                                const id = getEntityId(item);
                                const titleValue = String(item.name || item.title || item.code || id || "Bản ghi");
                                return (
                                    <div key={id || JSON.stringify(item)} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                                        <div className="mb-2 flex items-center justify-between gap-2">
                                            <p className="text-base font-semibold text-gray-900 dark:text-white">{titleValue}</p>
                                            <span className="text-xs text-gray-500">{id || "-"}</span>
                                        </div>

                                        <div className="space-y-1">
                                            {columns.slice(0, 4).map((column) => (
                                                <p key={`${id}-${column.key}`} className="text-sm text-gray-600 dark:text-gray-300">
                                                    <span className="font-medium text-gray-800 dark:text-gray-200">{column.label}: </span>
                                                    {column.format
                                                        ? column.format(item[column.key])
                                                        : formatValue(item[column.key])}
                                                </p>
                                            ))}
                                        </div>

                                        <div className="mt-3 flex items-center justify-end gap-1.5">
                                            <button
                                                onClick={() => setDetailItem(item)}
                                                title="Xem chi tiết"
                                                className="rounded-full bg-gray-100 p-2.5 text-gray-700 shadow-sm transition hover:scale-110 hover:bg-gray-200 hover:shadow-md dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => openEditModal(item)}
                                                title="Sửa"
                                                className={
                                                    useAssignedListStyle
                                                        ? "rounded p-1 text-warning-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                                                        : "rounded-full bg-gradient-to-br from-warning-500 to-warning-600 p-2.5 text-white shadow-md transition hover:scale-110 hover:shadow-lg"
                                                }
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => setDeleteTarget({ id, label: String(item.name || item.title || id || "bản ghi") })}
                                                title="Xóa"
                                                className={
                                                    useAssignedListStyle
                                                        ? "rounded p-1 text-error-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                                                        : "rounded-full bg-gradient-to-br from-error-500 to-error-600 p-2.5 text-white shadow-md transition hover:scale-110 hover:shadow-lg"
                                                }
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div
                            className={
                                useAssignedListStyle
                                    ? "flex flex-col gap-3 border-t border-gray-200 px-4 py-3 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-300 sm:flex-row sm:items-center sm:justify-between"
                                    : "mt-4 flex flex-col gap-3 border-t border-gray-200 pt-4 text-sm dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between"
                            }
                        >
                            <div className={`flex items-center gap-2 ${useAssignedListStyle ? "" : "text-gray-600 dark:text-gray-300"}`}>
                                {useAssignedListStyle ? <span>Có {filteredItems.length} kết quả</span> : null}
                                {useAssignedListStyle ? <span>|</span> : null}
                                <span>Hiển thị</span>
                                <select
                                    value={rowsPerPage}
                                    onChange={(event) => setRowsPerPage(Number(event.target.value))}
                                    className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
                                >
                                    {[5, 10, 20, 50].map((value) => (
                                        <option key={value} value={value}>
                                            {value}
                                        </option>
                                    ))}
                                </select>
                                <span>{useAssignedListStyle ? "dòng/trang" : "dòng mỗi trang"}</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                    disabled={currentPage <= 1}
                                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                >
                                    Trước
                                </button>
                                <span className="text-sm text-gray-600 dark:text-gray-300">
                                    Trang {currentPage}/{totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage >= totalPages}
                                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                >
                                    Sau
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {createOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Thêm bản ghi mới</h3>
                            <button onClick={() => setCreateOpen(false)} className="rounded-md p-1 hover:bg-gray-100 dark:hover:bg-gray-800">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {renderFormFields(createFormValues, setCreateFormValues)}
                        <div className="mt-4 flex items-center justify-end gap-2">
                            <button
                                onClick={() => setCreateOpen(false)}
                                disabled={mutating}
                                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={() => void handleCreate()}
                                disabled={mutating}
                                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                            >
                                <Plus className="h-4 w-4" />
                                {mutating ? "Đang tạo..." : "Tạo bản ghi"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Cập nhật bản ghi: {editingId}</h3>
                            <button onClick={() => setEditOpen(false)} className="rounded-md p-1 hover:bg-gray-100 dark:hover:bg-gray-800">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {renderFormFields(editFormValues, setEditFormValues)}
                        <div className="mt-4 flex items-center justify-end gap-2">
                            <button
                                onClick={() => setEditOpen(false)}
                                disabled={mutating}
                                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={() => void handleUpdate()}
                                disabled={mutating}
                                className="inline-flex items-center gap-2 rounded-lg bg-warning-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-warning-700 disabled:opacity-50"
                            >
                                <Pencil className="h-4 w-4" />
                                {mutating ? "Đang lưu..." : "Lưu thay đổi"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900">
                        <div className="mb-3 flex items-center gap-2 text-error-600 dark:text-error-300">
                            <AlertCircle className="h-5 w-5" />
                            <h3 className="text-base font-semibold">Xác nhận xóa bản ghi</h3>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            Bạn có chắc muốn xóa <span className="font-semibold text-gray-900 dark:text-white">{deleteTarget.label}</span> không?
                        </p>

                        <div className="mt-5 flex items-center justify-end gap-2">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                disabled={Boolean(deletingId)}
                                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={() => void handleDelete()}
                                disabled={Boolean(deletingId)}
                                className="inline-flex items-center gap-1 rounded-lg bg-error-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-error-700 disabled:opacity-50"
                            >
                                <Trash2 className="h-4 w-4" />
                                {deletingId ? "Đang xóa..." : "Xác nhận xóa"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {detailItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Chi tiết bản ghi</h3>
                            <button onClick={() => setDetailItem(null)} className="rounded-md p-1 hover:bg-gray-100 dark:hover:bg-gray-800">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="max-h-[60vh] space-y-4 overflow-auto pr-1">
                            {detailSections.length > 0 ? (
                                <div className="space-y-3">
                                    {detailSections.map((section) => (
                                        <section key={section.title} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{section.title}</p>
                                            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                                                {section.fields.map((field) => (
                                                    <div key={`${section.title}-${field.key}`} className={field.key === "summary" || field.key === "description" || field.key === "note" ? "md:col-span-2" : ""}>
                                                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                            {field.label}
                                                        </p>
                                                        <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                                                            {field.format
                                                                ? field.format(detailItem[field.key])
                                                                : formatValue(detailItem[field.key])}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    ))}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    {detailColumns.map((field) => (
                                        <div key={field.key} className={field.key === "summary" || field.key === "description" || field.key === "note" ? "md:col-span-2" : ""}>
                                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                {field.label}
                                            </p>
                                            <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                                                {field.format
                                                    ? field.format(detailItem[field.key])
                                                    : formatValue(detailItem[field.key])}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {renderModuleDetailExtras(detailItem)}

                            <div>
                                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    Dữ liệu JSON gốc
                                </p>
                                <pre className="overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-700 dark:bg-gray-800">
                                    {safeStringify(detailItem)}
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

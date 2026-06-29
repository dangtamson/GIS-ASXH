"use client";

import React, {useCallback, useEffect, useMemo, useState} from "react";
import {ConfigProvider, notification, TreeSelect} from "antd";
import {AlertCircle} from "lucide-react";

import {api, ApiError} from "@/lib/api";
import {extractList} from "@/lib/data-utils";
import {endpoints} from "@/lib/endpoints";
import {
    type ColumnConfig,
    documentColumns,
    documentFilterFields,
    documentFormFields,
    formatValue,
    type FormFieldConfig,
} from "@/lib/column-config";

import {
    ActionButton,
    ActionModal,
    AppPagination,
    AppDatePicker,
    AppInput,
    ConfirmModal,
    DocumentTypeSelect,
    FieldSelect,
    FilterSpace,
    TitleSpace,
    UploadAttachmentsField,
    ViewModal,
} from "@/components/controller";
import ActionIcon from "@/components/controller/ActionIcon";
import {controllerSelectClassName} from "@/components/controller/input/selectShared";
import {useDonViSelect} from "@/hooks/useOrganization";
import type {
    ExistingAttachment,
    JsonRecord,
    UploadAttachment,
} from "@/components/controller/input/UploadAttachmentField";

const TITLE = "Văn bản";
const DESCRIPTION = "Quản lý văn bản nghiệp vụ";

const DEFAULT_FORM: Record<string, string> = {
    documentNumber: "",
    title: "",
    summary: "",
    documentTypeId: "",
    issuingOrgId: "",
    issuedDate: "",
    effectiveDate: "",
    statusId: "",
    filePath: "",
};

const notifySuccess = (description: string) => {
    notification.success({
        title: "Thành công",
        description,
    });
};

const notifyError = (description: string) => {
    notification.error({
        title: "Thất bại",
        description,
    });
};

const notifyWarning = (description: string) => {
    notification.warning({
        title: "Cảnh báo",
        description,
    });
};

const getEntityId = (item: JsonRecord) => String(item.id ?? item.uuid ?? item._id ?? "");
const toFormValue = (value: unknown) => (value == null ? "" : String(value));

const trimObjectByIdFields = (item: JsonRecord): JsonRecord => {
    const result = { ...item };
    ["id", "uuid", "_id", "createdAt", "updatedAt"].forEach((key) => delete result[key]);
    return result;
};

const validateRequiredFields = (fields: FormFieldConfig[], values: JsonRecord): string | null => {
    const missing = fields.find((field) => field.required && !String(values[field.key] ?? "").trim());
    return missing ? `Vui lòng nhập trường bắt buộc: ${missing.label}.` : null;
};

const buildPayloadFromForm = (fields: FormFieldConfig[], values: JsonRecord): JsonRecord => {
    const payload: JsonRecord = {};

    fields.forEach((field) => {
        const rawValue = values[field.key];
        if (rawValue === undefined || rawValue === null || rawValue === "") return;

        if (field.valueType === "boolean") {
            const normalized = String(rawValue).trim().toLowerCase();
            payload[field.key] = ["true", "1", "yes"].includes(normalized);
            return;
        }

        if (field.type === "number" || field.valueType === "number") {
            const numValue = Number(rawValue);
            if (!Number.isNaN(numValue)) payload[field.key] = numValue;
            return;
        }

        payload[field.key] = rawValue;
    });

    return payload;
};

const getAttachmentName = (value: unknown): string => {
    if (typeof value === "string") {
        return value.split("/").filter(Boolean).pop() ?? value;
    }

    if (!value || typeof value !== "object") return "";

    const item = value as JsonRecord;
    const rawName = String(item.fileName ?? item.name ?? item.originalName ?? item.filePath ?? "").trim();
    return rawName.split("/").filter(Boolean).pop() ?? rawName;
};

const parseExistingAttachments = (item: JsonRecord): ExistingAttachment[] => {
    const groups = [item.attachments, item.files, item.fileList];
    const result: ExistingAttachment[] = [];

    groups.forEach((group, groupIndex) => {
        if (!Array.isArray(group)) return;

        group.forEach((entry, entryIndex) => {
            if (typeof entry === "string") {
                const fileName = entry.trim();
                if (!fileName) return;
                result.push({ key: `${groupIndex}-${entryIndex}-${fileName}`, fileName });
                return;
            }

            if (!entry || typeof entry !== "object") return;

            const data = entry as JsonRecord;
            const id = String(data.uuid ?? data.id ?? data._id ?? "").trim();
            const fileName = getAttachmentName(data);
            if (!fileName) return;

            const parsedSize = Number(data.fileSize ?? data.size);

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
        if (dedupeKey && !deduped.has(dedupeKey)) deduped.set(dedupeKey, attachment);
    });

    if (deduped.size === 0) {
        const filePath = String(item.filePath ?? "").trim();
        if (filePath) {
            const fileName = getAttachmentName(filePath);
            if (fileName) deduped.set(fileName, { key: `filepath-${fileName}`, fileName });
        }
    }

    return Array.from(deduped.values());
};

export default function DocumentTablePage() {
    const columns: ColumnConfig[] = documentColumns;
    const formFields = documentFormFields;
    const filterFields = documentFilterFields;
    const endpoint = endpoints.admin.documents;
    const hasFilePathField = useMemo(
        () => formFields.some((field) => field.key === "filePath"),
        [formFields]
    );

    const { dsDonVi, loading: donViLoading } = useDonViSelect();
    const organizationTreeSelectTheme = useMemo(
        () => ({
            token: {
                colorPrimary: "#dc2626",
                colorPrimaryHover: "#dc2626",
                colorPrimaryActive: "#dc2626",
                colorPrimaryBorder: "rgba(220, 38, 38, 0.4)",
                controlOutline: "rgba(220, 38, 38, 0.2)",
                controlOutlineWidth: 2,
            },
            components: {
                Select: {
                    colorPrimary: "#dc2626",
                    colorPrimaryHover: "#dc2626",
                    colorPrimaryBorder: "rgba(220, 38, 38, 0.4)",
                    controlOutline: "rgba(220, 38, 38, 0.2)",
                    activeBorderColor: "#dc2626",
                    hoverBorderColor: "#dc2626",
                },
                TreeSelect: {
                    colorPrimary: "#dc2626",
                    colorPrimaryHover: "#dc2626",
                    colorPrimaryBorder: "rgba(220, 38, 38, 0.4)",
                    controlOutline: "rgba(220, 38, 38, 0.2)",
                    activeBorderColor: "#dc2626",
                    hoverBorderColor: "#dc2626",
                },
            },
        }),
        []
    );

    const [items, setItems] = useState<JsonRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [mutating, setMutating] = useState(false);

    const [error, setError] = useState<string | null>(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalItems, setTotalItems] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const [filterValues, setFilterValues] = useState<JsonRecord>({});
    const [formValues, setFormValues] = useState<JsonRecord>({ ...DEFAULT_FORM });

    const [modalMode, setModalMode] = useState<"create" | "edit" | "view" | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);

    const [createAttachments, setCreateAttachments] = useState<UploadAttachment[]>([]);
    const [editAttachments, setEditAttachments] = useState<UploadAttachment[]>([]);
    const [editExistingAttachments, setEditExistingAttachments] = useState<ExistingAttachment[]>([]);
    const [pendingDeletedExistingAttachments, setPendingDeletedExistingAttachments] = useState<ExistingAttachment[]>([]);

    const isCreateMode = modalMode === "create";
    const isEditMode = modalMode === "edit";
    const isViewMode = modalMode === "view";

    const loadData = useCallback(
        async (page = currentPage, limit = rowsPerPage, overrideFilters?: JsonRecord) => {
            setLoading(true);
            setError(null);

            try {
                const mergedFilters = { ...filterValues, ...overrideFilters };
                const params = new URLSearchParams({
                    page: String(page),
                    limit: String(limit),
                });

                if (mergedFilters.documentNumber) params.set("documentNumber", String(mergedFilters.documentNumber));
                if (mergedFilters.summary) params.set("summary", String(mergedFilters.summary));
                if (mergedFilters.documentTypeId) params.set("documentTypeId", String(mergedFilters.documentTypeId));
                if (mergedFilters.fieldId) params.set("fieldId", String(mergedFilters.fieldId));
                if (mergedFilters.issuingOrgId) params.set("organizationId", String(mergedFilters.issuingOrgId));
                if (mergedFilters.issuedDate) params.set("issuedDate", String(mergedFilters.issuedDate));

                const res = await api.get<unknown>(`${endpoint}?${params.toString()}`);
                const list = extractList<JsonRecord>(res);

                const root = res as Record<string, unknown>;
                const rootData =
                    root?.data && typeof root.data === "object"
                        ? (root.data as Record<string, unknown>)
                        : root;
                const pagination =
                    rootData?.pagination && typeof rootData.pagination === "object"
                        ? (rootData.pagination as Record<string, unknown>)
                        : null;

                const total = Number(pagination?.total ?? list.length) || 0;
                const pages = Number(pagination?.pages ?? Math.max(1, Math.ceil(total / limit))) || 1;

                setItems(list);
                setTotalItems(total);
                setTotalPages(pages);
                setCurrentPage(page);
                setRowsPerPage(limit);
            } catch (err) {
                setItems([]);
                setTotalItems(0);
                setTotalPages(1);
                setError(err instanceof ApiError ? err.message : "Không thể tải dữ liệu.");
            } finally {
                setLoading(false);
            }
        },
        [currentPage, rowsPerPage, filterValues, endpoint]
    );

    useEffect(() => {
        void loadData(1, 10);
    }, []);

    const openCreateModal = () => {
        const nextValues: JsonRecord = {};
        formFields.forEach((field) => {
            nextValues[field.key] = DEFAULT_FORM[field.key] ?? "";
        });

        setFormValues(nextValues);
        setCreateAttachments([]);
        setEditAttachments([]);
        setEditExistingAttachments([]);
        setPendingDeletedExistingAttachments([]);
        setEditingId(null);
        setModalMode("create");
    };

    const openEditModal = (item: JsonRecord) => {
        const id = getEntityId(item);
        if (!id) {
            notifyWarning("Không xác định được ID văn bản.");
            return;
        }

        const cleaned = trimObjectByIdFields(item);
        const nextValues: JsonRecord = {};

        formFields.forEach((field) => {
            nextValues[field.key] = toFormValue(cleaned[field.key]);
        });

        setEditingId(id);
        setFormValues(nextValues);
        setEditAttachments([]);
        setEditExistingAttachments(parseExistingAttachments(item));
        setPendingDeletedExistingAttachments([]);
        setModalMode("edit");
    };

    const openViewModal = (item: JsonRecord) => {
        const id = getEntityId(item);
        if (!id) return;

        const cleaned = trimObjectByIdFields(item);
        const nextValues: JsonRecord = {};

        formFields.forEach((field) => {
            nextValues[field.key] = toFormValue(cleaned[field.key]);
        });

        setEditingId(id);
        setFormValues(nextValues);
        setEditAttachments([]);
        setEditExistingAttachments(parseExistingAttachments(item));
        setPendingDeletedExistingAttachments([]);
        setModalMode("view");
    };

    const syncFilePath = useCallback(
        (attachments: UploadAttachment[]) => {
            if (!hasFilePathField) return;

            setFormValues((prev) => {
                const currentFilePath = String(prev.filePath ?? "").trim();
                if (currentFilePath && attachments.some((file) => file.fileName === currentFilePath)) {
                    return prev;
                }

                const nextFilePath = attachments[0]?.fileName || "";
                if (currentFilePath === nextFilePath) return prev;

                return { ...prev, filePath: nextFilePath };
            });
        },
        [hasFilePathField]
    );

    const mapExistingToUpload = useCallback(
        (attachment: ExistingAttachment): UploadAttachment => ({
            id: String(attachment.id ?? attachment.key).trim() || attachment.fileName,
            uuid: attachment.id ? String(attachment.id) : undefined,
            fileName: attachment.fileName,
            fileSize: Number(attachment.fileSize ?? 0),
            mimeType: attachment.mimeType || "application/octet-stream",
            fileContentBase64: "",
        }),
        []
    );

    const handleAttachmentChange = useCallback(
        (
            target: "create" | "edit",
            nextAttachments: UploadAttachment[],
            existingAttachments: ExistingAttachment[] = []
        ) => {
            if (target === "create") {
                const newFiles = nextAttachments.filter((file) => !file.uuid);
                setCreateAttachments(newFiles);
                syncFilePath(newFiles);
                return;
            }

            const existingMap = new Map(
                existingAttachments.map((item) => [String(item.id ?? item.key), item])
            );

            const keptExisting = nextAttachments
                .filter((file) => Boolean(file.uuid))
                .map((file) => existingMap.get(String(file.uuid ?? file.id)))
                .filter((item): item is ExistingAttachment => Boolean(item));

            const newFiles = nextAttachments.filter((file) => !file.uuid);

            setEditExistingAttachments(keptExisting);
            setEditAttachments(newFiles);
            setPendingDeletedExistingAttachments(
                existingAttachments.filter(
                    (item) =>
                        !keptExisting.some(
                            (kept) => String(kept.id ?? kept.key) === String(item.id ?? item.key)
                        )
                )
            );

            syncFilePath([...keptExisting.map(mapExistingToUpload), ...newFiles]);
        },
        [mapExistingToUpload, syncFilePath]
    );

    const handleCreate = async () => {
        setMutating(true);

        try {
            const requiredError = validateRequiredFields(formFields, formValues);
            if (requiredError) {
                notifyWarning(requiredError);
                return;
            }

            const payload = buildPayloadFromForm(formFields, formValues);

            if (createAttachments.length > 0) {
                payload.attachments = createAttachments.map((file) => ({
                    fileName: file.fileName,
                    fileContentBase64: file.fileContentBase64,
                    mimeType: file.mimeType,
                    fileSize: file.fileSize,
                }));
            }

            await api.post(endpoint, payload);
            setModalMode(null);
            notifySuccess("Thêm mới thành công.");
            await loadData(1, rowsPerPage);
        } catch (err) {
            notifyError(err instanceof ApiError ? err.message : "Thêm mới thất bại.");
        } finally {
            setMutating(false);
        }
    };

    const handleUpdate = async () => {
        setMutating(true);

        try {
            if (!editingId?.trim()) {
                notifyWarning("Vui lòng chọn văn bản để cập nhật.");
                return;
            }

            const requiredError = validateRequiredFields(formFields, formValues);
            if (requiredError) {
                notifyWarning(requiredError);
                return;
            }

            const payload = buildPayloadFromForm(formFields, formValues);

            const persistedAttachments = editExistingAttachments
                .filter((item) => Boolean(item.id))
                .map((item) => ({ uuid: String(item.id) }));

            const newAttachments = editAttachments.map((file) => ({
                fileName: file.fileName,
                fileContentBase64: file.fileContentBase64,
                mimeType: file.mimeType,
                fileSize: file.fileSize,
            }));

            if (
                pendingDeletedExistingAttachments.length > 0 ||
                persistedAttachments.length > 0 ||
                newAttachments.length > 0
            ) {
                payload.attachments = [...persistedAttachments, ...newAttachments];
            }

            await api.patch(`${endpoint}/${editingId.trim()}`, payload);
            setModalMode(null);
            setEditingId(null);
            setPendingDeletedExistingAttachments([]);
            notifySuccess("Cập nhật thành công.");
            await loadData(currentPage, rowsPerPage);
        } catch (err) {
            notifyError(err instanceof ApiError ? err.message : "Cập nhật thất bại.");
        } finally {
            setMutating(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget?.id.trim()) {
            notifyWarning("Vui lòng chọn văn bản để xóa.");
            return;
        }

        try {
            setMutating(true);
            await api.delete(`${endpoint}/${deleteTarget.id.trim()}`);
            setDeleteTarget(null);
            notifySuccess("Xóa thành công.");
            await loadData(currentPage, rowsPerPage);
        } catch (err) {
            notifyError(err instanceof ApiError ? err.message : "Xóa thất bại.");
        } finally {
            setMutating(false);
        }
    };

    const renderMappedSelect = (
        fieldKey: string,
        value: string,
        onChange: (nextValue?: string) => void,
        placeholder: string,
        disabled = false
    ) => {
        if (fieldKey === "documentTypeId") {
            return (
                <DocumentTypeSelect
                    hideTitle
                    value={value || undefined}
                    onChange={onChange}
                    placeholder={placeholder || "Chọn loại văn bản"}
                    disabled={disabled}
                />
            );
        }

        if (fieldKey === "fieldId") {
            return (
                <FieldSelect
                    hideTitle
                    value={value || undefined}
                    onChange={onChange}
                    placeholder={placeholder || "Chọn lĩnh vực"}
                    disabled={disabled}
                />
            );
        }

        if (fieldKey === "issuingOrgId") {
            return (
                <ConfigProvider theme={organizationTreeSelectTheme}>
                    <TreeSelect
                        className={controllerSelectClassName}
                        placeholder={placeholder || "Chọn đơn vị"}
                        treeData={dsDonVi}
                        value={value || undefined}
                        onChange={onChange}
                        loading={donViLoading}
                        size="large"
                        allowClear
                        disabled={disabled}
                    />
                </ConfigProvider>
            );
        }

        return null;
    };

    const renderFormFields = (values: JsonRecord, disabled = false) => (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {formFields.map((field) => (
                <div key={field.key} className={field.type === "textarea" ? "md:col-span-2" : ""}>
                    <div className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                        {field.label}
                        {field.required ? <span className="text-error-600"> *</span> : null}
                    </div>

                    {field.type === "textarea" ? (
                        <AppInput
                            hideTitle
                            type="textarea"
                            value={toFormValue(values[field.key])}
                            placeholder={field.placeholder}
                            disabled={disabled}
                            onChange={(nextValue) =>
                                setFormValues((prev) => ({ ...prev, [field.key]: nextValue }))
                            }
                        />
                    ) : field.type === "select" ? (
                        renderMappedSelect(
                            field.key,
                            toFormValue(values[field.key]),
                            (nextValue) =>
                                setFormValues((prev) => ({ ...prev, [field.key]: nextValue ?? "" })),
                            field.placeholder || "-- Chọn --",
                            disabled
                        )
                    ) : field.type === "date" ? (
                        <AppDatePicker
                            hideTitle
                            value={toFormValue(values[field.key])}
                            disabled={disabled}
                            onChange={(newValue) =>
                                setFormValues((prev) => ({ ...prev, [field.key]: newValue }))
                            }
                            placeholder={field.placeholder || "Chọn ngày"}
                        />
                    ) : field.type === "number" ? (
                        <AppInput
                            hideTitle
                            type="number"
                            value={toFormValue(values[field.key]) ? Number(values[field.key]) : undefined}
                            placeholder={field.placeholder}
                            disabled={disabled}
                            onChange={(nextValue) =>
                                setFormValues((prev) => ({ ...prev, [field.key]: nextValue ?? "" }))
                            }
                        />
                    ) : (
                        <AppInput
                            hideTitle
                            value={toFormValue(values[field.key])}
                            placeholder={field.placeholder}
                            disabled={disabled}
                            onChange={(nextValue) =>
                                setFormValues((prev) => ({ ...prev, [field.key]: nextValue }))
                            }
                        />
                    )}
                </div>
            ))}
        </div>
    );

    const renderAttachmentUploader = (
        target: "create" | "edit",
        attachments: UploadAttachment[],
        existingAttachments: ExistingAttachment[] = [],
        disabled = false
    ) => {
        const currentValue =
            target === "create"
                ? attachments
                : [...existingAttachments.map(mapExistingToUpload), ...attachments];

        return (
            <div>
                <h3 className="mt-4 mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                    {disabled ? "" : "Tài liệu đính kèm"}
                </h3>
                <UploadAttachmentsField
                    value={currentValue}
                    visibleExtensions={["pdf", "docx", "doc"]}
                    readOnly={disabled}
                    onChange={
                        disabled
                            ? undefined
                            : (nextValue) => handleAttachmentChange(target, nextValue, existingAttachments)
                    }
                />
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <TitleSpace
                title={TITLE}
                description={DESCRIPTION}
                actions={
                    <ActionButton type="create" onClick={openCreateModal}></ActionButton>
                }
            />

            {error && (
                <p className="flex items-start gap-2 rounded-xl border border-error-200 bg-error-50 p-3 text-sm text-error-700 dark:border-error-900 dark:bg-error-950/40 dark:text-error-300">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    {error}
                </p>
            )}

            <FilterSpace
                actionsPosition="bottom-center"
                actions={
                    <>
                        <ActionButton type="refresh" onClick={() => {
                            setFilterValues({});
                            setCurrentPage(1);
                            void loadData(1, rowsPerPage, {});
                        }}></ActionButton>
                        <ActionButton type="search" onClick={() => void loadData(1, rowsPerPage)}></ActionButton>
                    </>
                }
            >
                {filterFields.map((field) => (
                    <div key={field.key}>
                        <span className="mb-1 font-semibold block text-sm text-gray-700 dark:text-gray-300">
                            {field.label}
                        </span>

                        {field.type === "select" ? (
                            renderMappedSelect(
                                field.key,
                                toFormValue(filterValues[field.key]),
                                (nextValue) =>
                                    setFilterValues((prev) => ({ ...prev, [field.key]: nextValue ?? "" })),
                                field.placeholder || "-- Tất cả --"
                            )
                        ) : field.type === "date" || field.type === "date-from" || field.type === "date-to" ? (
                            <AppDatePicker
                                hideTitle
                                value={toFormValue(filterValues[field.key])}
                                onChange={(newValue) =>
                                    setFilterValues((prev) => ({ ...prev, [field.key]: newValue }))
                                }
                                placeholder={field.placeholder || "Chọn ngày"}
                            />
                        ) : (
                            <AppInput
                                hideTitle
                                value={toFormValue(filterValues[field.key])}
                                placeholder={field.placeholder}
                                onChange={(nextValue) =>
                                    setFilterValues((prev) => ({ ...prev, [field.key]: nextValue }))
                                }
                            />
                        )}
                    </div>
                ))}
            </FilterSpace>

            <div className="data-table-shell md:block">
                {loading ? (
                    <div className="flex flex-col items-center justify-center px-4 py-12">
                        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500 dark:border-gray-700 dark:border-t-brand-400" />
                        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Đang tải dữ liệu...</p>
                    </div>
                ) : items.length === 0 ? (
                    <div className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                        Không có dữ liệu phù hợp
                    </div>
                ) : (
                    <div className="data-table-wrap ">
                        <table className="data-table">
                            <thead className="data-table-head bg-[#d4a574]">
                                <tr>
                                    <th className="data-table-th">STT</th>
                                    {columns.map((column) => (
                                        <th key={column.key} className="data-table-th">
                                            {column.label}
                                        </th>
                                    ))}
                                    <th className="data-table-th-action">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, index) => {
                                    const id = getEntityId(item);
                                    return (
                                        <tr key={id || JSON.stringify(item)} className="data-table-row">
                                            <td className="data-table-cell text-xs font-mono text-gray-500">
                                                {(currentPage - 1) * rowsPerPage + index + 1}
                                            </td>

                                            {columns.map((column) => (
                                                <td
                                                    key={`${id}-${column.key}`}
                                                    className="data-table-cell"
                                                    title={String(item[column.key] ?? "")}
                                                >
                                                    {column.format
                                                        ? column.format(item[column.key])
                                                        : formatValue(item[column.key])}
                                                </td>
                                            ))}

                                            <td className="data-table-cell">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button
                                                        onClick={() => openViewModal(item)}
                                                        className="data-table-action-btn text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                                                        title="Xem chi tiết"
                                                    >
                                                        <ActionIcon action="view" />
                                                    </button>

                                                    <button
                                                        onClick={() => openEditModal(item)}
                                                        className="data-table-action-btn text-warning-600 hover:text-warning-700 dark:text-warning-500 dark:hover:text-warning-400"
                                                        title="Cập nhật"
                                                    >
                                                        <ActionIcon action="edit" />
                                                    </button>

                                                    <button
                                                        onClick={() =>
                                                            setDeleteTarget({
                                                                id,
                                                                label: String(item.name || item.title || id || "bản ghi"),
                                                            })
                                                        }
                                                        className="data-table-action-btn text-error-600 hover:text-error-700 dark:text-error-500 dark:hover:text-error-400"
                                                        title="Xóa"
                                                    >
                                                        <ActionIcon action="delete" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                <AppPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalRows={totalItems}
                    rowsPerPage={rowsPerPage}
                    rowsPerPageOptions={[5, 10, 20, 50]}
                    onRowsPerPageChange={(next) => {
                        void loadData(1, next);
                    }}
                    onPageChange={(nextPage) => {
                        void loadData(nextPage, rowsPerPage);
                    }}
                />
            </div>

            {(isCreateMode || isEditMode) && (
                <ActionModal
                    open
                    title={isCreateMode ? "Thêm mới" : "Cập nhật"}
                    width={1080}
                    okText="Lưu"
                    cancelText="Đóng"
                    loading={mutating}
                    spinning={mutating}
                    variant="danger"
                    onOk={() => {
                        if (isCreateMode) void handleCreate();
                        else void handleUpdate();
                    }}
                    onCancel={() => setModalMode(null)}
                >
                    <div className="max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
                        {renderFormFields(formValues, false)}
                        {renderAttachmentUploader(
                            isCreateMode ? "create" : "edit",
                            isCreateMode ? createAttachments : editAttachments,
                            isCreateMode ? [] : editExistingAttachments,
                            false
                        )}
                    </div>
                </ActionModal>
            )}

            {isViewMode && (
                <ViewModal
                    open
                    title="Xem chi tiết"
                    width={1080}
                    spinning={mutating}
                    onCancel={() => setModalMode(null)}
                    footer={
                        <div className="popup-footer-actions">
                            <button onClick={() => setModalMode(null)}>
                                Đóng
                            </button>
                        </div>
                    }
                >
                    <div className="max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
                        {renderFormFields(formValues, true)}
                        {renderAttachmentUploader("edit", editAttachments, editExistingAttachments, true)}
                    </div>
                </ViewModal>
            )}

            <ConfirmModal
                open={Boolean(deleteTarget)}
                onOk={() => void handleDelete()}
                onCancel={() => setDeleteTarget(null)}
                variant="danger"
                descriptionPrefix="Bạn có chắc chắn muốn xóa"
                subject={deleteTarget?.label}
                descriptionSuffix="?"
                okText="Xóa"
                loading={mutating}
                spinning={mutating}
            />
        </div>
    );
}

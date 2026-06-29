"use client";

import {api, ApiError} from "@/lib/api";
import {extractList} from "@/lib/data-utils";
import {endpoints} from "@/lib/endpoints";
import {
    buildOrganizationTree,
    flattenOrganizationTree,
    type OrganizationTreeNode,
    PRIORITY_OPTIONS,
    type SelectOption,
    STATUS_OPTIONS
} from "@/lib/task-options";
import {AlertCircle, Check, ChevronDown, ChevronRight, Eye, Pencil, PlusCircle, Search, Trash2,} from "lucide-react";
import React, {useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import dayjs from "dayjs";
import {notification} from "antd";
import DocumentInfoModal from "@/components/tasks/DocumentModal";

type TaskTab = "assigned" | "coordination" | "due" | "overdue";


type ProgressRecord = {
    taskId: string;
    progressPercent: number;
    comment: string;
    updatedBy: string;
    createdAt: string;
};

type DocumentFile = {
    id: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    createdAt: string;
};

type DocumentView = {
    title: string;
    documentNumber: string;
    summary: string;
    issuedDate: string;
    effectiveDate: string;
    statusId: string;
    files: DocumentFile[];
};

type TaskItem = {
    id: string;
    name: string;
    assignInfo: string;
    deadline: string;
    dueDateRaw: string;
    progress: number;
    reportLabel: string;
    documentLabel: string;
    statusLabel: string;
    statusId: string;
    statusCode: string;
    documentId: string;
    organizationId: string;
    priorityId: string;
    fieldId: string;
    completedAt: string;
    isDueSoon: boolean;
    isCoordination: boolean;
    isOverdue: boolean;
    status: string,
    startDate?: string | null;
    issuedDate?: string | null
};

function normalizeText(value: unknown): string {
    return String(value ?? "").trim().toLowerCase();
}

function parseDateMs(value: unknown): number {
    const raw = String(value ?? "").trim();
    if (!raw) {
        return Number.NaN;
    }
    const parsed = new Date(raw).getTime();
    return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function toDateLabelVi(value: string): string {
    return dayjs(value).format("DD/MM/YYYY");
}

function clampPercent(value: unknown): number {
    const asNumber = Number(value);
    if (!Number.isFinite(asNumber)) {
        return 0;
    }
    return Math.max(0, Math.min(100, Math.round(asNumber)));
}

function isCompletedByStatusCode(statusCode: string): boolean {
    if (!statusCode) {
        return false;
    }
    return ["completed", "done", "approved", "closed", "hoan_thanh", "da_phe_duyet"].some((token) => statusCode.includes(token));
}


type TaskOrganization = {
    name: string,
    uuid: string,
    is_coordination: boolean,

}

type ResTaskType = {
    uuid: string,
    status: string,
    task_progress: {
        progress_percent: number,
    }
    due_date: string,
    complete_at: string,
    organization: TaskOrganization,
    task_assignments: [
        {
            uuid: string,
            task_id: string,
            organization: TaskOrganization,
        }
    ],
    document: {
        title: string,
        document_number: string,
        document_type_id: string,
        field: {
            name: string,
            uuid: string
        },
    },
    document_id: string,
    title: string,
    issuedByName: string,
    priority_id: string,
    start_date: string,
    issued_date: string,
}

function toTaskItem(
    raw: ResTaskType,
): TaskItem {
    const id = String(raw.uuid || "");
    const statusId = String(raw.status ?? "");
    const statusMeta: {
        code: string,
        label: string,
    } = {
        code: raw.status,
        label: STATUS_OPTIONS.find(item => item.value === raw.status)?.label ?? raw.status // chỉnh sửa lại nếu có danh mục riêng,
    };

    const progress = raw?.task_progress?.progress_percent || 0;

    const dueDateRaw = String(raw.due_date || "");
    const dueMs = parseDateMs(dueDateRaw);
    const completedAt = String(raw.complete_at ?? "").trim();
    const completed = Boolean(completedAt) || progress >= 100 || isCompletedByStatusCode(statusMeta?.code ?? "");

    const now = Date.now();
    const isOverdue = Number.isFinite(dueMs) ? dueMs < now && !completed : false;
    const isDueSoon = Number.isFinite(dueMs) ? dueMs >= now && dueMs - now <= 3 * 24 * 60 * 60 * 1000 && !completed : false;

    const baseOrgId = String(raw.organization.uuid ?? "");
    const assignmentRows = raw.task_assignments
    const baseAssignment = assignmentRows.find(
        entry => entry.organization.uuid === baseOrgId
    );

    const isCoordination = baseAssignment?.organization.is_coordination ?? false;

    const documentId = String(raw.document_id ?? "");
    const fieldId = String(raw.document.field.uuid ?? "");

    return {
        id,
        name: String(raw.title || "Nhiệm vụ"),
        assignInfo: `${String(raw.issuedByName ?? raw?.organization?.name ?? "Đơn vị giao")}  -> ${raw.task_assignments.filter(item => !item.organization.is_coordination).map(item => item.organization.name).join((", "))}`,
        deadline: toDateLabelVi(dueDateRaw),
        dueDateRaw,
        progress,
        reportLabel: completed ? "Kết quả" : "Chưa có kết quả",
        documentLabel: "Văn bản",
        statusLabel: statusMeta?.label || "Chờ tiếp nhận",
        statusId,
        statusCode: statusMeta?.code || "",
        documentId,
        organizationId: String(raw.organization.uuid ?? ""),
        priorityId: String(raw.priority_id ?? ""),
        fieldId,
        completedAt,
        isDueSoon,
        isCoordination,
        isOverdue,
        status: raw.status,
        startDate: raw.start_date,
        issuedDate: raw.issued_date
    };
}


function toDocumentFiles(rawData: unknown): DocumentFile[] {
    const rows = extractList<Record<string, unknown>>(rawData);
    return rows.map((row, index) => ({
        id: String(row.uuid ?? row.id ?? `file-${index}`),
        fileName: String(row.fileName ?? row.name ?? "Không tên"),
        filePath: String(row.filePath ?? ""),
        fileSize: Number(row.fileSize ?? 0),
        mimeType: String(row.mimeType ?? ""),
        createdAt: String(row.createdAt ?? ""),
    }));
}

function formatFileSize(sizeInBytes: number): string {
    if (!sizeInBytes || !Number.isFinite(sizeInBytes)) {
        return "-";
    }
    if (sizeInBytes >= 1024 * 1024) {
        return `${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    return `${Math.max(sizeInBytes / 1024, 0.1).toFixed(1)} KB`;
}


export default function AssignedTasksPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TaskTab>("assigned");
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [selectedDocumentId, setSelectedDocumentId] = useState("");
    const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
    const [selectedFieldId, setSelectedFieldId] = useState("");
    const [selectedPriorityId, setSelectedPriorityId] = useState("");
    const [selectedStatusId, setSelectedStatusId] = useState("");
    const [queryHydrated, setQueryHydrated] = useState(false);
    const [remind, setRemind] = useState({
        total: 0,
        dueSoon: 0,
        overDue: 0,
    });
    const [selectedRemind, setSelectedRemind] = useState<string | null>("total");

    const [documentOptions, setDocumentOptions] = useState<SelectOption[]>([]);
    const [organizationOptions, setOrganizationOptions] = useState<SelectOption[]>([]);
    const [organizationTree, setOrganizationTree] = useState<OrganizationTreeNode[]>([]);
    const [fieldOptions, setFieldOptions] = useState<SelectOption[]>([]);
    const [expandedTreeNodes, setExpandedTreeNodes] = useState<Record<string, boolean>>({});
    const [openTreeSelectKey, setOpenTreeSelectKey] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rows, setRows] = useState<TaskItem[]>([]);

    const [documentModalTask, setDocumentModalTask] = useState<TaskItem | null>(null);
    const [documentLoading, setDocumentLoading] = useState(false);
    const [documentError, setDocumentError] = useState<string | null>(null);
    const [documentView, setDocumentView] = useState<DocumentView | null>(null);

    const [reportModalTask, setReportModalTask] = useState<TaskItem | null>(null);
    const [reportLoading, setReportLoading] = useState(false);
    const [reportError, setReportError] = useState<string | null>(null);
    const [reportRows, setReportRows] = useState<ProgressRecord[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // const


    useEffect(() => {
        const params = new URLSearchParams(window.location.search);

        const q = params.get("q") ?? "";
        const doc = params.get("documentId") ?? "";
        const org = params.get("organizationId") ?? "";
        const field = params.get("fieldId") ?? "";
        const priority = params.get("priorityId") ?? "";
        const status = params.get("statusId") ?? "";

        setSearchInput(q);
        setSearch(q);
        setSelectedDocumentId(doc);
        setSelectedOrganizationId(org);
        setSelectedFieldId(field);
        setSelectedPriorityId(priority);
        setSelectedStatusId(status);
        setActiveTab("assigned");
        setQueryHydrated(true);
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setSearch(searchInput);
        }, 300);

        return () => {
            window.clearTimeout(timer);
        };
    }, [searchInput]);

    useEffect(() => {
        if (!queryHydrated) {
            return;
        }

        const params = new URLSearchParams();
        if (search) {
            params.set("q", search);
        }
        if (selectedDocumentId) {
            params.set("documentId", selectedDocumentId);
        }
        if (selectedOrganizationId) {
            params.set("organizationId", selectedOrganizationId);
        }
        if (selectedFieldId) {
            params.set("fieldId", selectedFieldId);
        }
        if (selectedPriorityId) {
            params.set("priorityId", selectedPriorityId);
        }
        if (selectedStatusId) {
            params.set("statusId", selectedStatusId);
        }

        const query = params.toString();
        const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
        const currentUrl = `${window.location.pathname}${window.location.search}`;
        if (nextUrl !== currentUrl) {
            window.history.replaceState(null, "", nextUrl);
        }
    }, [
        queryHydrated,
        search,
        selectedDocumentId,
        selectedFieldId,
        selectedOrganizationId,
        selectedPriorityId,
        selectedStatusId,
    ]);

    const loadTasks = async (remind: string | null = null) => {
        setLoading(true);
        setError(null);
        try {
            let params: string | null = "page=" + currentPage || "1"
            if (selectedDocumentId)
                params += "&documentId=" + selectedDocumentId;
            if (selectedOrganizationId)
                params += "&organizationId=" + selectedOrganizationId;
            // if(selectedFieldId)
            //     params += "&fieldId=" + selectedFieldId;
            if (selectedPriorityId)
                params += "&priority=" + selectedPriorityId;
            if (selectedStatusId)
                params += "&status=" + selectedStatusId;
            if (rowsPerPage)
                params += "&limit=" + rowsPerPage;
            if (selectedFieldId)
                params += "&fieldId=" + selectedFieldId;
            if (search)
                params += "&search=" + search;
            if (remind)
                params += "&remind=" + remind;

            const [
                taskRaw,
            ] = await Promise.all([
                api.get<unknown>(`${endpoints.admin.tasks}?${params}`),
            ]);

            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            setRemind(taskRaw.reminds);


            const list = extractList<Record<string, unknown>>(taskRaw).map((row) =>
                toTaskItem(row as unknown as ResTaskType)
            );
            setRows(list);
        } catch (err) {

            if (err instanceof ApiError) {
                setError(err.message);
            } else {
                console.log(err)
                setError("Không thể tải danh sách nhiệm vụ.");
            }
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const [
                    taskRaw,
                    categoriesRaw,
                    categoryItemsRaw,
                    organizationsRaw,
                    documentsRaw,
                ] = await Promise.all([
                    api.get<unknown>(`${endpoints.admin.tasks}?page=1&limit=100`),
                    api.get<unknown>(`${endpoints.admin.categories}?page=1&limit=100`),
                    api.get<unknown>(`${endpoints.admin.categoryItems}?page=1&limit=100`),
                    api.get<unknown>(`${endpoints.admin.organizations}?page=1&limit=100`),
                    api.get<unknown>(`${endpoints.admin.documents}?page=1&limit=100`),
                ]);
                if (cancelled) {
                    return;
                }

                const categories = extractList<Record<string, unknown>>(categoriesRaw);
                const categoryItems = extractList<Record<string, unknown>>(categoryItemsRaw);

                // Find FIELD category and extract field options
                const fieldCategoryId = categories
                    .filter(
                        (cat) =>
                            normalizeText(cat.code) === "field" ||
                            normalizeText(cat.code) === "task_field"
                    )
                    .map((cat) => String(cat.uuid ?? cat.id ?? ""))
                    .find((id) => id);

                const toOptions = (items: Record<string, unknown>[]) =>
                    items
                        .map((item) => ({
                            value: String(item.uuid ?? item.id ?? ""),
                            label: String(item.name ?? item.code ?? item.uuid ?? ""),
                        }))
                        .filter((item) => item.value);

                setFieldOptions(
                    toOptions(
                        categoryItems.filter((item) =>
                            !fieldCategoryId || String(item.categoryId ?? "") === fieldCategoryId
                        )
                    )
                );

                const organizations = extractList<Record<string, unknown>>(organizationsRaw);
                const orgTree = buildOrganizationTree(organizations);
                setOrganizationTree(orgTree);
                setOrganizationOptions(flattenOrganizationTree(orgTree));

                const documents = extractList<Record<string, unknown>>(documentsRaw);
                const documentById = new Map<string, Record<string, unknown>>();
                documents.forEach((document) => {
                    const id = String(document.uuid ?? document.id ?? "");
                    if (id) {
                        documentById.set(id, document);
                    }
                });
                setDocumentOptions(
                    documents
                        .map((doc) => ({
                            value: String(doc.uuid ?? doc.id ?? ""),
                            label: String(doc.title ?? doc.documentNumber ?? doc.uuid ?? ""),
                        }))
                        .filter((item) => item.value)
                );

                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                setRemind(taskRaw.reminds);

                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                const list = extractList<Record<string, unknown>>(taskRaw).map((row) =>
                    toTaskItem(row as unknown as ResTaskType)
                );
                setRows(list);
            } catch (err) {
                if (cancelled) {
                    return;
                }
                if (err instanceof ApiError) {
                    setError(err.message);
                } else {
                    setError("Không thể tải danh sách nhiệm vụ.");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {

        void loadTasks()
    }, [rowsPerPage, currentPage]);


    const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));

    useEffect(() => {
        setCurrentPage(1);
    }, [search, selectedDocumentId, selectedOrganizationId, selectedFieldId, selectedPriorityId, selectedStatusId, activeTab]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    useEffect(() => {
        if (!documentModalTask) {
            return;
        }

        let cancelled = false;
        const load = async () => {
            setDocumentLoading(true);
            setDocumentError(null);
            setDocumentView(null);
            try {

                const documentId = String(documentModalTask.documentId ?? "");

                if (!documentId) {
                    setDocumentView({
                        title: "Không gắn văn bản",
                        documentNumber: "",
                        summary: "",
                        issuedDate: "",
                        effectiveDate: "",
                        statusId: "",
                        files: [],
                    });
                    return;
                }

                const documentRaw = await api.get<Record<string, unknown>>(`${endpoints.admin.documents}/${documentId}`);
                if (cancelled) {
                    return;
                }

                const docPayload = documentRaw as Record<string, unknown>;
                const docData = (docPayload as Record<string, unknown> | undefined) ?? null;
                const docItem = ((docData?.item as Record<string, unknown> | undefined) ?? docPayload) as Record<string, unknown>;
                const files = toDocumentFiles((docData?.files as unknown) ?? docItem.files ?? []);

                setDocumentView({
                    title: String(docItem.title ?? ""),
                    documentNumber: String(docItem.documentNumber ?? ""),
                    summary: String(docItem.summary ?? ""),
                    issuedDate: String(docItem.issuedDate ?? ""),
                    effectiveDate: String(docItem.effectiveDate ?? ""),
                    statusId: String(docItem.statusId ?? ""),
                    files,
                });
            } catch (err) {
                if (cancelled) {
                    return;
                }
                if (err instanceof ApiError) {
                    setDocumentError(err.message);
                } else {
                    setDocumentError("Không thể tải thông tin văn bản.");
                }
            } finally {
                if (!cancelled) {
                    setDocumentLoading(false);
                }
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [documentModalTask]);

    useEffect(() => {
        if (!reportModalTask) {
            return;
        }

        let cancelled = false;
        const load = async () => {
            setReportLoading(true);
            setReportError(null);
            setReportRows([]);
            try {
                const progressRaw = await api.get<unknown>(`${endpoints.admin.taskProgress}?taskId=${reportModalTask.id}&page=1&limit=100`);
                if (cancelled) {
                    return;
                }

                const rowsRaw = extractList<Record<string, unknown>>(progressRaw)
                    .map((row) => ({
                        taskId: String(row.taskId ?? ""),
                        progressPercent: clampPercent(row.progressPercent),
                        comment: String(row.comment ?? ""),
                        updatedBy: String(row.updatedBy ?? ""),
                        createdAt: String(row.createdAt ?? ""),
                    }))
                    .sort((a, b) => parseDateMs(b.createdAt) - parseDateMs(a.createdAt));

                setReportRows(rowsRaw);
            } catch (err) {
                if (cancelled) {
                    return;
                }
                if (err instanceof ApiError) {
                    setReportError(err.message);
                } else {
                    setReportError("Không thể tải kết quả báo cáo.");
                }
            } finally {
                if (!cancelled) {
                    setReportLoading(false);
                }
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [reportModalTask]);

    const getStatusBadgeClass = (task: TaskItem) => {
        const statusValue = task.statusCode || task.status;

        if (task.isOverdue) {
            return "bg-error-50 text-error-700 dark:bg-error-900/30 dark:text-error-300";
        }

        if (task.progress >= 100 || task.completedAt || isCompletedByStatusCode(statusValue)) {
            return "bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300";
        }

        if (task.isDueSoon) {
            return "bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300";
        }

        if (["in_progress", "processing", "dang_xu_ly", "thuc_hien"].some((token) => statusValue.includes(token))) {
            return "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300";
        }

        return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200";
    };

    const handleDelete = async () => {
        if (!deleteTarget?.id.trim()) {
            notification.warning(
                {
                    title: 'Cảnh báo',
                    description: "Vui lòng chọn bản ghi để xóa."
                }
            )
            return;
        }

        try {
            setDeletingId(deleteTarget.id);
            await api.delete(`${endpoints.admin.tasks}/${deleteTarget.id.trim()}`);
            setDeleteTarget(null);
            notification.success({
                title: 'Thành công',
                description: 'Xóa bản ghi thành công'
            })
            await loadTasks();
        } catch (err) {
            if (err instanceof ApiError) {
                notification.error({
                    title: 'Thất bại',
                    description: err.message
                });
            } else {
                notification.error({
                    title: 'Thất bại',
                    description: "Xóa thất bại."
                })
            }
        } finally {
            setDeletingId(null);
        }
    };

    const renderTreeSelect = (
        selectKey: string,
        fieldKey: string,
        value: string,
        onChange: (nextValue: string) => void,
        placeholder: string
    ) => {
        const treeNodes = organizationTree;
        if (!treeNodes.length) {
            return null;
        }

        const options = organizationOptions;
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
                const next = {...prev};
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
                            <span className="flex min-w-0 items-center gap-1" style={{paddingLeft: `${depth * 14}px`}}>
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
                                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5"/> :
                                            <ChevronRight className="h-3.5 w-3.5"/>}
                                    </span>
                                ) : (
                                    <span className="inline-block h-3.5 w-3.5"/>
                                )}
                                <span className="truncate">{node.label}</span>
                            </span>

                            {isSelected ? <Check className="h-3.5 w-3.5 shrink-0"/> : null}
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
                    <span
                        className={`truncate ${selectedLabel ? "text-gray-800 dark:text-gray-100" : "text-gray-400"}`}>
                        {selectedLabel || placeholder}
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-gray-500 transition ${isOpen ? "rotate-180" : ""}`}/>
                </button>

                {isOpen ? (
                    <div
                        className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
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

    const normalBtn =
        "flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-colors bg-white text-gray-600 hover:bg-gray-50";

    const activeBtn =
        "flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-colors bg-[#dc2626] text-white";

    return (
        <>
            <div className="w-full space-y-4">
                <div className="">
                    <div className="relative flex items-start justify-between gap-3">
                        <h2 className="text-xl font-semibold">Danh sách nhiệm vụ đã giao</h2>


                    </div>
                </div>


                <div className="border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
                        <label>
                            <span className="mb-1 block text-sm text-gray-700 dark:text-gray-200 font-semibold">Từ khóa tìm kiếm</span>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={searchInput}
                                    onChange={(event) => setSearchInput(event.target.value)}
                                    placeholder="Nhập từ khóa tìm kiếm"
                                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 pr-8 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-gray-700 dark:bg-gray-800 dark:focus:border-sky-600 dark:focus:ring-sky-900/40"
                                />
                                <Search className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"/>
                            </div>
                        </label>
                        <label>
                            <span
                                className="mb-1 block text-sm text-gray-700 dark:text-gray-200 font-semibold">Văn bản</span>
                            <select
                                value={selectedDocumentId}
                                onChange={(event) => setSelectedDocumentId(event.target.value)}
                                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-gray-700 dark:bg-gray-800 dark:focus:border-sky-600 dark:focus:ring-sky-900/40"
                            >
                                <option value="">Tất cả văn bản</option>
                                {documentOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            <span className="mb-1 block text-sm text-gray-700 dark:text-gray-200 font-semibold">Đơn vị được giao</span>
                            {renderTreeSelect(
                                "org-filter",
                                "organizationId",
                                selectedOrganizationId,
                                (nextValue) => setSelectedOrganizationId(nextValue),
                                "Tất cả đơn vị"
                            )}
                        </label>
                        <label>
                            <span className="mb-1 block text-sm text-gray-700 dark:text-gray-200 font-semibold">Trạng thái</span>
                            <select
                                value={selectedStatusId}
                                onChange={(event) => setSelectedStatusId(event.target.value)}
                                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-gray-700 dark:bg-gray-800 dark:focus:border-sky-600 dark:focus:ring-sky-900/40"
                            >
                                <option value="">Tất cả trạng thái</option>
                                {STATUS_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            <span
                                className="mb-1 block text-sm text-gray-700 dark:text-gray-200 font-semibold">Lĩnh vực</span>
                            <select
                                value={selectedFieldId}
                                onChange={(event) => setSelectedFieldId(event.target.value)}
                                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-gray-700 dark:bg-gray-800 dark:focus:border-sky-600 dark:focus:ring-sky-900/40"
                            >
                                <option value="">Tất cả lĩnh vực</option>
                                {fieldOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label>
                            <span className="mb-1 block text-sm text-gray-700 dark:text-gray-200 font-semibold">Mức độ ưu tiên</span>
                            <select
                                value={selectedPriorityId}
                                onChange={(event) => setSelectedPriorityId(event.target.value)}
                                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-gray-700 dark:bg-gray-800 dark:focus:border-sky-600 dark:focus:ring-sky-900/40"
                            >
                                <option value="">Tất cả mức ưu tiên</option>
                                {PRIORITY_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                    </div>

                    <div className="flex gap-3 justify-center mt-4">
                        <button
                            className="bg-white border border-[#dc2626] text-[#dc2626] px-6 py-2 rounded text-sm hover:bg-gray-50"
                            onClick={() => {
                                setSearchInput("");
                                setSearch("");
                                setSelectedDocumentId("");
                                setSelectedOrganizationId("");
                                setSelectedFieldId("");
                                setSelectedPriorityId("");
                                setSelectedStatusId("");
                            }}
                        >Làm mới
                        </button>
                        <button
                            className="bg-[#dc2626] text-white px-6 py-2 rounded text-sm flex items-center gap-2 hover:bg-[#b91c1c]"
                            onClick={() => loadTasks()}

                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                                 fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                                 strokeLinejoin="round" className="lucide lucide-search w-4 h-4">
                                <circle cx="11" cy="11" r="8"></circle>
                                <path d="m21 21-4.3-4.3"></path>
                            </svg>
                            Tìm kiếm
                        </button>
                    </div>

                </div>

                <div className="flex gap-2 mb-4 bg-[#f5f0e8] p-1 rounded-lg w-fit font-semibold">
                    <button
                        onClick={() => {
                            if (selectedRemind != 'total') {
                                setSelectedRemind('total');
                                void loadTasks();
                            }
                        }}
                        className={selectedRemind == 'total' ? activeBtn : normalBtn}
                    >
                        Kết quả tìm kiếm
                        <span
                            className={
                                selectedRemind == 'total'
                                    ? "px-2 py-0.5 rounded-full bg-gray-100 text-[#dc2626] text-xs"
                                    : "px-2 py-0.5 rounded-full bg-[#dc2626] text-white text-xs"
                            }
                        >
                        {remind?.total}
                      </span>
                    </button>
                    {remind?.dueSoon != 0 && (
                        <button
                            onClick={() => {
                                if (selectedRemind !== "due_soon") {
                                    setSelectedRemind("due_soon");
                                    void loadTasks("due_soon");
                                }
                            }}
                            className={selectedRemind === "due_soon" ? activeBtn : normalBtn}
                        >
                            Nhiệm vụ gần tới hạn
                            <span
                                className={
                                    selectedRemind === "due_soon"
                                        ? "px-2 py-0.5 rounded-full bg-gray-100 text-[#dc2626] text-xs"
                                        : "px-2 py-0.5 rounded-full bg-[#dc2626] text-white text-xs"
                                }
                            >
                              {remind.dueSoon}
                            </span>
                        </button>
                    )}
                    {remind?.overDue != 0 && (
                        <button
                            onClick={() => {
                                if (selectedRemind !== "over_due") {
                                    setSelectedRemind("over_due");
                                    void loadTasks("over_due");
                                }
                            }}
                            className={selectedRemind === "over_due" ? activeBtn : normalBtn}
                        >
                            Nhiệm vụ quá hạn
                            <span
                                className={
                                    selectedRemind === "over_due"
                                        ? "px-2 py-0.5 rounded-full bg-gray-100 text-[#dc2626] text-xs"
                                        : "px-2 py-0.5 rounded-full bg-[#dc2626] text-white text-xs"
                                }
                            >
                              {remind.overDue}
                            </span>
                        </button>
                    )}

                </div>

                <div className="flex items-end gap-2 md:justify-end lg:col-span-2">

                    <button
                        type="button"
                        onClick={() => router.push("/nhiem-vu-da-giao/them-moi")}
                        className="bg-[#dc2626] text-white px-4 py-2 rounded text-sm flex items-center gap-2 hover:bg-[#b91c1c]"
                    >
                        <PlusCircle className="h-4 w-4"/>
                        Thêm nhiệm vụ, công việc
                    </button>
                </div>


                {error ? (
                    <div
                        className="rounded border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700">{error}</div>
                ) : null}

                <div
                    className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1100px] border-collapse text-sm">
                            <thead className={'bg-[#d4a574]'}>
                            <tr>
                                <th className="px-4 py-3 text-left">STT</th>
                                <th className="px-4 py-3 text-left">Tên nhiệm vụ</th>
                                <th className="px-4 py-3 text-left">Đơn vị giao {"->"} Người thực hiện</th>
                                <th className="px-4 py-3 text-left">Hạn hoàn thành</th>
                                <th className="px-4 py-3 text-left">Tiến độ (%)</th>
                                <th className="px-4 py-3 text-left">Văn bản</th>
                                <th className="px-4 py-3 text-left">Trạng thái</th>
                                <th className="px-4 py-3 text-left">Thao tác</th>
                            </tr>
                            </thead>
                            <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                                        Đang tải dữ liệu...
                                    </td>
                                </tr>
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                                        Không có nhiệm vụ phù hợp
                                    </td>
                                </tr>
                            ) : (
                                rows.map((task, index) => (
                                    <tr key={task.id || `${index}`}
                                        className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${task.isOverdue ? "bg-error-50/50 dark:bg-error-900/10" : ""}`}>
                                        <td className="px-4 py-3">{(currentPage - 1) * rowsPerPage + index + 1}</td>
                                        <td className="px-4 py-3">{task.name}</td>
                                        <td className="px-4 py-3">
                                            <div
                                                className={'text-[#dc2626] text-xs'}>{task.assignInfo.split(" -> ")[0]}</div>
                                            <div className={'text-xs'}>Giao
                                                cho {" > "}{task.assignInfo.split(" -> ")[1]}</div>
                                        </td>
                                        <td className="px-4 py-3">{task.deadline}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="h-2 max-w-[90px] flex-1 rounded-full bg-gray-200">
                                                    <div
                                                        className={`h-2 rounded-full ${task.isOverdue ? "bg-error-500" : "bg-blue-500"}`}
                                                        style={{width: `${task.progress}%`}}
                                                    />
                                                </div>
                                                <span className="text-xs">{task.progress}%</span>
                                            </div>
                                        </td>

                                        <td className="px-4 py-3">
                                            <button
                                                type="button"
                                                onClick={() => setDocumentModalTask(task)}
                                                className="inline-block bg-[#dc2626] text-white px-3 py-1 rounded text-xs hover:bg-[#b91c1c]"
                                            >
                                                {task.documentLabel}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3">
                                                <span
                                                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(task)}`}>
                                                    {task.statusLabel || task.status}
                                                </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => router.push(`/nhiem-vu-da-giao/${task.id}`)}
                                                    className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                                                    title="Xem"
                                                >
                                                    <Eye className="h-4 w-4"/>
                                                </button>
                                                {
                                                    !task.issuedDate && <button
                                                        type="button"
                                                        onClick={() => router.push(`/nhiem-vu-da-giao/${task.id}/chinh-sua`)}
                                                        className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                                                        title="Chỉnh sửa"
                                                    >
                                                        <Pencil className="h-4 w-4"/>
                                                    </button>
                                                }
                                                <button
                                                    type="button"
                                                    onClick={() => router.push(`/nhiem-vu-da-giao/${task.id}/chinh-sua?hanhDong=them-nhiem-vu-con`)}
                                                    className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                                                    title="Thêm nhiệm vụ con"
                                                >
                                                    <PlusCircle className="h-4 w-4"/>
                                                </button>
                                                {/*<button*/}
                                                {/*    type="button"*/}
                                                {/*    onClick={() => router.push(`/nhiem-vu-da-giao/${task.id}/chinh-sua?hanhDong=chuyen-giao-nhiem-vu`)}*/}
                                                {/*    className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"*/}
                                                {/*    title="Chuyển giao nhiệm vụ"*/}
                                                {/*>*/}
                                                {/*    <Send className="h-4 w-4" />*/}
                                                {/*</button>*/}
                                                {
                                                    !task.issuedDate && <button
                                                        type="button"
                                                        onClick={() => setDeleteTarget({
                                                            id: task.id,
                                                            label: String(task.name || task.id || "bản ghi")
                                                        })}
                                                        className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                                                        title="Xóa nhiệm vụ"
                                                    >
                                                        <Trash2 className="h-4 w-4 text-red-500"/>
                                                    </button>
                                                }
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                            </tbody>
                        </table>
                    </div>

                    <div
                        className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-300 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                            <span>Có {rows.length} kết quả</span>
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
                                type="button"
                                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                disabled={currentPage <= 1}
                                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                                Trước
                            </button>
                            <span
                                className="text-sm text-gray-600 dark:text-gray-300">Trang {currentPage}/{totalPages}</span>
                            <button
                                type="button"
                                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                disabled={currentPage >= totalPages}
                                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                                Sau
                            </button>
                        </div>
                    </div>
                </div>
                {deleteTarget && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
                        <div
                            className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900">
                            <div className="mb-3 flex items-center gap-2 text-error-600 dark:text-error-300">
                                <AlertCircle className="h-5 w-5"/>
                                <h3 className="text-base font-semibold">Xác nhận xóa bản ghi</h3>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                Bạn có chắc muốn xóa <span
                                className="font-semibold text-gray-900 dark:text-white">{deleteTarget.label}</span> không?
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
                                    <Trash2 className="h-4 w-4"/>
                                    {deletingId ? "Đang xóa..." : "Xác nhận xóa"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}


                <DocumentInfoModal open={Boolean(documentModalTask)}  onClose={() => setDocumentModalTask(null)} documentId={documentModalTask?.documentId}/>

            </div>
        </>
    );
}

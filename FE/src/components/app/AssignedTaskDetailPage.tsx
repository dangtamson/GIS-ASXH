"use client";

import {api, ApiError} from "@/lib/api";
import DatePickerInput from "@/components/form/DatePickerInput";
import {extractList} from "@/lib/data-utils";
import {endpoints} from "@/lib/endpoints";
import {AlertTriangle, FileText, MessageSquare, Pencil, Save, Search, Send, Upload, X,} from "lucide-react";
import {useRouter} from "next/navigation";
import {type ChangeEvent, type ReactNode, useEffect, useRef, useState} from "react";
import {PRIORITY_OPTIONS, STATUS_OPTIONS} from "@/lib/task-options";

type DetailTab = "basic" | "progress" | "discussion" | "document" | "history";

type Mode = "create" | "view" | "edit";

type TaskForm = {
    title: string;
    description: string;
    organizationId: string;
    startDate: string;
    dueDate: string;
    priorityId: string;
    statusId: string;
    progress: string;
    reportContent: string;
};

type SelectItem = { value: string; label: string };

type ReportFile = {
    id: number;
    name: string;
    sizeLabel: string;
};

const inputClass =
    "w-full h-10 border border-gray-300 rounded-lg px-3 text-sm bg-white outline-none focus:ring-2 focus:ring-[#dc2626]/20 focus:border-[#dc2626]/40 dark:border-gray-700 dark:bg-gray-800";
const cardClass = "bg-white border border-gray-200 rounded-2xl shadow-sm p-4 sm:p-5 dark:bg-gray-900 dark:border-gray-700";

function normalizeText(value: unknown): string {
    return String(value ?? "").trim().toLowerCase();
}

function toDateString(value: unknown): string {
    const raw = String(value ?? "").trim();
    if (!raw) {
        return "";
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
        return raw;
    }
    return date.toISOString().slice(0, 10);
}

function formatFileSize(sizeInBytes: number): string {
    if (!sizeInBytes) {
        return "0 KB";
    }
    return `${Math.max(sizeInBytes / 1024, 0.1).toFixed(1)} KB`;
}

function EmptyBoard({ columns, emptyText = "Chưa có dữ liệu" }: { columns: string[]; emptyText?: string }) {
    return (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-[#f3f4f6] text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    <tr>
                        {columns.map((columnName) => (
                            <th key={columnName} className="border-r border-gray-200 px-3 py-2 text-left last:border-r-0 dark:border-gray-700">
                                {columnName}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    <tr className="border-t border-gray-200 dark:border-gray-700">
                        <td colSpan={columns.length} className="h-28 text-center text-gray-400">
                            {emptyText}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

export default function AssignedTaskDetailPage({
    mode,
    taskId,
    isOwner = false,
    actionHint = "",
}: {
    mode: Mode;
    taskId?: string;
    isOwner?: boolean;
    actionHint?: string;
}) {
    const router = useRouter();
    const reportFileInputRef = useRef<HTMLInputElement | null>(null);

    const [activeTab, setActiveTab] = useState<DetailTab>("basic");
    const [form, setForm] = useState<TaskForm>({
        title: "",
        description: "",
        organizationId: "",
        startDate: "",
        dueDate: "",
        priorityId: "",
        statusId: "",
        progress: "0",
        reportContent: "",
    });
    const [reportFiles, setReportFiles] = useState<ReportFile[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [organizationOptions, setOrganizationOptions] = useState<SelectItem[]>([]);
    const [priorityOptions, setPriorityOptions] = useState<SelectItem[]>([]);
    const [statusOptions, setStatusOptions] = useState<SelectItem[]>([]);

    const isEditMode = mode === "edit";
    const isCreateMode = mode === "create";

    useEffect(() => {
        let cancelled = false;

        const loadOptions = async () => {
            try {
                const [orgRaw, categoriesRaw, categoryItemsRaw] = await Promise.all([
                    api.get<unknown>(`${endpoints.admin.organizations}?page=1&limit=100`),
                    api.get<unknown>(`${endpoints.admin.categories}?page=1&limit=100`),
                    api.get<unknown>(`${endpoints.admin.categoryItems}?page=1&limit=100`),
                ]);

                if (cancelled) {
                    return;
                }

                const orgRows = extractList<Record<string, unknown>>(orgRaw);
                setOrganizationOptions(
                    orgRows.map((row) => ({
                        value: String(row.uuid ?? row.id ?? ""),
                        label: String(row.name ?? row.code ?? row.uuid ?? ""),
                    }))
                );

                const categories = extractList<Record<string, unknown>>(categoriesRaw);
                const items = extractList<Record<string, unknown>>(categoryItemsRaw);

                const categoryIdsByCode = new Map<string, string>();
                categories.forEach((category) => {
                    const code = normalizeText(category.code);
                    const id = String(category.uuid ?? category.id ?? "");
                    if (code && id) {
                        categoryIdsByCode.set(code, id);
                    }
                });


                setPriorityOptions(
                    PRIORITY_OPTIONS
                );

                setStatusOptions(STATUS_OPTIONS)


            } catch {
                if (!cancelled) {
                    setOrganizationOptions([]);
                    setPriorityOptions([]);
                    setStatusOptions([]);
                }
            }
        };

        void loadOptions();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!taskId || isCreateMode) {
            return;
        }

        let cancelled = false;
        const loadTask = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await api.get<Record<string, unknown>>(`${endpoints.admin.tasks}/${taskId}`);
                if (cancelled) {
                    return;
                }

                const payload = data as Record<string, unknown>;
                const nestedData = (payload as Record<string, unknown> | undefined) || null;
                const item = ((nestedData?.item as Record<string, unknown> | undefined) || payload) as Record<string, unknown>;

                setForm((prev) => ({
                    ...prev,
                    title: String(item.title ?? item.name ?? ""),
                    description: String(item.description ?? ""),
                    organizationId: String(item.organization_id ?? ""),
                    startDate: toDateString(item.start_date || ""),
                    dueDate: toDateString(item.due_date),
                    priorityId: String(item.priority ?? ""),
                    statusId: String(item.status ?? ""),
                    progress: String(item.progress ?? "0"),
                }));
            } catch (err) {
                if (cancelled) {
                    return;
                }
                if (err instanceof ApiError) {
                    setError(err.message);
                } else {
                    setError("Không thể tải chi tiết nhiệm vụ.");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void loadTask();

        return () => {
            cancelled = true;
        };
    }, [taskId, isCreateMode]);

    const progressValue = Number(form.progress || 0);

    const statusSteps = [
        { key: "waiting", label: "Chờ tiếp nhận" },
        { key: "processing", label: "Đang thực hiện" },
        { key: "progress", label: `${Number.isFinite(progressValue) ? progressValue : 0}%` },
        { key: "pending_approval", label: "Chờ phê duyệt" },
        { key: "rejected", label: "Từ chối" },
        { key: "approved", label: "Đã phê duyệt" },
    ] as const;

    const tabs: Array<{ key: DetailTab; label: string; icon: ReactNode }> = [

    ];

    tabs.push({ key: "basic", label: "Thông tin cơ bản", icon: <FileText className="h-4 w-4" /> })
    if(!isOwner) tabs.push({ key: "progress", label: "Tiến độ (Đơn vị thực hiện / phối hợp)", icon: <Pencil className="h-4 w-4" /> })
    tabs.push({
        key: "discussion",
        label: "Nội dung trao đổi",
        icon: (
            <span className="flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" />
                    <AlertTriangle className="h-3 w-3 text-[#e65d23]" />
                </span>
        ),
    })
    tabs.push({ key: "document", label: "Thông tin văn bản", icon: <Search className="h-4 w-4" /> })
    tabs.push({ key: "history", label: "Lịch sử", icon: <Search className="h-4 w-4" /> })



    const readOnlyClass = !isEditMode && !isCreateMode ? "pointer-events-none opacity-95" : "";

    const handleSelectReportFiles = (event: ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(event.target.files || []);

        if (!selectedFiles.length) {
            return;
        }

        const validFiles = selectedFiles.filter((file) => {
            const extension = file.name.split(".").pop()?.toLowerCase() || "";
            return ["pdf", "docx"].includes(extension) && file.size < 50 * 1024 * 1024;
        });

        if (validFiles.length !== selectedFiles.length) {
            window.alert("Chỉ cho phép upload file PDF/DOCX và dung lượng nhỏ hơn 50MB.");
        }

        if (!validFiles.length) {
            event.target.value = "";
            return;
        }

        setReportFiles((currentItems) => {
            const maxId = currentItems.reduce((maxValue, item) => Math.max(maxValue, item.id), 0);
            const newItems = validFiles.map((file, index) => ({
                id: maxId + index + 1,
                name: file.name,
                sizeLabel: formatFileSize(file.size),
            }));
            return [...currentItems, ...newItems];
        });

        event.target.value = "";
    };

    const removeReportFile = (fileId: number) => {
        setReportFiles((currentItems) => currentItems.filter((item) => item.id !== fileId));
    };

    const handleSubmit = async () => {
        if (!form.title.trim()) {
            setActiveTab("basic");
            setError("Vui lòng nhập tên nhiệm vụ.");
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const payload: Record<string, unknown> = {
                title: form.title,
                description: form.description,
                organizationId: form.organizationId || undefined,
                startDate: form.startDate || undefined,
                dueDate: form.dueDate || undefined,
                priorityId: form.priorityId || undefined,
                statusId: form.statusId || undefined,
                progress: Number(form.progress || 0),
            };

            if (isCreateMode) {
                await api.post(endpoints.admin.tasks, payload);
            } else if (taskId && isEditMode) {
                await api.patch(`${endpoints.admin.tasks}/${taskId}`, payload);
            }

            router.push("/nhiem-vu-da-giao");
        } catch (err) {
            if (err instanceof ApiError) {
                setError(err.message);
            } else {
                setError("Không thể lưu nhiệm vụ.");
            }
        } finally {
            setSaving(false);
        }
    };

    const closeDetail = () => {
        router.push("/nhiem-vu-da-giao");
    };

    return (
        <div className="w-full space-y-4">
            <div className="rounded-2xl bg-gradient-to-r from-[#b91c1c] to-[#dc2626] p-4 text-white shadow-sm sm:p-5">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-semibold sm:text-xl">
                            {isOwner ? "Chi tiết nhiệm vụ đã giao" : isCreateMode ? "Thêm mới nhiệm vụ" : isEditMode ? "Chỉnh sửa nhiệm vụ được giao" : "Chi tiết nhiệm vụ được giao"}
                        </h2>
                        <p className="mt-1 text-sm text-white/90">{form.title || "Nhiệm vụ"}</p>
                        {actionHint ? <p className="mt-1 text-xs text-white/80">Hành động: {actionHint}</p> : null}
                    </div>
                    <button onClick={closeDetail} className="rounded-lg p-2 text-white hover:bg-white/15" title="Đóng">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="mt-4 hidden items-center text-xs md:flex">
                    {statusSteps.map((stepItem, index) => (
                        <div key={stepItem.key} className="flex min-w-0 flex-1 items-center">
                            <div className="w-full rounded-lg bg-white/10 px-3 py-2 text-center text-white/90">{stepItem.label}</div>
                            {index < statusSteps.length - 1 ? <div className="mx-1 h-0.5 min-w-[12px] flex-1 bg-white/30" /> : null}
                        </div>
                    ))}
                </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:p-3">
                <div className="flex min-w-max gap-2">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${activeTab === tab.key ? "bg-[#dc2626] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
                                }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {error ? <div className="rounded border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700">{error}</div> : null}
            {loading ? <div className="rounded bg-white p-6 text-center text-sm text-gray-500 shadow-sm dark:bg-gray-900">Đang tải dữ liệu...</div> : null}

            {activeTab === "basic" ? (
                <div className={`${cardClass} ${readOnlyClass}`}>
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-sm text-gray-700 dark:text-gray-200">Tên nhiệm vụ, Nhiệm vụ *</label>
                            <input className={inputClass} value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-sm text-gray-700 dark:text-gray-200">Mức độ ưu tiên</label>
                            <select className={inputClass} value={form.priorityId} onChange={(event) => setForm((prev) => ({ ...prev, priorityId: event.target.value }))}>
                                <option value="">-- Chọn --</option>
                                {priorityOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-sm text-gray-700 dark:text-gray-200">Đơn vị thực hiện</label>
                            <select className={inputClass} value={form.organizationId} onChange={(event) => setForm((prev) => ({ ...prev, organizationId: event.target.value }))}>
                                <option value="">-- Chọn --</option>
                                {organizationOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-sm text-gray-700 dark:text-gray-200">Trạng thái</label>
                            <select className={inputClass} value={form.statusId} onChange={(event) => setForm((prev) => ({ ...prev, statusId: event.target.value }))}>
                                <option value="">-- Chọn --</option>
                                {statusOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-sm text-gray-700 dark:text-gray-200">Ngày ban hành</label>
                            <DatePickerInput value={form.startDate} onChange={(newValue) => setForm((prev) => ({ ...prev, startDate: newValue }))} placeholder="Chọn ngày" />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-sm text-gray-700 dark:text-gray-200">Hạn hoàn thành</label>
                            <DatePickerInput value={form.dueDate} onChange={(newValue) => setForm((prev) => ({ ...prev, dueDate: newValue }))} placeholder="Chọn ngày" />
                        </div>
                    </div>

                    <div className="mt-3">
                        <label className="mb-1.5 block text-sm text-gray-700 dark:text-gray-200">Nội dung</label>
                        <textarea
                            rows={4}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#dc2626]/40 focus:ring-2 focus:ring-[#dc2626]/20 dark:border-gray-700 dark:bg-gray-800"
                            value={form.description}
                            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                        />
                    </div>
                </div>
            ) : null}

            {activeTab === "progress" ? (
                <div className={`${cardClass} ${readOnlyClass}`}>
                    <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">Tiến độ / trạng thái / kết quả</h3>
                    <div>
                        <label className="mb-1.5 block text-sm text-gray-700 dark:text-gray-200">% Tiến độ</label>
                        <input
                            type="number"
                            value={form.progress}
                            onChange={(event) => setForm((prev) => ({ ...prev, progress: event.target.value }))}
                            className={`${inputClass} lg:w-1/3`}
                        />
                    </div>
                    <div className="mt-3">
                        <label className="mb-1.5 block text-sm text-gray-700 dark:text-gray-200">Nội dung báo cáo</label>
                        <textarea
                            rows={4}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#dc2626]/40 focus:ring-2 focus:ring-[#dc2626]/20 dark:border-gray-700 dark:bg-gray-800"
                            placeholder="Nhập nội dung báo cáo tiến độ"
                            value={form.reportContent}
                            onChange={(event) => setForm((prev) => ({ ...prev, reportContent: event.target.value }))}
                        />
                    </div>
                    <div className="mt-3">
                        <label className="mb-1.5 block text-sm text-gray-700 dark:text-gray-200">Kết quả dạng file</label>
                        <input
                            ref={reportFileInputRef}
                            type="file"
                            multiple
                            accept=".pdf,.docx"
                            className="hidden"
                            onChange={handleSelectReportFiles}
                        />
                        <button
                            type="button"
                            onClick={() => reportFileInputRef.current?.click()}
                            className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 py-8 text-sm text-[#dc2626] transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800"
                        >
                            <Upload className="mb-2 h-5 w-5" />
                            Kéo thả hoặc bấm để tải file lên
                        </button>
                        <p className="mt-2 text-xs text-gray-500">Chỉ hỗ trợ file PDF, DOCX và dung lượng mỗi file phải nhỏ hơn 50MB.</p>
                        {reportFiles.length > 0 ? (
                            <div className="mt-3 space-y-2">
                                {reportFiles.map((reportFile) => (
                                    <div key={reportFile.id} className="flex items-center justify-between rounded border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                                        <div className="text-sm text-gray-700 dark:text-gray-200">
                                            {reportFile.name}
                                            <span className="ml-2 text-gray-400">({reportFile.sizeLabel})</span>
                                        </div>
                                        <button type="button" onClick={() => removeReportFile(reportFile.id)} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700" title="Xóa">
                                            <X className="h-4 w-4 text-red-600" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
            ) : null}

            {activeTab === "discussion" ? <div className={cardClass}>Nội dung trao đổi</div> : null}
            {activeTab === "document" ? <div className={cardClass}>Thông tin văn bản</div> : null}
            {activeTab === "history" ? (
                <div className={cardClass}>
                    <EmptyBoard columns={["STT", "Người báo cáo", "Ngày gửi", "Ngày duyệt"]} />
                </div>
            ) : null}

            <div className="sticky bottom-0 z-20 border-t border-gray-200 bg-[#f5f0e8]/95 px-2 py-3 backdrop-blur dark:border-gray-700 dark:bg-gray-900/95">
                <div className="flex flex-wrap justify-center gap-3">
                    {(isEditMode || isCreateMode) ? (
                        <button
                            type="button"
                            onClick={() => void handleSubmit()}
                            disabled={saving}
                            className="flex h-10 items-center gap-2 rounded-lg bg-[#dc2626] px-6 text-sm text-white hover:bg-[#b91c1c] disabled:opacity-60"
                        >
                            <Save className="h-4 w-4" />
                            {saving ? "Đang lưu..." : "Ghi"}
                        </button>
                    ) : null}
                    {(isEditMode || isCreateMode) ? (
                        <button
                            type="button"
                            onClick={() => {
                                if (!form.reportContent.trim()) {
                                    setActiveTab("progress");
                                    setError("Vui lòng nhập nội dung báo cáo trước khi Ghi và chuyển duyệt.");
                                    return;
                                }
                                void handleSubmit();
                            }}
                            disabled={saving}
                            className="flex h-10 items-center gap-2 rounded-lg border border-[#dc2626] bg-white px-6 text-sm text-[#dc2626] hover:bg-red-50 disabled:opacity-60"
                        >
                            <Send className="h-4 w-4" />
                            Ghi và chuyển duyệt
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={closeDetail}
                        className="h-10 rounded-lg border border-gray-300 bg-white px-6 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
}

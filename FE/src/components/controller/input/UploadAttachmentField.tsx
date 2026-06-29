'use client'

import React, { ChangeEvent, DragEvent, useRef, useState } from "react";
import { notification } from "antd";
import { CheckCircle2, Copy, File, FileArchive, FileImage, FileSpreadsheet, FileText, FileType2, Film, Music, Upload, X } from "lucide-react";
import ActionIcon from "@/components/controller/ActionIcon";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { FileUploadType } from "@/types/api";
import ActionButton from "../ActionButton";

export interface AttachmentType {
    id: string;
    uuid?: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    fileContentBase64: string;
}
export type JsonRecord = Record<string, unknown>;

export type UploadAttachment = {
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    fileContentBase64: string;
    uuid?: string;
};

export type ExistingAttachment = {
    key: string;
    id?: string;
    fileName: string;
    fileSize?: number;
    mimeType?: string;
};
export function getFileExtension(fileName: string): string {
    const name = fileName.trim().toLowerCase();
    const dotIndex = name.lastIndexOf(".");
    if (dotIndex < 0 || dotIndex === name.length - 1) {
        return "";
    }
    return name.slice(dotIndex + 1);
}
export function formatFileSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return "0 KB";
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
export function fileToBase64(file: File): Promise<string> {
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
interface FProps {
    value?: AttachmentType[];
    onChange?: (files: AttachmentType[]) => void;
    error?: string;
    visibleExtensions?: string[];
    readOnly?: boolean;
    multiple?: boolean;
}


type FileSummaryResponse = {
    item?: JsonRecord;
    summary?: string;
    summarySource?: string;
    smartReader?: JsonRecord;
};

type SummaryModalTarget = {
    attachment: ExistingAttachment;
    document: JsonRecord | null;
};

const maxUploadSizeBytes = 50 * 1024 * 1024;
const maxUploadSizeText = '50MB';

const getFileIcon = (fileName: string, mimeType: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';

    if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
        return <FileImage size={18} color="#1677ff" />;
    }

    if (mimeType.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'wmv'].includes(ext)) {
        return <Film size={18} color="#722ed1" />;
    }

    if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'aac'].includes(ext)) {
        return <Music size={18} color="#13a8a8" />;
    }

    if (['xls', 'xlsx', 'csv'].includes(ext)) {
        return <FileSpreadsheet size={18} color="#389e0d" />;
    }

    if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) {
        return <FileText size={18} color="#1677ff" />;
    }

    if (['pdf'].includes(ext)) {
        return <FileType2 size={18} color="#cf1322" />;
    }

    if (['zip', 'rar', '7z'].includes(ext)) {
        return <FileArchive size={18} color="#d48806" />;
    }

    return <File size={18} color="#8c8c8c" />;
};

const asRecord = (value: unknown): JsonRecord | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    return value as JsonRecord;
};

const normalizeExtension = (extension: string) => extension.trim().toLowerCase().replace(/^\./, "");

export default function UploadAttachmentsField({
    value = [],
    onChange,
    error,
    visibleExtensions = [],
    readOnly = false,
    multiple= true
}: FProps) {
    const [summaryTarget, setSummaryTarget] = React.useState<SummaryModalTarget | null>(null);
    const [summaryLoading, setSummaryLoading] = React.useState(false);
    const [summaryError, setSummaryError] = React.useState<string | null>(null);
    const [summaryResult, setSummaryResult] = React.useState<FileSummaryResponse | null>(null);
    const [summaryCache, setSummaryCache] = React.useState<Record<string, FileSummaryResponse>>({});
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [activeDocumentItem] = useState<JsonRecord | null>(null);
    const summaryRequestRef = useRef(0);
    const summaryCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [summaryCopied, setSummaryCopied] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const normalizedVisibleExtensions = visibleExtensions.map(normalizeExtension).filter(Boolean);
    const hasVisibleExtensionFilter = normalizedVisibleExtensions.length > 0;
    const matchesVisibleExtension = (fileName: string) => {
        if (!hasVisibleExtensionFilter) {
            return true;
        }

        const extension = normalizeExtension(getFileExtension(fileName));
        return normalizedVisibleExtensions.includes(extension);
    };
    const acceptValue = hasVisibleExtensionFilter
        ? normalizedVisibleExtensions.map((extension) => "." + extension).join(",")
        : undefined;
    const displayedAttachments = value.filter((attachment) => matchesVisibleExtension(attachment.fileName));
    const displayedNewAttachments = displayedAttachments.filter((attachment) => !attachment.uuid);
    const displayedExistingAttachments = displayedAttachments.filter((attachment) => attachment.uuid);

    const createAttachmentsFromFiles = async (selectedFiles: File[]) => {
        const oversizedFiles = selectedFiles.filter((file) => file.size > maxUploadSizeBytes);
        const invalidExtensionFiles = hasVisibleExtensionFilter
            ? selectedFiles.filter((file) => !matchesVisibleExtension(file.name))
            : [];
        const validFiles = selectedFiles.filter(
            (file) => file.size <= maxUploadSizeBytes && matchesVisibleExtension(file.name)
        );



        if (oversizedFiles.length > 0) {
            notification.warning({
                title: 'Tệp vượt quá dung lượng',
                description: `Chỉ được tải tệp tối đa ${maxUploadSizeText}.`,
            });
        }

        if (invalidExtensionFiles.length > 0) {
            notification.warning({
                title: "Định dạng tệp không hợp lệ",
                description: `Chỉ hiển thị và tải lên các tệp: ${normalizedVisibleExtensions.map((extension) => extension.toUpperCase()).join(", ")}.`,
            });
        }

        if (!validFiles.length) return [];

        const uploaded = await Promise.all(
            validFiles.map(async (file, index) => ({
                id: `${Date.now()}-${index}-${file.name}`,
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type || "application/octet-stream",
                fileContentBase64: await fileToBase64(file),
            }))
        );

        return uploaded;
    };

    const appendSelectedFiles = async (selectedFiles: File[]) => {
        if (!selectedFiles.length) return;

        try {
            const uploaded = await createAttachmentsFromFiles(selectedFiles);

            if (uploaded.length > 0) {
                if (multiple) {
                    onChange?.([...value, ...uploaded]);
                } else {
                        // @ts-expect-error single-file mode keeps backward compatibility with current consumers
                        onChange?.(uploaded[0]);
                    }
                }
        } catch(e) {
            console.log(e)
            console.error("Không thể đọc file");
        }
    };

    const handleSelectFiles = async (event: ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(event.target.files || []);
        await appendSelectedFiles(selectedFiles);

        // reset input để chọn lại cùng file
        event.target.value = "";
    };

    const handleDragOver = (event: DragEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();

        if (!readOnly) {
            setIsDragOver(true);
        }
    };

    const handleDragLeave = (event: DragEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(false);
    };

    const handleDropFiles = async (event: DragEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(false);

        if (readOnly) {
            return;
        }

        const droppedFiles = Array.from(event.dataTransfer.files || []);
        await appendSelectedFiles(droppedFiles);
    };

    const removeAttachment = (id: string) => {
        const newList = value.filter((f) => f.id !== id);
        onChange?.(newList);
    };

    const resolveExistingAttachmentPreviewUrl = async (attachment: FileUploadType) => {
        if (!attachment.uuid) {
            throw new Error("File này không có ID để xem.");
        }

        const response = await api.get<{ previewUrl?: string }>(
            `/content/files/${attachment.uuid}/preview?expiresIn=300`
        );
        const previewUrl = String(response?.previewUrl ?? "").trim();

        if (!previewUrl) {
            throw new Error("Không nhận được đường dẫn xem file.");
        }

        return previewUrl;
    };

    const viewExistingAttachment = async (attachment: FileUploadType) => {
        try {

            const ext = getFileExtension(attachment.fileName);
            if (ext === "docx" || ext === "doc") {
                notification.warning({ title: 'Cảnh báo', description: "File DOCX không hỗ trợ xem trước." });
                return;
            }

            const url = await resolveExistingAttachmentPreviewUrl(attachment);
            window.open(url, "_blank", "noopener,noreferrer");
        } catch {
            notification.error({ title: 'Tệp tin lỗi', description: "Không thể xem file." });
        }
    };

    const openSummaryModal = async (attachment: FileUploadType) => {
        const fileId = String(attachment.uuid ?? "").trim();
        if (!fileId) {
            notification.error({ description: "File này không có ID để tóm tắt.", title: 'Lỗi file' });
            return;
        }

        setSummaryTarget({
            attachment: { ...attachment, key: 'summary' },
            document: activeDocumentItem,
        });
        if (summaryCopyTimeoutRef.current) {
            clearTimeout(summaryCopyTimeoutRef.current);
            summaryCopyTimeoutRef.current = null;
        }
        setSummaryCopied(false);
        setSummaryError(null);

        const cachedSummary = summaryCache[fileId];
        if (cachedSummary) {
            setSummaryResult(cachedSummary);
            setSummaryLoading(false);
            return;
        }

        setSummaryResult(null);
        setSummaryLoading(true);

        const requestKey = summaryRequestRef.current + 1;
        summaryRequestRef.current = requestKey;

        try {
            const nextSummary = await requestFileSummary(fileId);
            if (summaryRequestRef.current !== requestKey) {
                return;
            }

            setSummaryResult(nextSummary);
            setSummaryCache((prev) => ({
                ...prev,
                [fileId]: nextSummary,
            }));
        } catch (err) {
            if (summaryRequestRef.current !== requestKey) {
                return;
            }

            setSummaryError(err instanceof Error ? err.message : "Không thể tóm tắt nội dung văn bản.");
        } finally {
            if (summaryRequestRef.current === requestKey) {
                setSummaryLoading(false);
            }
        }
    };

    const summaryItem = asRecord(summaryResult?.item);
    const smartReader = asRecord(summaryResult?.smartReader);
    const smartReaderSummary = asRecord(smartReader?.summary);
    const smartReaderSummaryObject = asRecord(smartReaderSummary?.object);
    const summaryWarningMessages = Array.isArray(smartReaderSummaryObject?.warning_messages)
        ? smartReaderSummaryObject.warning_messages
            .map((value) => String(value ?? "").trim())
            .filter(Boolean)
        : [];
    const summaryText =
        String(summaryResult?.summary ?? "").trim() ||
        String(asRecord(smartReaderSummaryObject?.summary)?.text ?? "").trim();
    const summaryFileName = String(summaryItem?.fileName ?? summaryTarget?.attachment.fileName ?? "").trim();
    const summaryMimeType = String(summaryItem?.mimeType ?? summaryTarget?.attachment.mimeType ?? "").trim();
    const summaryFileType = (() => {
        const extension = getFileExtension(summaryFileName);
        if (extension) {
            return extension.toUpperCase();
        }

        if (!summaryMimeType) {
            return "";
        }

        const mimeTypePart = summaryMimeType.split("/").pop()?.split(".").pop()?.trim();
        return mimeTypePart ? mimeTypePart.toUpperCase() : summaryMimeType.toUpperCase();
    })();
    const summaryFileSize = summaryItem?.fileSize
        ? formatFileSize(Number(summaryItem.fileSize))
        : (summaryTarget?.attachment.fileSize ? formatFileSize(summaryTarget.attachment.fileSize) : "");

    const copySummaryText = async () => {
        const text = summaryText.trim();
        if (!text) {
            return;
        }

        try {
            await navigator.clipboard.writeText(text);
            setSummaryCopied(true);

            if (summaryCopyTimeoutRef.current) {
                clearTimeout(summaryCopyTimeoutRef.current);
            }

            summaryCopyTimeoutRef.current = setTimeout(() => {
                setSummaryCopied(false);
            }, 2000);
        } catch {
            notification.error({ description: "Không thể sao chép nội dung tóm tắt.", title: 'Lỗi' });
        }
    };

    const resolveExistingAttachmentDownloadUrl = async (attachment: FileUploadType) => {
        if (!attachment.uuid) {
            notification.warning({ title: 'Cảnh báo', description: "File này không có ID để tải xuống." });
        }

        const response = await api.get<{ downloadUrl?: string }>(
            `/content/files/${attachment.uuid}/download?expiresIn=300`
        );
        const downloadUrl = String(response?.downloadUrl ?? "").trim();

        if (!downloadUrl) {
            notification.warning({ title: 'Cảnh báo', description: "Không nhận được đường dẫn tải file." });

        }

        return downloadUrl;
    };

    const downloadExistingAttachment = async (attachment: FileUploadType) => {
        try {
            const url = await resolveExistingAttachmentDownloadUrl(attachment);

            const link = document.createElement("a");
            link.href = url;
            link.download = attachment.fileName;
            link.rel = "noopener noreferrer";
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch {
            notification.error({ title: 'Tệp tin lỗi', description: "Không thể tải file." });
        }
    };

    const closeSummaryModal = () => {
        summaryRequestRef.current += 1;
        if (summaryCopyTimeoutRef.current) {
            clearTimeout(summaryCopyTimeoutRef.current);
            summaryCopyTimeoutRef.current = null;
        }
        setSummaryCopied(false);
        setSummaryTarget(null);
        setSummaryLoading(false);
        setSummaryError(null);
        setSummaryResult(null);
    };

    const requestFileSummary = async (fileId: string) => {
        return api.post<FileSummaryResponse>(endpoints.admin.fileSummary(fileId), {
            details: true,
        });
    };

    return (
        <div>
            {!readOnly && (
                <>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple={multiple}
                        accept={acceptValue}
                        className="hidden"
                        onChange={handleSelectFiles}
                    />

                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={handleDragOver}
                        onDragEnter={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={(event) => void handleDropFiles(event)}
                        className={`flex w-full flex-col items-center justify-center rounded border border-dashed py-6 transition-colors ${
                            isDragOver
                                ? "border-[#dc2626] bg-red-50 text-[#dc2626] dark:border-red-400 dark:bg-red-950/30"
                                : "border-gray-300 bg-white text-[#dc2626] hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
                        }`}
                    >
                        <Upload className="mb-1 h-5 w-5" />
                        {isDragOver ? "Thả file vào đây" : "Tải file lên"}
                        <span className="mt-1 text-xs text-gray-500">
                            Kéo thả hoặc bấm để chọn, tối đa {maxUploadSizeText} mỗi tệp
                        </span>
                    </button>
                </>
            )}

            {error && (
                <p className="mt-1 text-xs text-red-600">{error}</p>
            )}

            {displayedAttachments.length > 0 && (
                <div className="mt-3 space-y-2">
                    {displayedNewAttachments.length > 0 && <span className={'font-semibold'}>{"File mới"}</span>}
                    {displayedNewAttachments.map((attachment) => (
                        <div
                            key={attachment.id}
                            className="flex items-center justify-between rounded border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
                        >
                            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                                <span className="inline-flex items-center justify-center rounded-md bg-gray-50 p-2 dark:bg-gray-700">
                                    {getFileIcon(attachment.fileName, attachment.mimeType)}
                                </span>
                                <span>{attachment.fileName}</span>
                            </div>

                            {!readOnly && (
                                <button
                                    type="button"
                                    onClick={() => removeAttachment(attachment.id)}
                                    className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    title="Xóa"
                                >
                                    <ActionIcon action="delete" />
                                </button>
                            )}
                        </div>
                    ))}

                    {displayedExistingAttachments.length > 0 && <span className={'font-semibold'}>{"File có sẵn"}</span>}
                    {displayedExistingAttachments.map((attachment) => {
                        const extension = getFileExtension(attachment.fileName);
                        const canPreview = extension === "pdf";

                        return (
                            <div
                                key={attachment.id}
                                className="flex items-center justify-between rounded border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
                            >
                                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                                    <span className="inline-flex items-center justify-center rounded-md bg-gray-50 p-2 dark:bg-gray-700">
                                        {getFileIcon(attachment.fileName, attachment.mimeType)}
                                    </span>
                                    <span>{attachment.fileName}</span>
                                </div>
                                <div>
                                    {canPreview ? (
                                        <button
                                            type="button"
                                            onClick={() => viewExistingAttachment(attachment as unknown as FileUploadType)}
                                            disabled={!attachment.id}
                                            className="rounded-md p-1 text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
                                            title="Xem file"
                                        >
                                            <ActionIcon action="view" />
                                        </button>
                                    ) : null}

                                    {canPreview ? (
                                        <button
                                            type="button"
                                            onClick={() => void openSummaryModal(attachment as unknown as FileUploadType)}
                                            disabled={!attachment.id}
                                            className="rounded-md p-1 text-sky-600 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-sky-300 dark:hover:bg-sky-900/30"
                                            title="Tóm tắt văn bản"
                                        >
                                            <ActionIcon action="magic" />
                                        </button>
                                    ) : null}

                                    <button
                                        type="button"
                                        onClick={() => downloadExistingAttachment(attachment as unknown as FileUploadType)}
                                        disabled={!attachment.id}
                                        className="rounded-md p-1 text-sky-600 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-sky-300 dark:hover:bg-sky-900/30"
                                        title={attachment.id ? "Tải xuống" : "File này không có ID để tải xuống"}
                                    >
                                        <ActionIcon action="download" />
                                    </button>

                                    {!readOnly && (
                                        <button
                                            type="button"
                                            onClick={() => removeAttachment(attachment.id)}
                                            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                                            title="Xóa"
                                        >
                                            <ActionIcon action="delete" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
            {summaryTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-900">
                        <div className="popup-title-bar-danger rounded-t-lg flex items-center justify-between">
                            <h3 className="popup-title-text">Tóm tắt văn bản</h3>

                            <button onClick={closeSummaryModal} className="rounded-md p-1 text-white/90 hover:bg-white/10">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="max-h-[calc(100vh-6rem)] overflow-y-auto p-5">
                            <div className="grid grid-cols-1 gap-3">
                                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                                    <h4 className="text-base font-semibold text-gray-900 dark:text-white">Thông tin chung</h4>
                                    <div className="mt-3 space-y-1 pl-4 text-sm leading-7 text-gray-900 dark:text-white">
                                        <p className="break-words">
                                            <span className="font-medium">Tên file:</span> {summaryFileName || "-"}
                                        </p>
                                        <p className="break-words">
                                            <span className="font-medium">Định dạng:</span> {summaryFileType || "-"}
                                        </p>
                                        <p className="break-words">
                                            <span className="font-medium">Kích thước:</span> {summaryFileSize || "-"}
                                        </p>
                                    </div>
                                </div>

                            </div>
                            {summaryWarningMessages.length > 0 ? (
                                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                                    <p className="font-semibold">Cảnh báo</p>
                                    <div className="mt-2 space-y-1">
                                        {summaryWarningMessages.map((warningMessage: string) => (
                                            <p key={warningMessage}>- {warningMessage}</p>
                                        ))}
                                    </div>
                                </div>
                            ) : null}

                            <div className="mt-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                                <div className="flex items-center justify-between gap-3">
                                    <h4 className="text-base font-semibold text-gray-900 dark:text-white">Nội dung tóm tắt</h4>
                                    <button
                                        type="button"
                                        onClick={() => void copySummaryText()}
                                        disabled={summaryLoading || summaryError !== null || !summaryText}
                                        className="rounded-md p-1.5 text-sky-600 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-sky-300 dark:hover:bg-sky-900/30"
                                        title={summaryCopied ? "Đã sao chép" : "Sao chép nội dung"}
                                    >
                                        {summaryCopied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                    </button>
                                </div>

                                {summaryLoading ? (
                                    <div className="flex flex-col items-center justify-center py-10">
                                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500 dark:border-gray-700 dark:border-t-brand-400"></div>
                                        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Đang tóm tắt nội dung...</p>
                                    </div>
                                ) : summaryError ? (
                                    <p className="mt-3 rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-700 dark:border-error-900 dark:bg-error-950/40 dark:text-error-300">
                                        {summaryError}
                                    </p>
                                ) : (
                                    <>
                                        <div className="mt-3 rounded-lg bg-gray-50 p-4 text-sm leading-6 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                                            <p className="whitespace-pre-wrap">{summaryText || "Không có nội dung tóm tắt."}</p>
                                        </div>
                                        <p className="mt-3 text-xs italic text-gray-500 dark:text-gray-400">
                                            Nội dung này được tạo bởi AI và chỉ mang tính chất tham khảo
                                        </p>
                                    </>
                                )}
                            </div>

                            <div className="popup-footer-actions">
                                <ActionButton type="close" onClick={closeSummaryModal} label="Đóng"></ActionButton>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

'use client'

import {FileUploadType} from "@/types/api";
import {Button, Flex, notification, Space, Tooltip, Typography} from "antd";
import {formatFileSize, getFileExtension} from "@/components/controller/input/UploadAttachmentField";
import {Download, Eye} from "lucide-react";
import React, {JSX} from "react";
import {api} from "@/lib/api";

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
            notification.warning({title: 'Cảnh báo', description: "File DOCX không hỗ trợ xem trước."});
            return;
        }

        const url = await resolveExistingAttachmentPreviewUrl(attachment);
        window.open(url, "_blank", "noopener,noreferrer");
    } catch {
        notification.error({title: 'Tệp tin lỗi', description: "Không thể xem file."});
    }
};

const resolveExistingAttachmentDownloadUrl = async (attachment: FileUploadType) => {
    if (!attachment.uuid) {
        notification.warning({title: 'Cảnh báo', description: "File này không có ID để tải xuống."});
    }

    const response = await api.get<{ downloadUrl?: string }>(
        `/content/files/${attachment.uuid}/download?expiresIn=300`
    );
    const downloadUrl = String(response?.downloadUrl ?? "").trim();

    if (!downloadUrl) {
        notification.warning({title: 'Cảnh báo', description: "Không nhận được đường dẫn tải file."});

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
        notification.error({title: 'Tệp tin lỗi', description: "Không thể tải file."});
    }
};

export default function FilesDisplayComponents ({files, orientation='vertical' }: {files: FileUploadType[], orientation?: 'vertical' | 'horizontal'}): JSX.Element {
    {
        if (!files?.length) {
            return <Typography.Text type="secondary">Không có tệp đính kèm</Typography.Text>;
        }

        return (
            <Space orientation={orientation} size={8} style={{ width: '100%' }}>
                {files.map((f) => {
                    const extension = getFileExtension(f.fileName);
                    const canPreview = extension === "pdf";

                    return (
                        <Flex
                            key={f.uuid}
                            align="center"
                            justify="space-between"
                            gap={12}
                            style={{
                                border: "1px solid #f0f0f0",
                                borderRadius: 8,
                                padding: "8px 12px",
                                width: orientation === "horizontal" ? "100%" : undefined,
                            }}
                        >
                            <Flex vertical style={{ minWidth: 0, flex: 1 }}>
                                <Typography.Text ellipsis style={{ maxWidth: 240 }}>
                                    {f.fileName}
                                </Typography.Text>
                                <Typography.Text type="secondary">
                                    {formatFileSize(f.fileSize)}
                                </Typography.Text>
                            </Flex>

                            <Space>
                                {canPreview && (
                                    <Tooltip title="Xem file PDF">
                                        <Button
                                            type="text"
                                            size="small"
                                            icon={<Eye size={16} />}
                                            onClick={() => viewExistingAttachment(f)}
                                            disabled={!f.uuid}
                                        />
                                    </Tooltip>
                                )}

                                <Tooltip title="Tải xuống">
                                    <Button
                                        type="text"
                                        size="small"
                                        icon={<Download size={16} />}
                                        onClick={() => downloadExistingAttachment(f)}
                                        disabled={!f.uuid}
                                    />
                                </Tooltip>
                            </Space>
                        </Flex>
                    );
                })}
            </Space>
        );
    }
}

'use client'

import React, { useEffect, useState } from "react";
import {Col, Modal, notification, Row, Spin} from "antd";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import {ApiResponse, FileUploadType} from "@/types/api";
import dayjs from "dayjs";
import {DocumentSchema} from "@/types/documents";
import {formatFileSize, getFileExtension} from "@/components/controller/input/UploadAttachmentField";
import {Download, Eye} from "lucide-react";
import {DonVi} from "@/types/organizations";

type Props = {

    documentId?: string | null;
    setDocument?: (e: DocumentSchema) => void;
};

export default function DocumentInfoComponent({
                                              documentId,
                                                  setDocument
                                          }: Props) {

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | undefined>(undefined);
    const [documentView, setDocumentView] = useState<DocumentSchema | undefined>(undefined);
    const [org, setOrg] = useState<DonVi| undefined>(undefined)
    const [field, setField] = useState<{name: string} | undefined>(undefined)


    const getDocument = async () => {
        if (!documentId) return;

        try {
            setLoading(true);
            setError(undefined);

            const res =
                await api.get<ApiResponse<DocumentSchema>>(
                    `${endpoints.admin.documents}/${documentId}`
                );

            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            const doc: DocumentSchema = {...res.item,
                              files: res.files }

            if (doc?.issuingOrgId) {
                const orgRes = await api.get<ApiResponse<DonVi>>(
                    `${endpoints.admin.organizations}/${doc.issuingOrgId}`
                );
                setOrg(orgRes.item);
            }
            if(doc?.fieldId) {
                const fieldRes = await api.get<ApiResponse<{name: string}>>(
                    `${endpoints.admin.categoryItems}/${doc?.fieldId}`
                )
                setField(fieldRes.item)
            }
            setDocumentView(doc);
            setDocument?.(doc)

        } catch (e: unknown) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            setError(e.message || "Lỗi tải văn bản");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void getDocument()
    }, [documentId]);



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
        } catch (err) {
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
        } catch (err) {
            notification.error({title: 'Tệp tin lỗi', description: "Không thể tải file."});
        }
    };


    return (
<Spin spinning={loading} size={'large'}>
            <Row gutter={[16,16]}>


                {error && (
                    <Col span={24}>

                    <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {error}
                    </div>
                    </Col>

                )}


                {!loading && !error && documentView && (
                    <Col span={24}>
                        <Row gutter={[16, 16]}>
                            <Col md={24} lg={12}>
                                <Info label="Tên văn bản" value={documentView.title} />
                            </Col>

                            <Col md={24} lg={12}>
                                <Info label="Số văn bản" value={documentView?.documentNumber || ''} />
                            </Col>

                            <Col md={24} lg={12}>
                                <Info label="Cơ quan ban hành" value={org?.name || ''} />
                            </Col>

                            <Col md={24} lg={12}>
                                <Info label="Lĩnh vực" value={field?.name || ''} />
                            </Col>


                            <Col md={24} lg={12}>
                                <Info
                                    label="Ngày ban hành"
                                    value={dayjs(documentView.issuedDate).format('DD/MM/YYYY')}
                                />
                            </Col>

                            <Col md={24} lg={12}>
                                <Info
                                    label="Ngày hiệu lực"
                                    value={dayjs(documentView.effectiveDate).format('DD/MM/YYYY')}
                                />
                            </Col>

                            <Col span={24}>
                                <div className="rounded border border-gray-200 p-3 text-sm">
                                    <p className="text-xs text-gray-500">
                                        Tóm tắt
                                    </p>

                                    <p className="mt-1">
                                        {documentView.summary || "-"}
                                    </p>
                                </div>
                            </Col>
                            <Col span={24}>
                                <div className="overflow-x-auto rounded border border-gray-200">
                                    <table className="w-full min-w-[760px] text-sm">

                                        <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-3 py-2 text-left">
                                                STT
                                            </th>

                                            <th className="px-3 py-2 text-left">
                                                Tên file
                                            </th>

                                            <th className="px-3 py-2 text-left">
                                                Dung lượng
                                            </th>

                                            {/*<th className="px-3 py-2 text-left">*/}
                                            {/*    Đường dẫn*/}
                                            {/*</th>*/}
                                            <th className="px-3 py-2 text-left">
                                                Thao tác
                                            </th>
                                        </tr>
                                        </thead>


                                        <tbody>
                                        {documentView.files?.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan={4}
                                                    className="px-3 py-6 text-center text-gray-500"
                                                >
                                                    Không có tệp đính kèm
                                                </td>
                                            </tr>
                                        )}

                                        {documentView.files?.map(
                                            (f, i: number) => {
                                                const extension = getFileExtension(f.fileName);
                                                const canPreview = extension === "pdf";
                                                return (

                                                    <tr
                                                        key={f.uuid}
                                                        className="border-t"
                                                    >
                                                        <td className="px-3 py-2">
                                                            {i + 1}
                                                        </td>

                                                        <td className="px-3 py-2">
                                                            {f.fileName}
                                                        </td>

                                                        <td className="px-3 py-2">
                                                            {formatFileSize(f.fileSize)}
                                                        </td>

                                                        {/*<td className="px-3 py-2 text-xs">*/}
                                                        {/*    {f.filePath || "-"}*/}
                                                        {/*</td >*/}
                                                        <td className="px-3 py-2 text-xs">
                                                            { canPreview && <button
                                                                type="button"
                                                                onClick={() => viewExistingAttachment(f)}
                                                                disabled={!f.uuid || !canPreview}
                                                                className="rounded-md p-1.5 text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
                                                                title={canPreview ? "Xem file" : "Chỉ hỗ trợ xem trước file PDF"}
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                            </button> }

                                                            <button
                                                                type="button"
                                                                onClick={() => downloadExistingAttachment(f)}
                                                                disabled={!f.uuid}
                                                                className="rounded-md p-1.5 text-sky-600 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-sky-300 dark:hover:bg-sky-900/30"
                                                                title={f.uuid ? "Tải xuống file" : "File này không có ID để tải xuống"}
                                                            >
                                                                <Download className="h-4 w-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                )}
                                        )}
                                        </tbody>

                                    </table>
                                </div>
                            </Col>








                        </Row>






                    </Col>
                )}

            </Row>
</Spin>
    );
}


function Info({
                  label,
                  value,
              }: {
    label: string;
    value?: string;
}) {
    return (
        <div className="rounded border border-gray-200 p-3">
            <p className="text-xs text-gray-500">
                {label}
            </p>

            <p className="mt-1 font-medium">
                {value || "-"}
            </p>
        </div>
    );
}
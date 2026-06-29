"use client";

import {api, ApiError} from "@/lib/api";
import {endpoints} from "@/lib/endpoints";
import type {ImportCommitResult, ImportField, ImportPreviewResult, ImportTemplateResponse} from "@/types/imports";
import {App, Button, Modal, Table, Tag} from "antd";
import {UploadOutlined} from "@ant-design/icons";
import {useCallback, useEffect, useMemo, useState} from "react";
import {ReactSpreadsheetImport} from "react-spreadsheet-import";
import type {Fields, Result} from "react-spreadsheet-import/types/types";

type SharedSpreadsheetImportProps = {
    moduleKey: string;
    buttonLabel?: string;
    onCommitted?: (result: ImportCommitResult) => void | Promise<void>;
};

type RowRecord = Record<string, unknown>;

const toRsiFields = (fields: ImportField[]): Fields<string> =>
    fields.map((field) => ({
        label: field.label,
        key: field.key,
        description: field.description,
        alternateMatches: field.alternateMatches,
        fieldType: field.fieldType ?? {type: "input"},
        validations: field.validations,
        example: field.example,
    })) as Fields<string>;

const rowsFromResult = (result: Result<string>): RowRecord[] =>
    result.all.map((row) => {
        const next: RowRecord = {};
        Object.entries(row).forEach(([key, value]) => {
            if (key === "__index" || key === "__errors") return;
            next[key] = value;
        });
        return next;
    });

export default function SharedSpreadsheetImport({
    moduleKey,
    buttonLabel = "Import Excel",
    onCommitted,
}: SharedSpreadsheetImportProps) {
    const {notification} = App.useApp();
    const [isOpen, setIsOpen] = useState(false);
    const [template, setTemplate] = useState<ImportTemplateResponse | null>(null);
    const [loadingTemplate, setLoadingTemplate] = useState(false);
    const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
    const [pendingRows, setPendingRows] = useState<RowRecord[]>([]);
    const [commitOpen, setCommitOpen] = useState(false);
    const [committing, setCommitting] = useState(false);

    const loadTemplate = useCallback(async () => {
        setLoadingTemplate(true);
        try {
            const data = await api.get<ImportTemplateResponse>(endpoints.imports.template(moduleKey));
            setTemplate(data);
        } catch (error) {
            notification.error({
                message: "Không thể tải cấu hình import",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
        } finally {
            setLoadingTemplate(false);
        }
    }, [moduleKey, notification]);

    useEffect(() => {
        if (isOpen && !template) {
            loadTemplate();
        }
    }, [isOpen, loadTemplate, template]);

    const rsiFields = useMemo(() => toRsiFields(template?.fields ?? []), [template?.fields]);

    const handleSubmit = async (result: Result<string>) => {
        const rows = rowsFromResult(result);
        try {
            const previewResult = await api.post<ImportPreviewResult>(endpoints.imports.preview(moduleKey), {rows});
            setPreview(previewResult);
            setPendingRows(previewResult.validRows.map((row) => row.data as RowRecord));
            setCommitOpen(true);
            setIsOpen(false);
        } catch (error) {
            notification.error({
                message: "Không thể kiểm tra dữ liệu import",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
        }
    };

    const commitRows = async () => {
        setCommitting(true);
        try {
            const result = await api.post<ImportCommitResult>(endpoints.imports.commit(moduleKey), {rows: pendingRows});
            notification.success({
                message: "Import hoàn tất",
                description: `Thêm mới ${result.created.length}, cập nhật ${result.updated.length}, lỗi ${result.failed}.`,
            });
            setCommitOpen(false);
            setPreview(null);
            setPendingRows([]);
            await onCommitted?.(result);
        } catch (error) {
            notification.error({
                message: "Không thể lưu dữ liệu import",
                description: error instanceof ApiError ? error.message : "Vui lòng kiểm tra dữ liệu",
            });
        } finally {
            setCommitting(false);
        }
    };

    return (
        <>
            <Button
                icon={<UploadOutlined/>}
                loading={loadingTemplate}
                onClick={() => setIsOpen(true)}
                style={{
                    height: 40,
                    borderRadius: 10,
                    fontWeight: 500,
                    backgroundColor: "#f6ffed",
                    borderColor: "#d9f7be",
                    color: "#389e0d",
                    boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)",
                }}
            >
                {buttonLabel}
            </Button>
            {template ? (
                <ReactSpreadsheetImport
                    isOpen={isOpen}
                    onClose={() => setIsOpen(false)}
                    fields={rsiFields}
                    onSubmit={handleSubmit}
                    allowInvalidSubmit={false}
                    autoMapHeaders
                    autoMapSelectValues
                    isNavigationEnabled
                    maxRecords={5000}
                    translations={{
                        uploadStep: {
                            title: "Tải file dữ liệu",
                            manifestTitle: "Cột dữ liệu cần có",
                            manifestDescription: "File Excel/CSV sẽ được đọc và cho phép map cột trước khi lưu.",
                            dropzone: {
                                title: "Kéo thả file vào đây hoặc chọn file",
                                errorToastDescription: "File không hợp lệ",
                                activeDropzoneTitle: "Thả file để tải lên",
                                buttonTitle: "Chọn file",
                            },
                        },
                    }}
                />
            ) : null}
            <Modal
                title="Xác nhận import"
                open={commitOpen}
                onCancel={() => setCommitOpen(false)}
                onOk={commitRows}
                confirmLoading={committing}
                okButtonProps={{disabled: !preview || preview.validRows.length === 0 || preview.errors.length > 0}}
                okText="Lưu dữ liệu"
                cancelText="Hủy"
                width={860}
            >
                <div className="mb-3 flex flex-wrap gap-2">
                    <Tag color="blue">Tổng dòng: {preview?.totalRows ?? 0}</Tag>
                    <Tag color="green">Hợp lệ: {preview?.validRows.length ?? 0}</Tag>
                    <Tag color={preview?.errors.length ? "red" : "default"}>Lỗi: {preview?.errors.length ?? 0}</Tag>
                </div>
                <Table
                    rowKey={(row) => `${row.rowNumber}-${row.field ?? row.message}`}
                    size="small"
                    pagination={{pageSize: 5}}
                    dataSource={preview?.errors ?? []}
                    columns={[
                        {title: "Dòng", dataIndex: "rowNumber", width: 90},
                        {title: "Trường", dataIndex: "field", width: 160, render: (value) => value || "-"},
                        {title: "Lỗi", dataIndex: "message"},
                    ]}
                    locale={{emptyText: "Không có lỗi. Có thể lưu dữ liệu."}}
                />
            </Modal>
        </>
    );
}

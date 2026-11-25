"use client";

import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import {
    createDistributionBatchImportTemplate,
    readDistributionBatchSpreadsheet,
    type DistributionImportIssue,
    type DistributionLineImportResult,
    type DistributionLocalityOption
} from "@/lib/distribution-batch-import";
import type {
    DistributionBatchCreateInput,
    DistributionBatchLineInput,
    PublicLocationOption,
    SocialAssistanceDistributionBatch,
    SocialAssistanceProgram
} from "@/types/social-assistance";
import { Alert, App, Button, DatePicker, Drawer, Empty, Form, Input, InputNumber, Select, Space, Spin, Table, Typography } from "antd";
import type { TableColumnsType } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { Download, FileSpreadsheet, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type WardOption = PublicLocationOption & { provinceCode: string };
type CatalogResponse<T> = { items?: T[] };
type EditorFormValues = Omit<DistributionBatchCreateInput,
    "documentDate" | "submissionDeadline" | "completionDeadline" | "lines" | "supersedesBatchId"
> & {
    documentDate: Dayjs;
    submissionDeadline?: Dayjs | null;
    completionDeadline?: Dayjs | null;
};
type Props = {
    open: boolean;
    batch: SocialAssistanceDistributionBatch | null;
    supersedesBatchId?: string | null;
    programs: SocialAssistanceProgram[];
    onClose: () => void;
    onSave: (input: DistributionBatchCreateInput) => Promise<void>;
};

const currency = (amount: number): string => `${amount.toLocaleString("vi-VN")} đ`;
const localityLabel = (option: PublicLocationOption): string => option.fullName || option.name;

export default function DistributionBatchEditorDrawer({
    open,
    batch,
    supersedesBatchId,
    programs,
    onClose,
    onSave
}: Props) {
    const [form] = Form.useForm<EditorFormValues>();
    const { message } = App.useApp();
    const [saving, setSaving] = useState(false);
    const [loadingCatalog, setLoadingCatalog] = useState(false);
    const [catalogError, setCatalogError] = useState<string | null>(null);
    const [localities, setLocalities] = useState<DistributionLocalityOption[]>([]);
    const [lines, setLines] = useState<DistributionBatchLineInput[]>([]);
    const [importResult, setImportResult] = useState<DistributionLineImportResult | null>(null);
    const unitAmount = Form.useWatch("unitAmount", form) ?? 0;
    const declaredTotalQuantity = Form.useWatch("declaredTotalQuantity", form) ?? 0;
    const declaredTotalAmount = Form.useWatch("declaredTotalAmount", form) ?? 0;
    const calculatedQuantity = lines.reduce((total, line) => total + (Number.isSafeInteger(line.allocatedQuantity) ? line.allocatedQuantity : 0), 0);
    const calculatedAmount = calculatedQuantity * Number(unitAmount || 0);
    const duplicateLine = new Set(lines.map((line) => `${line.provinceCode}:${line.wardCode}`)).size !== lines.length;
    const invalidLine = lines.some((line) => !line.provinceCode || !line.wardCode || !Number.isSafeInteger(line.allocatedQuantity) || line.allocatedQuantity < 1);
    const linesValid = lines.length > 0 && !duplicateLine && !invalidLine;
    const totalsMatch = calculatedQuantity === Number(declaredTotalQuantity) && calculatedAmount === Number(declaredTotalAmount);
    const provinces = useMemo(() => [...new Map(localities.map((item) => [item.provinceCode, item.provinceLabel])).entries()], [localities]);
    const wardsByProvince = useMemo(() => {
        const result = new Map<string, Array<{ value: string; label: string }>>();
        for (const locality of localities) {
            const options = result.get(locality.provinceCode) ?? [];
            options.push({ value: locality.wardCode, label: locality.wardLabel });
            result.set(locality.provinceCode, options);
        }
        return result;
    }, [localities]);

    useEffect(() => {
        if (!open) return;
        let active = true;
        setLoadingCatalog(true);
        setCatalogError(null);
        void api.get<CatalogResponse<PublicLocationOption>>(endpoints.poverty.locationProvinces)
            .then(async (provinceResponse) => {
                const provinceOptions = provinceResponse.items ?? [];
                const wardResults = await Promise.all(provinceOptions.map(async (province) => {
                    const response = await api.get<CatalogResponse<WardOption>>(endpoints.poverty.locationWards(province.code));
                    return (response.items ?? []).map((ward) => ({
                        provinceCode: province.code,
                        provinceLabel: localityLabel(province),
                        wardCode: ward.code,
                        wardLabel: localityLabel(ward)
                    }));
                }));
                if (active) setLocalities(wardResults.flat());
            })
            .catch((error: unknown) => {
                if (active) setCatalogError(error instanceof Error ? error.message : "Không thể tải danh mục xã/phường.");
            })
            .finally(() => { if (active) setLoadingCatalog(false); });
        return () => { active = false; };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        setImportResult(null);
        if (batch) {
            form.setFieldsValue({
                programId: batch.programId ?? null,
                documentNumber: batch.documentNumber,
                documentDate: dayjs(batch.documentDate),
                title: batch.title,
                fundingSourceText: batch.fundingSourceText,
                supportItemName: batch.supportItemName,
                unitLabel: batch.unitLabel,
                unitAmount: batch.unitAmount,
                declaredTotalQuantity: batch.declaredTotalQuantity,
                declaredTotalAmount: batch.declaredTotalAmount,
                eligibilitySummary: batch.eligibilitySummary,
                eligibilityApprovalYear: batch.eligibilityApprovalYear,
                submissionDeadline: batch.submissionDeadline ? dayjs(batch.submissionDeadline) : null,
                completionDeadline: batch.completionDeadline ? dayjs(batch.completionDeadline) : null
            });
            setLines(batch.lines.map(({ provinceCode, wardCode, allocatedQuantity }) => ({ provinceCode, wardCode, allocatedQuantity })));
        } else {
            form.resetFields();
            setLines([]);
        }
    }, [batch, form, open, supersedesBatchId]);

    const updateLine = (index: number, patch: Partial<DistributionBatchLineInput>): void => {
        setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
    };

    const previewImport = async (file: File | undefined): Promise<void> => {
        if (!file) return;
        if (!localities.length) {
            message.error("Danh mục xã/phường chưa sẵn sàng.");
            return;
        }
        try {
            setImportResult(await readDistributionBatchSpreadsheet(file, localities));
        } catch {
            setImportResult({
                lines: [],
                errors: [{ rowNumber: 1, field: "file", message: "Không thể đọc tệp bảng tính. Hãy dùng tệp XLSX hoặc XLS hợp lệ." }]
            });
        }
    };

    const downloadTemplate = (): void => {
        const url = URL.createObjectURL(createDistributionBatchImportTemplate());
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "mau-chi-tieu-dia-ban.xlsx";
        anchor.click();
        URL.revokeObjectURL(url);
    };

    const save = async (): Promise<void> => {
        try {
            const values = await form.validateFields();
            if (!linesValid || !totalsMatch) {
                message.error("Cần bổ sung địa bàn và đối chiếu tổng số lượng, giá trị trước khi lưu.");
                return;
            }
            setSaving(true);
            await onSave({
                ...values,
                supersedesBatchId: batch?.supersedesBatchId ?? supersedesBatchId ?? undefined,
                documentDate: values.documentDate.format("YYYY-MM-DD"),
                submissionDeadline: values.submissionDeadline?.format("YYYY-MM-DD") ?? null,
                completionDeadline: values.completionDeadline?.format("YYYY-MM-DD") ?? null,
                lines
            });
        } catch (error) {
            if (error instanceof Error && "errorFields" in error) return;
            message.error(error instanceof Error ? error.message : "Không thể lưu đợt phân bổ.");
        } finally {
            setSaving(false);
        }
    };

    const lineColumns: TableColumnsType<DistributionBatchLineInput> = [
        {
            title: "Tỉnh/thành phố",
            key: "provinceCode",
            width: 220,
            render: (_, line, index) => (
                <Select
                    aria-label={`Tỉnh/thành phố dòng ${index + 1}`}
                    showSearch
                    optionFilterProp="label"
                    value={line.provinceCode || undefined}
                    options={provinces.map(([value, label]) => ({ value, label }))}
                    onChange={(provinceCode) => updateLine(index, { provinceCode, wardCode: "" })}
                    placeholder="Chọn tỉnh/thành phố"
                />
            )
        },
        {
            title: "Xã/phường",
            key: "wardCode",
            width: 240,
            render: (_, line, index) => (
                <Select
                    aria-label={`Xã/phường dòng ${index + 1}`}
                    showSearch
                    optionFilterProp="label"
                    value={line.wardCode || undefined}
                    options={wardsByProvince.get(line.provinceCode) ?? []}
                    disabled={!line.provinceCode}
                    onChange={(wardCode) => updateLine(index, { wardCode })}
                    placeholder="Chọn xã/phường"
                />
            )
        },
        {
            title: "Số lượng",
            key: "allocatedQuantity",
            width: 140,
            render: (_, line, index) => (
                <InputNumber
                    aria-label={`Số lượng dòng ${index + 1}`}
                    className="w-full"
                    min={1}
                    precision={0}
                    value={line.allocatedQuantity || undefined}
                    onChange={(value) => updateLine(index, { allocatedQuantity: value ?? 0 })}
                />
            )
        },
        {
            title: "",
            key: "remove",
            width: 56,
            render: (_, _line, index) => (
                <Button aria-label={`Xóa địa bàn dòng ${index + 1}`} icon={<Trash2 size={15} />} onClick={() => setLines((current) => current.filter((__, lineIndex) => lineIndex !== index))} />
            )
        }
    ];

    const summarizeImportIssues = (issues: DistributionImportIssue[]): string => issues.slice(0, 3)
        .map((issue) => `Dòng ${issue.rowNumber}: ${issue.message}`)
        .join(" ");

    return (
        <Drawer
            title={batch ? "Chỉnh sửa đợt phân bổ nháp" : supersedesBatchId ? "Tạo đợt điều chỉnh" : "Tạo đợt phân bổ"}
            open={open}
            onClose={onClose}
            width="min(920px, calc(100vw - 24px))"
            destroyOnHidden
            footer={<div className="flex justify-end gap-2"><Button onClick={onClose}>Hủy</Button><Button type="primary" loading={saving} disabled={!linesValid || !totalsMatch || loadingCatalog} onClick={() => void save()}>Lưu bản nháp</Button></div>}
        >
            <Form form={form} layout="vertical" className="space-y-5">
                <section aria-label="Thông tin công văn" className="border-b border-gray-200 pb-5">
                    <Typography.Title level={5}>Thông tin công văn</Typography.Title>
                    <div className="grid gap-x-3 sm:grid-cols-2">
                        <Form.Item label="Số công văn" name="documentNumber" rules={[{ required: true, whitespace: true }]}><Input maxLength={100} /></Form.Item>
                        <Form.Item label="Ngày ban hành" name="documentDate" rules={[{ required: true }]}><DatePicker className="w-full" format="DD/MM/YYYY" /></Form.Item>
                        <Form.Item label="Tên đợt phân bổ" name="title" rules={[{ required: true, whitespace: true }]}><Input maxLength={255} /></Form.Item>
                        <Form.Item label="Nguồn kinh phí" name="fundingSourceText" rules={[{ required: true, whitespace: true }]}><Input maxLength={2000} /></Form.Item>
                        <Form.Item label="Hình thức hỗ trợ" name="supportItemName" rules={[{ required: true, whitespace: true }]}><Input maxLength={255} /></Form.Item>
                        <Form.Item label="Đơn vị tính" name="unitLabel" rules={[{ required: true, whitespace: true }]}><Input maxLength={40} /></Form.Item>
                        <Form.Item label="Đơn giá (đồng)" name="unitAmount" rules={[{ required: true }, { type: "number", min: 1 }]}><InputNumber className="w-full" min={1} precision={0} /></Form.Item>
                        <Form.Item label="Chương trình liên kết (không bắt buộc)" name="programId"><Select allowClear options={programs.map((program) => ({ value: program.id, label: program.title }))} /></Form.Item>
                        <Form.Item label="Tổng số lượng theo công văn" name="declaredTotalQuantity" rules={[{ required: true }, { type: "number", min: 1 }]}><InputNumber className="w-full" min={1} precision={0} /></Form.Item>
                        <Form.Item label="Tổng kinh phí theo công văn (đồng)" name="declaredTotalAmount" rules={[{ required: true }, { type: "number", min: 1 }]}><InputNumber className="w-full" min={1} precision={0} /></Form.Item>
                        <Form.Item label="Năm phê duyệt danh sách hộ" name="eligibilityApprovalYear"><InputNumber className="w-full" min={1900} max={2200} precision={0} /></Form.Item>
                        <Form.Item label="Hạn nộp hồ sơ" name="submissionDeadline"><DatePicker className="w-full" format="DD/MM/YYYY" /></Form.Item>
                        <Form.Item label="Hạn hoàn thành" name="completionDeadline"><DatePicker className="w-full" format="DD/MM/YYYY" /></Form.Item>
                    </div>
                    <Form.Item label="Điều kiện hưởng" name="eligibilitySummary" rules={[{ required: true, whitespace: true }]}><Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} maxLength={4000} /></Form.Item>
                </section>

                <section aria-label="Chỉ tiêu theo địa bàn" className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <Typography.Title level={5} className="!mb-0">Chỉ tiêu theo địa bàn</Typography.Title>
                        <Space wrap>
                            <Button icon={<Download size={15} />} onClick={downloadTemplate}>Tải mẫu</Button>
                            <label className="inline-flex min-h-8 cursor-pointer items-center gap-2 rounded border border-gray-300 px-3 text-sm hover:border-blue-500">
                                <FileSpreadsheet size={15} /> Nhập bảng tính
                                <input className="sr-only" type="file" accept=".xlsx,.xls" onChange={(event) => { void previewImport(event.target.files?.[0]); event.currentTarget.value = ""; }} />
                            </label>
                            <Button icon={<Plus size={15} />} onClick={() => setLines((current) => [...current, { provinceCode: "", wardCode: "", allocatedQuantity: 0 }])}>Thêm địa bàn</Button>
                        </Space>
                    </div>
                    {catalogError ? <Alert type="error" showIcon message={catalogError} /> : null}
                    <Spin spinning={loadingCatalog}>
                        <Table
                            rowKey={(_, index) => String(index)}
                            columns={lineColumns}
                            dataSource={lines}
                            pagination={false}
                            scroll={{ x: 650 }}
                            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có chỉ tiêu địa bàn" /> }}
                        />
                    </Spin>
                    {duplicateLine ? <Alert type="error" showIcon message="Một địa bàn chỉ được xuất hiện một lần trong cùng công văn." /> : null}
                    {importResult ? (
                        <div className="space-y-3 border-y border-gray-200 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <Typography.Text strong>Xem trước dữ liệu nhập</Typography.Text>
                                <Typography.Text type="secondary">{importResult.lines.length} địa bàn · {importResult.lines.reduce((sum, line) => sum + line.allocatedQuantity, 0).toLocaleString("vi-VN")} chỉ tiêu</Typography.Text>
                            </div>
                            {importResult.errors.length ? <Alert type="error" showIcon message={`${importResult.errors.length} lỗi nhập liệu`} description={summarizeImportIssues(importResult.errors)} /> : <Alert type="success" showIcon message={`Tổng giá trị dự kiến: ${currency(importResult.lines.reduce((sum, line) => sum + line.allocatedQuantity, 0) * Number(unitAmount || 0))}`} />}
                            <Table
                                rowKey={(line) => `${line.provinceCode}:${line.wardCode}`}
                                size="small"
                                pagination={{ pageSize: 8, hideOnSinglePage: true }}
                                dataSource={importResult.lines}
                                columns={[
                                    { title: "Tỉnh/thành phố", dataIndex: "provinceCode", key: "provinceCode", render: (code: string) => localities.find((item) => item.provinceCode === code)?.provinceLabel ?? code },
                                    { title: "Xã/phường", dataIndex: "wardCode", key: "wardCode", render: (code: string, line: DistributionBatchLineInput) => localities.find((item) => item.provinceCode === line.provinceCode && item.wardCode === code)?.wardLabel ?? code },
                                    { title: "Số lượng", dataIndex: "allocatedQuantity", key: "allocatedQuantity" }
                                ]}
                                scroll={{ x: 450 }}
                            />
                            {importResult.errors.length === 0 && importResult.lines.length > 0 ? <Button type="primary" onClick={() => { setLines(importResult.lines); setImportResult(null); }}>Thay chỉ tiêu nháp bằng bảng này</Button> : <Typography.Text type="secondary">Sửa các dòng lỗi trong tệp rồi nhập lại; chỉ dữ liệu hợp lệ mới được thay vào bản nháp.</Typography.Text>}
                        </div>
                    ) : null}
                    <div className="grid gap-3 border-t border-gray-200 pt-3 sm:grid-cols-3">
                        <div><Typography.Text type="secondary">Tổng số dòng</Typography.Text><p className="mt-1 font-semibold">{lines.length.toLocaleString("vi-VN")}</p></div>
                        <div><Typography.Text type="secondary">Tổng chỉ tiêu địa bàn</Typography.Text><p className={`mt-1 font-semibold ${calculatedQuantity === Number(declaredTotalQuantity) ? "text-emerald-700" : "text-red-700"}`}>{calculatedQuantity.toLocaleString("vi-VN")} / {Number(declaredTotalQuantity).toLocaleString("vi-VN")}</p></div>
                        <div><Typography.Text type="secondary">Tổng giá trị địa bàn</Typography.Text><p className={`mt-1 font-semibold ${calculatedAmount === Number(declaredTotalAmount) ? "text-emerald-700" : "text-red-700"}`}>{currency(calculatedAmount)} / {currency(Number(declaredTotalAmount) || 0)}</p></div>
                    </div>
                    {!totalsMatch ? <Alert type="warning" showIcon message="Số lượng hoặc kinh phí địa bàn chưa khớp công văn. Chưa thể lưu bản nháp." /> : null}
                </section>
            </Form>
        </Drawer>
    );
}
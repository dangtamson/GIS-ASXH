"use client";

import { api, ApiError } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { ExcelPayload, PaginationMeta, PovertyReportDetailResponse, PovertyReportDetailRow, PovertyReportRow } from "@/types/poverty";
import { downloadBase64File, formatNumber, householdStatusLabel, povertyTypeLabel, povertyTypeOptions } from "@/components/poverty/poverty-utils";
import { usePovertyCategoryOptions } from "@/components/poverty/usePovertyCategoryOptions";
import { ActionButton, TitleSpace } from "@/components/controller";
import { usePermission } from "@/hooks/usePermission";
import { App, Button, Col, ConfigProvider, Form, Input, InputNumber, Row, Segmented, Select, Table } from "antd";
import type { TableColumnsType } from "antd";
import { ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

function buildQuery(values: Record<string, unknown>): string {
    const params = new URLSearchParams();
    Object.entries(values).forEach(([key, value]) => {
        const text = String(value ?? "").trim();
        if (text) params.set(key, text);
    });
    return params.toString();
}

const currentYear = new Date().getFullYear();
const defaultDetailPagination: PaginationMeta = {
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
};

export default function PovertyReportPage() {
    const { notification } = App.useApp();
    const [form] = Form.useForm();
    const [filters, setFilters] = useState<Record<string, unknown>>({ year: currentYear });
    const [activeTab, setActiveTab] = useState<"summary" | "detail">("summary");
    const [summaryItems, setSummaryItems] = useState<PovertyReportRow[]>([]);
    const [detailItems, setDetailItems] = useState<PovertyReportDetailRow[]>([]);
    const [detailPagination, setDetailPagination] = useState<PaginationMeta>(defaultDetailPagination);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [filtersCollapsed, setFiltersCollapsed] = useState(false);
    const areaOptions = usePovertyCategoryOptions("AREA");
    const { can: canExportReport } = usePermission("poverty.report.export");
    const activeFilterCount = useMemo(
        () => Object.values(filters).filter((value) => String(value ?? "").trim()).length,
        [filters]
    );

    const loadSummary = useCallback(async () => {
        setLoadingSummary(true);
        try {
            const query = buildQuery(filters);
            const data = await api.get<{ items?: PovertyReportRow[] }>(`${endpoints.poverty.reportSummary}?${query}`);
            setSummaryItems(data.items ?? []);
        } catch (error) {
            notification.error({
                message: "Không thể tải báo cáo",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
        } finally {
            setLoadingSummary(false);
        }
    }, [filters, notification]);

    const loadDetail = useCallback(async (page: number, limit: number) => {
        setLoadingDetail(true);
        try {
            const query = buildQuery({ ...filters, page, limit });
            const data = await api.get<PovertyReportDetailResponse>(`${endpoints.poverty.reportDetail}?${query}`);
            setDetailItems(data.items ?? []);
            setDetailPagination(data.pagination ?? { ...defaultDetailPagination, page, limit });
        } catch (error) {
            notification.error({
                message: "Không thể tải báo cáo chi tiết",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
        } finally {
            setLoadingDetail(false);
        }
    }, [filters, notification]);

    useEffect(() => {
        if (activeTab === "summary") {
            loadSummary();
            return;
        }
        loadDetail(detailPagination.page, detailPagination.limit);
    }, [activeTab, detailPagination.limit, detailPagination.page, loadDetail, loadSummary]);

    const exportExcel = async () => {
        try {
            const query = buildQuery(filters);
            const exportEndpoint = activeTab === "summary" ? endpoints.poverty.reportExportExcel : endpoints.poverty.reportDetailExportExcel;
            const data = await api.get<ExcelPayload>(`${exportEndpoint}?${query}`);
            downloadBase64File(data.fileName, data.mimeType, data.fileContentBase64);
        } catch (error) {
            notification.error({
                message: "Không thể xuất báo cáo",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
        }
    };

    const summaryColumns: TableColumnsType<PovertyReportRow> = [
        {
            title: "STT",
            width: 80,
            align: "center",
            render: (_value, _record, index) => index + 1,
        },
        { title: "Năm báo cáo", dataIndex: "year", width: 120, align: "center" },
        { title: "Khu vực", dataIndex: "area" },
        { title: "Hộ nghèo", dataIndex: "poorCount", align: "right", render: formatNumber },
        { title: "Hộ cận nghèo", dataIndex: "nearPoorCount", align: "right", render: formatNumber },
        { title: "Tổng hộ nghèo/cận nghèo", dataIndex: "total", align: "right", render: formatNumber },
        { title: "Tổng số hộ", dataIndex: "totalHouseholds", align: "right", render: formatNumber },
        { title: "Tỷ lệ hộ nghèo (%)", dataIndex: "poorRatePercent", align: "right", render: (value: number) => formatNumber(value) },
        { title: "Tỷ lệ hộ cận nghèo (%)", dataIndex: "nearPoorRatePercent", align: "right", render: (value: number) => formatNumber(value) },
    ];

    const detailColumns: TableColumnsType<PovertyReportDetailRow> = [
        {
            title: "STT",
            width: 80,
            align: "center",
            render: (_value, _record, index) => ((detailPagination.page - 1) * detailPagination.limit) + index + 1,
        },
        { title: "Mã hộ", dataIndex: "code", width: 140, render: (value?: string | null) => value || "-" },
        { title: "Tên chủ hộ", dataIndex: "headFullName", width: 220, render: (value?: string | null) => value || "-" },
        { title: "Loại hộ", dataIndex: "povertyType", width: 160, render: (value?: string | null) => povertyTypeLabel(value) },
        { title: "Địa chỉ", dataIndex: "address", render: (value?: string | null) => value || "-" },
        { title: "Số thành viên", dataIndex: "memberCount", width: 140, align: "right", render: formatNumber },
        { title: "Trạng thái", dataIndex: "status", width: 130, render: (value?: string | null) => householdStatusLabel(value) },
        { title: "Năm báo cáo", dataIndex: "year", width: 130, align: "center" },
    ];

    return (
        <div className="min-w-0 space-y-4">
            <TitleSpace title="Báo cáo hộ nghèo" actions={canExportReport ? <ActionButton type="export-excel" onClick={exportExcel} /> : undefined} />
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-700">
                            <SlidersHorizontal size={16} />
                        </span>
                        <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-gray-800">Bộ lọc báo cáo</h3>
                            <p className="mt-0.5 text-xs text-gray-500">
                                {activeFilterCount > 0 ? `${activeFilterCount} điều kiện đang áp dụng` : "Lọc dữ liệu tổng hợp theo thời gian và địa bàn"}
                            </p>
                        </div>
                    </div>
                    <Button
                        icon={filtersCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                        onClick={() => setFiltersCollapsed((value) => !value)}
                    />
                </div>

                {!filtersCollapsed ? (
                    <div className="p-4">
                        <Form
                            form={form}
                            layout="vertical"
                            initialValues={{ year: currentYear }}
                            onFinish={(values) => {
                                setFilters(values);
                                setDetailPagination((prev) => ({ ...prev, page: 1, limit: 20 }));
                            }}
                        >
                            <Row gutter={[16, 0]}>
                                <Col xs={12} md={2} xl={2}><Form.Item name="povertyType" label="Loại hộ"><Select allowClear options={povertyTypeOptions} /></Form.Item></Col>
                                {/* <Col xs={24} md={6} xl={5}><Form.Item name="provinceName" label="Tỉnh/Thành phố"><Input /></Form.Item></Col> */}
                                <Col xs={24} md={3} xl={3}><Form.Item name="wardName" label="Xã/Phường"><Input /></Form.Item></Col>
                                <Col xs={24} md={3} xl={3}><Form.Item name="areaName" label="Khu vực"><Select allowClear showSearch optionFilterProp="label" options={areaOptions} /></Form.Item></Col>
                                <Col xs={12} md={2} xl={2}><Form.Item name="year" label="Năm"><InputNumber className="w-full" min={1900} max={2200} /></Form.Item></Col>
                            </Row>
                            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end [&_.ant-btn]:w-full sm:[&_.ant-btn]:w-auto mt-2">
                                <ActionButton type="search" htmlType="submit" loading={activeTab === "summary" ? loadingSummary : loadingDetail} />
                                <ActionButton type="refresh" variant="outlined" onClick={() => {
                                    form.resetFields();
                                    setFilters({ year: currentYear });
                                    setDetailPagination((prev) => ({ ...prev, page: 1, limit: 20 }));
                                }} />
                            </div>
                        </Form>
                    </div>
                ) : null}
            </div>
            <div className="min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white">
                <div className="border-b border-gray-100 px-3 py-3 sm:px-4">
                    <ConfigProvider
                        theme={{
                            components: {
                                Segmented: {
                                    trackBg: "#f3f4f6",
                                    itemColor: "#4b5563",
                                    itemSelectedBg: "#fee2e2",
                                    itemSelectedColor: "#b91c1c",
                                },
                            },
                        }}
                    >
                        <Segmented
                            value={activeTab}
                            className="inline-flex max-w-full rounded-2xl border border-gray-200 p-1 shadow-sm [&_.ant-segmented-group]:gap-1 [&_.ant-segmented-item]:rounded-xl [&_.ant-segmented-item]:px-3 [&_.ant-segmented-item]:py-2 [&_.ant-segmented-item]:text-sm [&_.ant-segmented-item]:font-semibold [&_.ant-segmented-thumb]:rounded-xl [&_.ant-segmented-thumb]:shadow-[0_4px_12px_rgba(220,38,38,0.2)]"
                            onChange={(value) => {
                                const tab = value as "summary" | "detail";
                                setActiveTab(tab);
                                if (tab === "detail" && detailPagination.page !== 1) {
                                    setDetailPagination((prev) => ({ ...prev, page: 1 }));
                                }
                            }}
                            options={[
                                { label: "Báo cáo tổng hợp", value: "summary" },
                                { label: "Chi tiết từng hộ", value: "detail" },
                            ]}
                        />
                    </ConfigProvider>
                </div>

                {activeTab === "summary" ? (
                    <div className="px-3 pb-3 pt-3">
                        <Table
                            rowKey={(record) => `${record.year ?? "none"}-${record.area}`}
                            loading={loadingSummary}
                            columns={summaryColumns}
                            dataSource={summaryItems}
                            pagination={false}
                            scroll={{ x: 980 }}
                        />
                    </div>
                ) : (
                    <div className="px-3 pb-3 pt-3">
                        <Table
                            rowKey={(record) => `${record.code ?? "unknown"}-${record.year}`}
                            loading={loadingDetail}
                            columns={detailColumns}
                            dataSource={detailItems}
                            pagination={{
                                current: detailPagination.page,
                                pageSize: detailPagination.limit,
                                total: detailPagination.total,
                                showSizeChanger: true,
                                pageSizeOptions: ["20", "50", "100"],
                                onChange: (page, pageSize) => {
                                    setDetailPagination((prev) => ({ ...prev, page, limit: pageSize }));
                                },
                            }}
                            scroll={{ x: 1260 }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

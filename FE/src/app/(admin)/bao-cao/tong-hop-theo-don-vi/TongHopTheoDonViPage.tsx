"use client";

import React, {useEffect, useMemo, useRef, useState} from "react";
import * as XLSX from "xlsx-js-style";
import OrganizationTreeSelect from "@/app/(admin)/bao-cao/common/OrganizationTreeSelect";
import Tooltip from "@/app/(admin)/bao-cao/common/Tooltip";
import {api, ApiError} from "@/lib/api";
import {endpoints} from "@/lib/endpoints";
import TitleSpace from "@/components/controller/space/TitleSpace";
import ActionButton from "@/components/controller/ActionButton";
import {AppDatePicker, DocumentTypeSelect, FieldSelect, FilterSpace} from "@/components/controller";

type ReportRow = {
    id: string;
    stt: string;
    name: string;
    tong_cong: number;
    tongxlc: number;
    tongphxl: number;
    sl_xlc_cho_tiep_nhan: number;
    sl_xlc_dang_xu_ly: number;
    sl_xlc_hoan_thanh: number;
    sl_xlc_cho_duyet: number;
    sl_xlc_tu_choi: number;
    sl_xlc_phe_duyet: number;
    sl_phxl_cho_tiep_nhan: number;
    sl_phxl_dang_xu_ly: number;
    sl_phxl_hoan_thanh: number;
    sl_phxl_cho_duyet: number;
    sl_phxl_tu_choi: number;
    sl_phxl_phe_duyet: number;
};

type ReportTotals = {
    totalActual: number;
    xlcTong: number;
    xlcHoanThanh: number;
    xlcDangXuLy: number;
    xlcChoTiepNhan: number;
    xlcChoDuyet: number;
    xlcTuChoi: number;
    xlcPheDuyet: number;
    phxlTong: number;
    phxlHoanThanh: number;
    phxlDangXuLy: number;
    phxlChoTiepNhan: number;
    phxlChoDuyet: number;
    phxlTuChoi: number;
    phxlPheDuyet: number;
};

type SelectOption = { value: string; label: string };

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
}

function asNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function completionRate(done: number, total: number): number {
    if (!total) return 0;
    return Math.round((done / total) * 100);
}

function buildCategoryQuery(categoryCode: string): string {
    return new URLSearchParams({ categoryCode, status: "true" }).toString();
}

function formatDateOnly(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getDefaultReportDateRange(): { fromDate: string; toDate: string } {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return {
        fromDate: formatDateOnly(startOfMonth),
        toDate: formatDateOnly(endOfMonth),
    };
}

const EMPTY_TOTALS: ReportTotals = {
    totalActual: 0,
    xlcTong: 0,
    xlcHoanThanh: 0,
    xlcDangXuLy: 0,
    xlcChoTiepNhan: 0,
    xlcChoDuyet: 0,
    xlcTuChoi: 0,
    xlcPheDuyet: 0,
    phxlTong: 0,
    phxlHoanThanh: 0,
    phxlDangXuLy: 0,
    phxlChoTiepNhan: 0,
    phxlChoDuyet: 0,
    phxlTuChoi: 0,
    phxlPheDuyet: 0,
};

export default function TongHopTheoDonViPage() {
    const defaultDateRange = useMemo(() => getDefaultReportDateRange(), []);
    const [selectedOrg, setSelectedOrg] = useState<string[]>([]);
    const [hasOrgFilter, setHasOrgFilter] = useState(false);
    const [fromDate, setFromDate] = useState(defaultDateRange.fromDate);
    const [toDate, setToDate] = useState(defaultDateRange.toDate);
    const [linhVucOptions, setLinhVucOptions] = useState<SelectOption[]>([{ value: "", label: "Tất cả" }]);
    const [loaiVanBanOptions, setLoaiVanBanOptions] = useState<SelectOption[]>([{ value: "", label: "Tất cả" }]);
    const [linhVuc, setLinhVuc] = useState<string[]>([]);
    const [loaiVanBan, setLoaiVanBan] = useState<string[]>([]);
    const initLinhVucRef = useRef(false);
    const initLoaiVanBanRef = useRef(false);
    const [rows, setRows] = useState<ReportRow[]>([]);
    const [reportTotals, setReportTotals] = useState<ReportTotals | null>(null);
    const [reportLoading, setReportLoading] = useState(false);
    const [reportError, setReportError] = useState<string | null>(null);

    useEffect(() => {
        const loadCategoryOptions = async () => {
            try {
                const baseEndpoint = endpoints.admin.categoryItems;
                const [fieldItems, docTypeItems] = await Promise.all([
                    api.get<unknown>(`${baseEndpoint}?${buildCategoryQuery("FIELD")}`),
                    api.get<unknown>(`${baseEndpoint}?${buildCategoryQuery("DOCUMENT_TYPE")}`),
                ]);

                const mapOptions = (payload: unknown): SelectOption[] => {
                    const payloadRecord = asRecord(payload);
                    const dataRecord = asRecord(payloadRecord?.data) ?? payloadRecord;
                    const items = Array.isArray(dataRecord?.items) ? dataRecord.items : [];
                    return items
                        .map((item) => {
                            const record = asRecord(item);
                            const value = String(record?.uuid ?? "").trim();
                            const label = String(record?.name ?? "").trim();
                            return value && label ? { value, label } : null;
                        })
                        .filter((option): option is SelectOption => Boolean(option));
                };

                setLinhVucOptions([{ value: "", label: "Tất cả" }, ...mapOptions(fieldItems)]);
                setLoaiVanBanOptions([{ value: "", label: "Tất cả" }, ...mapOptions(docTypeItems)]);
            } catch {
                setLinhVucOptions([{ value: "", label: "Tất cả" }]);
                setLoaiVanBanOptions([{ value: "", label: "Tất cả" }]);
            }
        };

        void loadCategoryOptions();
    }, []);

    useEffect(() => {
        if (initLinhVucRef.current) return;
        const allValues = linhVucOptions.map((option) => option.value).filter(Boolean);
        if (allValues.length > 0) {
            setLinhVuc(allValues);
            initLinhVucRef.current = true;
        }
    }, [linhVucOptions]);

    useEffect(() => {
        if (initLoaiVanBanRef.current) return;
        const allValues = loaiVanBanOptions.map((option) => option.value).filter(Boolean);
        if (allValues.length > 0) {
            setLoaiVanBan(allValues);
            initLoaiVanBanRef.current = true;
        }
    }, [loaiVanBanOptions]);

    const buildPayload = () => ({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        organization_ids: hasOrgFilter && selectedOrg.length > 0 ? selectedOrg : undefined,
        field: linhVuc.length > 0 ? linhVuc : undefined,
        document_type_id: loaiVanBan.length > 0 ? loaiVanBan : undefined,
    });

    const fetchReport = async (): Promise<{ rows: ReportRow[]; totals: ReportTotals | null }> => {
        setReportLoading(true);
        setReportError(null);
        try {
            const data = await api.post<unknown>(endpoints.report.reportTaskByOrganization, buildPayload());
            const dataRecord = asRecord(data);
            const items = Array.isArray(dataRecord?.items) ? dataRecord.items : [];
            const totals = asRecord(dataRecord?.totals);
            const mappedRows = items.map((item, index) => {
                const record = asRecord(item);
                return {
                    id: String(record?.uuid ?? index),
                    stt: String(record?.stt ?? ""),
                    name: String(record?.name ?? ""),
                    tong_cong: asNumber(record?.tong_cong),
                    tongxlc: asNumber(record?.tongxlc),
                    tongphxl: asNumber(record?.tongphxl),
                    sl_xlc_cho_tiep_nhan: asNumber(record?.sl_xlc_cho_tiep_nhan),
                    sl_xlc_dang_xu_ly: asNumber(record?.sl_xlc_dang_xu_ly),
                    sl_xlc_hoan_thanh: asNumber(record?.sl_xlc_hoan_thanh),
                    sl_xlc_cho_duyet: asNumber(record?.sl_xlc_cho_duyet),
                    sl_xlc_tu_choi: asNumber(record?.sl_xlc_tu_choi),
                    sl_xlc_phe_duyet: asNumber(record?.sl_xlc_phe_duyet),
                    sl_phxl_cho_tiep_nhan: asNumber(record?.sl_phxl_cho_tiep_nhan),
                    sl_phxl_dang_xu_ly: asNumber(record?.sl_phxl_dang_xu_ly),
                    sl_phxl_hoan_thanh: asNumber(record?.sl_phxl_hoan_thanh),
                    sl_phxl_cho_duyet: asNumber(record?.sl_phxl_cho_duyet),
                    sl_phxl_tu_choi: asNumber(record?.sl_phxl_tu_choi),
                    sl_phxl_phe_duyet: asNumber(record?.sl_phxl_phe_duyet),
                };
            });
            const mappedTotals = totals
                ? {
                      totalActual: asNumber(totals.totalActual ?? totals.total_actual),
                      xlcTong: asNumber(totals.xlcTong ?? totals.xlc_tong),
                      xlcHoanThanh: asNumber(totals.xlcHoanThanh ?? totals.xlc_hoan_thanh),
                      xlcDangXuLy: asNumber(totals.xlcDangXuLy ?? totals.xlc_dang_thuc_hien),
                      xlcChoTiepNhan: asNumber(totals.xlcChoTiepNhan ?? totals.xlc_cho_tiep_nhan),
                      xlcChoDuyet: asNumber(totals.xlcChoDuyet ?? totals.xlc_cho_duyet),
                      xlcTuChoi: asNumber(totals.xlcTuChoi ?? totals.xlc_tu_choi),
                      xlcPheDuyet: asNumber(totals.xlcPheDuyet ?? totals.xlc_phe_duyet),
                      phxlTong: asNumber(totals.phxlTong ?? totals.phxl_tong),
                      phxlHoanThanh: asNumber(totals.phxlHoanThanh ?? totals.phxl_hoan_thanh),
                      phxlDangXuLy: asNumber(totals.phxlDangXuLy ?? totals.phxl_dang_thuc_hien),
                      phxlChoTiepNhan: asNumber(totals.phxlChoTiepNhan ?? totals.phxl_cho_tiep_nhan),
                      phxlChoDuyet: asNumber(totals.phxlChoDuyet ?? totals.phxl_cho_duyet),
                      phxlTuChoi: asNumber(totals.phxlTuChoi ?? totals.phxl_tu_choi),
                      phxlPheDuyet: asNumber(totals.phxlPheDuyet ?? totals.phxl_phe_duyet),
                  }
                : null;

            setRows(mappedRows);
            setReportTotals(mappedTotals);
            return { rows: mappedRows, totals: mappedTotals };
        } catch (error) {
            setRows([]);
            setReportTotals(null);
            setReportError(error instanceof ApiError ? error.message : "Không thể tải dữ liệu báo cáo.");
            return { rows: [], totals: null };
        } finally {
            setReportLoading(false);
        }
    };

    const totalRow = useMemo(() => {
        if (reportTotals) return reportTotals;
        return rows.reduce((acc, row) => ({
            totalActual: acc.totalActual + row.tong_cong,
            xlcTong: acc.xlcTong + row.tongxlc,
            xlcHoanThanh: acc.xlcHoanThanh + row.sl_xlc_hoan_thanh,
            xlcDangXuLy: acc.xlcDangXuLy + row.sl_xlc_dang_xu_ly,
            xlcChoTiepNhan: acc.xlcChoTiepNhan + row.sl_xlc_cho_tiep_nhan,
            xlcChoDuyet: acc.xlcChoDuyet + row.sl_xlc_cho_duyet,
            xlcTuChoi: acc.xlcTuChoi + row.sl_xlc_tu_choi,
            xlcPheDuyet: acc.xlcPheDuyet + row.sl_xlc_phe_duyet,
            phxlTong: acc.phxlTong + row.tongphxl,
            phxlHoanThanh: acc.phxlHoanThanh + row.sl_phxl_hoan_thanh,
            phxlDangXuLy: acc.phxlDangXuLy + row.sl_phxl_dang_xu_ly,
            phxlChoTiepNhan: acc.phxlChoTiepNhan + row.sl_phxl_cho_tiep_nhan,
            phxlChoDuyet: acc.phxlChoDuyet + row.sl_phxl_cho_duyet,
            phxlTuChoi: acc.phxlTuChoi + row.sl_phxl_tu_choi,
            phxlPheDuyet: acc.phxlPheDuyet + row.sl_phxl_phe_duyet,
        }), EMPTY_TOTALS);
    }, [reportTotals, rows]);

    const handleReset = () => {
        setFromDate(defaultDateRange.fromDate);
        setToDate(defaultDateRange.toDate);
        setSelectedOrg([]);
        setHasOrgFilter(false);
        setLinhVuc(linhVucOptions.map((option) => option.value).filter(Boolean));
        setLoaiVanBan(loaiVanBanOptions.map((option) => option.value).filter(Boolean));
        setRows([]);
        setReportTotals(null);
        setReportError(null);
    };

    const validateFilterSelection = () => {
        if (linhVuc.length === 0 || loaiVanBan.length === 0) {
            setReportError("Vui lòng chọn ít nhất 1 Lĩnh vực và 1 Loại văn bản.");
            return false;
        }
        setReportError(null);
        return true;
    };

    const handleExportExcel = async () => {
        if (!validateFilterSelection()) return;
        const reportResult = rows.length > 0 ? { rows, totals: reportTotals } : await fetchReport();
        const exportRows = reportResult.rows;
        const exportTotals = reportResult.totals ?? totalRow;

        const headers = [
            "Tên đơn vị",
            "Tổng NV thực tế",
            "Xử lý chính",
            "Hoàn thành",
            "Đang xử lý",
            "Chờ tiếp nhận",
            "Chờ duyệt",
            "Từ chối",
            "Phê duyệt",
            "Tỷ lệ hoàn thành",
            "Phối hợp xử lý",
            "Hoàn thành",
            "Đang xử lý",
            "Chờ tiếp nhận",
            "Chờ duyệt",
            "Từ chối",
            "Phê duyệt",
            "Tỷ lệ hoàn thành",
        ];

        const worksheet = XLSX.utils.aoa_to_sheet([
            ["BÁO CÁO TỔNG HỢP NHIỆM VỤ THEO ĐƠN VỊ"],
            headers,
            ...exportRows.map((row) => [
                `${row.stt ? `${row.stt}. ` : ""}${row.name}`,
                row.tong_cong,
                row.tongxlc,
                row.sl_xlc_hoan_thanh,
                row.sl_xlc_dang_xu_ly,
                row.sl_xlc_cho_tiep_nhan,
                row.sl_xlc_cho_duyet,
                row.sl_xlc_tu_choi,
                row.sl_xlc_phe_duyet,
                `${completionRate(row.sl_xlc_hoan_thanh, row.tongxlc)}%`,
                row.tongphxl,
                row.sl_phxl_hoan_thanh,
                row.sl_phxl_dang_xu_ly,
                row.sl_phxl_cho_tiep_nhan,
                row.sl_phxl_cho_duyet,
                row.sl_phxl_tu_choi,
                row.sl_phxl_phe_duyet,
                `${completionRate(row.sl_phxl_hoan_thanh, row.tongphxl)}%`,
            ]),
            [
                "Tổng cộng",
                exportTotals.totalActual,
                exportTotals.xlcTong,
                exportTotals.xlcHoanThanh,
                exportTotals.xlcDangXuLy,
                exportTotals.xlcChoTiepNhan,
                exportTotals.xlcChoDuyet,
                exportTotals.xlcTuChoi,
                exportTotals.xlcPheDuyet,
                `${completionRate(exportTotals.xlcHoanThanh, exportTotals.xlcTong)}%`,
                exportTotals.phxlTong,
                exportTotals.phxlHoanThanh,
                exportTotals.phxlDangXuLy,
                exportTotals.phxlChoTiepNhan,
                exportTotals.phxlChoDuyet,
                exportTotals.phxlTuChoi,
                exportTotals.phxlPheDuyet,
                `${completionRate(exportTotals.phxlHoanThanh, exportTotals.phxlTong)}%`,
            ],
        ]);

        worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 17 } }];
        worksheet["!cols"] = [
            { wch: 42 },
            { wch: 12 },
            { wch: 12 },
            { wch: 12 },
            { wch: 12 },
            { wch: 14 },
            { wch: 12 },
            { wch: 12 },
            { wch: 12 },
            { wch: 16 },
            { wch: 14 },
            { wch: 12 },
            { wch: 12 },
            { wch: 14 },
            { wch: 12 },
            { wch: 12 },
            { wch: 12 },
            { wch: 16 },
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "BaoCao");
        XLSX.writeFile(workbook, `bao-cao-theo-don-vi-${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    return (
        <div className="space-y-4">
            <TitleSpace
                title="Báo cáo tổng hợp nhiệm vụ theo đơn vị"
                description={
                    <>
                        Thống kê tổng hợp tình hình nhiệm vụ theo từng đơn vị.
                        <Tooltip content="Báo cáo thống kê theo: ngày giao nhiệm vụ, đơn vị được giao, lĩnh vực và loại văn bản.">
                            <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-[10px] text-gray-500">i</span>
                        </Tooltip>
                    </>
                }
            />

            <FilterSpace
                key="filter-space-bao-cao-theo-don-vi"
                defaultCollapsed={false}
                actions={<>
                <ActionButton type="preview" onClick={() => { if (validateFilterSelection()) void fetchReport(); }} />
                <ActionButton type="refresh" onClick={handleReset} />
                <ActionButton type="export-excel" onClick={() => void handleExportExcel()} />
            </>}
            >
                <AppDatePicker title={'Từ ngày'} bold value={fromDate} onChange={(e) => setFromDate(e)}/>
                <AppDatePicker title={'Đến ngày'} bold value={toDate} onChange={(e) => setToDate(e)}/>
                <label>
                        <span className="mb-1 inline-flex items-center gap-1 text-sm font-semibold text-gray-700">
                            Đơn vị được giao
                            <Tooltip content="Double click vào đơn vị cha để chọn hoặc bỏ chọn tất cả đơn vị con.">
                                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-[10px] text-gray-500">i</span>
                            </Tooltip>
                        </span>
                    <OrganizationTreeSelect multiple value={selectedOrg} onChange={setSelectedOrg} onFilterChange={setHasOrgFilter} />
                </label>
                <FieldSelect value={linhVuc} onChange={value => setLinhVuc(value)} multiple includeAllOption allOptionValue={'all'}/>
                <DocumentTypeSelect value={loaiVanBan}  onChange={value => setLoaiVanBan(value)} multiple includeAllOption allOptionValue={'all'}/>
            </FilterSpace>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">


                <div className="border-t border-gray-200">
                    <div className="max-h-[520px] overflow-auto">
                        <table className="min-w-full border-separate border-spacing-0 text-sm">
                            <thead className="sticky top-0 z-10 bg-[#d4a574] text-gray-700">
                                <tr>
                                    <th className="sticky top-0 border border-gray-300 bg-[#d4a574] px-4 py-3 text-center font-semibold" rowSpan={2}>Tên đơn vị</th>
                                    <th className="sticky top-0 border border-gray-300 bg-[#d4a574] px-4 py-3 text-center font-semibold" rowSpan={2}>Tổng NV thực tế</th>
                                    <th className="sticky top-0 border border-gray-300 bg-[#d4a574] px-4 py-3 text-center font-semibold" colSpan={8}>Xử lý chính</th>
                                    <th className="sticky top-0 border border-gray-300 bg-[#d4a574] px-4 py-3 text-center font-semibold" colSpan={8}>Phối hợp xử lý</th>
                                </tr>
                                <tr>
                                    <th className="sticky top-0 border border-gray-300 bg-[#d4a574] px-4 py-3 text-center font-semibold">Tổng cộng</th>
                                    <th className="sticky top-0 border border-gray-300 bg-[#d4a574] px-4 py-3 text-center font-semibold">Hoàn thành</th>
                                    <th className="sticky top-0 border border-gray-300 bg-[#d4a574] px-4 py-3 text-center font-semibold">Đang xử lý</th>
                                    <th className="sticky top-0 border border-gray-300 bg-[#d4a574] px-4 py-3 text-center font-semibold">Chờ tiếp nhận</th>
                                    <th className="sticky top-0 border border-gray-300 bg-[#d4a574] px-4 py-3 text-center font-semibold">Chờ duyệt</th>
                                    <th className="sticky top-0 border border-gray-300 bg-[#d4a574] px-4 py-3 text-center font-semibold">Từ chối</th>
                                    <th className="sticky top-0 border border-gray-300 bg-[#d4a574] px-4 py-3 text-center font-semibold">Phê duyệt</th>
                                    <th className="sticky top-0 border border-gray-300 bg-[#d4a574] px-4 py-3 text-center font-semibold">Tỷ lệ hoàn thành</th>
                                    <th className="sticky top-0 border border-gray-300 bg-[#d4a574] px-4 py-3 text-center font-semibold">Tổng cộng</th>
                                    <th className="sticky top-0 border border-gray-300 bg-[#d4a574] px-4 py-3 text-center font-semibold">Hoàn thành</th>
                                    <th className="sticky top-0 border border-gray-300 bg-[#d4a574] px-4 py-3 text-center font-semibold">Đang xử lý</th>
                                    <th className="sticky top-0 border border-gray-300 bg-[#d4a574] px-4 py-3 text-center font-semibold">Chờ tiếp nhận</th>
                                    <th className="sticky top-0 border border-gray-300 bg-[#d4a574] px-4 py-3 text-center font-semibold">Chờ duyệt</th>
                                    <th className="sticky top-0 border border-gray-300 bg-[#d4a574] px-4 py-3 text-center font-semibold">Từ chối</th>
                                    <th className="sticky top-0 border border-gray-300 bg-[#d4a574] px-4 py-3 text-center font-semibold">Phê duyệt</th>
                                    <th className="sticky top-0 border border-gray-300 bg-[#d4a574] px-4 py-3 text-center font-semibold">Tỷ lệ hoàn thành</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.id} className="bg-white">
                                        <td className="border border-gray-200 px-4 py-3 text-left text-gray-800">{row.stt ? `${row.stt}. ` : ""}{row.name}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center">{row.tong_cong}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center">{row.tongxlc}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center text-emerald-600">{row.sl_xlc_hoan_thanh}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center text-amber-600">{row.sl_xlc_dang_xu_ly}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center text-gray-600">{row.sl_xlc_cho_tiep_nhan}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center text-sky-600">{row.sl_xlc_cho_duyet}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center text-red-600">{row.sl_xlc_tu_choi}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center text-violet-600">{row.sl_xlc_phe_duyet}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center">{completionRate(row.sl_xlc_hoan_thanh, row.tongxlc)}%</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center">{row.tongphxl}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center text-emerald-600">{row.sl_phxl_hoan_thanh}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center text-amber-600">{row.sl_phxl_dang_xu_ly}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center text-gray-600">{row.sl_phxl_cho_tiep_nhan}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center text-sky-600">{row.sl_phxl_cho_duyet}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center text-red-600">{row.sl_phxl_tu_choi}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center text-violet-600">{row.sl_phxl_phe_duyet}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center">{completionRate(row.sl_phxl_hoan_thanh, row.tongphxl)}%</td>
                                    </tr>
                                ))}
                                {rows.length > 0 ? (
                                    <tr className="sticky bottom-0 z-10 bg-gray-50 font-semibold text-gray-800">
                                        <td className="border border-gray-200 px-4 py-3 text-center">Tổng cộng</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center">{totalRow.totalActual}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center">{totalRow.xlcTong}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center">{totalRow.xlcHoanThanh}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center">{totalRow.xlcDangXuLy}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center">{totalRow.xlcChoTiepNhan}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center">{totalRow.xlcChoDuyet}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center">{totalRow.xlcTuChoi}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center">{totalRow.xlcPheDuyet}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center">{completionRate(totalRow.xlcHoanThanh, totalRow.xlcTong)}%</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center">{totalRow.phxlTong}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center">{totalRow.phxlHoanThanh}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center">{totalRow.phxlDangXuLy}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center">{totalRow.phxlChoTiepNhan}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center">{totalRow.phxlChoDuyet}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center">{totalRow.phxlTuChoi}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center">{totalRow.phxlPheDuyet}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center">{completionRate(totalRow.phxlHoanThanh, totalRow.phxlTong)}%</td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

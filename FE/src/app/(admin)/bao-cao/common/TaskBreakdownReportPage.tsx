"use client";

import React, {useEffect, useRef, useState} from "react";
import * as XLSX from "xlsx-js-style";
import OrganizationTreeSelect from "@/app/(admin)/bao-cao/common/OrganizationTreeSelect";
import Tooltip from "@/app/(admin)/bao-cao/common/Tooltip";
import {endpoints} from "@/lib/endpoints";
import {api, ApiError} from "@/lib/api";
import TitleSpace from "@/components/controller/space/TitleSpace";
import ActionButton from "@/components/controller/ActionButton";
import {AppDatePicker, DocumentTypeSelect, FieldSelect, FilterSpace} from "@/components/controller";

type CategoryItem = { uuid?: string; name?: string };
type SelectOption = { value: string; label: string };
type ReportRow = {
    id: string;
    name: string;
    totalTasks: number;
    totalMainUnits: number;
    totalCoordinationUnits: number;
};
type ReportTotals = {
    totalTasks: number;
    totalMainUnits: number;
    totalCoordinationUnits: number;
};
type ReportFetchResult = {
    rows: ReportRow[];
    totals: ReportTotals;
};
type TaskBreakdownReportPageProps = {
    title: string;
    description: string;
    tooltipContent: string;
    reportEndpoint: string;
    summaryNameHeader: string;
    summaryFilePrefix: string;
    mapSummaryRow: (item: Record<string, unknown>, index: number) => ReportRow;
};

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
}

function extractCategoryItems(payload: unknown): CategoryItem[] {
    const payloadRecord = asRecord(payload);
    const dataRecord = asRecord(payloadRecord?.data) ?? payloadRecord;
    if (!dataRecord) return [];
    if (Array.isArray(dataRecord.items)) return dataRecord.items as CategoryItem[];
    if (Array.isArray(payload)) return payload as CategoryItem[];
    return [];
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

function applyExcelStyle(worksheet: XLSX.WorkSheet, numericColumns: number[], mergeTitleToColumn: number): void {
    const merges = worksheet["!merges"] ?? [];
    merges.unshift({ s: { r: 0, c: 0 }, e: { r: 0, c: mergeTitleToColumn } });
    worksheet["!merges"] = merges;
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");

    for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
        for (let colIndex = range.s.c; colIndex <= range.e.c; colIndex += 1) {
            const address = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
            const cell = worksheet[address];
            if (!cell) continue;
            if (!cell.s) cell.s = {};
            cell.s.border = {
                top: { style: "thin", color: { rgb: "000000" } },
                bottom: { style: "thin", color: { rgb: "000000" } },
                left: { style: "thin", color: { rgb: "000000" } },
                right: { style: "thin", color: { rgb: "000000" } },
            };
            if (rowIndex === 0) {
                cell.s.font = { bold: true, sz: 16, name: "Times New Roman" };
                cell.s.alignment = { horizontal: "center", vertical: "center" };
                continue;
            }
            if (rowIndex === 1) {
                cell.s.font = { bold: true, name: "Times New Roman" };
                cell.s.alignment = { horizontal: "center", vertical: "center" };
                continue;
            }
            cell.s.font = { name: "Times New Roman" };
            cell.s.alignment = {
                horizontal: colIndex === 0 ? "center" : numericColumns.includes(colIndex) ? "right" : "left",
                vertical: "center",
            };
        }
    }
}

export default function TaskBreakdownReportPage({
    title,
    description,
    tooltipContent,
    reportEndpoint,
    summaryNameHeader,
    summaryFilePrefix,
    mapSummaryRow,
}: TaskBreakdownReportPageProps) {
    const defaultDateRange = React.useMemo(() => getDefaultReportDateRange(), []);
    const [selectedOrg, setSelectedOrg] = React.useState<string[]>([]);
    const [hasOrgFilter, setHasOrgFilter] = React.useState(false);
    const [fromDate, setFromDate] = useState(defaultDateRange.fromDate);
    const [toDate, setToDate] = useState(defaultDateRange.toDate);
    const [linhVucOptions, setLinhVucOptions] = useState<SelectOption[]>([{ value: "", label: "Tất cả" }]);
    const [loaiVanBanOptions, setLoaiVanBanOptions] = useState<SelectOption[]>([{ value: "", label: "Tất cả" }]);
    const [linhVuc, setLinhVuc] = useState<string[]>([]);
    const [loaiVanBan, setLoaiVanBan] = useState<string[]>([]);
    const initLinhVucRef = useRef(false);
    const initLoaiVanBanRef = useRef(false);
    const [rows, setRows] = useState<ReportRow[]>([]);
    const [totals, setTotals] = useState<ReportTotals>({ totalTasks: 0, totalMainUnits: 0, totalCoordinationUnits: 0 });
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

                const fieldOptions = extractCategoryItems(fieldItems)
                    .map((item) => {
                        const value = item.uuid?.trim() || "";
                        const label = item.name?.trim() || "";
                        return value && label ? { value, label } : null;
                    })
                    .filter((option): option is SelectOption => Boolean(option));

                const docTypeOptions = extractCategoryItems(docTypeItems)
                    .map((item) => {
                        const value = item.uuid?.trim() || "";
                        const label = item.name?.trim() || "";
                        return value && label ? { value, label } : null;
                    })
                    .filter((option): option is SelectOption => Boolean(option));

                setLinhVucOptions([{ value: "", label: "Tất cả" }, ...fieldOptions]);
                setLoaiVanBanOptions([{ value: "", label: "Tất cả" }, ...docTypeOptions]);
            } catch (error) {
                console.error("Failed to load category options", error);
                setLinhVucOptions([{ value: "", label: "Tất cả" }]);
                setLoaiVanBanOptions([{ value: "", label: "Tất cả" }]);
            }
        };

        void loadCategoryOptions();
    }, []);

    useEffect(() => {
        if (!initLinhVucRef.current) {
            const allValues = linhVucOptions.map((option) => option.value).filter(Boolean);
            if (allValues.length > 0) {
                setLinhVuc(allValues);
                initLinhVucRef.current = true;
            }
        }
    }, [linhVucOptions]);

    useEffect(() => {
        if (!initLoaiVanBanRef.current) {
            const allValues = loaiVanBanOptions.map((option) => option.value).filter(Boolean);
            if (allValues.length > 0) {
                setLoaiVanBan(allValues);
                initLoaiVanBanRef.current = true;
            }
        }
    }, [loaiVanBanOptions]);

    const handleOrgChange = (nextValue: string[]) => {
        setSelectedOrg(nextValue);
        setHasOrgFilter(nextValue.length > 0);
    };

    const buildReportPayload = () => ({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        organization_ids: hasOrgFilter && selectedOrg.length > 0 ? selectedOrg : undefined,
        field: linhVuc.length > 0 ? linhVuc : undefined,
        document_type_id: loaiVanBan.length > 0 ? loaiVanBan : undefined,
    });

    const validateFilterSelection = () => {
        if (linhVuc.length === 0 || loaiVanBan.length === 0) {
            setReportError("Vui lòng chọn ít nhất 1 Lĩnh vực và 1 Loại văn bản.");
            return false;
        }
        setReportError(null);
        return true;
    };

    const fetchReport = async (): Promise<ReportFetchResult> => {
        setReportLoading(true);
        setReportError(null);
        try {
            const data = await api.post<unknown>(reportEndpoint, buildReportPayload());
            const dataRecord = asRecord(data);
            const itemsRaw = (dataRecord?.items as Record<string, unknown>[] | undefined) ?? [];
            const totalsRaw = asRecord(dataRecord?.totals);
            const mapped = itemsRaw.map(mapSummaryRow);
            const nextTotals = {
                totalTasks: Number(totalsRaw?.tong_so_nhiem_vu ?? 0),
                totalMainUnits: Number(totalsRaw?.tong_so_don_vi_thuc_hien ?? 0),
                totalCoordinationUnits: Number(totalsRaw?.tong_so_don_vi_phoi_hop ?? 0),
            };
            setRows(mapped);
            setTotals(nextTotals);
            return { rows: mapped, totals: nextTotals };
        } catch (err) {
            if (err instanceof ApiError) {
                setReportError(err.message);
            } else {
                console.error(err);
                setReportError("Không thể tải dữ liệu báo cáo.");
            }
            return {
                rows: [],
                totals: { totalTasks: 0, totalMainUnits: 0, totalCoordinationUnits: 0 },
            };
        } finally {
            setReportLoading(false);
        }
    };

    const handleReset = () => {
        setFromDate(defaultDateRange.fromDate);
        setToDate(defaultDateRange.toDate);
        setLinhVuc(linhVucOptions.map((option) => option.value).filter(Boolean));
        setLoaiVanBan(loaiVanBanOptions.map((option) => option.value).filter(Boolean));
        setSelectedOrg([]);
        setHasOrgFilter(false);
        setRows([]);
        setTotals({ totalTasks: 0, totalMainUnits: 0, totalCoordinationUnits: 0 });
        setReportError(null);
    };

    const exportSummaryExcel = async (filename: string) => {
        if (!validateFilterSelection()) return;
        const fetched = rows.length > 0 ? { rows, totals } : await fetchReport();
        const dataRows = fetched.rows;
        const exportTotals = fetched.totals;
        const headers = ["STT", summaryNameHeader, "Tổng số NV", "Tổng số đơn vị thực hiện", "Tổng số đơn vị phối hợp"];
        const rowsForSheet = dataRows.map((row, index) => [
            index + 1,
            row.name,
            row.totalTasks,
            row.totalMainUnits,
            row.totalCoordinationUnits,
        ]);
        rowsForSheet.push(["Tổng cộng", "", exportTotals.totalTasks, exportTotals.totalMainUnits, exportTotals.totalCoordinationUnits]);

        const worksheet = XLSX.utils.aoa_to_sheet([[title], headers, ...rowsForSheet]);
        worksheet["!cols"] = [{ wch: 6 }, { wch: 40 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
        worksheet["!merges"] = [{ s: { r: rowsForSheet.length + 1, c: 0 }, e: { r: rowsForSheet.length + 1, c: 1 } }];
        applyExcelStyle(worksheet, [2, 3, 4], headers.length - 1);

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "BaoCao");
        XLSX.writeFile(workbook, filename);
    };

    const exportSummaryPdf = async () => {
        if (!validateFilterSelection()) return;
        const fetched = rows.length > 0 ? { rows, totals } : await fetchReport();
        const dataRows = fetched.rows;
        const exportTotals = fetched.totals;
        const tableRows = dataRows
            .map(
                (row, index) =>
                    `<tr><td class="center">${index + 1}</td><td class="text">${row.name}</td><td class="num">${row.totalTasks}</td><td class="num">${row.totalMainUnits}</td><td class="num">${row.totalCoordinationUnits}</td></tr>`
            )
            .join("");
        const html = `<html><head><title>${title}</title><style>body{font-family:Arial,sans-serif;padding:16px}h1{font-size:18px;margin-bottom:12px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #e5e7eb;padding:8px;vertical-align:middle}th{text-align:center;background:#f3f4f6}.text{text-align:left}.num{text-align:right}.center{text-align:center}</style></head><body><h1>${title}</h1><table><thead><tr><th>STT</th><th>${summaryNameHeader}</th><th>Tổng số NV</th><th>Tổng số đơn vị thực hiện</th><th>Tổng số đơn vị phối hợp</th></tr></thead><tbody>${tableRows}<tr><td class="center" colspan="2"><strong>Tổng cộng</strong></td><td class="num"><strong>${exportTotals.totalTasks}</strong></td><td class="num"><strong>${exportTotals.totalMainUnits}</strong></td><td class="num"><strong>${exportTotals.totalCoordinationUnits}</strong></td></tr></tbody></table></body></html>`;

        const printWindow = window.open("", "_blank");
        if (!printWindow) {
            setReportError("Không thể mở cửa sổ in PDF.");
            return;
        }
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    };

    return (
        <div className="space-y-4">
            <TitleSpace
                title={title}
                description={
                    <>
                        {description}{" "}
                        <Tooltip content={tooltipContent}>
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-[10px] text-gray-500">i</span>
                        </Tooltip>
                    </>
                }
            />

            <FilterSpace
                key={`filter-space-${summaryFilePrefix}`}
                defaultCollapsed={false}
                actions={<>
                <ActionButton
                    type="preview"
                    onClick={() => {
                        if (validateFilterSelection()) void fetchReport();
                    }}
                />
                <ActionButton type="refresh" onClick={handleReset} />
                <ActionButton
                    type="export-excel"
                    onClick={() => void exportSummaryExcel(`${summaryFilePrefix}-${new Date().toISOString().slice(0, 10)}.xlsx`)}
                />
                <ActionButton type="export-pdf" onClick={() => void exportSummaryPdf()} />
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
                    <OrganizationTreeSelect multiple  value={selectedOrg} onChange={handleOrgChange} onFilterChange={setHasOrgFilter} />
                </label>

                <FieldSelect value={linhVuc} onChange={value => setLinhVuc(value)} multiple includeAllOption allOptionValue={'all'}/>
                <DocumentTypeSelect value={loaiVanBan}  onChange={value => setLoaiVanBan(value)} multiple includeAllOption allOptionValue={'all'}/>

            </FilterSpace>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="border-t border-gray-200">
                    <div className="max-h-[520px] overflow-auto">
                        <table className="min-w-full text-sm">
                            <thead className="sticky top-0 z-10 bg-[#d4a574] text-gray-700">
                                <tr>
                                    <th className="sticky top-0 border border-gray-200 bg-[#d4a574] px-4 py-3 text-center font-semibold">STT</th>
                                    <th className="sticky top-0 border border-gray-200 bg-[#d4a574] px-4 py-3 text-center font-semibold">{summaryNameHeader}</th>
                                    <th className="sticky top-0 border border-gray-200 bg-[#d4a574] px-4 py-3 text-center font-semibold">Tổng số NV</th>
                                    <th className="sticky top-0 border border-gray-200 bg-[#d4a574] px-4 py-3 text-center font-semibold">Tổng số đơn vị thực hiện</th>
                                    <th className="sticky top-0 border border-gray-200 bg-[#d4a574] px-4 py-3 text-center font-semibold">Tổng số đơn vị phối hợp</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, index) => (
                                    <tr key={row.id} className="bg-white">
                                        <td className="border border-gray-200 px-4 py-3 text-center text-gray-600">{index + 1}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-gray-800">{row.name}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center text-gray-800">{row.totalTasks}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center text-gray-800">{row.totalMainUnits}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center text-gray-800">{row.totalCoordinationUnits}</td>
                                    </tr>
                                ))}
                                {rows.length > 0 ? (
                                    <tr className="sticky bottom-0 z-10 bg-gray-50 font-semibold text-gray-800">
                                        <td className="border border-gray-200 bg-gray-50 px-4 py-3 text-center" colSpan={2}>Tổng cộng</td>
                                        <td className="border border-gray-200 bg-gray-50 px-4 py-3 text-center">{totals.totalTasks}</td>
                                        <td className="border border-gray-200 bg-gray-50 px-4 py-3 text-center">{totals.totalMainUnits}</td>
                                        <td className="border border-gray-200 bg-gray-50 px-4 py-3 text-center">{totals.totalCoordinationUnits}</td>
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

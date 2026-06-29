"use client";

import {Eye} from "lucide-react";
import React, {useEffect, useMemo, useRef, useState} from "react";
import {endpoints} from "@/lib/endpoints";
import {api, ApiError} from "@/lib/api";
import OrganizationTreeSelect from "@/app/(admin)/bao-cao/common/OrganizationTreeSelect";
import Tooltip from "@/app/(admin)/bao-cao/common/Tooltip";
import {AppPagination} from "@/components/controller";
import {getToken, getWorkspaceId} from "@/lib/auth";
import TitleSpace from "@/components/controller/space/TitleSpace";
import ActionButton from "@/components/controller/ActionButton";
import {AppDatePicker, DocumentTypeSelect, FieldSelect, FilterSpace, StatusSelect} from "@/components/controller";

type ReportRow = {
    uuid: string;
    uuid_as: string;
    tenNhiemVu: string;
    donViThucHien: string;
    hanHoanThanh?: string | null;
    trangThai?: string | null;
    tienDo?: number | null;
    tenVanBan?: string | null;
};

type CategoryItem = {
    uuid?: string;
    name?: string;
};

type SelectOption = {
    value: string;
    label: string;
};

const STATUS_OPTIONS: SelectOption[] = [
    { value: "", label: "Tất cả" },
    { value: "new", label: "Chờ tiếp nhận" },
    { value: "in_progress", label: "Đang xử lý" },
    { value: "completed", label: "Hoàn thành" },
    { value: "pending", label: "Chờ duyệt" },
    { value: "rejected", label: "Từ chối" },
    { value: "approved", label: "Phê duyệt" },
];

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    return value as Record<string, unknown>;
}

function extractCategoryItems(payload: unknown): CategoryItem[] {
    const payloadRecord = asRecord(payload);
    const dataRecord = asRecord(payloadRecord?.data) ?? payloadRecord;
    if (!dataRecord) {
        return [];
    }

    const items = dataRecord.items;
    if (Array.isArray(items)) {
        return items as CategoryItem[];
    }

    if (Array.isArray(payload)) {
        return payload as CategoryItem[];
    }

    return [];
}

function buildCategoryQuery(categoryCode: string): string {
    const params = new URLSearchParams({
        categoryCode,
        status: "true",
    });
    return params.toString();
}

function asNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
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

const dateFormatter = new Intl.DateTimeFormat("vi-VN");

function formatDate(value?: string | null): string {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return dateFormatter.format(parsed);
}

export default function BaoCaoChiTietNhiemVuPage() {
    const defaultDateRange = useMemo(() => getDefaultReportDateRange(), []);
    const reportEndpoint = endpoints.report.reportTaskDetail;
    const exportExcelEndpoint = endpoints.report.reportTaskDetailExportExcel;
    const exportPdfEndpoint = endpoints.report.reportTaskDetailExportPdf;
    const [fromDate, setFromDate] = useState(defaultDateRange.fromDate);
    const [toDate, setToDate] = useState(defaultDateRange.toDate);
    const [selectedOrg, setSelectedOrg] = useState<string[]>([]);
    const [hasOrgFilter, setHasOrgFilter] = useState(false);
    const [assignedOrg, setAssignedOrg] = useState<string[]>([]);
    const [hasAssignedFilter, setHasAssignedFilter] = useState(false);
    const [linhVucOptions, setLinhVucOptions] = useState<SelectOption[]>([{ value: "", label: "Tất cả" }]);
    const [loaiVanBanOptions, setLoaiVanBanOptions] = useState<SelectOption[]>([{ value: "", label: "Tất cả" }]);
    const [linhVuc, setLinhVuc] = useState<string[]>([]);
    const [loaiVanBan, setLoaiVanBan] = useState<string[]>([]);
    const [statusOptions] = useState<SelectOption[]>(STATUS_OPTIONS);
    const [statusList, setStatusList] = useState<string[]>([]);
    const initLinhVucRef = useRef(false);
    const initLoaiVanBanRef = useRef(false);
    const initStatusRef = useRef(false);
    const [rows, setRows] = useState<ReportRow[]>([]);
    const [reportLoading, setReportLoading] = useState(false);
    const [reportError, setReportError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRows, setTotalRows] = useState(0);

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
                        if (!value || !label) {
                            return null;
                        }
                        return { value, label };
                    })
                    .filter((option): option is SelectOption => Boolean(option));

                const docTypeOptions = extractCategoryItems(docTypeItems)
                    .map((item) => {
                        const value = item.uuid?.trim() || "";
                        const label = item.name?.trim() || "";
                        if (!value || !label) {
                            return null;
                        }
                        return { value, label };
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

    useEffect(() => {
        if (!initStatusRef.current) {
            const allValues = statusOptions.map((option) => option.value).filter(Boolean);
            if (allValues.length > 0) {
                setStatusList(allValues);
                initStatusRef.current = true;
            }
        }
    }, [statusOptions]);

    const buildReportPayload = () => ({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        organization_ids: hasOrgFilter && selectedOrg.length > 0 ? selectedOrg : undefined,
        assigned_to_org_ids: hasAssignedFilter && assignedOrg.length > 0 ? assignedOrg : undefined,
        field: linhVuc.length > 0 ? linhVuc : undefined,
        document_type_id: loaiVanBan.length > 0 ? loaiVanBan : undefined,
        status: statusList.length > 0 ? statusList : undefined,
        page,
        limit: pageSize,
    });

    useEffect(() => {
        if (linhVuc.length === 0 || loaiVanBan.length === 0) {
            return;
        }
        void fetchReport();
    }, [page, pageSize]);

    const fetchReport = async (): Promise<ReportRow[]> => {
        setReportLoading(true);
        setReportError(null);
        try {
            const data = await api.post<unknown>(reportEndpoint, buildReportPayload());
            const dataRecord = asRecord(data);
            const itemsRaw = (dataRecord?.items as Record<string, unknown>[] | undefined) ?? [];
            const pagination = asRecord(dataRecord?.pagination);
            const mapped = itemsRaw.map((item) => ({
                uuid: String(item.uuid ?? ""),
                uuid_as: String(item.uuid_as ?? ""),
                tenNhiemVu: String(item.tenNhiemVu ?? ""),
                donViThucHien: String(item.donViThucHien ?? ""),
                hanHoanThanh: (item.hanHoanThanh as string | null) ?? null,
                trangThai: (item.trangThai as string | null) ?? null,
                tienDo: asNumber(item.tienDo),
                tenVanBan: (item.tenVanBan as string | null) ?? null,
            }));
            setRows(mapped);
            setTotalRows(Number(pagination?.total ?? itemsRaw.length ?? 0));
            setTotalPages(Number(pagination?.pages ?? 1));
            setPage(Number(pagination?.page ?? page));
            setPageSize(Number(pagination?.limit ?? pageSize));
            return mapped;
        } catch (err) {
            if (err instanceof ApiError) {
                setReportError(err.message);
            } else {
                console.error(err);
                setReportError("Không thể tải dữ liệu báo cáo.");
            }
            return [];
        } finally {
            setReportLoading(false);
        }
    };

    const validateFilterSelection = () => {
        if (linhVuc.length === 0 || loaiVanBan.length === 0) {
            setReportError("Vui lòng chọn ít nhất 1 lĩnh vực và 1 loại văn bản.");
            return false;
        }
        setReportError(null);
        return true;
    };

    const handlePreview = () => {
        if (!validateFilterSelection()) return;
        setPage(1);
        void fetchReport();
    };

    const handleReset = () => {
        const allFields = linhVucOptions.map((option) => option.value).filter(Boolean);
        const allDocTypes = loaiVanBanOptions.map((option) => option.value).filter(Boolean);
        const allStatuses = statusOptions.map((option) => option.value).filter(Boolean);
        setFromDate(defaultDateRange.fromDate);
        setToDate(defaultDateRange.toDate);
        setLinhVuc(allFields);
        setLoaiVanBan(allDocTypes);
        setStatusList(allStatuses);
        setSelectedOrg([]);
        setHasOrgFilter(false);
        setAssignedOrg([]);
        setHasAssignedFilter(false);
        setRows([]);
        setReportError(null);
        setPage(1);
        setTotalRows(0);
        setTotalPages(1);
    };

    const groupedRows = useMemo(() => {
        const counts = new Map<string, number>();
        const indexes = new Map<string, number>();
        let groupIndex = 0;
        rows.forEach((row) => {
            const key = row.uuid || row.uuid_as;
            if (!counts.has(key)) {
                counts.set(key, 0);
                indexes.set(key, ++groupIndex);
            }
            counts.set(key, (counts.get(key) ?? 0) + 1);
        });
        const seen = new Set<string>();
        return rows.map((row) => {
            const key = row.uuid || row.uuid_as;
            const isFirst = !seen.has(key);
            if (isFirst) {
                seen.add(key);
            }
            return {
                row,
                rowSpan: isFirst ? counts.get(key) ?? 1 : 0,
                groupIndex: indexes.get(key) ?? 0,
                isFirst,
            };
        });
    }, [rows]);

    const handleExportExcel = () => {
        const dateSuffix = new Date().toISOString().slice(0, 10);
        void exportExcel(`bao-cao-chi-tiet-nhiem-vu-${dateSuffix}.xlsx`);
    };

    const exportExcel = async (filename: string) => {
        if (!validateFilterSelection()) return;
        const payload = {
            ...buildReportPayload(),
            page: undefined,
            limit: undefined,
        };
        const token = getToken();
        const workspaceId = getWorkspaceId();
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}${exportExcelEndpoint}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(workspaceId ? { "x-workspace-id": workspaceId } : {}),
            },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            setReportError("Không thể xuất Excel.");
            return;
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    };

    const handleExportPdf = async () => {
        if (!validateFilterSelection()) return;
        const payload = {
            ...buildReportPayload(),
            page: undefined,
            limit: undefined,
        };
        const token = getToken();
        const workspaceId = getWorkspaceId();
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}${exportPdfEndpoint}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(workspaceId ? { "x-workspace-id": workspaceId } : {}),
            },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            setReportError("Không thể xuất PDF.");
            return;
        }
        const html = await response.text();
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
                title="Báo cáo chi tiết nhiệm vụ"
                description="Thống kê tất cả nhiệm vụ theo điều kiện đã chọn."
            />

            <FilterSpace
                key="filter-space-bao-cao-chi-tiet-nhiem-vu"
                defaultCollapsed={false}
                actions={
                <>
                    <ActionButton type="preview" onClick={handlePreview} />
                    <ActionButton type="refresh" onClick={handleReset} />
                    <ActionButton type="export-excel" onClick={handleExportExcel} />
                    <ActionButton type="export-pdf" onClick={handleExportPdf} />
                </>
            }
            >
                <AppDatePicker title={'Từ ngày'} bold value={fromDate} onChange={(e) => setFromDate(e)}/>
                <AppDatePicker title={'Đến ngày'} bold value={toDate} onChange={(e) => setToDate(e)}/>
                <label>
                            <span className="mb-1 inline-flex items-center gap-1 text-sm text-gray-700 font-semibold">
                                Đơn vị giao
                                <Tooltip content="Nháy đúp chuột vào đơn vị cha để chọn/bỏ chọn tất cả đơn vị con.">
                                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-[10px] text-gray-500">
                                        i
                                    </span>
                                </Tooltip>
                            </span>
                    <OrganizationTreeSelect
                        value={selectedOrg}
                        multiple
                        onChange={(value) => {
                            setSelectedOrg(value);
                            setHasOrgFilter(value.length > 0);
                        }}
                        onFilterChange={setHasOrgFilter}
                    />
                </label>

                <label>
                            <span className="mb-1 inline-flex items-center gap-1 text-sm text-gray-700 font-semibold">
                                Đơn vị thực hiện
                                <Tooltip content="Nháy đúp chuột vào đơn vị cha để chọn/bỏ chọn tất cả đơn vị con.">
                                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-[10px] text-gray-500">
                                        i
                                    </span>
                                </Tooltip>
                            </span>
                    <OrganizationTreeSelect
                        multiple
                        value={assignedOrg}
                        onChange={(value) => {
                            setAssignedOrg(value);
                            setHasAssignedFilter(value.length > 0);
                        }}
                        onFilterChange={setHasAssignedFilter}
                    />
                </label>

                <FieldSelect value={linhVuc} onChange={value => setLinhVuc(value)} multiple includeAllOption allOptionValue={'all'}/>
                <DocumentTypeSelect value={loaiVanBan}  onChange={value => setLoaiVanBan(value)} multiple includeAllOption allOptionValue={'all'}/>
                <StatusSelect value={statusList} multiple includeAllOption allOptionValue={'all'} onChange={e => setStatusList(e)}/>
            </FilterSpace>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                {/*<div className="p-4 md:p-6">*/}

                {/*    <div className="mt-4 flex flex-wrap items-center justify-end gap-2">*/}

                {/*    </div>*/}
                {/*    {reportError ? <p className="mt-3 text-sm text-red-600">{reportError}</p> : null}*/}
                {/*    {reportLoading ? <p className="mt-2 text-sm text-gray-500">Đang tải dữ liệu...</p> : null}*/}
                {/*</div>*/}

                <div className="border-t border-gray-200">
                    <div className="max-h-[520px] overflow-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-[#d4a574] text-gray-700 sticky top-0 z-10">
                                <tr>
                                    <th className="border border-gray-200 px-4 py-3 text-center font-semibold sticky top-0 bg-[#d4a574]">STT</th>
                                    <th className="border border-gray-200 px-4 py-3 text-center font-semibold sticky top-0 bg-[#d4a574]">Văn bản</th>
                                    <th className="border border-gray-200 px-4 py-3 text-center font-semibold sticky top-0 bg-[#d4a574]">Tên nhiệm vụ</th>
                                    <th className="border border-gray-200 px-4 py-3 text-center font-semibold sticky top-0 bg-[#d4a574]">Đơn vị giao -&gt; Đơn vị thực hiện, phối hợp</th>
                                    <th className="border border-gray-200 px-4 py-3 text-center font-semibold sticky top-0 bg-[#d4a574]">Hạn hoàn thành</th>
                                    <th className="border border-gray-200 px-4 py-3 text-center font-semibold sticky top-0 bg-[#d4a574]">Tiến độ</th>
                                    <th className="border border-gray-200 px-4 py-3 text-center font-semibold sticky top-0 bg-[#d4a574]">Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groupedRows.map(({ row, rowSpan, groupIndex, isFirst }, index) => (
                                    <tr key={`${row.uuid}-${row.uuid_as}-${index}`} className="bg-white">
                                        {isFirst ? (
                                            <td className="border border-gray-200 px-4 py-3 text-center" rowSpan={rowSpan}>
                                                {groupIndex}
                                            </td>
                                        ) : null}
                                        {isFirst ? (
                                            <td className="border border-gray-200 px-4 py-3 text-left text-gray-800" rowSpan={rowSpan}>
                                                {row.tenVanBan ?? "-"}
                                            </td>
                                        ) : null}
                                        {isFirst ? (
                                            <td className="border border-gray-200 px-4 py-3 text-left text-gray-800" rowSpan={rowSpan}>
                                                {row.tenNhiemVu}
                                            </td>
                                        ) : null}
                                        <td className="border border-gray-200 px-4 py-3 text-left text-gray-800">{row.donViThucHien}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center">{formatDate(row.hanHoanThanh)}</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center">{asNumber(row.tienDo)}%</td>
                                        <td className="border border-gray-200 px-4 py-3 text-center">{row.trangThai ?? "-"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <AppPagination
                        currentPage={page}
                        totalPages={totalPages}
                        totalRows={totalRows}
                        rowsPerPage={pageSize}
                        rowsPerPageOptions={[10, 20, 50]}
                        summaryLabel={`Có tổng ${totalRows} nhiệm vụ`}
                        pageSizeSuffix="dòng"
                        onRowsPerPageChange={(nextLimit) => {
                            setPageSize(nextLimit);
                            setPage(1);
                        }}
                        onPageChange={(nextPage) => {
                            if (nextPage < 1 || nextPage > totalPages) return;
                            setPage(nextPage);
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

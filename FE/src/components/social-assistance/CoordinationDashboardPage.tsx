"use client";

import { api, ApiError } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { SocialAssistancePage, SocialAssistanceToolbar } from "./SocialAssistanceLayout";
import { buildSocialAssistanceDashboardQuery } from "@/lib/social-assistance-utils";
import type { SocialAssistanceDashboard } from "@/types/social-assistance";
import { Alert, Button, Empty, Input, Select, Spin, Table, Tag } from "antd";
import type { TableColumnsType } from "antd";
import type { ApexOptions } from "apexcharts";
import { Activity, AlertTriangle, ChartNoAxesCombined, CheckCircle2, HandCoins, RefreshCw, UsersRound } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type DashboardFilters = {
    from: string;
    to: string;
    provinceCode?: string;
    wardCode?: string;
    programId?: string;
    requestStatus?: string;
};

type WardSummary = SocialAssistanceDashboard["byGeography"][number];

const currentYear = new Date().getFullYear();
const defaultFilters: DashboardFilters = {
    from: `${currentYear}-01-01`,
    to: `${currentYear}-12-31`
};
const currency = (amount: number): string => `${amount.toLocaleString("vi-VN")} đ`;

function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
    return (
        <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-600">{label}</p>
            <p className={`mt-2 break-words text-2xl font-semibold ${tone}`}>{value}</p>
            <p className="mt-2 text-xs text-slate-500">{detail}</p>
        </div>
    );
}

export default function CoordinationDashboardPage() {
    const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);
    const [data, setData] = useState<SocialAssistanceDashboard | null>(null);
    const [geographyOptions, setGeographyOptions] = useState<WardSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        const query = buildSocialAssistanceDashboardQuery(filters);
        api.get<SocialAssistanceDashboard>(query ? `${endpoints.socialAssistance.dashboard}?${query}` : endpoints.socialAssistance.dashboard)
            .then((result) => {
                if (!active) return;
                setData(result);
                if (!filters.provinceCode && !filters.wardCode) setGeographyOptions(result.byGeography);
            })
            .catch((loadError: unknown) => {
                if (!active) return;
                setError(loadError instanceof ApiError ? loadError.message : "Không thể tải dữ liệu điều phối.");
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => { active = false; };
    }, [filters]);

    const summary = data?.summary;
    const programNames = new Map((data?.programOptions ?? []).map((program) => [program.id, program.title]));
    const provinceCodes = [...new Set(geographyOptions.map((ward) => ward.provinceCode))];
    const availableWards = geographyOptions.filter((ward) => !filters.provinceCode || ward.provinceCode === filters.provinceCode);
    const chartOptions: ApexOptions = {
        chart: { type: "bar", toolbar: { show: false }, fontFamily: "Outfit, sans-serif" },
        plotOptions: { bar: { horizontal: true, borderRadius: 3, barHeight: "62%" } },
        colors: ["#d97706", "#0891b2", "#2563eb", "#15803d"],
        dataLabels: { enabled: false },
        grid: { borderColor: "#e8edf2" },
        xaxis: {
            categories: (data?.byProgram ?? []).map((row) => programNames.get(row.programId) ?? row.programId.slice(0, 8)),
            labels: { formatter: (value) => Number(value).toLocaleString("vi-VN") }
        },
        legend: { position: "bottom", fontSize: "12px", labels: { colors: "#475569" } },
        tooltip: { y: { formatter: (value) => currency(value) } }
    };
    const chartSeries = [
        { name: "Cam kết", data: (data?.byProgram ?? []).map((row) => row.pledgedCashAmount) },
        { name: "Đã tiếp nhận", data: (data?.byProgram ?? []).map((row) => row.receivedCashAmount) },
        { name: "Đã phân bổ", data: (data?.byProgram ?? []).map((row) => row.allocatedCashAmount) },
        { name: "Đã trao", data: (data?.byProgram ?? []).map((row) => row.deliveredCashAmount) }
    ];
    const geographyColumns: TableColumnsType<WardSummary> = [
        { title: "Mã tỉnh/thành", dataIndex: "provinceCode", key: "provinceCode" },
        { title: "Mã xã/phường", dataIndex: "wardCode", key: "wardCode" },
        { title: "Hồ sơ tiếp nhận", dataIndex: "requestsReceived", key: "requestsReceived", align: "right" },
        { title: "Đã xác minh", dataIndex: "requestsVerified", key: "requestsVerified", align: "right" },
        { title: "Đã phân bổ", dataIndex: "allocatedCashAmount", key: "allocatedCashAmount", align: "right", render: currency },
        { title: "Đã trao", dataIndex: "deliveredCashAmount", key: "deliveredCashAmount", align: "right", render: currency }
    ];

    const updateFilters = (update: (current: DashboardFilters) => DashboardFilters) => {
        setLoading(true);
        setError(null);
        setFilters(update);
    };
    const updateFilter = <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => {
        updateFilters((current) => ({ ...current, [key]: value || undefined }));
    };

    return (
        <SocialAssistancePage title="Bảng điều phối" icon={ChartNoAxesCombined} actions={
            <>
                <Link href="/an-sinh/tiep-nhan"><Button icon={<UsersRound size={15} />}>Hồ sơ cần rà soát</Button></Link>
                <Button icon={<RefreshCw size={15} />} onClick={() => updateFilters((current) => ({ ...current }))}>Làm mới</Button>
            </>
        }>

            <SocialAssistanceToolbar title="Bộ lọc báo cáo">
                <label className="grid w-full gap-1 text-sm text-gray-600 sm:w-44">Từ ngày<Input type="date" value={filters.from} onChange={(event) => updateFilter("from", event.target.value)} /></label>
                <label className="grid w-full gap-1 text-sm text-gray-600 sm:w-44">Đến ngày<Input type="date" value={filters.to} onChange={(event) => updateFilter("to", event.target.value)} /></label>
                <Select
                    allowClear
                    aria-label="Tỉnh/thành"
                    className="min-w-48"
                    placeholder="Tất cả tỉnh/thành"
                    value={filters.provinceCode}
                    options={provinceCodes.map((code) => ({ value: code, label: `Tỉnh/thành ${code}` }))}
                    onChange={(value) => updateFilters((current) => ({ ...current, provinceCode: value, wardCode: undefined }))}
                />
                <Select
                    allowClear
                    aria-label="Xã/phường"
                    className="min-w-48"
                    placeholder="Tất cả xã/phường"
                    value={filters.wardCode}
                    options={[...new Set(availableWards.map((ward) => ward.wardCode))].map((code) => ({ value: code, label: `Xã/phường ${code}` }))}
                    onChange={(value) => updateFilter("wardCode", value)}
                />
                <Select
                    allowClear
                    aria-label="Chương trình"
                    className="min-w-56"
                    placeholder="Tất cả chương trình"
                    value={filters.programId}
                    options={(data?.programOptions ?? []).map((program) => ({ value: program.id, label: program.title }))}
                    onChange={(value) => updateFilter("programId", value)}
                />
                <Select
                    allowClear
                    aria-label="Trạng thái hồ sơ"
                    className="min-w-48"
                    placeholder="Mọi trạng thái hồ sơ"
                    value={filters.requestStatus}
                    options={[
                        { value: "RECEIVED", label: "Mới tiếp nhận" },
                        { value: "IN_REVIEW", label: "Đang rà soát" },
                        { value: "NEEDS_INFORMATION", label: "Cần bổ sung" },
                        { value: "VERIFIED", label: "Đã xác minh" },
                        { value: "REJECTED", label: "Từ chối" }
                    ]}
                    onChange={(value) => updateFilter("requestStatus", value)}
                />
            </SocialAssistanceToolbar>

            {error ? <Alert type="error" showIcon message={error} /> : null}
            <Spin spinning={loading}>
                {summary ? (
                    <div className="space-y-5">
                        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <Metric label="Hồ sơ tiếp nhận" value={summary.requestsReceived.toLocaleString("vi-VN")} detail={`${summary.requestsVerified.toLocaleString("vi-VN")} hồ sơ đã xác minh`} tone="text-slate-900" />
                            <Metric label="Chờ phân bổ" value={summary.awaitingAllocation.toLocaleString("vi-VN")} detail={`${summary.allocatedCases.toLocaleString("vi-VN")} hồ sơ đã có phân bổ`} tone="text-amber-700" />
                            <Metric label="Đã hoàn thành" value={summary.completedCases.toLocaleString("vi-VN")} detail="Hồ sơ có hỗ trợ đã trao hoặc đối soát" tone="text-emerald-700" />
                            <Metric label="Cam kết hiện vật" value={summary.inKindPledgeCount.toLocaleString("vi-VN")} detail={`Trong ${summary.pledgeCount.toLocaleString("vi-VN")} cam kết`} tone="text-cyan-700" />
                        </section>

                        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Giá trị hỗ trợ bằng tiền">
                            <Metric label="Giá trị cam kết" value={currency(summary.pledgedCashAmount)} detail="Tiền mặt đã đăng ký ủng hộ" tone="text-amber-700" />
                            <Metric label="Đã tiếp nhận" value={currency(summary.receivedCashAmount)} detail="Tiền mặt đã được cán bộ xác nhận" tone="text-cyan-700" />
                            <Metric label="Đã phân bổ" value={currency(summary.allocatedCashAmount)} detail="Kế hoạch hỗ trợ đã ghi nhận" tone="text-blue-700" />
                            <Metric label="Đã trao" value={currency(summary.deliveredCashAmount)} detail="Giá trị tiền mặt đã thực hiện" tone="text-emerald-700" />
                        </section>

                        <div className="flex flex-wrap gap-3">
                            <Link href="/an-sinh/tiep-nhan"><Tag color={summary.openReviewBacklog ? "orange" : "green"} className="m-0 cursor-pointer px-3 py-1.5"><Activity size={14} className="mr-1 inline" />Tồn rà soát: {summary.openReviewBacklog}</Tag></Link>
                            <Link href="/an-sinh/tiep-nhan"><Tag color={summary.duplicateReviewCount ? "red" : "green"} className="m-0 cursor-pointer px-3 py-1.5"><AlertTriangle size={14} className="mr-1 inline" />Cần đối chiếu trùng: {summary.duplicateReviewCount}</Tag></Link>
                            <Tag color="blue" className="m-0 px-3 py-1.5"><CheckCircle2 size={14} className="mr-1 inline" />Giá trị tiền mặt, chưa quy đổi hiện vật</Tag>
                        </div>

                        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-5">
                            <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 xl:col-span-3">
                                <div className="mb-3">
                                    <h2 className="text-base font-semibold text-slate-900">Dòng tiền theo chương trình</h2>
                                    <p className="mt-1 text-sm text-slate-500">Cam kết, tiếp nhận, phân bổ và trao được tính độc lập; bộ lọc địa bàn áp dụng cho hồ sơ và phân bổ.</p>
                                </div>
                                {data.byProgram.length ? <Chart type="bar" height={Math.max(260, data.byProgram.length * 54)} options={chartOptions} series={chartSeries} /> : <Empty description="Chưa có số liệu chương trình" />}
                            </section>
                            <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 xl:col-span-2">
                                <div className="mb-3">
                                    <h2 className="text-base font-semibold text-slate-900">Kết quả theo địa bàn</h2>
                                    <p className="mt-1 text-sm text-slate-500">Danh sách theo phạm vi được cấp quyền</p>
                                </div>
                                <Table<WardSummary>
                                    rowKey={(row) => `${row.provinceCode}-${row.wardCode}`}
                                    columns={geographyColumns}
                                    dataSource={data.byGeography}
                                    pagination={{ pageSize: 8, showSizeChanger: false }}
                                    scroll={{ x: 660 }}
                                    size="small"
                                    locale={{ emptyText: <Empty description="Chưa có số liệu địa bàn" /> }}
                                />
                            </section>
                        </div>
                    </div>
                ) : !loading && !error ? <Empty description="Chưa có dữ liệu điều phối trong kỳ đã chọn" /> : null}
            </Spin>
            <p className="flex items-center gap-2 text-xs text-slate-500"><HandCoins size={14} />Cam kết không đồng nghĩa với khoản đã tiếp nhận; chỉ khoản đã trao mới được tính vào kết quả thực hiện.</p>
        </SocialAssistancePage>
    );
}
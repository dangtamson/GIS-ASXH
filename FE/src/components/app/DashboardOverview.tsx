"use client";

import {ConfigProvider, TreeSelect} from "antd";
import {api} from "@/lib/api";
import {endpoints} from "@/lib/endpoints";
import {memo, useEffect, useMemo, useRef, useState} from "react";
import dynamic from "next/dynamic";
import type {ApexOptions} from "apexcharts";
import {useDonViSelect} from "@/hooks/useOrganization";
import {
    ActionButton,
    AppDatePicker,
    DocumentSelect,
    DocumentTypeSelect,
    FieldSelect,
    FilterSpace,
    TitleSpace
} from "@/components/controller";
import {controllerSelectClassName} from "@/components/controller/input/selectShared";
import {Healthy, Task, Warning, WorkProcess} from "@/icons/index";
import Image, {type StaticImageData} from "next/image";
import {getOrganizationId} from "@/lib/auth";

type CategoryItem = { uuid?: string | null; name?: string | null };
type SelectOption = { value: string; label: string };
type ListItem = { uuid?: string | null; title?: string | null; name?: string | null; code?: string | null };

type DashboardWorkloadSummary = {
    totalActual?: number | null;
    total?: number | null;
    completed?: number | null;
    inProgress?: number | null;
    new?: number | null;
    pending?: number | null;
    rejected?: number | null;
    approved?: number | null;
    totalOrganizations?: number | null;
};

type DashboardBreakdownRow = {
    uuid?: string | null;
    name?: string | null;
    total_tasks?: number | null;
    total_assignments?: number | null;
};

type DashboardDocumentRow = {
    uuid?: string | null;
    title?: string | null;
    total_tasks?: number | null;
};

type DashboardParticipationTaskRow = {
    uuid?: string | null;
    title?: string | null;
    document_title?: string | null;
    total_units?: number | null;
    total_main_units?: number | null;
    total_coordination_units?: number | null;
};

type DashboardTaskStatusCard = {
    total?: number | null;
    completedOnTime?: number | null;
    completedLate?: number | null;
    inProgress?: number | null;
    inProgressAwaitingAcceptance?: number | null;
    inProgressAcceptance?: number | null;
    overdueInProgress?: number | null;
    overdueInProgressAwaitingAcceptance?: number | null;
    overdueInProgressAcceptance?: number | null;
    upcomingDeadline?: number | null;
};

type DashboardTimelineRow = {
    period?: string | null;
    total?: number | null;
    completedOnTime?: number | null;
    incomplete?: number | null;
    completedLate?: number | null;
};

type DashboardTimelineResponse = {
    timelineStats?: DashboardTimelineRow[] | null;
};

type DashboardExtraCharts = {
    summaryCards?: DashboardTaskStatusCard | null;
    timelineStats?: DashboardTimelineRow[] | null;
};

type DashboardResponse = {
    topOrganizations?: DashboardBreakdownRow[] | null;
    topFields?: DashboardBreakdownRow[] | null;
    topDocuments?: DashboardDocumentRow[] | null;
    highlights?: {
        topParticipationTasks?: DashboardParticipationTaskRow[] | null;
    } | null;
    extraCharts?: DashboardExtraCharts | null;
    summaryCards?: DashboardTaskStatusCard | null;
    timelineStats?: DashboardTimelineRow[] | null;
};

type SummaryNoteLine = {
    label: string;
    value: number;
    colorClass?: string;
};

type SummaryCardProps = {
    title: string;
    subTitle: string;
    totalLabel: string;
    totalValue: number;
    noteLines?: SummaryNoteLine[];
    iconBg: string;
    totalColor: string;
    bgClass: string;
    iconSrc?: string | StaticImageData;
};

const DASHBOARD_TOP_LIMIT = 10;

const SummaryCard = memo(function SummaryCard({
    title,
    subTitle,
    totalLabel,
    totalValue,
    noteLines = [],
    iconBg,
    totalColor,
    bgClass,
    iconSrc,
}: SummaryCardProps) {
    return (
        <div className={`rounded-2xl p-4 shadow-sm ${bgClass}`}>
            <div className="flex items-start justify-between gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-semibold ${iconBg}`}>
                    {iconSrc ? (
                        <Image
                            src={iconSrc}
                            alt="icon"
                            width={24}
                            height={24}
                            className="h-6 w-6 object-contain"
                        />
                    ) : null}
                </div>
                <div className="text-right">
                    <div className={`text-4xl font-bold ${totalColor}`}>{totalValue}</div>
                    <div className="text-sm text-gray-600">{totalLabel}</div>
                </div>
            </div>

            <div className="mt-4">
                <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
                <p className="mt-1 text-sm text-gray-600">{subTitle}</p>

                {noteLines.length > 0 ? (
                    <div className="mt-4 space-y-1 text-sm">
                        {noteLines.map((item, index) => (
                            <div key={`${item.label}-${index}`} className="flex items-center justify-between gap-3">
                                <span className={item.colorClass ?? "text-gray-700"}>{item.label}</span>
                                <span className="font-medium text-gray-800">{item.value}</span>
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>
        </div>
    );
});

function toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function getDashboardSummaryCards(data: DashboardResponse | null): DashboardTaskStatusCard | null {
    return data?.summaryCards ?? data?.extraCharts?.summaryCards ?? null;
}

function getDashboardTimelineStats(data: DashboardResponse | null): DashboardTimelineRow[] {
    return data?.extraCharts?.timelineStats ?? data?.timelineStats ?? [];
}

function resolveDashboardOrganizationId(selectedOrg: string[]): string | undefined {
    const organizationId = String(selectedOrg[0] || getOrganizationId() || "").trim();
    return organizationId || undefined;
}

function normalizeTreeSelectValues(value: string | string[] | undefined): string[] {
    if (Array.isArray(value)) {
        return value.map((item) => String(item || "").trim()).filter(Boolean);
    }

    const normalized = String(value || "").trim();
    return normalized ? [normalized] : [];
}

function mergeDashboardData(
    mainData: DashboardResponse,
    totalData: DashboardTaskStatusCard,
    timelineData: DashboardTimelineResponse | null
): DashboardResponse {
    const timelineStats = timelineData?.timelineStats ?? mainData.extraCharts?.timelineStats ?? mainData.timelineStats ?? [];

    return {
        ...mainData,
        extraCharts: {
            ...(mainData.extraCharts ?? {}),
            timelineStats,
        },
        summaryCards: totalData,
        timelineStats,
    };
}

function buildCategoryQuery(categoryCode: string): string {
    const params = new URLSearchParams();
    params.set("categoryCode", categoryCode);
    params.set("status", "true");
    return params.toString();
}

function extractCategoryItems(payload: unknown): CategoryItem[] {
    if (payload && typeof payload === "object") {
        const map = payload as Record<string, unknown>;
        if (map.data && typeof map.data === "object") {
            const dataObj = map.data as Record<string, unknown>;
            if (Array.isArray(dataObj.items)) return dataObj.items as CategoryItem[];
        }
        if (Array.isArray(map.items)) return map.items as CategoryItem[];
    }
    return [];
}

function extractList(payload: unknown): ListItem[] {
    if (Array.isArray(payload)) return payload as ListItem[];
    if (payload && typeof payload === "object") {
        const map = payload as Record<string, unknown>;
        if (map.data && typeof map.data === "object") {
            const dataObj = map.data as Record<string, unknown>;
            if (Array.isArray(dataObj.items)) return dataObj.items as ListItem[];
            if (Array.isArray(dataObj.rows)) return dataObj.rows as ListItem[];
        }
        if (Array.isArray(map.items)) return map.items as ListItem[];
        if (Array.isArray(map.rows)) return map.rows as ListItem[];
    }
    return [];
}

function parseDateInput(value: string): Date | null {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const parsed = new Date(`${value}T00:00:00`);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const parts = value.split("/").map((item) => Number(item));
    if (parts.length !== 3) return null;
    const [day, month, year] = parts;
    if (!day || !month || !year) return null;

    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toApiDate(value: string): string | undefined {
    const parsed = parseDateInput(value);
    if (!parsed) return undefined;
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function normalizeSelectedValues(values: string[], options: SelectOption[]): string[] | undefined {
    const normalizedValues = values.filter(Boolean);
    if (normalizedValues.length === 0) return undefined;

    const allOptionValues = options.map((item) => item.value).filter(Boolean);
    return allOptionValues.length > 0 && normalizedValues.length === allOptionValues.length ? undefined : normalizedValues;
}

function truncateLabel(label?: string | null, max = 28): string {
    const normalized = String(label ?? "").trim();
    if (!normalized) return "--";
    return normalized.length <= max ? normalized : `${normalized.slice(0, max - 3)}...`;
}

function formatDateOnly(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getDefaultDashboardDateRange(): { fromDate: string; toDate: string } {
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    return {
        fromDate: formatDateOnly(startOfYear),
        toDate: formatDateOnly(today),
    };
}

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function DashboardOverview() {
    const defaultDateRange = useMemo(() => getDefaultDashboardDateRange(), []);
    const { dsDonVi, loading: donViLoading } = useDonViSelect();
    const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
    const [mainWorkloadSummary, setMainWorkloadSummary] = useState<DashboardWorkloadSummary | null>(null);
    const [coordinationWorkloadSummary, setCoordinationWorkloadSummary] = useState<DashboardWorkloadSummary | null>(null);
    const [selectedOrg, setSelectedOrg] = useState<string[]>([]);
    const [assignedOrg, setAssignedOrg] = useState<string[]>([]);
    const [linhVucOptions, setLinhVucOptions] = useState<SelectOption[]>([{ value: "", label: "Tất cả" }]);
    const [loaiVanBanOptions, setLoaiVanBanOptions] = useState<SelectOption[]>([{ value: "", label: "Tất cả" }]);
    const [vanBanOptions, setVanBanOptions] = useState<SelectOption[]>([{ value: "", label: "Tất cả" }]);
    const [linhVuc, setLinhVuc] = useState<string[]>([]);
    const [loaiVanBan, setLoaiVanBan] = useState<string[]>([]);
    const [vanBan, setVanBan] = useState<string[]>([]);
    const [typeTask, setTypeTask] = useState<1 | 2>(2);
    const [fromDate, setFromDate] = useState(defaultDateRange.fromDate);
    const [toDate, setToDate] = useState(defaultDateRange.toDate);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const initDashboardFetchRef = useRef(false);
    const dashboardFetchInFlightRef = useRef(false);

    useEffect(() => {
        const loadFilterOptions = async () => {
            try {
                const baseEndpoint = endpoints.admin.categoryItems;
                const [fieldItems, docTypeItems, documentItems] = await Promise.all([
                    api.get<unknown>(`${baseEndpoint}?${buildCategoryQuery("FIELD")}`),
                    api.get<unknown>(`${baseEndpoint}?${buildCategoryQuery("DOCUMENT_TYPE")}`),
                    api.get<unknown>(endpoints.admin.documents),
                ]);

                const fieldOptions = extractCategoryItems(fieldItems)
                    .map((item) => (item.uuid?.trim() && item.name?.trim() ? { value: item.uuid.trim(), label: item.name.trim() } : null))
                    .filter((item): item is SelectOption => Boolean(item));

                const docTypeOptions = extractCategoryItems(docTypeItems)
                    .map((item) => (item.uuid?.trim() && item.name?.trim() ? { value: item.uuid.trim(), label: item.name.trim() } : null))
                    .filter((item): item is SelectOption => Boolean(item));

                const documentOptions = extractList(documentItems)
                    .map((item) => {
                        const value = String(item.uuid ?? "").trim();
                        const label = String(item.title ?? item.name ?? item.code ?? "").trim();
                        return value && label ? { value, label } : null;
                    })
                    .filter((item): item is SelectOption => Boolean(item));

                setLinhVucOptions([{ value: "", label: "Tất cả" }, ...fieldOptions]);
                setLoaiVanBanOptions([{ value: "", label: "Tất cả" }, ...docTypeOptions]);
                setVanBanOptions([{ value: "", label: "Tất cả" }, ...documentOptions]);
            } catch {
                setLinhVucOptions([{ value: "", label: "Tất cả" }]);
                setLoaiVanBanOptions([{ value: "", label: "Tất cả" }]);
                setVanBanOptions([{ value: "", label: "Tất cả" }]);
            }
        };

        void loadFilterOptions();
    }, []);

    const dashboardPayload = useMemo(
        () => ({
            fromDate: toApiDate(fromDate),
            toDate: toApiDate(toDate),
            typeTask,
            organization_ids: selectedOrg.length > 0 ? selectedOrg : undefined,
            assigned_to_org_ids: assignedOrg.length > 0 ? assignedOrg : undefined,
            field: normalizeSelectedValues(linhVuc, linhVucOptions),
            document_type_id: normalizeSelectedValues(loaiVanBan, loaiVanBanOptions),
            document_ids: normalizeSelectedValues(vanBan, vanBanOptions),
            topLimit: DASHBOARD_TOP_LIMIT,
            monthSpan: 6,
        }),
        [fromDate, toDate, typeTask, selectedOrg, assignedOrg, linhVuc, linhVucOptions, loaiVanBan, loaiVanBanOptions, vanBan, vanBanOptions]
    );

    const organizationWorkloadPayload = useMemo(
        () => ({
            fromDate: toApiDate(fromDate),
            toDate: toApiDate(toDate),
            typeTask,
            organization_ids: selectedOrg.length > 0 ? selectedOrg : undefined,
            assigned_to_org_ids: assignedOrg.length > 0 ? assignedOrg : undefined,
            field: normalizeSelectedValues(linhVuc, linhVucOptions),
            document_type_id: normalizeSelectedValues(loaiVanBan, loaiVanBanOptions),
        }),
        [fromDate, toDate, typeTask, selectedOrg, assignedOrg, linhVuc, linhVucOptions, loaiVanBan, loaiVanBanOptions]
    );
    const dashboardPayloadTotal = useMemo(
        () => ({
            fromDate: toApiDate(fromDate),
            toDate: toApiDate(toDate),
            typeTask,
            organizationId: resolveDashboardOrganizationId(selectedOrg),
            document_ids: normalizeSelectedValues(vanBan, vanBanOptions) ?? [],
        }),
        [fromDate, toDate, typeTask, selectedOrg, assignedOrg, linhVuc, linhVucOptions, loaiVanBan, loaiVanBanOptions, vanBan, vanBanOptions]
    );
    const fetchDashboard = async (payload: typeof dashboardPayload, workloadPayload: typeof organizationWorkloadPayload, totalPayload: typeof dashboardPayloadTotal) => {
        if (dashboardFetchInFlightRef.current) return;

        dashboardFetchInFlightRef.current = true;
        setLoading(true);
        setError(null);

        try {
            const [data, mainWorkload, coordinationWorkload, totalSummaryCards, timelineData] = await Promise.all([
                api.post<DashboardResponse>(endpoints.report.reportTaskDashboard, payload),
                api.post<DashboardWorkloadSummary>(endpoints.report.reportTaskDashboardMainWorkload, workloadPayload),
                api.post<DashboardWorkloadSummary>(endpoints.report.reportTaskDashboardCoordinationWorkload, workloadPayload),
                api.post<DashboardTaskStatusCard>(endpoints.report.reportTaskDashboardTotal, totalPayload),
                api.post<DashboardTimelineResponse>(endpoints.report.reportTimelineDashboardTotal, totalPayload)
            ]);
            setDashboard(mergeDashboardData(data, totalSummaryCards, timelineData));
            setMainWorkloadSummary(mainWorkload);
            setCoordinationWorkloadSummary(coordinationWorkload);
        } catch {
            setDashboard(null);
            setMainWorkloadSummary(null);
            setCoordinationWorkloadSummary(null);
            setError("Không thể tải dữ liệu tổng quan.");
        } finally {
            dashboardFetchInFlightRef.current = false;
            setLoading(false);
        }
    };

    useEffect(() => {
        if (initDashboardFetchRef.current) return;
        initDashboardFetchRef.current = true;
        void fetchDashboard(dashboardPayload, organizationWorkloadPayload, dashboardPayloadTotal);
    }, []);

    const handleResetFilters = () => {
        setFromDate(defaultDateRange.fromDate);
        setToDate(defaultDateRange.toDate);
        setSelectedOrg([]);
        setAssignedOrg([]);
        setLinhVuc([]);
        setLoaiVanBan([]);
        setVanBan([]);

        void fetchDashboard(
            {
                fromDate: defaultDateRange.fromDate,
                toDate: defaultDateRange.toDate,
                typeTask,
                organization_ids: undefined,
                assigned_to_org_ids: undefined,
                field: undefined,
                document_type_id: undefined,
                document_ids: undefined,
                topLimit: DASHBOARD_TOP_LIMIT,
                monthSpan: 6,
            },
            {
                fromDate: defaultDateRange.fromDate,
                toDate: defaultDateRange.toDate,
                typeTask,
                organization_ids: undefined,
                assigned_to_org_ids: undefined,
                field: undefined,
                document_type_id: undefined,
            },
            {
                fromDate: defaultDateRange.fromDate,
                toDate: defaultDateRange.toDate,
                typeTask,
                organizationId: resolveDashboardOrganizationId([]),
                document_ids: [],
            }
        );
    };

    const topOrganizations = dashboard?.topOrganizations ?? [];
    const topFields = dashboard?.topFields ?? [];
    const topDocuments = dashboard?.topDocuments ?? [];
    const topParticipationTasks = dashboard?.highlights?.topParticipationTasks ?? [];

    const summaryCards = getDashboardSummaryCards(dashboard);
    const unitProgress = getDashboardSummaryCards(dashboard);
    const timelineStats = getDashboardTimelineStats(dashboard);
    const totalSummaryTasks = toNumber(summaryCards?.total);
    const completedOnTimeCount = toNumber(summaryCards?.completedOnTime);
    const completedLateCount = toNumber(summaryCards?.completedLate);
    const inProgressCount = toNumber(summaryCards?.inProgress);
    const inProgressAwaitingAcceptanceCount = toNumber(summaryCards?.inProgressAwaitingAcceptance);
    const inProgressAcceptanceCount = toNumber(summaryCards?.inProgressAcceptance);
    const overdueInProgressCount = toNumber(summaryCards?.overdueInProgress);
    const overdueInProgressAwaitingAcceptanceCount = toNumber(summaryCards?.overdueInProgressAwaitingAcceptance);
    const overdueInProgressAcceptanceCount = toNumber(summaryCards?.overdueInProgressAcceptance);

    const completedSummaryNoteLines = useMemo<SummaryNoteLine[]>(
        () => [
            {
                label: "• Hoàn thành đúng hạn",
                value: completedOnTimeCount,
                colorClass: "text-green-600",
            },
            {
                label: "• Hoàn thành trễ hạn",
                value: completedLateCount,
                colorClass: "text-yellow-600",
            },
            {
                label: `${(((completedOnTimeCount + completedLateCount) / Math.max(totalSummaryTasks, 1)) * 100).toFixed(1)}% tổng số nhiệm vụ`,
                value: completedOnTimeCount + completedLateCount,
                colorClass: "text-green-700",
            },
        ],
        [completedLateCount, completedOnTimeCount, totalSummaryTasks]
    );

    const inProgressSummaryNoteLines = useMemo<SummaryNoteLine[]>(
        () => [
            {
                label: "• Chờ tiếp nhận",
                value: inProgressAwaitingAcceptanceCount,
                colorClass: "text-green-600",
            },
            {
                label: "• Đã tiếp nhận",
                value: inProgressAcceptanceCount,
                colorClass: "text-yellow-600",
            },
            {
                label: `${((inProgressCount / Math.max(totalSummaryTasks, 1)) * 100).toFixed(1)}% tổng số nhiệm vụ`,
                value: inProgressCount,
                colorClass: "text-amber-700",
            },
        ],
        [inProgressAcceptanceCount, inProgressAwaitingAcceptanceCount, inProgressCount, totalSummaryTasks]
    );

    const overdueSummaryNoteLines = useMemo<SummaryNoteLine[]>(
        () => [
            {
                label: "• Chờ tiếp nhận",
                value: overdueInProgressAwaitingAcceptanceCount,
                colorClass: "text-green-600",
            },
            {
                label: "• Đã tiếp nhận",
                value: overdueInProgressAcceptanceCount,
                colorClass: "text-yellow-600",
            },
            {
                label: `${((overdueInProgressCount / Math.max(totalSummaryTasks, 1)) * 100).toFixed(1)}% tổng số nhiệm vụ`,
                value: overdueInProgressCount,
                colorClass: "text-red-700",
            },
        ],
        [overdueInProgressAcceptanceCount, overdueInProgressAwaitingAcceptanceCount, overdueInProgressCount, totalSummaryTasks]
    );

    const renderOrganizationFilter = (
        title: string,
        value: string[],
        onChange: (nextValue: string[]) => void
    ) => (
        <label className="w-full">
            <span className="mb-1 block text-sm">{title}</span>
            <ConfigProvider theme={organizationTreeSelectTheme}>
                <TreeSelect
                className={controllerSelectClassName}
                treeData={dsDonVi}
                value={value}
                onChange={(nextValue) => onChange(normalizeTreeSelectValues(nextValue as string[]))}
                loading={donViLoading}
                multiple
                size="large"
                allowClear
                showSearch
                maxTagCount="responsive"
                placeholder="Chọn đơn vị"
                />
            </ConfigProvider>
        </label>
    );

    const handleChangeTaskType = (nextTypeTask: 1 | 2) => {
        if (nextTypeTask === typeTask || loading) {
            return;
        }

        setTypeTask(nextTypeTask);

        void fetchDashboard(
            {
                ...dashboardPayload,
                typeTask: nextTypeTask,
            },
            {
                ...organizationWorkloadPayload,
                typeTask: nextTypeTask,
            },
            {
                ...dashboardPayloadTotal,
                typeTask: nextTypeTask,
            }
        );
    };

    const renderTaskTypeTabs = () => (
        <div className="flex overflow-hidden text-center justify-center content-center rounded-md bg-white">
            <button
                type="button"
                onClick={() => handleChangeTaskType(2)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-gray-300 ${
                    typeTask === 2 ? "bg-[#dc2626] text-white" : "border bg-white text-gray-700 hover:bg-gray-50"
                }`}
            >
                Nhiệm vụ được giao
            </button>
            <button
                type="button"
                onClick={() => handleChangeTaskType(1)}
                className={`border-gray-300 px-4 py-2 text-sm font-medium transition-colors ${
                    typeTask === 1 ? "bg-[#dc2626] text-white" : "border bg-white text-gray-700 hover:bg-gray-50"
                }`}
            >
                Nhiệm vụ đã giao
            </button>
        </div>
    );

    const displayedTopDocuments = topDocuments.slice(0, 4);
    const displayedTopParticipationTasks = topParticipationTasks.slice(0, 4);
    const organizationTreeSelectTheme = useMemo(
        () => ({
            token: {
                colorPrimary: "#dc2626",
                colorPrimaryHover: "#dc2626",
                colorPrimaryActive: "#dc2626",
                colorPrimaryBorder: "rgba(220, 38, 38, 0.4)",
                controlOutline: "rgba(220, 38, 38, 0.2)",
                controlOutlineWidth: 2,
            },
            components: {
                Select: {
                    colorPrimary: "#dc2626",
                    colorPrimaryHover: "#dc2626",
                    colorPrimaryBorder: "rgba(220, 38, 38, 0.4)",
                    controlOutline: "rgba(220, 38, 38, 0.2)",
                    activeBorderColor: "#dc2626",
                    hoverBorderColor: "#dc2626",
                },
                TreeSelect: {
                    colorPrimary: "#dc2626",
                    colorPrimaryHover: "#dc2626",
                    colorPrimaryBorder: "rgba(220, 38, 38, 0.4)",
                    controlOutline: "rgba(220, 38, 38, 0.2)",
                    activeBorderColor: "#dc2626",
                    hoverBorderColor: "#dc2626",
                },
            },
        }),
        []
    );

    const mainWorkloadSeries = useMemo(
        () => [
            toNumber(mainWorkloadSummary?.completed),
            toNumber(mainWorkloadSummary?.inProgress),
            toNumber(mainWorkloadSummary?.new),
            toNumber(mainWorkloadSummary?.pending),
            toNumber(mainWorkloadSummary?.rejected),
            toNumber(mainWorkloadSummary?.approved),
        ],
        [mainWorkloadSummary]
    );

    const coordinationWorkloadSeries = useMemo(
        () => [
            toNumber(coordinationWorkloadSummary?.completed),
            toNumber(coordinationWorkloadSummary?.inProgress),
            toNumber(coordinationWorkloadSummary?.new),
            toNumber(coordinationWorkloadSummary?.pending),
            toNumber(coordinationWorkloadSummary?.rejected),
            toNumber(coordinationWorkloadSummary?.approved),
        ],
        [coordinationWorkloadSummary]
    );

    const donutOptions: ApexOptions = useMemo(
        () => ({
            chart: { type: "donut", toolbar: { show: false }, fontFamily: "Outfit, sans-serif" },
            labels: ["Hoàn thành", "Đang xử lý", "Chờ tiếp nhận", "Chờ phê duyệt", "Từ chối", "Phê duyệt"],
            colors: ["#16A34A", "#F59E0B", "#6B7280", "#0EA5E9", "#EF4444", "#8B5CF6"],
            legend: { position: "bottom" },
            dataLabels: { enabled: true },
            plotOptions: {
                pie: {
                    donut: {
                        size: "62%",
                        labels: { show: false },
                    },
                },
            },
            stroke: { colors: ["#FFFFFF"] },
            tooltip: { y: { formatter: (val) => `${val} đơn vị` } },
        }),
        []
    );

    const organizationSeries = useMemo(
        () => [{ name: "Phân công", data: topOrganizations.map((item) => toNumber(item.total_assignments)) }],
        [topOrganizations]
    );

    const totalOrganizationAssignments = useMemo(
        () => topOrganizations.reduce((sum, item) => sum + toNumber(item.total_assignments), 0),
        [topOrganizations]
    );

    const organizationOptions: ApexOptions = useMemo(
        () => ({
            chart: { type: "bar", toolbar: { show: false }, fontFamily: "Outfit, sans-serif" },
            colors: ["#2563EB"],
            plotOptions: { bar: { horizontal: true, borderRadius: 6, barHeight: "56%" } },
            xaxis: {
                categories: topOrganizations.map((item) => truncateLabel(item.name, 255)),
                labels: { style: { colors: "#6B7280", fontSize: "12px" } },
            },
            yaxis: { labels: { style: { colors: "#6B7280", fontSize: "11px" } } },
            grid: { strokeDashArray: 4 },
            dataLabels: {
                enabled: true,
                offsetX: 8,
                style: { fontSize: "11px", fontWeight: 600, colors: ["#1E3A8A"] },
                formatter: (val) => `${Math.round(Number(val) || 0)}`,
            },
            tooltip: { y: { formatter: (val) => `${val} nhiệm vụ` } },
        }),
        [topOrganizations]
    );

    const fieldSeries = useMemo(
        () => [{ name: "Nhiệm vụ", data: topFields.map((item) => toNumber(item.total_tasks)) }],
        [topFields]
    );

    const totalFieldTasks = useMemo(
        () => topFields.reduce((sum, item) => sum + toNumber(item.total_tasks), 0),
        [topFields]
    );

    const featuredDocumentTaskCount = useMemo(() => toNumber(topDocuments[0]?.total_tasks), [topDocuments]);

    const fieldOptions: ApexOptions = useMemo(
        () => ({
            chart: { type: "bar", toolbar: { show: false }, fontFamily: "Outfit, sans-serif" },
            colors: ["#0891B2"],
            plotOptions: { bar: { horizontal: true, borderRadius: 6, barHeight: "56%" } },
            xaxis: {
                categories: topFields.map((item) => truncateLabel(item.name, 255)),
                labels: { style: { colors: "#6B7280", fontSize: "12px" } },
            },
            yaxis: { labels: { style: { colors: "#6B7280", fontSize: "11px" } } },
            grid: { strokeDashArray: 4 },
            dataLabels: {
                enabled: true,
                offsetX: 8,
                style: { fontSize: "11px", fontWeight: 600, colors: ["#155E75"] },
                formatter: (val) => `${Math.round(Number(val) || 0)}`,
            },
            tooltip: { y: { formatter: (val) => `${val} nhiệm vụ` } },
        }),
        [topFields]
    );
    const unitProgressDonutSeries = useMemo(
        () => [
            toNumber(unitProgress?.inProgress),
            toNumber(unitProgress?.upcomingDeadline),
            toNumber(unitProgress?.completedOnTime),
            toNumber(unitProgress?.completedLate),
            toNumber(unitProgress?.overdueInProgress),
        ],
        [unitProgress]
    );

    const unitProgressDonutOptions: ApexOptions = useMemo(
        () => ({
            chart: { type: "donut", toolbar: { show: false }, fontFamily: "Outfit, sans-serif" },
            labels: [
                "Đang thực hiện",
                "Sắp đến hạn",
                "Hoàn thành đúng hạn",
                "Hoàn thành trễ hạn",
                "Đang thực hiện quá hạn",
            ],
            colors: ["#3B82F6", "#F97316", "#22C55E", "#EAB308", "#EF4444"],
            legend: {
                position: "bottom",
                fontSize: "13px",
            },
            stroke: { colors: ["#FFFFFF"] },
            dataLabels: { enabled: false },
            plotOptions: {
                pie: {
                    donut: {
                        size: "62%",
                        labels: {
                            show: true,
                            total: {
                                show: true,
                                label: "Tổng số nhiệm vụ",
                                formatter: () => `${toNumber(unitProgress?.total)}`,
                            },
                            value: {
                                formatter: (value) => `${value}`,
                            },
                        },
                    },
                },
            },
            tooltip: {
                y: {
                    formatter: (val) => `${val} nhiệm vụ`,
                },
            },
        }),
        [unitProgress]
    );
    const unitProgressBarSeries = useMemo(
        () => [
            {
                name: "Số lượng",
                data: [
                    toNumber(unitProgress?.inProgress),
                    toNumber(unitProgress?.upcomingDeadline),
                    toNumber(unitProgress?.completedOnTime),
                    toNumber(unitProgress?.completedLate),
                    toNumber(unitProgress?.overdueInProgress),
                ],
            },
        ],
        [unitProgress]
    );

    const unitProgressBarOptions: ApexOptions = useMemo(
        () => ({
            chart: { type: "bar", toolbar: { show: false }, fontFamily: "Outfit, sans-serif" },
            colors: ["#3B82F6", "#F97316", "#22C55E", "#EAB308", "#EF4444"],
            plotOptions: {
                bar: {
                    borderRadius: 4,
                    distributed: true,
                    columnWidth: "50%",
                },
            },
            dataLabels: {
                enabled: false,
            },
            legend: {
                show: false,
            },
            xaxis: {
                categories: [
                    "Đang thực hiện",
                    "Sắp đến hạn",
                    "Hoàn thành đúng hạn",
                    "Hoàn thành trễ hạn",
                    "Đang thực hiện quá hạn",
                ],
                labels: {
                    style: {
                        fontSize: "12px",
                        colors: "#6B7280",
                    },
                },
            },
            yaxis: {
                title: {
                    text: undefined,
                },
                labels: {
                    style: {
                        colors: "#6B7280",
                    },
                },
            },
            grid: {
                strokeDashArray: 4,
            },
            tooltip: {
                y: {
                    formatter: (val) => `${val} nhiệm vụ`,
                },
            },
        }),
        []
    );
    const timelineSeries = useMemo(
        () => [
            {
                name: "Tổng số",
                data: timelineStats.map((item) => toNumber(item.total)),
            },
            {
                name: "Hoàn thành đúng hạn",
                data: timelineStats.map((item) => toNumber(item.completedOnTime)),
            },
            {
                name: "Hoàn thành trễ hạn",
                data: timelineStats.map((item) => toNumber(item.completedLate)),
            },
            {
                name: "Chưa hoàn thành",
                data: timelineStats.map((item) => toNumber(item.incomplete)),
            },
        ],
        [timelineStats]
    );

    const timelineOptions: ApexOptions = useMemo(
        () => ({
            chart: {
                type: "bar",
                toolbar: { show: false },
                fontFamily: "Outfit, sans-serif",
            },
            colors: ["#3B82F6", "#22C55E", "#EAB308", "#EF4444"],
            plotOptions: {
                bar: {
                    horizontal: false,
                    columnWidth: "40%",
                    borderRadius: 2,
                },
            },
            dataLabels: {
                enabled: false,
            },
            stroke: {
                show: false,
            },
            xaxis: {
                categories: timelineStats.map((item) => String(item.period ?? "--")),
                labels: {
                    style: {
                        fontSize: "12px",
                        colors: "#6B7280",
                    },
                },
            },
            yaxis: {
                min: 0,
                forceNiceScale: true,
                labels: {
                    style: {
                        colors: "#6B7280",
                    },
                },
            },
            legend: {
                position: "bottom",
                fontSize: "14px",
            },
            grid: {
                strokeDashArray: 4,
            },
            tooltip: {
                shared: true,
                intersect: false,
            },
        }),
        [timelineStats]
    );
    return (
        <div className="space-y-4">
            <TitleSpace title={'Tổng quan hệ thống theo dõi nhiệm vụ'}
                description={'Dashboard rút gọn tập trung vào khối lượng xử lý chính, khối lượng phối hợp xử lý, điểm tập trung theo đơn vị, lĩnh vực, văn bản và các nhiệm vụ có nhiều đơn vị tham gia nhất.'} />

            <FilterSpace
                headerContent={renderTaskTypeTabs()}
                actionsPosition="bottom-center"
                actions={
                    <>
                        <ActionButton
                            type="statistics"
                            onClick={() => void fetchDashboard(dashboardPayload, organizationWorkloadPayload, dashboardPayloadTotal)}
                            disabled={loading}
                            loading={loading}
                        />
                        <ActionButton type="refresh" onClick={handleResetFilters} disabled={loading} className="ml-3" />

                    </>
                }
            >
                <AppDatePicker title="Từ ngày" value={fromDate} onChange={setFromDate} placeholder="Chọn ngày" />
                <AppDatePicker title="Đến ngày" value={toDate} onChange={setToDate} placeholder="Chọn ngày" />
                {renderOrganizationFilter("Đơn vị đã giao", selectedOrg, setSelectedOrg)}
                {renderOrganizationFilter("Đơn vị được giao", assignedOrg, setAssignedOrg)}
                <FieldSelect
                    multiple
                    includeAllOption
                    allOptionLabel="Tất cả"
                    allOptionValue=""
                    title="Lĩnh vực"
                    value={linhVuc}
                    onChange={setLinhVuc}
                    extraOptions={linhVucOptions.filter((item) => item.value)}
                />
                <DocumentSelect
                    multiple
                    includeAllOption
                    allOptionLabel="Tất cả"
                    allOptionValue=""
                    title="Văn bản"
                    value={vanBan}
                    onChange={setVanBan}
                    extraOptions={vanBanOptions.filter((item) => item.value)}
                />
                <DocumentTypeSelect
                    multiple
                    includeAllOption
                    allOptionLabel="Tất cả"
                    allOptionValue=""
                    title="Loại văn bản"
                    value={loaiVanBan}
                    onChange={setLoaiVanBan}
                />
            </FilterSpace>
            {error ? <p className="rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-700">{error}</p> : null}

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <SummaryCard
                    title="Tổng số nhiệm vụ"
                    subTitle="Toàn bộ nhiệm vụ hiện có"
                    totalLabel="nhiệm vụ"
                    totalValue={totalSummaryTasks}
                    iconBg="bg-blue-100 text-blue-700"
                    iconSrc={Task}
                    totalColor="text-blue-700"
                    bgClass="bg-blue-50"
                />

                <SummaryCard
                    title="Đã hoàn thành"
                    subTitle="Nhiệm vụ đã kết thúc"
                    totalLabel="nhiệm vụ"
                    totalValue={completedOnTimeCount + completedLateCount}
                    iconBg="bg-green-100 text-green-700"
                    iconSrc={Healthy}
                    totalColor="text-green-700"
                    bgClass="bg-green-50"
                    noteLines={completedSummaryNoteLines}
                />

                <SummaryCard
                    title="Đang thực hiện"
                    subTitle="Nhiệm vụ đang xử lý"
                    totalLabel="nhiệm vụ"
                    totalValue={inProgressCount}
                    iconBg="bg-amber-100 text-amber-700"
                    iconSrc={WorkProcess}
                    totalColor="text-amber-700"
                    bgClass="bg-amber-50"
                    noteLines={inProgressSummaryNoteLines}
                />

                <SummaryCard
                    title="Đang thực hiện quá hạn"
                    subTitle="Cần xử lý gấp"
                    totalLabel="nhiệm vụ"
                    totalValue={overdueInProgressCount}
                    iconBg="bg-red-100 text-red-700"
                    iconSrc={Warning}
                    totalColor="text-red-700"
                    bgClass="bg-red-50"
                    noteLines={overdueSummaryNoteLines}
                />
            </section>
            <section className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm dark:border-brand-900/40 dark:bg-white/3">
                    <div className="mb-4 text-center">
                        <h3 className="text-2xl font-semibold text-gray-800 dark:text-white/90">Đơn vị của tôi</h3>
                        <p className="mt-2 text-base text-gray-500 dark:text-gray-400">Phân bố nhiệm vụ theo trạng thái</p>
                    </div>

                    <div className="min-h-80">
                        {loading ? (
                            <div className="h-80 w-full rounded-xl bg-gray-100 motion-safe:animate-pulse dark:bg-white/10" />
                        ) : (
                            <Chart options={unitProgressDonutOptions} series={unitProgressDonutSeries} type="donut" height={360} />
                        )}
                    </div>
                </div>

                <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm dark:border-brand-900/40 dark:bg-white/3">
                    <div className="mb-4 text-center">
                        <h3 className="text-2xl font-semibold text-gray-800 dark:text-white/90">Biểu đồ tiến độ nhiệm vụ đơn vị</h3>
                        <p className="mt-2 text-base text-gray-500 dark:text-gray-400">Số lượng nhiệm vụ theo trạng thái</p>
                    </div>

                    <div className="min-h-80">
                        {loading ? (
                            <div className="h-80 w-full rounded-xl bg-gray-100 motion-safe:animate-pulse dark:bg-white/10" />
                        ) : (
                            <Chart options={unitProgressBarOptions} series={unitProgressBarSeries} type="bar" height={360} />
                        )}
                    </div>
                </div>
            </section>
            <section>
                <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm dark:border-brand-900/40 dark:bg-white/3">
                    <div className="mb-4 text-center">
                        <h3 className="text-2xl font-semibold text-gray-800 dark:text-white/90">Biểu đồ thống kê theo mốc thời gian</h3>
                    </div>

                    <div className="min-h-96">
                        {loading ? (
                            <div className="h-96 w-full rounded-xl bg-gray-100 motion-safe:animate-pulse dark:bg-white/10" />
                        ) : (
                            <Chart options={timelineOptions} series={timelineSeries} type="bar" height={360} />
                        )}
                    </div>
                </div>
            </section>
            <section className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm dark:border-brand-900/40 dark:bg-white/3">
                    <div className="mb-4 flex items-start justify-between">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">Khối lượng xử lý chính</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Tổng số nhiệm vụ thực tế: {loading ? "..." : `${toNumber(mainWorkloadSummary?.totalActual)} nhiệm vụ`}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Tổng số đơn vị tiếp nhận thực tế: {loading ? "..." : `${toNumber(mainWorkloadSummary?.totalOrganizations)} đơn vị`}</p>
                        </div>
                        <span className="rounded-full bg-blue-light-50 px-3 py-1 text-xs font-semibold text-blue-light-700 dark:bg-blue-light-500/20 dark:text-blue-light-200">
                            Tổng: {loading ? "..." : `${toNumber(mainWorkloadSummary?.total)} đơn vị tiếp nhận`}
                        </span>

                    </div>
                    <div className="min-h-80">
                        {loading ? (
                            <div className="h-80 w-full rounded-xl bg-gray-100 motion-safe:animate-pulse dark:bg-white/10" />
                        ) : (
                            <Chart options={donutOptions} series={mainWorkloadSeries} type="donut" height={320} />
                        )}
                    </div>
                </div>

                <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm dark:border-brand-900/40 dark:bg-white/3">
                    <div className="mb-4 flex items-start justify-between">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">Khối lượng phối hợp xử lý</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Tổng số nhiệm vụ thực tế: {loading ? "..." : `${toNumber(coordinationWorkloadSummary?.totalActual)} nhiệm vụ`}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Tổng số đơn vị tiếp nhận thực tế: {loading ? "..." : `${toNumber(coordinationWorkloadSummary?.totalOrganizations)} đơn vị`}</p>
                        </div>
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
                            Tổng: {loading ? "..." : `${toNumber(coordinationWorkloadSummary?.total)} đơn vị tiếp nhận`}
                        </span>
                    </div>
                    <div className="min-h-80">
                        {loading ? (
                            <div className="h-80 w-full rounded-xl bg-gray-100 motion-safe:animate-pulse dark:bg-white/10" />
                        ) : (
                            <Chart options={donutOptions} series={coordinationWorkloadSeries} type="donut" height={320} />
                        )}
                    </div>
                </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm dark:border-brand-900/40 dark:bg-white/3">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">Top {DASHBOARD_TOP_LIMIT} đơn vị theo tổng số phân công</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Tổng cộng: {loading ? "..." : `${totalOrganizationAssignments} phân công`}</p>
                        </div>
                    </div>
                    <div className="min-h-80">
                        {loading ? (
                            <div className="h-80 w-full rounded-xl bg-gray-100 motion-safe:animate-pulse dark:bg-white/10" />
                        ) : topOrganizations.length > 0 ? (
                            <Chart options={organizationOptions} series={organizationSeries} type="bar" height={320} />
                        ) : (
                            <div className="flex h-80 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-500">Chưa có dữ liệu đơn vị.</div>
                        )}
                    </div>
                </div>

                <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm dark:border-brand-900/40 dark:bg-white/3">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">Top {DASHBOARD_TOP_LIMIT} lĩnh vực theo số nhiệm vụ</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Tổng cộng: {loading ? "..." : `${totalFieldTasks} nhiệm vụ`}</p>
                        </div>
                        <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-200">
                            {loading ? "..." : `${topFields.length} lĩnh vực`}
                        </span>
                    </div>
                    <div className="min-h-80">
                        {loading ? (
                            <div className="h-80 w-full rounded-xl bg-gray-100 motion-safe:animate-pulse dark:bg-white/10" />
                        ) : topFields.length > 0 ? (
                            <Chart options={fieldOptions} series={fieldSeries} type="bar" height={320} />
                        ) : (
                            <div className="flex h-80 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-500">Chưa có dữ liệu lĩnh vực.</div>
                        )}
                    </div>
                </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm dark:border-brand-900/40 dark:bg-white/3">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">Top {DASHBOARD_TOP_LIMIT} văn bản tạo nhiều nhiệm vụ nhất</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Văn bản đứng đầu hiện có: {loading ? "..." : `${featuredDocumentTaskCount} nhiệm vụ`}</p>
                        </div>
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
                            {loading ? "..." : `${topDocuments.length} văn bản`}
                        </span>
                    </div>
                    <div className="space-y-3">
                        {(loading ? Array.from({ length: 4 }, (): DashboardDocumentRow => ({})) : displayedTopDocuments).map((item, index) => (
                            <div key={loading ? `top-doc-${index}` : String(item.uuid ?? index)} className="rounded-xl border border-gray-100 bg-gray-50/70 p-3 dark:border-white/10 dark:bg-white/2">
                                {loading ? (
                                    <div className="h-14 rounded-lg bg-gray-100 motion-safe:animate-pulse dark:bg-white/10" />
                                ) : (
                                    <>
                                        <p className="text-sm font-semibold text-gray-800 dark:text-white/90">{truncateLabel(item.title, 150)}</p>
                                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                                            <span>{toNumber(item.total_tasks)} nhiệm vụ</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm dark:border-brand-900/40 dark:bg-white/3">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">Top {DASHBOARD_TOP_LIMIT} nhiệm vụ có nhiều đơn vị tham gia xử lý và phối hợp nhất</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Hiện có {loading ? "..." : `${topParticipationTasks.length} nhiệm vụ`} phù hợp điều kiện lọc</p>
                        </div>
                        <span className="rounded-full bg-blue-light-50 px-3 py-1 text-xs text-blue-light-700 dark:bg-blue-light-500/20 dark:text-blue-light-200">
                            {loading ? "..." : `${topParticipationTasks.length} nhiệm vụ`}
                        </span>
                    </div>
                    <div className="space-y-3">
                        {(loading ? Array.from({ length: 4 }, (): DashboardParticipationTaskRow => ({})) : displayedTopParticipationTasks).map((item, index) => (
                            <div key={loading ? `participant-task-${index}` : String(item.uuid ?? index)} className="rounded-xl border border-gray-100 bg-gray-50/70 p-3 dark:border-white/10 dark:bg-white/2">
                                {loading ? (
                                    <div className="h-14 rounded-lg bg-gray-100 motion-safe:animate-pulse dark:bg-white/10" />
                                ) : (
                                    <>
                                        <p className="text-sm font-semibold text-gray-800 dark:text-white/90">{truncateLabel(item.title, 150)}</p>
                                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                                            <span>{toNumber(item.total_units)} đơn vị tham gia</span>
                                            <span>{toNumber(item.total_main_units)} xử lý chính</span>
                                            <span>{toNumber(item.total_coordination_units)} phối hợp</span>
                                            {item.document_title ? <span>{truncateLabel(item.document_title, 100)}</span> : null}
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}



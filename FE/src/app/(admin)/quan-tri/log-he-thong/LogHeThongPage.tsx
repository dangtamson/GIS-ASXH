"use client";

import {api, ApiError} from "@/lib/api";
import {endpoints} from "@/lib/endpoints";
import {App} from "antd";
import {useCallback, useEffect, useMemo, useState} from "react";
import {ActionButton, AppDatePicker, AppInput, AppSelect, TitleSpace} from "@/components/controller";

type AuditLogRecord = {
    auditLog?: {
        uuid?: string;
        action?: string;
        entityType?: string;
        entityId?: string;
        details?: Record<string, unknown> | null;
        ipAddress?: string;
        userAgent?: string;
        workspaceId?: string;
        createdAt?: string;
    };
    actor?: {
        uuid?: string;
        email?: string;
        fullName?: string;
    };
    workspace?: {
        uuid?: string;
        name?: string;
    };
};

type AuditLogsResponse = {
    auditLogs?: AuditLogRecord[];
    pagination?: {
        page?: number;
        limit?: number;
        total?: number;
        pages?: number;
    };
};

type StatItem = {
    action?: string;
    entityType?: string;
    count?: number;
};

type TopActorItem = {
    actorId?: string;
    actorEmail?: string;
    count?: number;
};

type DailyActivityItem = {
    date?: string;
    count?: number;
};

type AuditStatsResponse = {
    period?: string;
    actionStats?: StatItem[];
    entityTypeStats?: StatItem[];
    topActors?: TopActorItem[];
    dailyActivity?: DailyActivityItem[];
};

const cardClass =
    "rounded-2xl border border-red-200/70 bg-white/95 p-5 shadow-sm dark:border-red-900/50 dark:bg-gray-900";

const inputClass =
    "w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:border-red-900/50 dark:bg-gray-900 dark:text-gray-100";

function toDateText(value?: string): string {
    if (!value) {
        return "-";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString("vi-VN");
}

function toCount(value?: string | number): number {
    if(Number.isNaN(value)) {
        return 0;
    }

    return value ? Number(value) : 0;
}

export default function LogHeThongPage() {
    const { notification } = App.useApp();
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [loadingStats, setLoadingStats] = useState(false);

    const [actionFilter, setActionFilter] = useState("");
    const [entityTypeFilter, setEntityTypeFilter] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const [days, setDays] = useState(30);
    const [statsKeyword, setStatsKeyword] = useState("");

    const [page, setPage] = useState(1);
    const [limit] = useState(20);
    const [totalPages, setTotalPages] = useState(1);
    const [totalLogs, setTotalLogs] = useState(0);

    const [logs, setLogs] = useState<AuditLogRecord[]>([]);
    const [stats, setStats] = useState<AuditStatsResponse>({});

    const loadLogs = useCallback(async () => {
        setLoadingLogs(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: String(limit),
            });

            if (actionFilter.trim()) {
                params.set("action", actionFilter.trim());
            }
            if (entityTypeFilter.trim()) {
                params.set("entityType", entityTypeFilter.trim());
            }
            if (startDate) {
                params.set("startDate", new Date(startDate).toISOString());
            }
            if (endDate) {
                const endDateTime = new Date(`${endDate}T23:59:59.999`);
                params.set("endDate", endDateTime.toISOString());
            }

            const data = await api.get<AuditLogsResponse>(`${endpoints.admin.auditLogs}?${params.toString()}`);
            const list = Array.isArray(data.auditLogs) ? data.auditLogs : [];
            const pagination = data.pagination || {};

            setLogs(list);
            setTotalPages(Math.max(1, Number(pagination.pages) || 1));
            setTotalLogs(Number(pagination.total) || 0);
        } catch (err) {
            if (err instanceof ApiError) {
                notification.error({ message: "Lỗi", description: err.message });
            } else {
                notification.error({ message: "Lỗi", description: "Không thể tải lịch sử log hệ thống." });
            }
            setLogs([]);
            setTotalPages(1);
            setTotalLogs(0);
        } finally {
            setLoadingLogs(false);
        }
    }, [actionFilter, endDate, limit, notification, page, startDate, entityTypeFilter]);

    const loadStats = useCallback(async () => {
        setLoadingStats(true);
        try {
            const data = await api.get<AuditStatsResponse>(`${endpoints.admin.auditLogStats}?days=${days}`);
            setStats(data || {});
        } catch (err) {
            if (err instanceof ApiError) {
                notification.error({ message: "Lỗi", description: err.message });
            } else {
                notification.error({ message: "Lỗi", description: "Không thể tải thống kê log hệ thống." });
            }
            setStats({});
        } finally {
            setLoadingStats(false);
        }
    }, [days, notification]);

    useEffect(() => {
        void loadLogs();
    }, [loadLogs]);

    useEffect(() => {
        void loadStats();
    }, [loadStats]);

    const totalEventsInPeriod = useMemo(() => {
        const actionStats = Array.isArray(stats.actionStats) ? stats.actionStats : [];
        return actionStats.reduce((sum, item) => sum + toCount(item.count), 0);
    }, [stats.actionStats]);

    const filteredActionStats = useMemo(() => {
        const keyword = statsKeyword.trim().toLowerCase();
        const source = Array.isArray(stats.actionStats) ? stats.actionStats : [];

        if (!keyword) {
            return source;
        }

        return source.filter((item) => String(item.action || "").toLowerCase().includes(keyword));
    }, [stats.actionStats, statsKeyword]);

    const filteredEntityStats = useMemo(() => {
        const keyword = statsKeyword.trim().toLowerCase();
        const source = Array.isArray(stats.entityTypeStats) ? stats.entityTypeStats : [];

        if (!keyword) {
            return source;
        }

        return source.filter((item) => String(item.entityType || "").toLowerCase().includes(keyword));
    }, [stats.entityTypeStats, statsKeyword]);

    return (
        <div className="space-y-5">
            <TitleSpace title={'Nhật ký hệ thống'} actions={<ActionButton type={'refresh'} onClick={() => {
                void loadLogs();
                void loadStats();
            }} disabled={loadingLogs || loadingStats}/>} />

            <div className={cardClass}>
                <div className="mb-4 flex flex-wrap items-end gap-3">
                    <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                        <AppSelect options={[{
                            value: '7',
                            label:'7 ngày'
                        }, {
                            value: '30',
                            label:'30 ngày'
                        }, {
                            value: '90',
                            label:'90 ngày'
                        }]} title={'Khoảng thống kê'} placeholder={'Chọn khoản thống kê'} value={String(days)} onChange={(e) => setDays(Number(e || 30))}/>

                    </div>

                    <div className="min-w-64 flex-1 space-y-1">
                        <AppInput title={'Tìm trong thống kê'} value={statsKeyword}
                                  onChange={(e) => setStatsKeyword(e)}
                                  placeholder="Tìm theo action hoặc entity type"/>
                    </div>
                </div>

                <div className="mb-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-red-200/70 bg-red-50/40 p-4 dark:border-red-900/40 dark:bg-red-900/10">
                        <div className="text-sm text-gray-600 dark:text-gray-400">Tổng sự kiện ({stats.period || "khoảng chọn"})</div>
                        <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{totalEventsInPeriod}</div>
                    </div>
                    <div className="rounded-xl border border-red-200/70 bg-red-50/40 p-4 dark:border-red-900/40 dark:bg-red-900/10">
                        <div className="text-sm text-gray-600 dark:text-gray-400">Số loại action</div>
                        <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{filteredActionStats.length}</div>
                    </div>
                    <div className="rounded-xl border border-red-200/70 bg-red-50/40 p-4 dark:border-red-900/40 dark:bg-red-900/10">
                        <div className="text-sm text-gray-600 dark:text-gray-400">Số entity type</div>
                        <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{filteredEntityStats.length}</div>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-red-200/70 p-3 dark:border-red-900/40">
                        <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Top Action</h3>
                        <div className="max-h-64 space-y-2 overflow-auto">
                            {loadingStats ? (
                                <p className="text-sm text-gray-500">Đang tải...</p>
                            ) : filteredActionStats.length === 0 ? (
                                <p className="text-sm text-gray-500">Không có dữ liệu.</p>
                            ) : (
                                filteredActionStats.map((item) => (
                                    <div key={String(item.action || "unknown")} className="flex items-center justify-between text-sm">
                                        <span className="text-gray-700 dark:text-gray-300">{item.action || "-"}</span>
                                        <span className="font-medium text-gray-900 dark:text-gray-100">{toCount(item.count)}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="rounded-xl border border-red-200/70 p-3 dark:border-red-900/40">
                        <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Top Entity Type</h3>
                        <div className="max-h-64 space-y-2 overflow-auto">
                            {loadingStats ? (
                                <p className="text-sm text-gray-500">Đang tải...</p>
                            ) : filteredEntityStats.length === 0 ? (
                                <p className="text-sm text-gray-500">Không có dữ liệu.</p>
                            ) : (
                                filteredEntityStats.map((item) => (
                                    <div key={String(item.entityType || "unknown")} className="flex items-center justify-between text-sm">
                                        <span className="text-gray-700 dark:text-gray-300">{item.entityType || "-"}</span>
                                        <span className="font-medium text-gray-900 dark:text-gray-100">{toCount(item.count)}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className={cardClass}>
                <div className="mb-4 grid gap-3 md:grid-cols-4">
                    <AppInput title={'Action'}    value={actionFilter}
                              onChange={(e) => {
                                  setPage(1);
                                  setActionFilter(e);
                              }}
                              placeholder="VD: account.create"/>
                    <AppInput
                        title={'Entity Type'}
                        value={entityTypeFilter}
                        onChange={(e) => {
                            setPage(1);
                            setEntityTypeFilter(e);
                        }}
                        placeholder="VD: account"
                    />

                    <AppDatePicker
                        title={'Từ ngày'}
                        value={startDate}
                        onChange={(e) => {
                            setStartDate(e);
                        }}
                    />
                    <AppDatePicker
                        title={'Đến ngày'}
                        value={endDate}
                        onChange={(e) => {
                            setEndDate(e);
                        }}
                    />


                </div>

                <div className="mb-3 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>Tổng log: {totalLogs}</span>
                    <span>Trang {page}/{totalPages}</span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-red-200/70 ">
                    <table className="min-w-full divide-y divide-red-200/70 text-sm ">
                        <thead className="bg-[#d4a574] ">
                            <tr>
                                <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Thời gian</th>
                                <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Action</th>
                                <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Entity</th>
                                <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Người thao tác</th>
                                <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Workspace</th>
                                <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">IP</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-red-100 dark:divide-red-900/20">
                            {loadingLogs ? (
                                <tr>
                                    <td className="px-3 py-4 text-gray-500" colSpan={6}>Đang tải dữ liệu...</td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td className="px-3 py-4 text-gray-500" colSpan={6}>Không có log phù hợp.</td>
                                </tr>
                            ) : (
                                logs.map((row) => {
                                    const id = row.auditLog?.uuid || `${row.auditLog?.createdAt || ""}-${row.auditLog?.action || ""}`;
                                    return (
                                        <tr key={id} className="bg-white dark:bg-gray-900">
                                            <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{toDateText(row.auditLog?.createdAt)}</td>
                                            <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{row.auditLog?.action || "-"}</td>
                                            <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{row.auditLog?.entityType || "-"}</td>
                                            <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{row.actor?.fullName || row.actor?.email || "-"}</td>
                                            <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{row.workspace?.name || row.auditLog?.workspaceId || "-"}</td>
                                            <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{row.auditLog?.ipAddress || "-"}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        disabled={page <= 1 || loadingLogs}
                        onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/40 dark:text-gray-300"
                    >
                        Trước
                    </button>
                    <button
                        type="button"
                        disabled={page >= totalPages || loadingLogs}
                        onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/40 dark:text-gray-300"
                    >
                        Sau
                    </button>
                </div>
            </div>
        </div>
    );
}

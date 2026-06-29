"use client";

import React, {useCallback, useEffect, useMemo, useState} from "react";
import {
    fetchMyNotifications,
    formatNotificationRelativeTime,
    getNotificationMessage,
    getNotificationTitle,
    markAllMyNotificationsRead,
    type NotificationItem
} from "@/lib/notifications";

type ReadFilter = "all" | "unread" | "read";

export default function NotificationsPage() {
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [readFilter, setReadFilter] = useState<ReadFilter>("all");
    const [markingRead, setMarkingRead] = useState(false);

    const isReadValue = useMemo(() => {
        if (readFilter === "unread") {
            return false;
        }

        if (readFilter === "read") {
            return true;
        }

        return undefined;
    }, [readFilter]);

    const loadNotifications = useCallback(async () => {
        setLoading(true);
        setErrorMessage(null);

        try {
            const result = await fetchMyNotifications({
                page,
                limit: 20,
                isRead: isReadValue
            });

            setItems(result.items);
            setPages(Math.max(1, result.pagination.pages));
            setTotal(result.pagination.total);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Không thể tải thông báo";
            setErrorMessage(message);
        } finally {
            setLoading(false);
        }
    }, [isReadValue, page]);

    useEffect(() => {
        void loadNotifications();
    }, [loadNotifications]);

    useEffect(() => {
        setPage(1);
    }, [readFilter]);

    const handleMarkAllRead = async () => {
        if (markingRead) {
            return;
        }

        setMarkingRead(true);
        setErrorMessage(null);

        try {
            await markAllMyNotificationsRead();
            setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
            await loadNotifications();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Không thể đánh dấu đã đọc";
            setErrorMessage(message);
        } finally {
            setMarkingRead(false);
        }
    };

    return (
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-gray-800">Tất cả thông báo</h1>
                    <p className="text-sm text-gray-500">Hiển thị thông báo được gửi tới tài khoản của bạn.</p>
                </div>
                <button
                    type="button"
                    onClick={handleMarkAllRead}
                    disabled={markingRead}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {markingRead ? "Đang cập nhật..." : "Đánh dấu tất cả đã đọc"}
                </button>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => setReadFilter("all")}
                    className={`rounded-full px-3 py-1.5 text-sm ${readFilter === "all"
                            ? "bg-red-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                >
                    Tất cả
                </button>
                <button
                    type="button"
                    onClick={() => setReadFilter("unread")}
                    className={`rounded-full px-3 py-1.5 text-sm ${readFilter === "unread"
                            ? "bg-red-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                >
                    Chưa đọc
                </button>
                <button
                    type="button"
                    onClick={() => setReadFilter("read")}
                    className={`rounded-full px-3 py-1.5 text-sm ${readFilter === "read"
                            ? "bg-red-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                >
                    Đã đọc
                </button>
                <span className="ml-auto text-sm text-gray-500">Tổng: {total}</span>
            </div>

            {loading && <div className="py-8 text-center text-sm text-gray-500">Đang tải dữ liệu...</div>}

            {!loading && errorMessage && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{errorMessage}</div>
            )}

            {!loading && !errorMessage && items.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
                    Không có thông báo phù hợp.
                </div>
            )}

            {!loading && !errorMessage && items.length > 0 && (
                <div className="space-y-2">
                    {items.map((item) => (
                        <article
                            key={item.userNotificationId || item.uuid}
                            className={`rounded-xl border p-4 ${item.isRead === false ? "border-red-200 bg-red-50/40" : "border-gray-200 bg-white"
                                }`}
                        >
                            <div className="mb-1 flex items-start gap-2">
                                <h2 className="text-sm font-semibold text-gray-800 sm:text-base">{getNotificationTitle(item)}</h2>
                                {item.isRead === false && <span className="mt-2 h-2 w-2 rounded-full bg-red-500" />}
                            </div>
                            <p className="text-sm text-gray-600">{getNotificationMessage(item)}</p>
                            <p className="mt-2 text-xs text-gray-400">
                                {formatNotificationRelativeTime(item.created_at || item.deliveredAt)}
                            </p>
                        </article>
                    ))}
                </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
                <button
                    type="button"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page <= 1 || loading}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Trước
                </button>
                <span className="text-sm text-gray-600">
                    Trang {page}/{pages}
                </span>
                <button
                    type="button"
                    onClick={() => setPage((prev) => Math.min(pages, prev + 1))}
                    disabled={page >= pages || loading}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Sau
                </button>
            </div>
        </section>
    );
}

"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import { Spin } from "antd";
import {
  fetchMyNotifications,
  formatNotificationRelativeTime,
  getNotificationMessage,
  getNotificationTaskHref,
  getNotificationTitle,
  markMyNotificationRead,
  markAllMyNotificationsRead,
  type NotificationItem
} from "@/lib/notifications";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";

type NotificationDropdownProps = {
  triggerClassName?: string;
};

export default function NotificationDropdown({
  triggerClassName = "",
}: NotificationDropdownProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const result = await fetchMyNotifications({ page: 1, limit: 1, isRead: false });
      setUnreadCount(result.pagination.total);
    } catch {
      setUnreadCount(0);
    }
  }, []);

  const loadDropdownItems = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await fetchMyNotifications({ page: 1, limit: 8 });
      setItems(result.items);
      const unread = result.items.filter((item) => item.isRead === false).length;
      setUnreadCount(unread);
      await refreshUnreadCount();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể tải thông báo";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [refreshUnreadCount]);

  function toggleDropdown() {
    setIsOpen(!isOpen);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  const handleClick = async () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    if (nextOpen) {
      await loadDropdownItems();
    }
  };

  const handleMarkAllRead = async () => {
    if (isMarkingRead) {
      return;
    }

    setIsMarkingRead(true);
    try {
      await markAllMyNotificationsRead();
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể đánh dấu đã đọc";
      setErrorMessage(message);
    } finally {
      setIsMarkingRead(false);
    }
  };

  const handleNotificationClick = async (item: NotificationItem, taskHref: string | null) => {
    if (!taskHref) {
      closeDropdown();
      return;
    }

    if (item.isRead === false) {
      try {
        await markMyNotificationRead({
          userNotificationId: item.userNotificationId,
          notificationId: item.uuid
        });

        setItems((prev) =>
          prev.map((entry) =>
            (entry.userNotificationId || entry.uuid) === (item.userNotificationId || item.uuid)
              ? { ...entry, isRead: true }
              : entry
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Không thể đánh dấu đã đọc";
        setErrorMessage(message);
      }
    }

    closeDropdown();
    router.push(taskHref);
  };

  useEffect(() => {
    void refreshUnreadCount();
  }, [refreshUnreadCount]);

  return (
    <div className="relative">
      <button
        className={`relative dropdown-toggle flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors ${triggerClassName}`}
        onClick={handleClick}
      >
        <span
          className={`absolute right-0 top-0.5 z-10 h-2 w-2 rounded-full bg-orange-400 ${unreadCount > 0 ? "flex" : "hidden"
            }`}
        >
          <span className="absolute inline-flex w-full h-full bg-orange-400 rounded-full opacity-75 animate-ping"></span>
        </span>
        <svg
          className="fill-current"
          width="25"
          height="25"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M10.75 2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H4.37504H15.625H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248ZM14.875 14.4591V9.16748C14.875 6.47509 12.6924 4.29248 10 4.29248C7.30765 4.29248 5.12504 6.47509 5.12504 9.16748V14.4591H14.875ZM8.00004 17.7085C8.00004 18.1228 8.33583 18.4585 8.75004 18.4585H11.25C11.6643 18.4585 12 18.1228 12 17.7085C12 17.2943 11.6643 16.9585 11.25 16.9585H8.75004C8.33583 16.9585 8.00004 17.2943 8.00004 17.7085Z"
            fill="currentColor"
          />
        </svg>
      </button>
      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute left-0 mt-[17px] flex h-[480px] w-[min(350px,calc(100vw-2rem))] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark sm:w-[361px] lg:left-auto lg:right-0"
      >
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-700">
          <h5 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Thông báo
          </h5>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={isMarkingRead}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:text-gray-400"
              >
                {isMarkingRead ? "Đang cập nhật..." : "Đánh dấu đã đọc"}
              </button>
            )}
            <button
              onClick={toggleDropdown}
              className="text-gray-500 transition dropdown-toggle dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <svg
                className="fill-current"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
        </div>
        <ul className="flex flex-col h-auto overflow-y-auto custom-scrollbar">
          {isLoading && (
            <li className="px-4 py-6 text-center">
              <Spin size="small" />
            </li>
          )}

          {!isLoading && errorMessage && (
            <li className="px-4 py-6 text-sm text-center text-red-500 dark:text-red-400">{errorMessage}</li>
          )}

          {!isLoading && !errorMessage && items.length === 0 && (
            <li className="px-4 py-6 text-sm text-center text-gray-500 dark:text-gray-400">
              Bạn chưa có thông báo nào.
            </li>
          )}

          {!isLoading &&
            !errorMessage &&
            items.map((item) => {
              const taskHref = getNotificationTaskHref(item);

              return (
                <li key={item.userNotificationId || item.uuid}>
                  <DropdownItem
                    tag="button"
                    onClick={() => void handleNotificationClick(item, taskHref)}
                    onItemClick={closeDropdown}
                    className={`flex flex-col gap-1 rounded-lg border-b border-gray-100 p-3 px-4.5 py-3 text-left hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5 ${item.isRead === false ? "bg-red-50/50 dark:bg-red-900/15" : ""
                      }`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="line-clamp-1 text-theme-sm font-medium text-gray-800 dark:text-white/90">
                        {getNotificationTitle(item)}
                      </span>
                      {item.isRead === false && (
                        <span className="mt-1 inline-block h-2 w-2 rounded-full bg-red-500" />
                      )}
                    </span>
                    <span className="line-clamp-2 text-theme-sm text-gray-500 dark:text-gray-400">
                      {getNotificationMessage(item)}
                    </span>
                    <span className="text-theme-xs text-gray-400 dark:text-gray-500">
                      {formatNotificationRelativeTime(item.created_at || item.deliveredAt)}
                    </span>
                  </DropdownItem>
                </li>
              );
            })}
        </ul>
        <Link
          href="/thong-bao"
          onClick={closeDropdown}
          className="block px-4 py-2 mt-3 text-sm font-medium text-center text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          Xem tất cả thông báo
        </Link>
      </Dropdown>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";

/**
 * SessionExpiredHandler: Global component that listens for session expiration (401 errors)
 * and displays a notification to the user before redirecting to login page.
 * Also manages automatic session timeout based on idle time and max session duration.
 */
export default function SessionExpiredHandler() {
    const [showNotification, setShowNotification] = useState(false);

    // Use session timeout hook to manage idle and max session timeouts
    useSessionTimeout();

    useEffect(() => {
        // Listen for sessionExpired event from api.ts
        const handleSessionExpired = () => {
            setShowNotification(true);
        };

        // Listen for storage changes from other tabs
        const handleStorageChange = (e: StorageEvent) => {
            if (
                (e.key === "tdnv_token" || e.key === "tdnv_account") &&
                e.newValue === null
            ) {
                // Token was cleared - session expired
                setShowNotification(true);
            }
        };

        window.addEventListener("sessionExpired", handleSessionExpired);
        window.addEventListener("storage", handleStorageChange);

        return () => {
            window.removeEventListener("sessionExpired", handleSessionExpired);
            window.removeEventListener("storage", handleStorageChange);
        };
    }, []);

    if (!showNotification) {
        return null;
    }

    return (
        <div className="fixed bottom-4 right-4 z-50 flex gap-3 rounded-lg border border-error-200 bg-error-50 p-4 shadow-lg dark:border-error-800 dark:bg-error-900/20 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 flex-shrink-0 text-error-600 dark:text-error-400 mt-0.5" />
                <div className="flex-1">
                    <p className="font-semibold text-error-900 dark:text-error-100">
                        Phiên làm việc đã hết hạn
                    </p>
                    <p className="mt-1 text-sm text-error-800 dark:text-error-200">
                        Token xác thực của bạn đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.
                    </p>
                    <p className="mt-2 text-xs text-error-700 dark:text-error-300">
                        Đang chuyển hướng đến trang đăng nhập...
                    </p>
                </div>
                <button
                    onClick={() => setShowNotification(false)}
                    className="flex-shrink-0 text-error-400 hover:text-error-600 dark:hover:text-error-300 transition"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}

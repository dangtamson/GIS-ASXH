"use client";

import { notification } from "antd";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ActionButton, ActionModal, AppInput } from "@/components/controller";
import Label from "@/components/form/Label";
import { api, ApiError } from "@/lib/api";
import { clearSession } from "@/lib/auth";
import { endpoints } from "@/lib/endpoints";

type ChangePasswordPopupProps = {
    open: boolean;
    onClose: () => void;
};

type SecurityPolicy = {
    minPasswordLength: number;
    maxPasswordLength: number;
    requireLowercase: boolean;
    requireUppercase: boolean;
    requireNumber: boolean;
    requireSpecialChar: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    return value as Record<string, unknown>;
}

function normalizeBoolean(value: unknown): boolean {
    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "number") {
        return value === 1;
    }

    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        return normalized === "true" || normalized === "1";
    }

    return false;
}

function normalizeNumber(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function extractSecurityPolicy(payload: unknown): SecurityPolicy | null {
    const root = asRecord(payload);
    const item = asRecord(root?.item);
    const policy = asRecord(item?.securityPolicy);

    if (!policy) {
        return null;
    }

    return {
        minPasswordLength: normalizeNumber(policy.minPasswordLength, 8),
        maxPasswordLength: normalizeNumber(policy.maxPasswordLength, 15),
        requireLowercase: normalizeBoolean(policy.requireLowercase),
        requireUppercase: normalizeBoolean(policy.requireUppercase),
        requireNumber: normalizeBoolean(policy.requireNumber),
        requireSpecialChar: normalizeBoolean(policy.requireSpecialChar),
    };
}

function validatePassword(password: string, policy: SecurityPolicy | null): string | null {
    if (!policy) return null;
    if (password.length < policy.minPasswordLength) return `Mật khẩu phải có ít nhất ${policy.minPasswordLength} ký tự.`;
    if (password.length > policy.maxPasswordLength) return `Mật khẩu không được vượt quá ${policy.maxPasswordLength} ký tự.`;
    if (policy.requireLowercase && !/[a-z]/.test(password)) return "Mật khẩu phải chứa ít nhất một chữ cái thường.";
    if (policy.requireUppercase && !/[A-Z]/.test(password)) return "Mật khẩu phải chứa ít nhất một chữ cái hoa.";
    if (policy.requireNumber && !/\d/.test(password)) return "Mật khẩu phải chứa ít nhất một số.";
    if (policy.requireSpecialChar && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        return "Mật khẩu phải chứa ít nhất một ký tự đặc biệt.";
    }
    return null;
}

async function fetchSecurityPolicy(): Promise<SecurityPolicy | null> {
    const response = await api.get<unknown>(endpoints.admin.systemConfig);
    return extractSecurityPolicy(response);
}

function resolveChangePasswordErrorMessage(err: unknown): string {
    const rawMessage =
        err instanceof ApiError || err instanceof Error
            ? err.message.trim()
            : "";

    if (err instanceof ApiError && err.status === 400) {
        return "Mật khẩu hiện tại không chính xác";
    }

    if (!rawMessage) {
        return "Có lỗi xảy ra. Vui lòng thử lại.";
    }

    if (rawMessage === "Failed to update password") {
        return "Không thể cập nhật mật khẩu trên hệ thống xác thực. Vui lòng liên hệ quản trị viên.";
    }

    if (
        rawMessage === "Failed to fetch" ||
        rawMessage === "Load failed" ||
        /network/i.test(rawMessage)
    ) {
        return "Không thể kết nối tới máy chủ. Vui lòng thử lại.";
    }

    return rawMessage;
}

export default function ChangePasswordPopup({
    open,
    onClose,
}: ChangePasswordPopupProps) {
    const router = useRouter();
    const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [securityPolicy, setSecurityPolicy] = useState<SecurityPolicy | null>(null);

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [currentPasswordError, setCurrentPasswordError] = useState<string | null>(null);
    const [newPasswordError, setNewPasswordError] = useState<string | null>(null);
    const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);

    const resetForm = () => {
        setLoading(false);
        setError(null);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setCurrentPasswordError(null);
        setNewPasswordError(null);
        setConfirmPasswordError(null);
    };

    useEffect(() => {
        resetForm();
    }, [open]);

    useEffect(() => {
        if (!open) {
            return;
        }

        let cancelled = false;

        const loadSecurityPolicy = async () => {
            try {
                const nextPolicy = await fetchSecurityPolicy();
                if (!cancelled) {
                    setSecurityPolicy(nextPolicy);
                }
            } catch {
                if (!cancelled) {
                    setSecurityPolicy(null);
                }
            }
        };

        void loadSecurityPolicy();

        return () => {
            cancelled = true;
        };
    }, [open]);

    useEffect(() => {
        return () => {
            if (redirectTimeoutRef.current) {
                clearTimeout(redirectTimeoutRef.current);
            }
        };
    }, []);

    const validatePasswords = (policy: SecurityPolicy | null): boolean => {
        let isValid = true;

        if (!currentPassword.trim()) {
            setCurrentPasswordError("Vui lòng nhập mật khẩu hiện tại");
            isValid = false;
        } else {
            setCurrentPasswordError(null);
        }

        if (!newPassword.trim()) {
            setNewPasswordError("Vui lòng nhập mật khẩu mới");
            isValid = false;
        } else if (currentPassword && currentPassword === newPassword) {
            setNewPasswordError("Mật khẩu mới không được trùng với mật khẩu hiện tại");
            isValid = false;
        } else {
            const passwordError = validatePassword(newPassword, policy);
            if (passwordError) {
                setNewPasswordError(passwordError);
                isValid = false;
            } else {
                setNewPasswordError(null);
            }
        }

        if (!confirmPassword.trim()) {
            setConfirmPasswordError("Vui lòng xác nhận mật khẩu mới");
            isValid = false;
        } else if (newPassword !== confirmPassword) {
            setConfirmPasswordError("Xác nhận mật khẩu không khớp");
            isValid = false;
        } else {
            setConfirmPasswordError(null);
        }

        return isValid;
    };

    const handleClose = () => {
        if (loading) return;
        resetForm();
        onClose();
    };

    const handleSubmit = async () => {
        setError(null);
        setLoading(true);

        try {
            const resolvedPolicy = securityPolicy ?? await fetchSecurityPolicy();
            setSecurityPolicy(resolvedPolicy);

            if (!validatePasswords(resolvedPolicy)) {
                return;
            }

            await api.post(endpoints.auth.changePassword || "/api/auth/change-password", {
                currentPassword,
                newPassword,
            });

            notification.success({
                title: "Thành công",
                description: "Đổi mật khẩu thành công",
            });

            notification.info({
                title: "Thông báo",
                description: "Chuyển sang trang đăng nhập sau vài giây.",
                duration: 2,
            });

            resetForm();
            onClose();

            redirectTimeoutRef.current = setTimeout(() => {
                clearSession();
                router.replace("/signin");
            }, 2000);
        } catch (err) {
            const errorMessage = resolveChangePasswordErrorMessage(err);

            if (errorMessage === "Mật khẩu hiện tại không chính xác") {
                notification.error({
                    title: "Lỗi",
                    description: errorMessage,
                });
                return;
            }

            if (err instanceof Error && errorMessage) {
                setError(errorMessage);
            } else {
                setError("Không thể tải cấu hình chính sách mật khẩu. Vui lòng thử lại.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <ActionModal
            open={open}
            title="Đổi mật khẩu"
            width={640}
            loading={loading}
            spinning={loading}
            onOk={() => void handleSubmit()}
            onCancel={handleClose}
            actions={
                <div className="flex items-center justify-end gap-2">
                    <ActionButton type="close" onClick={handleClose} label="Đóng" disabled={loading} />
                    <ActionButton
                        type="save"
                        onClick={() => void handleSubmit()}
                        label={loading ? "Đang lưu..." : "Lưu"}
                        loading={loading}
                    />
                </div>
            }
        >
            <form className="space-y-5">
                <div>
                    <Label>
                        Mật khẩu hiện tại <span className="text-error-500">*</span>
                    </Label>
                    <AppInput
                        hideTitle
                        type="password"
                        placeholder="Nhập mật khẩu hiện tại"
                        value={currentPassword}
                        disabled={loading}
                        onChange={(value) => {
                            setCurrentPassword(value);
                            if (currentPasswordError) setCurrentPasswordError(null);
                        }}
                    />
                    {currentPasswordError ? (
                        <p className="mt-1 text-xs text-error-600">{currentPasswordError}</p>
                    ) : null}
                </div>

                <div>
                    <Label>
                        Mật khẩu mới <span className="text-error-500">*</span>
                    </Label>
                    <AppInput
                        hideTitle
                        type="password"
                        placeholder="Nhập mật khẩu mới"
                        value={newPassword}
                        disabled={loading}
                        onChange={(value) => {
                            setNewPassword(value);
                            if (newPasswordError) setNewPasswordError(null);
                        }}
                    />
                    {newPasswordError ? (
                        <p className="mt-1 text-xs text-error-600">{newPasswordError}</p>
                    ) : null}
                </div>

                <div>
                    <Label>
                        Xác nhận mật khẩu mới <span className="text-error-500">*</span>
                    </Label>
                    <AppInput
                        hideTitle
                        type="password"
                        placeholder="Xác nhận mật khẩu mới"
                        value={confirmPassword}
                        disabled={loading}
                        onChange={(value) => {
                            setConfirmPassword(value);
                            if (confirmPasswordError) setConfirmPasswordError(null);
                        }}
                    />
                    {confirmPasswordError ? (
                        <p className="mt-1 text-xs text-error-600">{confirmPasswordError}</p>
                    ) : null}
                </div>

                {error ? <p className="text-sm text-error-600">{error}</p> : null}
            </form>
        </ActionModal>
    );
}

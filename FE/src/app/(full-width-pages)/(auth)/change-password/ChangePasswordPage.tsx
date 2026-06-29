"use client";

import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import {api, ApiError} from "@/lib/api";
import type {Account} from "@/lib/auth";
import {
    getAccount,
    hydrateSessionFromProfile,
    resolveOrganizationIdFromAuthPayload,
    resolveWorkspaceIdFromMePayload,
    setSession
} from "@/lib/auth";
import {endpoints} from "@/lib/endpoints";
import {EyeCloseIcon, EyeIcon} from "@/icons";
import {useRouter, useSearchParams} from "next/navigation";
import React, {FormEvent, useEffect, useRef, useState} from "react";

type SecurityPolicy = {
    minPasswordLength: number;
    maxPasswordLength: number;
    requireLowercase: boolean;
    requireUppercase: boolean;
    requireNumber: boolean;
    requireSpecialChar: boolean;
};

type AuthResponse = {
    token?: string;
    account?: Account;
    workspaces?: unknown[];
    workspaceId?: string;
    session?: {
        access_token?: string;
        account?: Account;
    };
    securityFlags?: {
        passwordChangeRequired?: boolean;
        sessionTimeoutMinutes?: number;
        sessionMaxTimeoutMinutes?: number;
    };
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

async function reAuthenticateWithNewPassword(password: string): Promise<void> {
    const account = getAccount();
    const email = typeof account?.email === "string" ? account.email.trim() : "";

    if (!email) {
        throw new Error("Không xác định được tài khoản hiện tại để đăng nhập lại.");
    }

    const data = await api.post<AuthResponse>(endpoints.auth.login, {
        email,
        password,
    });

    const accessToken = data.session?.access_token || data.token;
    if (!accessToken) {
        throw new Error("Không nhận được access token sau khi đăng nhập lại.");
    }

    const workspaceId = resolveWorkspaceIdFromMePayload(data) || undefined;
    const organizationId = resolveOrganizationIdFromAuthPayload(data) || undefined;
    const nextAccount = data.session?.account || data.account;
    const sessionAccount =
        workspaceId || organizationId
            ? {
                ...(nextAccount || {}),
                ...(workspaceId ? { workspaceId } : {}),
                ...(organizationId ? { organizationId } : {}),
            }
            : nextAccount;

    if (data.securityFlags?.sessionTimeoutMinutes) {
        sessionStorage.setItem(
            "sessionTimeoutMinutes",
            String(data.securityFlags.sessionTimeoutMinutes)
        );
    }
    if (data.securityFlags?.sessionMaxTimeoutMinutes) {
        sessionStorage.setItem(
            "sessionMaxTimeoutMinutes",
            String(data.securityFlags.sessionMaxTimeoutMinutes)
        );
    }

    setSession(accessToken, sessionAccount, workspaceId);
    try {
        await hydrateSessionFromProfile(accessToken, sessionAccount);
    } catch {
        setSession(accessToken, sessionAccount, workspaceId);
    }
}

export default function ChangePasswordPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get("redirect") || "/";
    const forceChange = searchParams.get("force") === "true";
    const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [securityPolicy, setSecurityPolicy] = useState<SecurityPolicy | null>(null);

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [currentPasswordError, setCurrentPasswordError] = useState<string | null>(null);
    const [newPasswordError, setNewPasswordError] = useState<string | null>(null);
    const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);

    useEffect(() => {
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
    }, []);

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

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError(null);
        setSuccess(null);
        setLoading(true);

        try {
            const resolvedPolicy = securityPolicy ?? await fetchSecurityPolicy();
            setSecurityPolicy(resolvedPolicy);

            if (!validatePasswords(resolvedPolicy)) {
                return;
            }

            await api.post(endpoints.auth.changePassword || "/api/auth/change-password", {
                currentPassword,
                newPassword
            });

            await reAuthenticateWithNewPassword(newPassword);

            setSuccess("Mật khẩu đã được thay đổi thành công!");
            redirectTimeoutRef.current = setTimeout(() => {
                router.push(redirectTo);
            }, 1500);
        } catch (err) {
            const errorMessage = resolveChangePasswordErrorMessage(err);

            if (
                err instanceof Error &&
                (
                    errorMessage === "Không xác định được tài khoản hiện tại để đăng nhập lại." ||
                    errorMessage === "Không nhận được access token sau khi đăng nhập lại."
                )
            ) {
                setError("Đổi mật khẩu thành công nhưng không thể đăng nhập lại tự động. Vui lòng đăng nhập lại.");
                redirectTimeoutRef.current = setTimeout(() => {
                    router.push("/signin");
                }, 1500);
            } else if (err instanceof Error && errorMessage) {
                setError(errorMessage);
            } else {
                setError("Không thể tải cấu hình chính sách mật khẩu. Vui lòng thử lại.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col flex-1 lg:w-1/2 w-full">
            <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
                <div>
                    <div className="mb-5 sm:mb-8">
                        <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
                            Thay đổi mật khẩu
                        </h1>
                        {forceChange && (
                            <p className="text-sm text-amber-600 dark:text-amber-400">
                                Bạn cần thay đổi mật khẩu lần đầu đăng nhập vào hệ thống
                            </p>
                        )}
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="space-y-6">
                            <div>
                                <Label>
                                    Mật khẩu hiện tại <span className="text-error-500">*</span>
                                </Label>
                                <div className="relative">
                                    <Input
                                        type={showCurrentPassword ? "text" : "password"}
                                        placeholder="Nhập mật khẩu hiện tại"
                                        value={currentPassword}
                                        onChange={(e) => {
                                            setCurrentPassword(e.target.value);
                                            if (currentPasswordError) setCurrentPasswordError(null);
                                        }}
                                    />
                                    <span
                                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                        className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                                    >
                                        {showCurrentPassword ? (
                                            <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
                                        ) : (
                                            <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
                                        )}
                                    </span>
                                </div>
                                {currentPasswordError && (
                                    <p className="mt-1 text-xs text-error-600">{currentPasswordError}</p>
                                )}
                            </div>

                            <div>
                                <Label>
                                    Mật khẩu mới <span className="text-error-500">*</span>
                                </Label>
                                <div className="relative">
                                    <Input
                                        type={showNewPassword ? "text" : "password"}
                                        placeholder="Nhập mật khẩu mới"
                                        value={newPassword}
                                        onChange={(e) => {
                                            setNewPassword(e.target.value);
                                            if (newPasswordError) setNewPasswordError(null);
                                        }}
                                    />
                                    <span
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                                    >
                                        {showNewPassword ? (
                                            <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
                                        ) : (
                                            <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
                                        )}
                                    </span>
                                </div>
                                {newPasswordError && (
                                    <p className="mt-1 text-xs text-error-600">{newPasswordError}</p>
                                )}
                            </div>

                            <div>
                                <Label>
                                    Xác nhận mật khẩu mới <span className="text-error-500">*</span>
                                </Label>
                                <div className="relative">
                                    <Input
                                        type={showConfirmPassword ? "text" : "password"}
                                        placeholder="Xác nhận mật khẩu mới"
                                        value={confirmPassword}
                                        onChange={(e) => {
                                            setConfirmPassword(e.target.value);
                                            if (confirmPasswordError) setConfirmPasswordError(null);
                                        }}
                                    />
                                    <span
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                                    >
                                        {showConfirmPassword ? (
                                            <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
                                        ) : (
                                            <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
                                        )}
                                    </span>
                                </div>
                                {confirmPasswordError && (
                                    <p className="mt-1 text-xs text-error-600">{confirmPasswordError}</p>
                                )}
                            </div>

                            {error && <p className="text-sm text-error-600">{error}</p>}
                            {success && <p className="text-sm text-success-600">{success}</p>}

                            <Button className="w-full" size="sm" disabled={loading}>
                                {loading ? "Đang lưu..." : "Lưu mật khẩu mới"}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

"use client";
import Checkbox from "@/components/form/input/Checkbox";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { getAccountEmailValidationMessage, isValidAccountEmailInput, normalizeAccountEmail } from "@/lib/accountEmail";
import Button from "@/components/ui/button/Button";
import { api, ApiError } from "@/lib/api";
import { hydrateSessionFromProfile, resolveOrganizationIdFromAuthPayload, resolveWorkspaceIdFromMePayload, setSession } from "@/lib/auth";
import type { Account } from "@/lib/auth";
import { endpoints } from "@/lib/endpoints";
import { EyeCloseIcon, EyeIcon } from "@/icons";
import { useRouter } from "next/navigation";
import React, { FormEvent, useEffect, useState } from "react";

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

export default function SignInForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const checkSsoAvailability = async () => {
      try {
        const data = await api.get<{ enabled?: boolean }>(endpoints.auth.ssoEnabled);
        if (!cancelled) {
          setSsoEnabled(data?.enabled === true);
        }
      } catch {
        if (!cancelled) {
          setSsoEnabled(false);
        }
      }
    };

    void checkSsoAvailability();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSsoSignIn = async () => {
    setError(null);
    setSsoLoading(true);

    try {
      const data = await api.get<{ url?: string }>(endpoints.auth.ssoLoginUrl);
      const loginUrl = typeof data?.url === "string" ? data.url.trim() : "";

      if (!loginUrl) {
        throw new Error("Không nhận được URL đăng nhập SSO.");
      }

      window.location.href = loginUrl;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError("SSO hiện chưa được cấu hình đầy đủ.");
      } else {
        setError("Không thể khởi tạo đăng nhập SSO. Vui lòng thử lại.");
      }
      setSsoLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const trimmedEmail = email.trim();
    const hasEmail = Boolean(trimmedEmail);
    const hasPassword = Boolean(password);
    const isValidAccountInput = hasEmail ? isValidAccountEmailInput(trimmedEmail) : false;

    setEmailError(!hasEmail ? "Vui lòng nhập tài khoản." : isValidAccountInput ? null : getAccountEmailValidationMessage());
    setPasswordError(hasPassword ? null : "Vui lòng nhập mật khẩu.");
    setError(null);

    if (!hasEmail || !hasPassword || !isValidAccountInput) {
      return;
    }

    setLoading(true);

    try {
      const data = await api.post<AuthResponse>(endpoints.auth.login, {
        email: normalizeAccountEmail(trimmedEmail),
        password,
      });
      const accessToken = data.session?.access_token || data.token;
      if (!accessToken) {
        throw new Error("Không nhận được access token từ phản hồi đăng nhập.");
      }

      const workspaceId = resolveWorkspaceIdFromMePayload(data) || undefined;
      const organizationId = resolveOrganizationIdFromAuthPayload(data) || undefined;
      const account = data.session?.account || data.account;
      const sessionAccount =
        workspaceId || organizationId
          ? {
              ...(account || {}),
              ...(workspaceId ? { workspaceId } : {}),
              ...(organizationId ? { organizationId } : {}),
            }
          : account;

      // Store session timeout info for later use
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

      // Check if password change is required
      if (data.securityFlags?.passwordChangeRequired === true) {
        router.push("/change-password?force=true&redirect=/");
        return;
      }

      router.push("/");
    } catch (err) {
      if (err instanceof ApiError && (err.status === 400 || err.status === 401 || err.status === 403)) {
        setError("Tài khoản hoặc mật khẩu không chính xác.");
      } else {
        setError("Đăng nhập thất bại. Vui lòng thử lại.");
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
              Đăng nhập
            </h1>
          </div>
          <div>
            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                <div>
                  <Label>
                    Tài khoản hoặc email <span className="text-error-500">*</span>{" "}
                  </Label>
                  <Input
                    placeholder="Nhập tài khoản hoặc email của bạn"
                    type="text"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) {
                        setEmailError(null);
                      }
                    }}
                  />
                  {emailError && <p className="mt-1 text-xs text-error-600">{emailError}</p>}
                </div>
                <div>
                  <Label>
                    Mật khẩu <span className="text-error-500">*</span>{" "}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Nhập mật khẩu của bạn"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (passwordError) {
                          setPasswordError(null);
                        }
                      }}
                    />
                    <span
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                    >
                      {showPassword ? (
                        <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
                      ) : (
                        <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
                      )}
                    </span>
                  </div>
                  {passwordError && <p className="mt-1 text-xs text-error-600">{passwordError}</p>}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={isChecked} onChange={setIsChecked} />
                    <span className="block font-normal text-gray-700 text-theme-sm dark:text-gray-400">
                      Ghi nhớ đăng nhập
                    </span>
                  </div>
                </div>
                {error && <p className="text-sm text-error-600">{error}</p>}
                <div>
                  <Button className="w-full" size="sm" disabled={loading}>
                    {loading ? "Đang đăng nhập..." : "Đăng nhập"}
                  </Button>
                </div>
                {ssoEnabled ? (
                  <div>
                    <button
                      type="button"
                      onClick={handleSsoSignIn}
                      disabled={loading || ssoLoading}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      {ssoLoading ? "Đang chuyển hướng SSO..." : "Đăng nhập SSO"}
                    </button>
                  </div>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

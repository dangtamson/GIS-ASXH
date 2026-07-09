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
import { useRouter, useSearchParams } from "next/navigation";
import React, { FormEvent, useEffect, useState } from "react";
import {
  GIS_SIGNIN_EYEBROW,
} from "./signin-showcase";

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
  const searchParams = useSearchParams();
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
  const redirectAfterLogin = (() => {
    const redirectValue = searchParams.get("redirect") || "";
    if (!redirectValue.startsWith("/") || redirectValue.startsWith("//")) {
      return "/";
    }
    return redirectValue;
  })();

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
        router.push(`/change-password?force=true&redirect=${encodeURIComponent(redirectAfterLogin)}`);
        return;
      }

      router.push(redirectAfterLogin);
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
    <div className="relative flex w-full flex-1 items-stretch lg:w-[46%] xl:w-[42%]">
      <div className="pointer-events-none absolute inset-0 lg:hidden">
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/45 via-white/15 to-transparent" />
        <div className="absolute left-[-2rem] top-[8%] h-24 w-24 rounded-full border border-white/30 opacity-65" />
        <div className="absolute left-[8%] top-[13%] h-16 w-16 rounded-full border border-orange-200/30 opacity-80" />
        <div className="absolute right-[7%] top-[11%] h-20 w-20 rounded-full border border-white/24 opacity-70" />
        <div className="absolute left-[16%] top-[26%] h-px w-28 rotate-[13deg] bg-gradient-to-r from-transparent via-orange-300/55 to-transparent" />
      </div>
      <div className="relative flex w-full flex-1 items-center justify-center px-5 py-8 sm:px-8 sm:py-10 lg:px-12 xl:px-16">
        <div className="w-full max-w-md">

          <div
            className="relative overflow-hidden w-full rounded-[30px] border border-white/40 bg-[linear-gradient(145deg,rgba(255,255,255,0.48)_0%,rgba(255,255,255,0.18)_100%)] p-6 shadow-[0_32px_80px_-32px_rgba(16,24,40,0.46)] backdrop-blur-2xl xl:p-8 dark:border-white/10 dark:bg-[linear-gradient(145deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.03)_100%)]"
            style={{ animation: "authCardLiftIn 480ms ease-out" }}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
            <div className="absolute right-[-2.5rem] top-[-2.5rem] h-28 w-28 rounded-full bg-white/22 blur-2xl dark:bg-white/8" />
            <div className="absolute bottom-[-2rem] left-[-1rem] h-24 w-24 rounded-full bg-orange-100/28 blur-2xl dark:bg-orange-200/6" />
            <div className="mb-6 sm:mb-8">
              <p className="mb-3 inline-flex rounded-full border border-white/50 bg-white/38 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-800 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06] dark:text-brand-100">
                {GIS_SIGNIN_EYEBROW}
              </p>
              <h1 className="text-[1.75rem] font-semibold text-gray-900 sm:text-[2rem] dark:text-white/92">
                Đăng nhập vào hệ thống
              </h1>
            </div>

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
                    error={Boolean(emailError)}
                    className="!rounded-2xl !border-white/40 !bg-white/30 backdrop-blur-xl dark:!border-white/10 dark:!bg-white/[0.04]"
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
                      error={Boolean(passwordError)}
                      className="!rounded-2xl !border-white/40 !bg-white/30 pr-12 backdrop-blur-xl dark:!border-white/10 dark:!bg-white/[0.04]"
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (passwordError) {
                          setPasswordError(null);
                        }
                      }}
                    />
                    <span
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 z-30 -translate-y-1/2 cursor-pointer"
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

                <div className="flex items-center justify-between rounded-2xl border border-white/35 bg-white/24 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={isChecked} onChange={setIsChecked} />
                    <span className="block font-normal text-gray-700 text-theme-sm dark:text-gray-400">
                      Ghi nhớ đăng nhập
                    </span>
                  </div>
                </div>

                {error ? (
                  <div className="rounded-2xl border border-error-200/80 bg-white/30 px-4 py-3 text-sm text-error-700 backdrop-blur-xl dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-200">
                    {error}
                  </div>
                ) : null}

                <div>
                  <Button className="h-12 w-full rounded-2xl bg-[linear-gradient(135deg,#e43d2f_0%,#fd853a_100%)] text-white shadow-[0_16px_36px_-18px_rgba(228,61,47,0.8)]" size="sm" disabled={loading}>
                    {loading ? "Đang đăng nhập..." : "Đăng nhập"}
                  </Button>
                </div>

                {ssoEnabled ? (
                  <div>
                    <button
                      type="button"
                      onClick={handleSsoSignIn}
                      disabled={loading || ssoLoading}
                      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/35 bg-white/22 text-sm font-medium text-gray-700 backdrop-blur-xl transition hover:border-white/55 hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/80 dark:hover:bg-white/[0.06]"
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

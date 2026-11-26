"use client";
import Checkbox from "@/components/form/input/Checkbox";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { getAccountEmailValidationMessage, getLoginAccountEmailInput, isValidAccountEmailInput } from "@/lib/accountEmail";
import Button from "@/components/ui/button/Button";
import { api, ApiError } from "@/lib/api";
import { hydrateSessionFromProfile, resolveOrganizationIdFromAuthPayload, resolveWorkspaceIdFromMePayload, setSession } from "@/lib/auth";
import type { Account } from "@/lib/auth";
import { endpoints } from "@/lib/endpoints";
import { EyeCloseIcon, EyeIcon } from "@/icons";
import { ArrowRight, HandHeart, Lock, ShieldCheck, User } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
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
        email: getLoginAccountEmailInput(trimmedEmail),
        password,
      });
      const accessToken = data.token || data.session?.access_token;
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
    <div className="relative flex w-full flex-1 items-stretch lg:w-[48%] xl:w-[44%]">
      <div className="relative flex w-full flex-1 items-center justify-center px-5 py-8 sm:px-8 sm:py-10 lg:px-10 xl:px-14">
        <div className="w-full max-w-[460px] space-y-5">
          <div className="flex items-center gap-3 px-1">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#0b2f7a] via-[#1346a8] to-[#0e7490] text-white shadow-md shadow-blue-900/20">
              <HandHeart size={22} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold uppercase tracking-tight text-slate-900 sm:text-base dark:text-white">
                An sinh cộng đồng
              </p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Mặt trận Tổ quốc Việt Nam
              </p>
            </div>
          </div>

          <div
            className="relative w-full overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 shadow-xl shadow-blue-950/8 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90"
            style={{ animation: "authCardLiftIn 420ms ease-out" }}
          >
            <div className="h-1.5 w-full bg-gradient-to-r from-[#0b2f7a] via-[#0284c7] to-[#059669]" aria-hidden="true" />

            <div className="p-6 sm:p-8">
              <div className="mb-6 space-y-2 sm:mb-7">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200/80 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20">
                  <ShieldCheck size={13} />
                  Cổng điều hành an sinh số
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.75rem] dark:text-white">
                  Đăng nhập hệ thống
                </h1>
                <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Truy cập không gian quản lý chương trình, tiếp nhận nhu cầu và điều phối hỗ trợ cộng đồng.
                </p>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="space-y-5">
                  <div>
                    <Label className="!mb-1.5 !text-sm !font-semibold !text-slate-700 dark:!text-slate-200">
                      Tài khoản hoặc email <span className="text-rose-500">*</span>
                    </Label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-slate-400">
                        <User size={17} />
                      </span>
                      <Input
                        placeholder="Nhập tài khoản hoặc email của bạn"
                        type="text"
                        value={email}
                        error={Boolean(emailError)}
                        className="!h-12 !rounded-xl !border-slate-200 !bg-slate-50/70 !pl-10 text-slate-900 transition focus:!border-[#11409a] focus:!bg-white dark:!border-slate-700 dark:!bg-slate-800/70 dark:text-white"
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (emailError) {
                            setEmailError(null);
                          }
                        }}
                      />
                    </div>
                    {emailError && <p className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">{emailError}</p>}
                  </div>

                  <div>
                    <Label className="!mb-1.5 !text-sm !font-semibold !text-slate-700 dark:!text-slate-200">
                      Mật khẩu <span className="text-rose-500">*</span>
                    </Label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-slate-400">
                        <Lock size={17} />
                      </span>
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Nhập mật khẩu của bạn"
                        value={password}
                        error={Boolean(passwordError)}
                        className="!h-12 !rounded-xl !border-slate-200 !bg-slate-50/70 !pl-10 !pr-11 text-slate-900 transition focus:!border-[#11409a] focus:!bg-white dark:!border-slate-700 dark:!bg-slate-800/70 dark:text-white"
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (passwordError) {
                            setPasswordError(null);
                          }
                        }}
                      />
                      <span
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 z-30 -translate-y-1/2 cursor-pointer rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
                      >
                        {showPassword ? (
                          <EyeIcon className="fill-slate-500 dark:fill-slate-400" />
                        ) : (
                          <EyeCloseIcon className="fill-slate-500 dark:fill-slate-400" />
                        )}
                      </span>
                    </div>
                    {passwordError && <p className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">{passwordError}</p>}
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/50">
                    <div className="flex items-center gap-2.5">
                      <Checkbox checked={isChecked} onChange={setIsChecked} />
                      <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Ghi nhớ đăng nhập
                      </span>
                    </div>
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      Kết nối an toàn
                    </span>
                  </div>

                  {error ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                      {error}
                    </div>
                  ) : null}

                  <div className="pt-1">
                    <Button
                      className="h-12 w-full !rounded-xl bg-gradient-to-r from-[#0b2f7a] via-[#11409a] to-[#0e7490] text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition-all hover:from-[#08245e] hover:via-[#0d3480] hover:to-[#0b5e75] hover:shadow-blue-900/30"
                      size="sm"
                      disabled={loading}
                    >
                      <span className="inline-flex items-center justify-center gap-2">
                        <span>{loading ? "Đang đăng nhập..." : "Đăng nhập"}</span>
                        {!loading ? <ArrowRight size={16} /> : null}
                      </span>
                    </Button>
                  </div>

                  {ssoEnabled ? (
                    <div>
                      <button
                        type="button"
                        onClick={handleSsoSignIn}
                        disabled={loading || ssoLoading}
                        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-xs transition hover:border-blue-200 hover:bg-blue-50/60 hover:text-[#11409a] disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:border-blue-400/30 dark:hover:bg-slate-800"
                      >
                        <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
                        <span>{ssoLoading ? "Đang chuyển hướng SSO..." : "Đăng nhập SSO"}</span>
                      </button>
                    </div>
                  ) : null}
                </div>
              </form>
            </div>
          </div>

          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
            Hệ thống An sinh cộng đồng · Bảo mật thông tin &amp; điều phối minh bạch
          </p>
        </div>
      </div>
    </div>
  );
}

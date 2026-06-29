"use client";

import {api, ApiError} from "@/lib/api";
import type {Account} from "@/lib/auth";
import {hydrateSessionFromProfile, resolveWorkspaceIdFromMePayload, setSession} from "@/lib/auth";
import {endpoints} from "@/lib/endpoints";
import {useRouter, useSearchParams} from "next/navigation";
import {Suspense, useEffect, useMemo, useState} from "react";

type AuthResponse = {
    token?: string;
    account?: Account;
    workspaces?: unknown[];
    workspaceId?: string;
    session?: {
        access_token?: string;
        account?: Account;
    };
};

function SignInSsoContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState<string | null>(null);

    const code = useMemo(() => searchParams.get("code") || "", [searchParams]);
    const state = useMemo(() => searchParams.get("state") || "", [searchParams]);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            if (!code) {
                setError("Thiếu mã xác thực SSO.");
                return;
            }

            try {
                const data = await api.post<AuthResponse>(endpoints.auth.ssoExchange, { code, state: state || undefined });
                const accessToken = data.session?.access_token || data.token;
                if (!accessToken) {
                    throw new Error("Không nhận được access token từ phản hồi đăng nhập SSO.");
                }

                const workspaceId = resolveWorkspaceIdFromMePayload(data) || undefined;
                const account = data.session?.account || data.account;
                const sessionAccount = workspaceId ? { ...(account || {}), workspaceId } : account;

                setSession(accessToken, sessionAccount, workspaceId);
                try {
                    await hydrateSessionFromProfile(accessToken, sessionAccount);
                } catch {
                    setSession(accessToken, sessionAccount, workspaceId);
                }

                if (!cancelled) {
                    router.replace("/");
                }
            } catch (err) {
                if (cancelled) {
                    return;
                }

                if (err instanceof ApiError) {
                    setError(err.message);
                } else {
                    setError("Đăng nhập SSO thất bại. Vui lòng thử lại.");
                }
            }
        };

        void run();

        return () => {
            cancelled = true;
        };
    }, [code, state, router]);

    return (
        <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-6">
            <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
                {error ? (
                    <>
                        <h1 className="text-lg font-semibold text-red-600">Không thể đăng nhập SSO</h1>
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{error}</p>
                        <button
                            type="button"
                            onClick={() => router.replace("/signin")}
                            className="mt-4 inline-flex rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
                        >
                            Quay lại đăng nhập
                        </button>
                    </>
                ) : (
                    <>
                        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Đang hoàn tất đăng nhập SSO</h1>
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Vui lòng chờ trong giây lát...</p>
                    </>
                )}
            </div>
        </div>
    );
}

export default function SignInSsoPage() {
    return (
        <Suspense>
            <SignInSsoContent />
        </Suspense>
    );
}

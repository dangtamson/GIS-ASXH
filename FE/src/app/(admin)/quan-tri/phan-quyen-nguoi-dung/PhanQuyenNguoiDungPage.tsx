"use client";

import {api, ApiError} from "@/lib/api";
import {getWorkspaceId, resolveWorkspaceIdFromMePayload} from "@/lib/auth";
import {extractList, getRowId} from "@/lib/data-utils";
import {endpoints} from "@/lib/endpoints";
import {Check, RefreshCw, Search, ShieldCheck, Users, X} from "lucide-react";
import {App} from "antd";
import {useCallback, useEffect, useMemo, useState} from "react";

type Role = {
    id?: string;
    uuid?: string;
    name?: string;
    code?: string;
    status?: string;
};

type Member = {
    account?: {
        uuid?: string;
        fullName?: string;
        email?: string;
        status?: string;
    };
    membership?: {
        uuid?: string;
        roleId?: string | number;
        accountId?: string;
        workspaceId?: string;
        status?: boolean;
    };
    profile?: {
        uuid?: string;
        name?: string;
    };
    [key: string]: unknown;
};

type MemberRowState = {
    membershipUuid: string;
    accountUuid: string;
    accountName: string;
    accountEmail: string;
    currentRoleId: string;
    selectedRoleId: string;
    isDirty: boolean;
};

type PaginationMeta = {
    page: number;
    limit: number;
    total: number;
    pages: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    return value as Record<string, unknown>;
}

function extractPagination(input: unknown): PaginationMeta | null {
    const root = asRecord(input);
    const data = asRecord(root?.data) ?? root;
    const pagination = asRecord(data?.pagination);
    if (!pagination) {
        return null;
    }
    return {
        page: Number(pagination.page ?? 1) || 1,
        limit: Number(pagination.limit ?? 10) || 10,
        total: Number(pagination.total ?? 0) || 0,
        pages: Number(pagination.pages ?? 1) || 1,
    };
}

function normalizeRoleInput(value: string): string | number {
    const trimmed = value.trim();
    return /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
}

export default function PhanQuyenNguoiDungPage() {
    const [members, setMembers] = useState<Member[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(false);
    const { notification } = App.useApp();
    const [searchQuery, setSearchQuery] = useState("");
    const [memberStates, setMemberStates] = useState<Record<string, MemberRowState>>({});
    const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
    const [workspaceId, setWorkspaceId] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalMembers, setTotalMembers] = useState(0);

    const roleIdOf = (role: Role) => getRowId(role);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            let resolvedWorkspaceId = getWorkspaceId();

            // Primary source: /workspaces for consistency across admin pages.
            if (!resolvedWorkspaceId) {
                try {
                    const workspacesData = await api.get<unknown>(endpoints.workspaces);
                    const workspaceList = extractList<Record<string, unknown>>(workspacesData);
                    const firstWorkspace = workspaceList[0];
                    if (firstWorkspace) {
                        const firstId = String(firstWorkspace.uuid ?? firstWorkspace.id ?? "").trim();
                        if (firstId) {
                            resolvedWorkspaceId = firstId;
                        }
                    }
                } catch {
                    // ignore and fallback to /me below
                }
            }

            // Fallback: nếu không có workspaceId, lấy từ /me
            if (!resolvedWorkspaceId) {
                try {
                    const profileData = await api.get<unknown>(endpoints.auth.me);
                    resolvedWorkspaceId = resolveWorkspaceIdFromMePayload(profileData);
                } catch {
                    // ignore
                }
            }

            if (!resolvedWorkspaceId) {
                notification.error({
                    message: "Lỗi",
                    description: "Không thể xác định workspace. Vui lòng đăng nhập lại.",
                });
                setLoading(false);
                return;
            }

            setWorkspaceId(resolvedWorkspaceId);

            const [membersData, rolesData] = await Promise.all([
                api.get<unknown>(
                    `${endpoints.admin.memberships}?workspaceId=${resolvedWorkspaceId}&page=${page}&limit=${rowsPerPage}`
                ),
                api.get<unknown>(`${endpoints.admin.roles}?page=1&limit=100`),
            ]);

            const membershipsList = extractList<Record<string, unknown>>(membersData);
            const memberList: Member[] = membershipsList
                .map((row) => {
                    const membership = asRecord(row.membership);
                    const account = asRecord(row.account);
                    if (!membership || !account) {
                        return null;
                    }
                    return {
                        membership: {
                            uuid: String(membership.uuid ?? ""),
                            roleId: membership.roleId as string | number | undefined,
                            accountId: String(membership.accountId ?? ""),
                            workspaceId: String(membership.workspaceId ?? ""),
                        },
                        account: {
                            uuid: String(account.uuid ?? ""),
                            fullName: String(account.fullName ?? ""),
                            email: String(account.email ?? ""),
                        },
                    } as Member;
                })
                .filter(Boolean) as Member[];
            const roleList = extractList<Role>(rolesData);
            const pagination = extractPagination(membersData);
            setMembers(memberList);
            setRoles(roleList);
            setTotalMembers(pagination?.total ?? memberList.length);

            // Initialize member states
            const initialStates: Record<string, MemberRowState> = {};
            memberList.forEach((member) => {
                const membershipUuid = String(member.membership?.uuid || "");
                const accountUuid = String(member.account?.uuid || "");
                const currentRoleId = String(member.membership?.roleId || "");
                if (membershipUuid && accountUuid) {
                    initialStates[membershipUuid] = {
                        membershipUuid,
                        accountUuid,
                        accountName: String(member.account?.fullName || ""),
                        accountEmail: String(member.account?.email || ""),
                        currentRoleId,
                        selectedRoleId: currentRoleId,
                        isDirty: false,
                    };
                }
            });
            setMemberStates(initialStates);
        } catch (err) {
            if (err instanceof ApiError) {
                notification.error({
                    message: "Lỗi",
                    description: err.message,
                });
            } else {
                notification.error({
                    message: "Lỗi",
                    description: "Không thể tải dữ liệu thành viên workspace và nhóm quyền",
                });
            }
        } finally {
            setLoading(false);
        }
    }, [notification, page, rowsPerPage]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    useEffect(() => {
        setPage(1);
    }, [rowsPerPage]);

    const filteredMembers = useMemo(() => {
        if (!searchQuery.trim()) return members;

        const query = searchQuery.toLowerCase();
        return members.filter((member) => {
            const fullName = String(member.account?.fullName || "").toLowerCase();
            const email = String(member.account?.email || "").toLowerCase();
            return fullName.includes(query) || email.includes(query);
        });
    }, [members, searchQuery]);

    const assignableRoles = useMemo(
        () => roles.filter((role) => String(role.status || "Hoạt động") !== "Ngưng"),
        [roles]
    );

    const getRoleName = (roleId: string | number) => {
        const role = roles.find((r) => String(roleIdOf(r)) === String(roleId));
        return role?.name || "Chưa gán quyền";
    };

    const handleRoleChange = (membershipUuid: string, newRoleId: string) => {
        setMemberStates((prev) => ({
            ...prev,
            [membershipUuid]: {
                ...prev[membershipUuid],
                selectedRoleId: newRoleId,
                isDirty: String(newRoleId) !== String(prev[membershipUuid].currentRoleId),
            },
        }));
    };

    const handleSave = async (membershipUuid: string) => {
        const state = memberStates[membershipUuid];
        if (!state || !state.isDirty) return;

        setSavingMemberId(membershipUuid);
        try {
            if (!workspaceId) {
                notification.error({
                    message: "Lỗi",
                    description: "Không thể xác định workspace",
                });
                setSavingMemberId(null);
                return;
            }

            const endpoint = `${endpoints.workspaces}/${workspaceId}/members/${membershipUuid}/role`;
            const payload = { role: normalizeRoleInput(state.selectedRoleId) };

            await api.put<unknown>(endpoint, payload);

            // Update local state
            setMemberStates((prev) => ({
                ...prev,
                [membershipUuid]: {
                    ...prev[membershipUuid],
                    currentRoleId: state.selectedRoleId,
                    isDirty: false,
                },
            }));
            notification.success({
                message: "Thành công",
                description: `Đã cập nhật quyền cho ${state.accountName || "thành viên"}.`,
            });
        } catch (err) {
            if (err instanceof ApiError) {
                notification.error({
                    message: "Lỗi",
                    description: "Lỗi khi cập nhật quyền: " + err.message,
                });
            } else {
                notification.error({
                    message: "Lỗi",
                    description: "Không thể cập nhật quyền cho thành viên workspace",
                });
            }
        } finally {
            setSavingMemberId(null);
        }
    };

    const handleReset = (membershipUuid: string) => {
        const state = memberStates[membershipUuid];
        if (!state) return;

        setMemberStates((prev) => ({
            ...prev,
            [membershipUuid]: {
                ...prev[membershipUuid],
                selectedRoleId: state.currentRoleId,
                isDirty: false,
            },
        }));
    };

    if (loading) {
        return (
            <div className="w-full p-4 sm:p-6">
                <div className="animate-pulse rounded-2xl border border-gray-200 bg-white/80 p-6 dark:border-gray-700 dark:bg-gray-900/80">
                    <div className="mb-4 h-8 w-2/5 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="mb-8 h-4 w-3/5 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="h-24 rounded-xl bg-gray-100 dark:bg-gray-800" />
                        <div className="h-24 rounded-xl bg-gray-100 dark:bg-gray-800" />
                        <div className="h-24 rounded-xl bg-gray-100 dark:bg-gray-800" />
                    </div>
                    <div className="mt-6 h-12 rounded-xl bg-gray-100 dark:bg-gray-800" />
                    <div className="mt-4 h-72 rounded-xl bg-gray-100 dark:bg-gray-800" />
                </div>
            </div>
        );
    }

    const hasChanges = Object.values(memberStates).some((state) => state.isDirty);
    const pendingChanges = Object.values(memberStates).filter((state) => state.isDirty).length;
    const totalPages = Math.max(1, Math.ceil(totalMembers / rowsPerPage));

    const cardClassName =
        "rounded-2xl border border-amber-200/70 bg-white/95 shadow-sm dark:border-amber-900/50 dark:bg-gray-900";

    return (
        <div className="w-full p-4 sm:p-6">
            <div className="relative overflow-hidden rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 via-orange-50 to-white p-5 shadow-sm dark:border-amber-900/60 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-gray-900 sm:p-7">
                <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-amber-300/35 blur-2xl dark:bg-amber-500/20" />
                <div className="pointer-events-none absolute -left-8 bottom-0 h-28 w-28 rounded-full bg-orange-300/35 blur-2xl dark:bg-orange-500/20" />
                <div className="relative flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/70 px-3 py-1 text-xs font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Quản trị người dùng
                        </p>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                            Quản Lý Người Dùng
                        </h1>
                    </div>
                    <button
                        onClick={() => void loadData()}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Tải lại dữ liệu
                    </button>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className={`${cardClassName} p-4`}>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Thành viên hiển thị</p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{filteredMembers.length}</p>
                </div>
                <div className={`${cardClassName} p-4`}>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Vai trò khả dụng</p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{assignableRoles.length}</p>
                </div>
                <div className={`${cardClassName} p-4`}>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Thay đổi chưa lưu</p>
                    <p className={`mt-2 text-2xl font-semibold ${pendingChanges ? "text-amber-600 dark:text-amber-300" : "text-emerald-600 dark:text-emerald-300"}`}>
                        {pendingChanges}
                    </p>
                </div>
            </div>

            <div className={`${cardClassName} mt-4 p-4`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:max-w-md">
                        <input
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            type="text"
                            placeholder="Tìm theo tên hoặc email"
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-10 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-amber-600 dark:focus:ring-amber-900/40"
                        />
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                        <Users className="h-4 w-4" />
                        {hasChanges
                            ? `${pendingChanges} thay đổi đang chờ lưu`
                            : "Không có thay đổi chưa lưu"}
                    </div>
                </div>
            </div>

            <div className={`${cardClassName} mt-4 hidden overflow-hidden md:block`}>
                <div className="max-h-[70vh] overflow-auto">
                    <table className="w-full">
                        <thead className="sticky top-0 z-10 border-b border-gray-200 bg-transparent backdrop-blur dark:border-gray-700 dark:bg-transparent">
                            <tr className="divide-x divide-gray-200 dark:divide-gray-700">
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                                    Họ tên
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                                    Email
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                                    Quyền hiện tại
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                                    Chọn quyền
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                                    Hành động
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredMembers.length ? (
                                filteredMembers.map((member) => {
                                    const membershipUuid = String(member.membership?.uuid || "");
                                    const state = memberStates[membershipUuid];
                                    if (!state) return null;

                                    return (
                                        <tr
                                            key={membershipUuid}
                                            className={`divide-x divide-gray-200 dark:divide-gray-700 ${state.isDirty
                                                ? "bg-amber-50/70 dark:bg-amber-950/20"
                                                : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
                                                }`}
                                        >
                                            <td className="px-4 py-3 text-sm dark:text-white">
                                                <div className="font-medium">{state.accountName || "-"}</div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                                {state.accountEmail || "-"}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700 dark:bg-sky-900/30 dark:text-sky-200">
                                                    {getRoleName(state.currentRoleId)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <select
                                                    value={state.selectedRoleId}
                                                    onChange={(e) => handleRoleChange(membershipUuid, e.target.value)}
                                                    className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-amber-600 dark:focus:ring-amber-900/40"
                                                >
                                                    {assignableRoles.map((role) => {
                                                        const rid = roleIdOf(role);
                                                        return (
                                                            <option key={rid} value={rid}>
                                                                {role.name || "Chưa có tên"}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    {state.isDirty && (
                                                        <>
                                                            <button
                                                                onClick={() => handleSave(membershipUuid)}
                                                                disabled={savingMemberId === membershipUuid}
                                                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-emerald-600 transition hover:bg-emerald-100 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
                                                                title="Lưu"
                                                            >
                                                                {savingMemberId === membershipUuid ? (
                                                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                                                                ) : (
                                                                    <Check className="h-4 w-4" />
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={() => handleReset(membershipUuid)}
                                                                disabled={savingMemberId === membershipUuid}
                                                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 transition hover:bg-rose-100 disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-900/30"
                                                                title="Hủy"
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                                        Không tìm thấy thành viên phù hợp.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:hidden">
                {filteredMembers.length ? (
                    filteredMembers.map((member) => {
                        const membershipUuid = String(member.membership?.uuid || "");
                        const state = memberStates[membershipUuid];
                        if (!state) return null;

                        return (
                            <div
                                key={membershipUuid}
                                className={`${cardClassName} ${state.isDirty ? "ring-1 ring-amber-300 dark:ring-amber-700" : ""} p-4`}
                            >
                                <div className="mb-3">
                                    <p className="text-base font-semibold text-gray-900 dark:text-white">{state.accountName || "-"}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{state.accountEmail || "-"}</p>
                                </div>

                                <div className="mb-3">
                                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Quyền hiện tại</p>
                                    <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700 dark:bg-sky-900/30 dark:text-sky-200">
                                        {getRoleName(state.currentRoleId)}
                                    </span>
                                </div>

                                <div>
                                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Chọn quyền</p>
                                    <select
                                        value={state.selectedRoleId}
                                        onChange={(e) => handleRoleChange(membershipUuid, e.target.value)}
                                        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-amber-600 dark:focus:ring-amber-900/40"
                                    >
                                        {assignableRoles.map((role) => {
                                            const rid = roleIdOf(role);
                                            return (
                                                <option key={rid} value={rid}>
                                                    {role.name || "Chưa có tên"}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>

                                {state.isDirty && (
                                    <div className="mt-4 flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => handleReset(membershipUuid)}
                                            disabled={savingMemberId === membershipUuid}
                                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                        >
                                            <X className="h-4 w-4" />
                                            Hủy
                                        </button>
                                        <button
                                            onClick={() => handleSave(membershipUuid)}
                                            disabled={savingMemberId === membershipUuid}
                                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white transition hover:bg-emerald-700 disabled:opacity-50"
                                        >
                                            {savingMemberId === membershipUuid ? (
                                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                            ) : (
                                                <Check className="h-4 w-4" />
                                            )}
                                            Lưu
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className={`${cardClassName} p-6 text-center text-sm text-gray-500 dark:text-gray-400`}>
                        Không tìm thấy thành viên phù hợp.
                    </div>
                )}
            </div>

            <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                        <span>
                            Tổng cộng <span className="font-semibold text-gray-900 dark:text-white">{totalMembers}</span> thành viên
                        </span>
                        {hasChanges && (
                            <span className="text-amber-600 dark:text-amber-300">
                                • {pendingChanges} thay đổi chưa lưu
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <span>Số dòng / trang</span>
                        <select
                            value={rowsPerPage}
                            onChange={(event) => setRowsPerPage(Number(event.target.value))}
                            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                        >
                            {[10, 20, 50].map((value) => (
                                <option key={value} value={value}>
                                    {value}
                                </option>
                            ))}
                        </select>

                        <button
                            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                            disabled={page <= 1}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                            Trước
                        </button>
                        <span className="text-gray-600 dark:text-gray-300">Trang {page}/{totalPages}</span>
                        <button
                            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                            disabled={page >= totalPages}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                            Sau
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

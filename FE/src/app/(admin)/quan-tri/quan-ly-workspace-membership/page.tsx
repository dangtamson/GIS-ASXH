"use client";

import {api, ApiError} from "@/lib/api";
import {endpoints} from "@/lib/endpoints";
import {getAccount, getWorkspaceId, resolveWorkspaceIdFromMePayload, setWorkspaceId} from "@/lib/auth";
import {extractList} from "@/lib/data-utils";
import {Check, ChevronDown, ChevronRight} from "lucide-react";
import type {TableColumnsType} from "antd";
import {App, Col, ConfigProvider, Empty, Form, Row, Select, Spin, Table, Tag} from "antd";
import {useCallback, useEffect, useMemo, useState} from "react";
import ActionIcon from "@/components/controller/ActionIcon";
import {ActionButton, ActionModal, AppPagination, ConfirmModal, FilterSpace, SearchBox, TitleSpace} from "@/components/controller";

type Role = {
    id?: string | number;
    uuid?: string;
    name?: string;
    code?: string;
    status?: string;
};

type WorkspaceOption = {
    id: string;
    name: string;
};

type OrganizationOption = {
    id: string;
    name: string;
    code?: string;
    parentId?: string;
};

type AccountOption = {
    id: string;
    fullName: string;
    email: string;
    status?: string;
};

type OrganizationTreeNode = OrganizationOption & {
    children: OrganizationTreeNode[];
};

type WorkspaceMember = {
    account?: {
        uuid?: string;
        fullName?: string;
        email?: string;
        status?: string;
    };
    profile?: {
        uuid?: string;
        name?: string;
        workspaceId?: string;
        accountId?: string;
    };
    membership?: {
        uuid?: string;
        workspaceId?: string;
        accountId?: string;
        roleId?: string | number;
        organizationId?: string;
        status?: boolean;
        joinedAt?: string;
        isAdmin?: boolean;
    };
    organization?: {
        uuid?: string;
        name?: string;
        code?: string;
    };
};

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    return value as Record<string, unknown>;
}

function extractAccounts(payload: unknown): AccountOption[] {
    const root = asRecord(payload);
    const data = asRecord(root?.data) ?? root;
    const list = Array.isArray(data?.accounts) ? (data.accounts as Record<string, unknown>[]) : [];

    return list
        .map((item) => ({
            id: String(item.uuid ?? item.id ?? "").trim(),
            fullName: String(item.fullName ?? item.name ?? "").trim(),
            email: String(item.email ?? "").trim(),
            status: item.status ? String(item.status) : undefined,
        }))
        .filter((item) => item.id && item.email);
}

function extractWorkspaceOptionsFromMe(payload: unknown): WorkspaceOption[] {
    const payloadRecord = asRecord(payload);
    const dataRecord = asRecord(payloadRecord?.data) ?? payloadRecord;
    const workspaces = Array.isArray(dataRecord?.workspaces) ? dataRecord.workspaces : [];

    const options = workspaces
        .map((entry) => {
            const entryRecord = asRecord(entry);
            const workspaceRecord = asRecord(entryRecord?.workspace) ?? entryRecord;
            const profileRecord = asRecord(entryRecord?.profile);
            const membershipRecord = asRecord(entryRecord?.membership);

            const idCandidate =
                profileRecord?.workspaceId ??
                membershipRecord?.workspaceId ??
                workspaceRecord?.uuid ??
                workspaceRecord?.id;

            const nameCandidate = workspaceRecord?.name ?? profileRecord?.name;

            if (typeof idCandidate !== "string" || !idCandidate.trim()) {
                return null;
            }

            return {
                id: idCandidate,
                name:
                    typeof nameCandidate === "string" && nameCandidate.trim()
                        ? nameCandidate
                        : `Workspace ${idCandidate.slice(0, 8)}`,
            };
        })
        .filter(Boolean) as WorkspaceOption[];

    const unique = new Map<string, WorkspaceOption>();
    for (const option of options) {
        if (!unique.has(option.id)) {
            unique.set(option.id, option);
        }
    }

    return Array.from(unique.values());
}

function extractWorkspaceOptionsFromWorkspaceList(payload: unknown): WorkspaceOption[] {
    return extractList<Record<string, unknown>>(payload)
        .map((item) => {
            const id = String(item.uuid ?? item.id ?? "").trim();
            const name = String(item.name ?? "").trim();

            if (!id) {
                return null;
            }

            return {
                id,
                name: name || `Workspace ${id.slice(0, 8)}`,
            };
        })
        .filter(Boolean) as WorkspaceOption[];
}

function extractMembers(payload: unknown): WorkspaceMember[] {
    const payloadRecord = asRecord(payload);
    const dataRecord = asRecord(payloadRecord?.data) ?? payloadRecord;
    const members = dataRecord?.members;
    return Array.isArray(members) ? (members as WorkspaceMember[]) : [];
}

function extractIsSuperAdminFromMe(payload: unknown): boolean {
    const payloadRecord = asRecord(payload);
    const dataRecord = asRecord(payloadRecord?.data) ?? payloadRecord;
    const accountRecord = asRecord(dataRecord?.account) ?? dataRecord;
    return Boolean(accountRecord?.isSuperAdmin);
}

function roleKey(role: Role): string {
    return String(role.id ?? role.uuid ?? "");
}

function normalizeRoleInput(value: string): string | number {
    const trimmed = value.trim();
    return /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
}

function buildOrganizationTree(options: OrganizationOption[]): OrganizationTreeNode[] {
    const nodeMap = new Map<string, OrganizationTreeNode>();

    options.forEach((option) => {
        nodeMap.set(option.id, {
            ...option,
            children: [],
        });
    });

    const roots: OrganizationTreeNode[] = [];
    nodeMap.forEach((node) => {
        if (node.parentId && nodeMap.has(node.parentId)) {
            nodeMap.get(node.parentId)?.children.push(node);
        } else {
            roots.push(node);
        }
    });

    const sortNodes = (nodes: OrganizationTreeNode[]) => {
        nodes.sort((a, b) => a.name.localeCompare(b.name, "vi"));
        nodes.forEach((node) => sortNodes(node.children));
    };

    sortNodes(roots);
    return roots;
}

function OrganizationTreeSelect({
    options,
    value,
    onChange,
    placeholder,
}: {
    options: OrganizationOption[];
    value: string;
    onChange: (nextValue: string) => void;
    placeholder: string;
}) {
    const [open, setOpen] = useState(false);
    const [expandedTreeNodes, setExpandedTreeNodes] = useState<Record<string, boolean>>({});

    const tree = useMemo(() => buildOrganizationTree(options), [options]);
    const selected = useMemo(() => options.find((item) => item.id === value), [options, value]);

    function findSelectedPath(nodes: OrganizationTreeNode[], selectedValue: string, parentPath: string[] = []): string[] | null {
        for (const node of nodes) {
            const currentPath = [...parentPath, node.id];
            if (node.id === selectedValue) {
                return currentPath;
            }

            if (node.children.length > 0) {
                const childPath = findSelectedPath(node.children, selectedValue, currentPath);
                if (childPath) {
                    return childPath;
                }
            }
        }

        return null;
    }

    function expandSelectedPath(): void {
        if (!value) {
            return;
        }

        const path = findSelectedPath(tree, value);
        if (!path?.length) {
            return;
        }

        setExpandedTreeNodes((prev) => {
            const next = { ...prev };
            path.forEach((nodeId) => {
                next[nodeId] = true;
            });
            return next;
        });
    }

    function renderNodes(nodes: OrganizationTreeNode[], depth: number): React.ReactNode {
        return nodes.map((node) => {
            const hasChildren = node.children.length > 0;
            const isExpanded = Boolean(expandedTreeNodes[node.id]);
            const isSelected = value === node.id;
            const nodeLabel = node.code ? `${node.name} (${node.code})` : node.name;

            return (
                <div key={node.id}>
                    <button
                        type="button"
                        onClick={() => {
                            onChange(node.id);
                            setOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-gray-100 dark:hover:bg-gray-700 ${isSelected ? "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" : ""
                            }`}
                    >
                        <span className="flex min-w-0 items-center gap-1" style={{ paddingLeft: `${depth * 14}px` }}>
                            {hasChildren ? (
                                <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        setExpandedTreeNodes((prev) => ({
                                            ...prev,
                                            [node.id]: !prev[node.id],
                                        }));
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key !== "Enter" && event.key !== " ") {
                                            return;
                                        }
                                        event.preventDefault();
                                        event.stopPropagation();
                                        setExpandedTreeNodes((prev) => ({
                                            ...prev,
                                            [node.id]: !prev[node.id],
                                        }));
                                    }}
                                    className="rounded p-0.5 text-gray-500 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-600"
                                    aria-label={isExpanded ? "Thu gọn node" : "Mở node con"}
                                >
                                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                </span>
                            ) : (
                                <span className="inline-block h-3.5 w-3.5" />
                            )}
                            <span className="truncate">{nodeLabel}</span>
                        </span>
                        {isSelected ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                    </button>

                    {hasChildren && isExpanded ? <div>{renderNodes(node.children, depth + 1)}</div> : null}
                </div>
            );
        });
    }

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => {
                    if (open) {
                        setOpen(false);
                        return;
                    }
                    expandSelectedPath();
                    setOpen(true);
                }}
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-left text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-amber-600 dark:focus:ring-amber-900/40"
            >
                <span className={`truncate ${selected ? "text-gray-800 dark:text-gray-100" : "text-gray-400"}`}>
                    {selected ? (selected.code ? `${selected.name} (${selected.code})` : selected.name) : placeholder}
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-gray-500 transition ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
                <div className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    <button
                        type="button"
                        onClick={() => {
                            onChange("");
                            setOpen(false);
                        }}
                        className="mb-1 w-full rounded-md px-2 py-1.5 text-left text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                        -- Chọn --
                    </button>
                    {renderNodes(tree, 0)}
                </div>
            )}
        </div>
    );
}

export default function QuanLyWorkspaceMembershipPage() {
    const currentAccount = useMemo(() => getAccount(), []);
    const [addMemberForm] = Form.useForm<{
        accountId?: string;
        roleId?: string;
        organizationId?: string;
    }>();
    const [isSuperAdmin, setIsSuperAdmin] = useState(Boolean(currentAccount?.isSuperAdmin));
    const [workspaceOptions, setWorkspaceOptions] = useState<WorkspaceOption[]>([]);
    const [organizationOptions, setOrganizationOptions] = useState<OrganizationOption[]>([]);
    const [accountOptions, setAccountOptions] = useState<AccountOption[]>([]);
    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
    const [roles, setRoles] = useState<Role[]>([]);
    const [members, setMembers] = useState<WorkspaceMember[]>([]);

    const [loadingInit, setLoadingInit] = useState(false);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const { notification } = App.useApp();
    const [search, setSearch] = useState("");
    const [searchDraft, setSearchDraft] = useState("");
    const [showAddForm, setShowAddForm] = useState(false);

    const [adding, setAdding] = useState(false);
    const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
    const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
    const [updateTarget, setUpdateTarget] = useState<{ id: string; name: string } | null>(null);
    const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);

    const [roleDraftByMemberId, setRoleDraftByMemberId] = useState<Record<string, string>>({});
    const [organizationDraftByMemberId, setOrganizationDraftByMemberId] = useState<Record<string, string>>({});
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const assignableRoles = useMemo(
        () => roles.filter((role) => String(role.status || "Hoạt động") !== "Ngưng"),
        [roles]
    );

    const roleNameById = useMemo(() => {
        const map = new Map<string, string>();
        assignableRoles.forEach((role) => {
            map.set(roleKey(role), role.name || role.code || "-");
        });
        return map;
    }, [assignableRoles]);

    const organizationNameById = useMemo(() => {
        const map = new Map<string, string>();
        organizationOptions.forEach((organization) => {
            map.set(
                organization.id,
                organization.code ? `${organization.name} (${organization.code})` : organization.name
            );
        });
        return map;
    }, [organizationOptions]);

    const accountById = useMemo(() => {
        const map = new Map<string, AccountOption>();
        accountOptions.forEach((account) => {
            map.set(account.id, account);
        });
        return map;
    }, [accountOptions]);

    const availableAccountOptions = useMemo(() => {
        const memberAccountIds = new Set(
            members
                .map((member) =>
                    String(
                        member.membership?.accountId ||
                        member.profile?.accountId ||
                        member.account?.uuid ||
                        ""
                    )
                )
                .filter((id) => Boolean(id))
        );

        return accountOptions.filter((account) => !memberAccountIds.has(account.id));
    }, [accountOptions, members]);

    const totalPages = Math.max(1, Math.ceil(members.length / rowsPerPage));
    const pagedMembers = useMemo(() => {
        const start = (page - 1) * rowsPerPage;
        return members.slice(start, start + rowsPerPage);
    }, [members, page, rowsPerPage]);

    useEffect(() => {
        setPage(1);
    }, [selectedWorkspaceId, rowsPerPage]);

    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

    const loadMembers = useCallback(async (workspaceId: string, keyword?: string) => {
        if (!workspaceId) {
            setMembers([]);
            return;
        }

        setLoadingMembers(true);
        try {
            const params = new URLSearchParams();
            const normalizedKeyword = String(keyword ?? "").trim();
            if (normalizedKeyword) {
                params.set("search", normalizedKeyword);
            }

            const response = await api.get<unknown>(
                params.size ? `${endpoints.members(workspaceId)}?${params.toString()}` : endpoints.members(workspaceId)
            );
            const memberList = extractMembers(response);
            setMembers(memberList);

            const nextDraft: Record<string, string> = {};
            const nextOrganizationDraft: Record<string, string> = {};
            memberList.forEach((member) => {
                const memberId = String(member.membership?.uuid || "");
                const roleId = String(member.membership?.roleId || "");
                const organizationId = String(member.membership?.organizationId || member.organization?.uuid || "");
                if (memberId) {
                    nextDraft[memberId] = roleId;
                    nextOrganizationDraft[memberId] = organizationId;
                }
            });
            setRoleDraftByMemberId(nextDraft);
            setOrganizationDraftByMemberId(nextOrganizationDraft);
        } catch (err) {
            if (err instanceof ApiError) {
                notification.error({
                    title: "Lỗi",
                    description: err.message,
                });
            } else {
                notification.error({
                    title: "Lỗi",
                    description: "Không thể tải danh sách người dùng của workspace.",
                });
            }
            setMembers([]);
        } finally {
            setLoadingMembers(false);
        }
    }, [notification]);

    const loadOrganizations = useCallback(async (workspaceId: string) => {
        if (!workspaceId) {
            setOrganizationOptions([]);
            return;
        }

        try {
            const organizationData = await api.get<unknown>(endpoints.admin.organizations);
            const organizations = extractList<Record<string, unknown>>(organizationData).map((item) => ({
                id: String(item.uuid ?? item.id ?? ""),
                name: String(item.name ?? item.title ?? ""),
                code: item.code ? String(item.code) : undefined,
                parentId: item.parentId ? String(item.parentId) : item.parent_id ? String(item.parent_id) : undefined,
            }));
            setOrganizationOptions(organizations.filter((item) => item.id && item.name));
        } catch {
            setOrganizationOptions([]);
        }
    }, []);

    const loadAccounts = useCallback(async () => {
        try {
            const accountData = await api.get<unknown>(`${endpoints.admin.accounts}?page=1&limit=100`, {
                headers: {
                    "x-workspace-id": "",
                },
            });
            setAccountOptions(extractAccounts(accountData));
        } catch {
            setAccountOptions([]);
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            setLoadingInit(true);
            try {
                const [meData, roleData] = await Promise.all([
                    api.get<unknown>(endpoints.auth.me),
                    api.get<unknown>(endpoints.admin.roles),
                ]);
                await loadAccounts();

                const actorIsSuperAdmin = extractIsSuperAdminFromMe(meData) || Boolean(currentAccount?.isSuperAdmin);
                setIsSuperAdmin(actorIsSuperAdmin);

                const optionsFromMe = extractWorkspaceOptionsFromMe(meData);
                const roleList = extractList<Role>(roleData);
                setRoles(roleList);

                const persistedWorkspaceId = getWorkspaceId();
                const activeWorkspaceId = resolveWorkspaceIdFromMePayload(meData);
                let initialWorkspaceId = "";

                if (actorIsSuperAdmin) {
                    const workspaceData = await api.get<unknown>(endpoints.workspaces).catch(() => null);
                    const optionsFromWorkspaceList = workspaceData
                        ? extractWorkspaceOptionsFromWorkspaceList(workspaceData)
                        : [];

                    const optionMap = new Map<string, WorkspaceOption>();
                    // Keep /workspaces as the primary source/order for admin dropdown consistency.
                    optionsFromWorkspaceList.forEach((option) => {
                        optionMap.set(option.id, option);
                    });
                    optionsFromMe.forEach((option) => {
                        if (!optionMap.has(option.id)) {
                            optionMap.set(option.id, option);
                        }
                    });

                    const options = Array.from(optionMap.values());
                    setWorkspaceOptions(options);

                    const primaryWorkspaceId = optionsFromWorkspaceList[0]?.id || "";
                    const fallbackWorkspaceId = options[0]?.id || "";
                    initialWorkspaceId =
                        (persistedWorkspaceId && optionMap.has(persistedWorkspaceId) ? persistedWorkspaceId : "") ||
                        primaryWorkspaceId ||
                        activeWorkspaceId ||
                        fallbackWorkspaceId;
                } else {
                    const memberWorkspaceId =
                        activeWorkspaceId ||
                        currentAccount?.workspaceId ||
                        optionsFromMe[0]?.id ||
                        persistedWorkspaceId ||
                        "";
                    const memberWorkspaceOption =
                        optionsFromMe.find((option) => option.id === memberWorkspaceId) ||
                        (memberWorkspaceId
                            ? {
                                id: memberWorkspaceId,
                                name: `Workspace ${memberWorkspaceId.slice(0, 8)}`,
                            }
                            : null);
                    setWorkspaceOptions(memberWorkspaceOption ? [memberWorkspaceOption] : []);
                    initialWorkspaceId = memberWorkspaceId;
                }

                setSelectedWorkspaceId(initialWorkspaceId);
                setWorkspaceId(initialWorkspaceId);
                if (initialWorkspaceId) {
                    await loadMembers(initialWorkspaceId, "");
                }

            } catch (err) {
                if (err instanceof ApiError) {
                    notification.error({
                        title: "Lỗi",
                        description: err.message,
                    });
                } else {
                    notification.error({
                        title: "Lỗi",
                        description: "Không thể khởi tạo dữ liệu workspace membership.",
                    });
                }
            } finally {
                setLoadingInit(false);
            }
        };

        void init();
    }, [currentAccount?.isSuperAdmin, currentAccount?.workspaceId, loadAccounts, loadMembers, notification]);

    useEffect(() => {
        if (!selectedWorkspaceId) {
            setOrganizationOptions([]);
            return;
        }

        void loadOrganizations(selectedWorkspaceId);
    }, [loadOrganizations, selectedWorkspaceId]);

    const onChangeWorkspace = async (workspaceId: string) => {
        if (!workspaceId.trim()) return;

        setSelectedWorkspaceId(workspaceId);
        setWorkspaceId(workspaceId);
        setSearch("");
        setSearchDraft("");
        setPage(1);

        await Promise.all([
            loadMembers(workspaceId, ""),
            loadOrganizations(workspaceId),
        ]);
    };

    const openAddMemberModal = () => {
        const defaultRoleId = roleSelectOptions[0]?.value;

        addMemberForm.setFieldsValue({
            accountId: undefined,
            roleId: defaultRoleId,
            organizationId: undefined,
        });
        setShowAddForm(true);
    };

    const closeAddMemberModal = () => {
        addMemberForm.resetFields();
        setShowAddForm(false);
    };

    const onAddMember = async (values: { accountId?: string; roleId?: string; organizationId?: string }) => {
        const accountId = String(values.accountId ?? "").trim();
        const roleId = String(values.roleId ?? "").trim();
        const organizationId = String(values.organizationId ?? "").trim();

        if (!selectedWorkspaceId) {
            notification.warning({
                title: "Thiếu thông tin",
                description: "Vui lòng chọn workspace.",
            });
            return;
        }
        if (!accountId) {
            notification.warning({
                title: "Thiếu thông tin",
                description: "Vui lòng chọn tài khoản người dùng.",
            });
            return;
        }
        if (!roleId) {
            notification.warning({
                title: "Thiếu thông tin",
                description: "Vui lòng chọn role.",
            });
            return;
        }

        const selectedAccount = accountById.get(accountId);
        if (!selectedAccount?.email) {
            notification.error({
                title: "Lỗi",
                description: "Không tìm thấy email của tài khoản đã chọn.",
            });
            return;
        }

        setAdding(true);
        try {
            await api.post<unknown>(endpoints.members(selectedWorkspaceId), {
                email: selectedAccount.email,
                role: normalizeRoleInput(roleId),
                organizationId: organizationId || undefined,
            });

            closeAddMemberModal();
            notification.success({
                title: "Thành công",
                description: "Thêm thành viên thành công.",
            });
            await loadMembers(selectedWorkspaceId, search);
        } catch (err) {
            if (err instanceof ApiError) {
                notification.error({
                    title: "Lỗi",
                    description: err.message,
                });
            } else {
                notification.error({
                    title: "Lỗi",
                    description: "Không thể thêm thành viên.",
                });
            }
        } finally {
            setAdding(false);
        }
    };

    const handleSubmitAddMember = async () => {
        const values = await addMemberForm.validateFields();
        await onAddMember(values);
    };

    const onUpdateMemberRole = async (memberId: string) => {
        if (!selectedWorkspaceId || !memberId) {
            return;
        }
        const role = roleDraftByMemberId[memberId];
        const organizationId = organizationDraftByMemberId[memberId] || undefined;
        if (!role) {
            notification.warning({
                title: "Thiếu thông tin",
                description: "Vui lòng chọn role hợp lệ.",
            });
            return;
        }

        setSavingMemberId(memberId);
        try {
            await api.put<unknown>(`${endpoints.members(selectedWorkspaceId)}/${memberId}/role`, {
                role: normalizeRoleInput(role),
                organizationId,
            });
            notification.success({
                title: "Thành công",
                description: "Cập nhật role thành công.",
            });
            setUpdateTarget(null);
            await loadMembers(selectedWorkspaceId, search);
        } catch (err) {
            if (err instanceof ApiError) {
                notification.error({
                    title: "Lỗi",
                    description: err.message,
                });
            } else {
                notification.error({
                    title: "Lỗi",
                    description: "Không thể cập nhật role cho member.",
                });
            }
        } finally {
            setSavingMemberId(null);
        }
    };

    const requestUpdateMember = (memberId: string, memberName: string) => {
        if (!memberId) {
            return;
        }

        setUpdateTarget({ id: memberId, name: memberName });
    };

    const requestRemoveMember = (memberId: string, memberName: string) => {
        if (!memberId) {
            return;
        }

        setRemoveTarget({ id: memberId, name: memberName });
    };

    const onRemoveMember = async () => {
        const memberId = removeTarget?.id;
        if (!selectedWorkspaceId || !memberId) {
            return;
        }
        setRemovingMemberId(memberId);
        try {
            await api.delete(`${endpoints.members(selectedWorkspaceId)}/${memberId}`);
            notification.success({
                title: "Thành công",
                description: "Đã xóa member khỏi workspace.",
            });
            setRemoveTarget(null);
            await loadMembers(selectedWorkspaceId, search);
        } catch (err) {
            if (err instanceof ApiError) {
                notification.error({
                    title: "Lỗi",
                    description: err.message,
                });
            } else {
                notification.error({
                    title: "Lỗi",
                    description: "Không thể xóa member.",
                });
            }
        } finally {
            setRemovingMemberId(null);
        }
    };

    const handleSearch = () => {
        const nextSearch = searchDraft.trim();

        if (page !== 1) {
            setPage(1);
        }

        if (nextSearch !== search) {
            setSearch(nextSearch);
        }

        if (selectedWorkspaceId) {
            void loadMembers(selectedWorkspaceId, nextSearch);
        }
    };

    const handleResetSearch = () => {
        setSearchDraft("");

        if (search) {
            setSearch("");
        }

        if (page !== 1) {
            setPage(1);
        }

        if (selectedWorkspaceId) {
            void loadMembers(selectedWorkspaceId, "");
        }
    };

    const workspaceSelectOptions = workspaceOptions.map((workspace) => ({
        label: workspace.name,
        value: workspace.id,
    }));

    const accountSelectOptions = availableAccountOptions.map((account) => ({
        label: `${account.fullName || "(Chưa có tên)"} - ${account.email}${account.status ? ` [${account.status}]` : ""}`,
        value: account.id,
    }));

    const roleSelectOptions = assignableRoles.map((role) => ({
        label: role.name || role.code || "Không tên",
        value: roleKey(role),
    }));
    const addOrganizationId = Form.useWatch("organizationId", addMemberForm) ?? "";

    const memberColumns: TableColumnsType<WorkspaceMember> = [
        {
            key: "stt",
            title: "STT",
            width: 70,
            align: "center",
            render: (_, __, index) => (page - 1) * rowsPerPage + index + 1,
        },
        {
            key: "name",
            title: "Họ tên",
            width: 200,
            render: (_, member) => {
                const memberName = member.profile?.name || member.account?.fullName || "-";
                return (
                    <div>
                        <div style={{ fontWeight: 600, color: "#1f1f1f" }}>{memberName}</div>
                    </div>
                );
            },
        },
        {
            key: "email",
            title: "Email",
            width: 200,
            render: (_, member) => member.account?.email || "-",
        },
        {
            key: "organization",
            title: "Đơn vị hiện tại",
            width: 200,
            render: (_, member) => {
                const currentOrganizationId = String(member.membership?.organizationId || member.organization?.uuid || "");
                return organizationNameById.get(currentOrganizationId) || member.organization?.name || "-";
            },
        },
        {
            key: "roleCurrent",
            title: "Role hiện tại",
            width: 140,
            render: (_, member) => {
                const currentRoleId = String(member.membership?.roleId || "");
                return (
                    <Tag color="processing" style={{ marginInlineEnd: 0 }}>
                        {roleNameById.get(currentRoleId) || currentRoleId || "-"}
                    </Tag>
                );
            },
        },
        {
            key: "roleDraft",
            title: "Đổi role",
            width: 220,
            render: (_, member) => {
                const memberId = String(member.membership?.uuid || "");
                const currentRoleId = String(member.membership?.roleId || "");
                const draftRoleId = roleDraftByMemberId[memberId] || currentRoleId;

                return (
                    <Select
                        value={draftRoleId || undefined}
                        options={roleSelectOptions}
                        placeholder="Chọn role"
                        style={{ width: "100%", height: '40px' }}
                        onChange={(value) =>
                            setRoleDraftByMemberId((prev) => ({
                                ...prev,
                                [memberId]: String(value ?? ""),
                            }))
                        }
                    />
                );
            },
        },
        {
            key: "organizationDraft",
            title: "Đổi đơn vị",
            width: 150,
            render: (_, member) => {
                const memberId = String(member.membership?.uuid || "");
                const currentOrganizationId = String(member.membership?.organizationId || member.organization?.uuid || "");
                const draftOrganizationId = organizationDraftByMemberId[memberId] ?? currentOrganizationId;

                return (
                    <OrganizationTreeSelect
                        value={draftOrganizationId}
                        onChange={(nextOrganizationId) =>
                            setOrganizationDraftByMemberId((prev) => ({
                                ...prev,
                                [memberId]: nextOrganizationId,
                            }))
                        }
                        options={organizationOptions}
                        placeholder="Chọn đơn vị"
                    />
                );
            },
        },
        {
            key: "actions",
            title: "Hành động",
            width: 120,
            fixed: "right",
            render: (_, member) => {
                const memberId = String(member.membership?.uuid || "");
                const currentRoleId = String(member.membership?.roleId || "");
                const currentOrganizationId = String(member.membership?.organizationId || member.organization?.uuid || "");
                const draftRoleId = roleDraftByMemberId[memberId] || currentRoleId;
                const draftOrganizationId = organizationDraftByMemberId[memberId] ?? currentOrganizationId;
                const memberName =
                    member.account?.fullName ||
                    member.profile?.name ||
                    member.account?.email ||
                    memberId;

                return (
                    <div className={"flex gap-1"}>
                        <button
                            type="button"
                            title="Lưu thay đổi"
                            onClick={() => requestUpdateMember(memberId, memberName)}
                            disabled={
                                !memberId ||
                                savingMemberId === memberId ||
                                (draftRoleId === currentRoleId && draftOrganizationId === currentOrganizationId)
                            }
                        >
                            <ActionIcon action={"check"} />
                        </button>
                        <button
                            type="button"
                            title="Xóa thành viên"
                            onClick={() => requestRemoveMember(memberId, memberName)}
                            disabled={!memberId || removingMemberId === memberId}
                        >
                            <ActionIcon action={"delete"} />
                        </button>
                    </div>
                );
            },
        },
    ];

    return (
        <Row gutter={[16, 16]}>
            <Col span={24}>
                <TitleSpace
                    title={"Quản lý phân quyền"}
                    description={"Thiết lập role và đơn vị cho từng thành viên trong workspace"}
                    actions={
                        <ActionButton
                            type="create"
                            label="Thêm mới"
                            onClick={openAddMemberModal}
                            disabled={!selectedWorkspaceId && isSuperAdmin}
                        />
                    }
                />
            </Col>

            <Col span={24}>
                <FilterSpace
                    responsive={{ xs: 24, md: 12, lg: isSuperAdmin ? 8 : 12 }}
                    actionsPosition="bottom-right"
                    actions={
                        <>
                            <ActionButton
                                type="refresh"
                                variant="outlined"
                                label="Làm mới"
                                disabled={!selectedWorkspaceId || loadingMembers}
                                onClick={handleResetSearch}
                            />
                            <ActionButton
                                type="search"
                                onClick={handleSearch}
                            />

                        </>
                    }
                >
                    {isSuperAdmin ? (
                        <label className="block w-full">
                            <span className="mb-1 block text-sm" style={{ fontWeight: 600 }}>
                                Workspace đang quản lý
                            </span>
                            <Select
                                value={selectedWorkspaceId || undefined}
                                options={workspaceSelectOptions}
                                placeholder="Chọn workspace"
                                loading={loadingInit}
                                size="large"
                                allowClear
                                style={{ width: "100%" }}
                                onChange={(value) => {
                                    if (value) {
                                        void onChangeWorkspace(String(value));
                                    }
                                }}
                            />
                        </label>
                    ) : null}

                    <SearchBox
                        value={searchDraft}
                        onChange={setSearchDraft}
                        placeholder="Nhập họ tên hoặc email"
                        bold
                    />
                </FilterSpace>
            </Col>

            <Col span={24}>
                <ConfigProvider
                    theme={{
                        components: {
                            Table: {
                                headerBg: "#d4a574",
                                headerSplitColor: "transparent",
                                borderColor: "transparent",
                                lineWidth: 0,
                                cellPaddingBlock: 12,
                                cellPaddingInline: 14,
                                headerBorderRadius: 4,
                            },
                        },
                    }}
                >


                        <Spin spinning={loadingInit || loadingMembers}>
                            {!selectedWorkspaceId ? (
                                <Empty
                                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                                    description="Chưa có workspace hợp lệ để hiển thị thành viên."
                                    style={{ padding: 32 }}
                                />
                            ) : members.length === 0 ? (
                                <Empty
                                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                                    description="Workspace chưa có thành viên."
                                    style={{ padding: 32 }}
                                />
                            ) : (
                                <Table
                                    size="small"
                                    rowKey={'id'}
                                    columns={memberColumns}
                                    dataSource={pagedMembers}
                                    pagination={false}
                                    scroll={{ x: "max-content" }}
                                />
                            )}
                        </Spin>

                        <AppPagination
                            currentPage={page}
                            totalPages={totalPages}
                            totalRows={members.length}
                            rowsPerPage={rowsPerPage}
                            rowsPerPageOptions={[5, 10, 20, 50]}
                            summaryLabel={`Có ${members.length} kết quả`}
                            onRowsPerPageChange={(value) => setRowsPerPage(value)}
                            onPageChange={(nextPage) => setPage(nextPage)}
                        />
                </ConfigProvider>
            </Col>

            <ActionModal
                open={showAddForm}
                title="Thêm mới"
                width={760}
                spinning={adding}
                onOk={() => {
                    void handleSubmitAddMember();
                }}
                onCancel={closeAddMemberModal}
                actions={
                    <>
                        <ActionButton
                            type="close"
                            label="Đóng"
                            onClick={closeAddMemberModal}
                        />
                        <ActionButton
                            type="create"
                            onClick={() => {
                                void handleSubmitAddMember();
                            }}
                            disabled={adding || !selectedWorkspaceId}
                            loading={adding}
                        />
                    </>
                }
            >
                <Form
                    form={addMemberForm}
                    layout="vertical"
                    disabled={adding}
                >
                    <Row gutter={[16, 16]}>
                        <Col xs={24} md={24} xl={12}>
                            <Form.Item
                                label="Tài khoản người dùng"
                                name="accountId"
                                rules={[
                                    {
                                        required: true,
                                        message: "Vui lòng chọn tài khoản người dùng.",
                                    },
                                ]}
                            >
                                <Select
                                    options={accountSelectOptions}
                                    placeholder="Chọn tài khoản người dùng"
                                    size="large"
                                    showSearch
                                    optionFilterProp="label"
                                    style={{ width: "100%" }}
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12} xl={6}>
                            <Form.Item
                                label="Role"
                                name="roleId"
                                rules={[
                                    {
                                        required: true,
                                        message: "Vui lòng chọn role.",
                                    },
                                ]}
                            >
                                <Select
                                    options={roleSelectOptions}
                                    placeholder="Chọn role"
                                    size="large"
                                    style={{ width: "100%" }}
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12} xl={6}>
                            <Form.Item
                                label="Đơn vị"
                                name="organizationId"
                            >
                                <OrganizationTreeSelect
                                    value={addOrganizationId}
                                    onChange={(nextValue) => addMemberForm.setFieldValue("organizationId", nextValue)}
                                    options={organizationOptions}
                                    placeholder="Chọn đơn vị"
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </ActionModal>

            <ConfirmModal
                open={Boolean(updateTarget)}
                title="Xác nhận cập nhật thành viên"
                okText={savingMemberId ? "Đang lưu..." : "Lưu"}
                loading={Boolean(savingMemberId)}
                spinning={Boolean(savingMemberId)}
                onOk={() => {
                    if (updateTarget?.id) {
                        void onUpdateMemberRole(updateTarget.id);
                    }
                }}
                onCancel={() => setUpdateTarget(null)}
                content={
                    updateTarget ? (
                        <p style={{ marginBottom: 0 }}>
                            Bạn có chắc muốn lưu thay đổi phân quyền cho <span className="font-semibold">{updateTarget.name}</span>?
                        </p>
                    ) : null
                }
            />

            <ConfirmModal
                open={Boolean(removeTarget)}
                title="Xác nhận xóa thành viên"
                variant="danger"
                okText={removingMemberId ? "Đang xóa..." : "Xóa"}
                loading={Boolean(removingMemberId)}
                spinning={Boolean(removingMemberId)}
                onOk={() => {
                    void onRemoveMember();
                }}
                onCancel={() => setRemoveTarget(null)}
                content={
                    removeTarget ? (
                        <p style={{ marginBottom: 0 }}>
                            Bạn có chắc muốn gỡ <span className="font-semibold">{removeTarget.name}</span> khỏi workspace này?
                        </p>
                    ) : null
                }
            />
        </Row>
    );
}

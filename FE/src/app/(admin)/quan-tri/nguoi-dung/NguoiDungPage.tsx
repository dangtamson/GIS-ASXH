"use client";

import {App, Col, Form, Input, Radio, Row, Select, Switch, TreeSelect} from "antd";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";

import {api, ApiError} from "@/lib/api";
import {getAccount, getWorkspaceId} from "@/lib/auth";
import {extractList} from "@/lib/data-utils";
import {endpoints} from "@/lib/endpoints";

import {
    ActionButton,
    ActionModal,
    ConfirmModal,
    FilterSpace,
    SearchBox,
    TitleSpace,
} from "@/components/controller";
import ActionIcon from "@/components/controller/ActionIcon";

type Account = {
    id: string;
    fullName: string;
    email: string;
    phone?: string;
    status?: string;
    isSuperAdmin?: boolean;
    isAdmin?: boolean;
    createdAt?: string;
    workspaceId?: string;
    organizationId?: string;
    workspaceName?: string;
    organizationName?: string;
};

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
    workspaceId?: string;
};

type MembershipRecord = {
    id: string;
    workspaceId: string;
    accountId?: string;
    organizationId?: string;
    roleId?: string;
    roleCode?: string;
    isAdmin?: boolean;
};

type PaginationInfo = {
    page?: number;
    limit?: number;
    total?: number;
    pages?: number;
};

type ModalMode = "create" | "edit";
type AccountType = "user" | "workspace_admin" | "super_admin";

type UserFormState = {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    status: "active" | "inactive";
    accountType: AccountType;
    workspaceId: string;
    role: string;
    organizationId: string;
};

type PermissionFormState = {
    workspaceId: string;
    role: string;
    organizationId: string;
    membershipId?: string;
    isAdmin?: boolean;
};

type TreeNode = {
    value: string;
    title: string;
    children?: TreeNode[];
};

type SecurityPolicy = {
    minPasswordLength?: number;
    maxPasswordLength?: number;
    requireLowercase?: boolean;
    requireUppercase?: boolean;
    requireNumber?: boolean;
    requireSpecialChar?: boolean;
    passwordImportDefault?: string;
    forceChangePasswordOnFirstLogin?: boolean;
};

function validatePassword(password: string, policy: SecurityPolicy | null): string | null {
    if (!policy) return null;
    const minPasswordLength = Number(policy.minPasswordLength ?? 0) || 0;
    const maxPasswordLength = Number(policy.maxPasswordLength ?? 0) || 0;

    if (password.length < minPasswordLength) return `Mật khẩu phải có ít nhất ${minPasswordLength} ký tự.`;
    if (maxPasswordLength > 0 && password.length > maxPasswordLength) {
        return `Mật khẩu không được vượt quá ${maxPasswordLength} ký tự.`;
    }
    if (policy.requireLowercase && !/[a-z]/.test(password)) return "Mật khẩu phải chứa ít nhất một chữ cái thường.";
    if (policy.requireUppercase && !/[A-Z]/.test(password)) return "Mật khẩu phải chứa ít nhất một chữ cái hoa.";
    if (policy.requireNumber && !/\d/.test(password)) return "Mật khẩu phải chứa ít nhất một số.";
    if (policy.requireSpecialChar && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return "Mật khẩu phải chứa ít nhất một ký tự đặc biệt.";
    return null;
}

function validateEmail(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
        return "Email không hợp lệ.";
    }

    return null;
}

function validatePhone(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const phoneRegex = /^(0|\+84)[0-9]{9,10}$/;
    if (!phoneRegex.test(trimmed)) {
        return "Số điện thoại không hợp lệ.";
    }

    return null;
}

function getDefaultPassword(policy: SecurityPolicy | null): string {
    const rawValue = typeof policy?.passwordImportDefault === "string" ? policy.passwordImportDefault : "";
    return rawValue.trim() ? rawValue : "";
}

function getModalErrorNotificationKey(): string {
    return "nguoi-dung-modal-error";
}

function getPermissionModalErrorNotificationKey(): string {
    return "nguoi-dung-permission-modal-error";
}

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
}

function extractAccounts(payload: unknown): Account[] {
    const root = asRecord(payload);
    const data = asRecord(root?.data) ?? root;
    const list = Array.isArray(data?.accounts) ? (data.accounts as Record<string, unknown>[]) : [];

    return list
        .map((item) => ({
            id: String(item.uuid ?? item.id ?? "").trim(),
            fullName: String(item.fullName ?? item.name ?? "").trim(),
            email: String(item.email ?? "").trim(),
            phone: item.phone ? String(item.phone) : undefined,
            status: item.status ? String(item.status) : undefined,
            isSuperAdmin: Boolean(item.isSuperAdmin),
            createdAt: item.createdAt ? String(item.createdAt) : undefined,
            workspaceId: item.workspaceId
                ? String(item.workspaceId)
                : item.workspace_id
                  ? String(item.workspace_id)
                  : undefined,
            organizationId: item.organizationId
                ? String(item.organizationId)
                : item.organization_id
                  ? String(item.organization_id)
                  : undefined,
            workspaceName: item.workspaceName
                ? String(item.workspaceName)
                : item.workspace_name
                  ? String(item.workspace_name)
                  : undefined,
            organizationName: item.organizationName
                ? String(item.organizationName)
                : item.organization_name
                  ? String(item.organization_name)
                  : undefined,
        }))
        .filter((item) => item.id.length > 0);
}

function extractRoles(payload: unknown): Role[] {
    return extractList<Role>(payload);
}

function extractWorkspaceOptions(payload: unknown): WorkspaceOption[] {
    const root = asRecord(payload);
    const data = asRecord(root?.data) ?? root;
    const fromAdminList = Array.isArray(data?.workspaces) ? (data.workspaces as Record<string, unknown>[]) : [];
    const fallback = extractList<Record<string, unknown>>(payload);
    const source = fromAdminList.length > 0 ? fromAdminList : fallback;

    const options = source
        .map((item) => {
            const nestedWorkspace = asRecord(item.workspace);
            const workspace = nestedWorkspace ?? item;
            const id = String(workspace.uuid ?? workspace.id ?? "").trim();
            const name = String(workspace.name ?? "").trim();
            if (!id) return null;
            return { id, name: name || `Workspace ${id.slice(0, 8)}` };
        })
        .filter(Boolean) as WorkspaceOption[];

    const unique = new Map<string, WorkspaceOption>();
    options.forEach((option) => {
        if (!unique.has(option.id)) unique.set(option.id, option);
    });

    return Array.from(unique.values());
}

function extractOrganizationOptions(payload: unknown): OrganizationOption[] {
    const list = extractList<Record<string, unknown>>(payload);
    return list
        .map((item) => ({
            id: String(item.uuid ?? item.id ?? "").trim(),
            name: String(item.name ?? item.title ?? "").trim(),
            code: item.code ? String(item.code) : undefined,
            parentId: item.parentId ? String(item.parentId) : item.parent_id ? String(item.parent_id) : undefined,
            workspaceId: item.workspaceId ? String(item.workspaceId) : item.workspace_id ? String(item.workspace_id) : undefined,
        }))
        .filter((item) => item.id && item.name);
}

function mergeOrganizations(payloads: unknown[]): OrganizationOption[] {
    const merged = new Map<string, OrganizationOption>();

    payloads.forEach((payload) => {
        extractOrganizationOptions(payload).forEach((option) => {
            if (!merged.has(option.id)) merged.set(option.id, option);
        });
    });

    return Array.from(merged.values());
}

function extractMemberships(payload: unknown): MembershipRecord[] {
    const root = asRecord(payload);
    const data = asRecord(root?.data) ?? root;
    const list = Array.isArray(data?.memberships) ? (data.memberships as Record<string, unknown>[]) : [];

    return list
        .map((row) => {
            const membership = asRecord(row.membership) ?? row;
            const role = asRecord(row.role);
            return {
                id: String(membership.uuid ?? membership.id ?? "").trim(),
                workspaceId: String(membership.workspaceId ?? membership.workspace_id ?? "").trim(),
                accountId: String(membership.accountId ?? membership.account_id ?? "").trim() || undefined,
                organizationId: String(membership.organizationId ?? membership.organization_id ?? "").trim() || undefined,
                roleId: String(membership.roleId ?? membership.role_id ?? "").trim() || undefined,
                roleCode: String(role?.code ?? membership.roleCode ?? membership.role_code ?? "").trim() || undefined,
                isAdmin: Boolean(membership.isAdmin ?? membership.is_admin),
            };
        })
        .filter((row) => row.id && row.workspaceId);
}

function extractPagination(payload: unknown): PaginationInfo {
    const root = asRecord(payload);
    const data = asRecord(root?.data) ?? root;
    const pagination = asRecord(data?.pagination);

    return {
        page: Number(pagination?.page ?? 1) || 1,
        limit: Number(pagination?.limit ?? 10) || 10,
        total: Number(pagination?.total ?? 0) || 0,
        pages: Number(pagination?.pages ?? 1) || 1,
    };
}

function extractSecurityPolicy(payload: unknown): SecurityPolicy | null {
    const root = asRecord(payload);
    const item = asRecord(root?.item);
    const policy = asRecord(item?.securityPolicy);

    if (!policy) return null;

    return {
        minPasswordLength: Number(policy.minPasswordLength ?? 0) || 0,
        maxPasswordLength: Number(policy.maxPasswordLength ?? 0) || 0,
        requireLowercase: Boolean(policy.requireLowercase),
        requireUppercase: Boolean(policy.requireUppercase),
        requireNumber: Boolean(policy.requireNumber),
        requireSpecialChar: Boolean(policy.requireSpecialChar),
        passwordImportDefault:
            typeof policy.passwordImportDefault === "string" ? policy.passwordImportDefault : undefined,
        forceChangePasswordOnFirstLogin: Boolean(policy.forceChangePasswordOnFirstLogin),
    };
}

function roleKey(role: Role): string {
    return String(role.id ?? role.uuid ?? "").trim();
}

function normalizeRoleInput(value: string): string | number {
    const trimmed = value.trim();
    return /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
}

function membershipAccountTypeValue(input: { isSuperAdmin?: boolean; membershipIsAdmin?: boolean }): AccountType {
    if (input.isSuperAdmin) return "super_admin";
    if (input.membershipIsAdmin) return "workspace_admin";
    return "user";
}

function normalizeStatus(value: string | undefined): "Hoạt động" | "Không hoạt động" {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (["inactive", "suspended", "disabled", "ngung", "ngưng"].includes(normalized)) {
        return "Không hoạt động";
    }
    return "Hoạt động";
}

function statusBadgeClass(value: string | undefined): string {
    return normalizeStatus(value) === "Hoạt động"
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
        : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
}

function buildOrganizationTree(options: OrganizationOption[]): TreeNode[] {
    const nodeMap = new Map<string, TreeNode & { parentId?: string }>();

    options.forEach((option) => {
        nodeMap.set(option.id, {
            value: option.id,
            title: option.code ? `${option.name} (${option.code})` : option.name,
            parentId: option.parentId,
            children: [],
        });
    });

    const roots: (TreeNode & { parentId?: string })[] = [];

    nodeMap.forEach((node) => {
        if (node.parentId && nodeMap.has(node.parentId)) {
            nodeMap.get(node.parentId)?.children?.push(node);
        } else {
            roots.push(node);
        }
    });

    const sortNodes = (nodes: (TreeNode & { parentId?: string })[]) => {
        nodes.sort((a, b) => String(a.title).localeCompare(String(b.title), "vi"));
        nodes.forEach((node) => sortNodes((node.children || []) as (TreeNode & { parentId?: string })[]));
    };

    sortNodes(roots);
    return roots;
}

const emptyUserForm: UserFormState = {
    fullName: "",
    email: "",
    phone: "",
    password: "",
    status: "active",
    accountType: "user",
    workspaceId: "",
    role: "",
    organizationId: "",
};

const emptyPermissionForm: PermissionFormState = {
    workspaceId: "",
    role: "",
    organizationId: "",
    isAdmin: false,
};

export default function NguoiDungPage() {
    const { notification } = App.useApp();
    const [userForm] = Form.useForm<UserFormState>();
    const [permissionForm] = Form.useForm<PermissionFormState>();

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
    const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
    const [securityPolicy, setSecurityPolicy] = useState<SecurityPolicy | null>(null);
    const [serverTotalPages, setServerTotalPages] = useState(1);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [permissionSaving, setPermissionSaving] = useState(false);
    const [loadingPermissionForm, setLoadingPermissionForm] = useState(false);

    const [search, setSearch] = useState("");
    const [appliedSearch, setAppliedSearch] = useState("");
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [searchResults, setSearchResults] = useState<Account[]>([]);

    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<ModalMode>("create");
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [permissionModalOpen, setPermissionModalOpen] = useState(false);
    const [permissionTarget, setPermissionTarget] = useState<Account | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);

    const referenceLoadedRef = useRef(false);
    const searchCacheRef = useRef<{ keyword: string; results: Account[] } | null>(null);

    const creatorAccount = useMemo(() => getAccount(), []);
    const creatorIsSuperAdmin = Boolean(creatorAccount?.isSuperAdmin);
    const creatorWorkspaceId = useMemo(
        () => String(creatorAccount?.workspaceId || getWorkspaceId() || "").trim(),
        [creatorAccount?.workspaceId]
    );

    const lockWorkspaceByCreator =
        (modalMode === "create" || modalMode === "edit") && !creatorIsSuperAdmin;
    const lockAccountTypeByCreator =
        (modalMode === "create" || modalMode === "edit") && !creatorIsSuperAdmin;
    const userWorkspaceId = Form.useWatch("workspaceId", userForm);
    const permissionWorkspaceId = Form.useWatch("workspaceId", permissionForm);
    const roleOptions = useMemo(
        () => roles.filter((role) => String(role.status ?? "Hoạt động") !== "Ngưng"),
        [roles]
    );

    const roleLabelById = useMemo(() => {
        const map = new Map<string, string>();
        roleOptions.forEach((role) => {
            map.set(roleKey(role), role.name || role.code || "-");
        });
        return map;
    }, [roleOptions]);

    const organizationLabelById = useMemo(() => {
        const map = new Map<string, string>();
        organizations.forEach((org) => {
            map.set(org.id, org.code ? `${org.name} (${org.code})` : org.name);
        });
        return map;
    }, [organizations]);

    const workspaceSelectOptions = useMemo(
        () => workspaces.map((workspace) => ({ label: workspace.name, value: workspace.id })),
        [workspaces]
    );
    const roleSelectOptions = useMemo(
        () => roleOptions.map((role) => ({ label: roleLabelById.get(roleKey(role)) || "-", value: roleKey(role) })),
        [roleLabelById, roleOptions]
    );
    const userOrganizations = useMemo(() => {
        if (!userWorkspaceId) return organizations;
        return organizations.filter((org) => !org.workspaceId || org.workspaceId === userWorkspaceId);
    }, [organizations, userWorkspaceId]);
    const permissionOrganizations = useMemo(() => {
        if (!permissionWorkspaceId) return organizations;
        return organizations.filter((org) => !org.workspaceId || org.workspaceId === permissionWorkspaceId);
    }, [organizations, permissionWorkspaceId]);
    const userOrganizationTree = useMemo(
        () => buildOrganizationTree(userOrganizations),
        [userOrganizations]
    );
    const permissionOrganizationTree = useMemo(
        () => buildOrganizationTree(permissionOrganizations),
        [permissionOrganizations]
    );

    const isSearchMode = appliedSearch.trim().length > 0;
    const totalPages = useMemo(() => {
        if (!isSearchMode) return Math.max(1, serverTotalPages);
        return Math.max(1, Math.ceil(searchResults.length / rowsPerPage));
    }, [isSearchMode, rowsPerPage, searchResults.length, serverTotalPages]);

    const visibleAccounts = useMemo(() => {
        if (!isSearchMode) return accounts;
        const start = (page - 1) * rowsPerPage;
        return searchResults.slice(start, start + rowsPerPage);
    }, [accounts, isSearchMode, page, rowsPerPage, searchResults]);

    const totalVisibleAccounts = isSearchMode ? searchResults.length : accounts.length;

    useEffect(() => {
        setPage(1);
    }, [appliedSearch, rowsPerPage]);

    useEffect(() => {
        if (page < 1) {
            setPage(1);
            return;
        }
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const loadReferenceData = useCallback(async () => {
        const [rolesResp, workspacesResp, configResp] = await Promise.all([
            api.get<unknown>(endpoints.admin.roles),
            api.get<unknown>(`${endpoints.admin.workspaces}?page=1&limit=100`),
            api.get<unknown>(endpoints.admin.systemConfig),
        ]);

        const nextRoles = extractRoles(rolesResp);
        const nextWorkspaces = extractWorkspaceOptions(workspacesResp);

        const organizationPayloads = await Promise.all(
            nextWorkspaces.map(() =>
                api
                    .get<unknown>(endpoints.admin.organizations, {
                    })
                    .catch(() => null)
            )
        );

        const nextOrganizations = mergeOrganizations(
            organizationPayloads.filter((payload): payload is unknown => payload !== null)
        );

        setRoles(nextRoles);
        setWorkspaces(nextWorkspaces);
        setOrganizations(nextOrganizations);
        const nextSecurityPolicy = extractSecurityPolicy(configResp);
        setSecurityPolicy(nextSecurityPolicy);
        referenceLoadedRef.current = true;
        return nextSecurityPolicy;
    }, []);

    const defaultWorkspaceId = useMemo(
        () => creatorIsSuperAdmin ? workspaces[0]?.id || creatorWorkspaceId : creatorWorkspaceId,
        [creatorIsSuperAdmin, creatorWorkspaceId, workspaces]
    );
    const defaultRoleId = useMemo(() => roleKey(roleOptions[0] || {}), [roleOptions]);

    const resetModalValidationState = () => {
        notification.destroy(getModalErrorNotificationKey());
    };

    const resetPermissionModalValidationState = () => {
        notification.destroy(getPermissionModalErrorNotificationKey());
    };

    const resolveMembershipRole = useCallback((membership: MembershipRecord | null | undefined): string => {
        if (!membership) return defaultRoleId;

        let mappedRole = membership.roleId || "";
        if (!mappedRole && membership.roleCode) {
            const matchedRole = roleOptions.find(
                (role) => String(role.code ?? "").trim().toLowerCase() === membership.roleCode?.toLowerCase()
            );
            mappedRole = matchedRole ? roleKey(matchedRole) : "";
        }

        return mappedRole || defaultRoleId;
    }, [defaultRoleId, roleOptions]);

    const getScopedWorkspaceId = useCallback((account: Account): string => {
        if (!creatorIsSuperAdmin) {
            return creatorWorkspaceId;
        }

        return String(account.workspaceId ?? "").trim() || defaultWorkspaceId;
    }, [creatorIsSuperAdmin, creatorWorkspaceId, defaultWorkspaceId]);

    const loadWorkspaceAdminMap = useCallback(async (workspaceId: string): Promise<Map<string, boolean>> => {
        const normalizedWorkspaceId = String(workspaceId ?? "").trim();
        if (!normalizedWorkspaceId) {
            return new Map<string, boolean>();
        }

        const adminMap = new Map<string, boolean>();
        let nextPage = 1;
        let totalPages = 1;

        do {
            const response = await api.get<unknown>(
                `${endpoints.admin.memberships}?workspaceId=${normalizedWorkspaceId}&page=${nextPage}&limit=100`
            );
            const memberships = extractMemberships(response);
            memberships.forEach((membership) => {
                if (membership.accountId) {
                    adminMap.set(membership.accountId, Boolean(membership.isAdmin));
                }
            });
            totalPages = Math.max(1, Number(extractPagination(response).pages ?? 1) || 1);
            nextPage += 1;
        } while (nextPage <= totalPages);

        return adminMap;
    }, []);

    const hydrateAccountsWithMembershipAdmin = useCallback(async (items: Account[]): Promise<Account[]> => {
        if (!items.length) {
            return items;
        }

        const workspaceIds = Array.from(new Set(
            items
                .map((item) => getScopedWorkspaceId(item))
                .filter((workspaceId) => workspaceId.length > 0)
        ));

        if (!workspaceIds.length) {
            return items.map((item) => ({ ...item, isAdmin: false }));
        }

        const workspaceAdminMaps = await Promise.all(
            workspaceIds.map(async (workspaceId) => ([workspaceId, await loadWorkspaceAdminMap(workspaceId)] as const))
        );
        const adminMapByWorkspace = new Map<string, Map<string, boolean>>(workspaceAdminMaps);

        return items.map((item) => {
            const scopedWorkspaceId = getScopedWorkspaceId(item);
            const isAdmin = adminMapByWorkspace.get(scopedWorkspaceId)?.get(item.id) ?? false;
            return {
                ...item,
                isAdmin,
            };
        });
    }, [getScopedWorkspaceId, loadWorkspaceAdminMap]);

    const loadAccountsPage = useCallback(async () => {
        const params = new URLSearchParams({
            page: String(page),
            limit: String(rowsPerPage),
        });
        const accountsResp = await api.get<unknown>(`${endpoints.admin.accounts}?${params.toString()}`);
        const nextAccounts = await hydrateAccountsWithMembershipAdmin(extractAccounts(accountsResp));
        const pagination = extractPagination(accountsResp);

        setAccounts(nextAccounts);
        setServerTotalPages(Math.max(1, Number(pagination.pages ?? 1) || 1));
    }, [hydrateAccountsWithMembershipAdmin, page, rowsPerPage]);

    const loadSearchResults = useCallback(
        async (force = false) => {
            const keyword = appliedSearch.trim().toLowerCase();

            if (!keyword) {
                setSearchResults([]);
                return;
            }

            if (!force && searchCacheRef.current?.keyword === keyword) {
                setSearchResults(searchCacheRef.current.results);
                return;
            }

            const requestPageSize = 100;
            let nextPage = 1;
            let apiTotalPages = 1;
            const allAccounts: Account[] = [];

            do {
                const params = new URLSearchParams({
                    page: String(nextPage),
                    limit: String(requestPageSize),
                });
                const response = await api.get<unknown>(`${endpoints.admin.accounts}?${params.toString()}`);
                allAccounts.push(...extractAccounts(response));
                apiTotalPages = Math.max(1, Number(extractPagination(response).pages ?? 1) || 1);
                nextPage += 1;
            } while (nextPage <= apiTotalPages);

            const hydratedAccounts = await hydrateAccountsWithMembershipAdmin(allAccounts);
            const nextResults = hydratedAccounts.filter((item) => (
                item.fullName.toLowerCase().includes(keyword) ||
                item.email.toLowerCase().includes(keyword) ||
                String(item.phone || "").toLowerCase().includes(keyword)
            ));

            searchCacheRef.current = { keyword, results: nextResults };
            setSearchResults(nextResults);
        },
        [appliedSearch, hydrateAccountsWithMembershipAdmin]
    );

    const loadData = useCallback(
        async (options?: { forceSearch?: boolean; reloadReferences?: boolean }) => {
            setLoading(true);
            try {
                if (options?.reloadReferences || !referenceLoadedRef.current) {
                    await loadReferenceData();
                }

                if (isSearchMode) {
                    await loadSearchResults(Boolean(options?.forceSearch));
                } else {
                    setSearchResults([]);
                    await loadAccountsPage();
                }
            } catch (err) {
                setAccounts([]);
                setSearchResults([]);
                setServerTotalPages(1);
                notification.error({
                    title: "Lỗi",
                    description:
                        err instanceof ApiError ? err.message : "Không thể tải dữ liệu quản lý người dùng.",
                });
            } finally {
                setLoading(false);
            }
        },
        [isSearchMode, loadAccountsPage, loadReferenceData, loadSearchResults, notification]
    );

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const loadAccountMembership = useCallback(async (accountId: string, workspaceId: string) => {
        if (!accountId.trim() || !workspaceId.trim()) {
            return {
                membershipId: undefined,
                role: defaultRoleId,
                organizationId: "",
                isAdmin: false,
            };
        }

        const membershipsResp = await api.get<unknown>(
            `${endpoints.admin.memberships}?accountId=${accountId}&workspaceId=${workspaceId}&page=1&limit=100`
        );
        const memberships = extractMemberships(membershipsResp);
        const targetMembership =
            memberships.find((membership) => membership.workspaceId === workspaceId) || memberships[0];

        return {
            membershipId: targetMembership?.id,
            role: resolveMembershipRole(targetMembership),
            organizationId: targetMembership?.organizationId || "",
            isAdmin: Boolean(targetMembership?.isAdmin),
        };
    }, [defaultRoleId, resolveMembershipRole]);

    const handleUserWorkspaceChange = useCallback(async (nextWorkspaceId: string) => {
        userForm.setFieldsValue({
            workspaceId: nextWorkspaceId,
            organizationId: "",
            role: defaultRoleId,
        });

        if (modalMode !== "edit" || !editingAccount) {
            return;
        }

        try {
            const membership = await loadAccountMembership(editingAccount.id, nextWorkspaceId);
            userForm.setFieldsValue({
                role: membership.role,
                organizationId: membership.organizationId,
                accountType: membershipAccountTypeValue({
                    isSuperAdmin: editingAccount.isSuperAdmin,
                    membershipIsAdmin: membership.isAdmin,
                }),
            });
        } catch {}
    }, [defaultRoleId, editingAccount, loadAccountMembership, modalMode, userForm]);

    const populatePermissionFormForWorkspace = useCallback(async (account: Account, workspaceId: string) => {
        if (!workspaceId.trim()) {
            permissionForm.setFieldsValue({
                ...emptyPermissionForm,
                workspaceId,
                role: defaultRoleId,
            });
            return;
        }

        setLoadingPermissionForm(true);
        try {
            const membership = await loadAccountMembership(account.id, workspaceId);
            permissionForm.setFieldsValue({
                workspaceId,
                role: membership.role,
                organizationId: membership.organizationId,
                membershipId: membership.membershipId,
                isAdmin: membership.isAdmin,
            });
        } finally {
            setLoadingPermissionForm(false);
        }
    }, [defaultRoleId, loadAccountMembership, permissionForm]);

    const openCreateModal = () => {
        resetModalValidationState();
        setEditingAccount(null);
        setModalMode("create");
        userForm.resetFields();
        userForm.setFieldsValue({
            ...emptyUserForm,
            password: getDefaultPassword(securityPolicy),
            workspaceId: defaultWorkspaceId,
            role: defaultRoleId,
            accountType: "user",
        });
        setModalOpen(true);
    };

    const openEditModal = async (account: Account) => {
        const initialWorkspaceId = creatorIsSuperAdmin
            ? account.workspaceId || defaultWorkspaceId
            : creatorWorkspaceId;

        resetModalValidationState();
        setEditingAccount(account);
        setModalMode("edit");
        userForm.resetFields();
        userForm.setFieldsValue({
            fullName: account.fullName || "",
            email: account.email || "",
            phone: account.phone || "",
            password: "",
            status: account.status === "inactive" ? "inactive" : "active",
            accountType: membershipAccountTypeValue({ isSuperAdmin: account.isSuperAdmin }),
            workspaceId: initialWorkspaceId,
            role: defaultRoleId,
            organizationId: account.organizationId || "",
        });
        setModalOpen(true);

        try {
            const membership = await loadAccountMembership(account.id, initialWorkspaceId);
            userForm.setFieldsValue({
                role: membership.role,
                organizationId: membership.organizationId || account.organizationId,
                accountType: membershipAccountTypeValue({
                    isSuperAdmin: account.isSuperAdmin,
                    membershipIsAdmin: membership.isAdmin,
                }),
            });
        } catch {}
    };

    const closeModal = () => {
        if (saving) return;
        resetModalValidationState();
        setModalOpen(false);
        setEditingAccount(null);
        userForm.resetFields();
    };

    const openPermissionModal = async (account: Account) => {
        const initialWorkspaceId = account.workspaceId || defaultWorkspaceId || creatorWorkspaceId;

        console.log('account', account);
        resetPermissionModalValidationState();
        setPermissionTarget(account);
        permissionForm.resetFields();
        permissionForm.setFieldsValue({
            ...emptyPermissionForm,
            workspaceId: initialWorkspaceId,
            role: defaultRoleId,
            organizationId: account.organizationId || "",
        });
        setPermissionModalOpen(true);

        try {
            await populatePermissionFormForWorkspace(account, initialWorkspaceId);
        } catch (err) {
            notification.error({
                key: getPermissionModalErrorNotificationKey(),
                title: "Lỗi",
                description: err instanceof ApiError ? err.message : "Không thể tải thông tin phân quyền người dùng.",
            });
        }
    };

    const closePermissionModal = () => {
        if (permissionSaving) return;
        resetPermissionModalValidationState();
        setPermissionModalOpen(false);
        setPermissionTarget(null);
        permissionForm.resetFields();
    };

    const handlePermissionWorkspaceChange = useCallback(async (nextWorkspaceId: string) => {
        permissionForm.setFieldsValue({
            workspaceId: nextWorkspaceId,
            role: defaultRoleId,
            organizationId: "",
            membershipId: undefined,
            isAdmin: false,
        });

        if (!permissionTarget) {
            return;
        }

        try {
            await populatePermissionFormForWorkspace(permissionTarget, nextWorkspaceId);
        } catch (err) {
            notification.error({
                key: getPermissionModalErrorNotificationKey(),
                title: "Lỗi",
                description: err instanceof ApiError ? err.message : "Không thể tải phân quyền theo workspace.",
            });
        }
    }, [defaultRoleId, notification, permissionForm, permissionTarget, populatePermissionFormForWorkspace]);

    const saveForm = async () => {
        setSaving(true);

        try {
            const currentSecurityPolicy = securityPolicy ?? await loadReferenceData();
            const values = await userForm.validateFields();
            const resolvedWorkspaceId =
                lockWorkspaceByCreator ? creatorWorkspaceId : String(values.workspaceId ?? "").trim();
            const role = String(values.role ?? "").trim();
            const organizationId = String(values.organizationId ?? "").trim();
            const accountType = values.accountType || "user";

            if (!resolvedWorkspaceId) throw new Error("Vui lòng chọn workspace.");
            if (!role) throw new Error("Vui lòng chọn vai trò.");

            if (modalMode === "create") {
                const passwordError = validatePassword(values.password, currentSecurityPolicy);
                if (passwordError) {
                    throw new Error(passwordError);
                }

                await api.post<unknown>(endpoints.admin.accounts, {
                    fullName: values.fullName.trim(),
                    email: values.email.trim(),
                    phone: values.phone.trim() || undefined,
                    password: values.password,
                    isSuperAdmin: lockAccountTypeByCreator ? false : accountType === "super_admin",
                    isAdmin: lockAccountTypeByCreator ? false : accountType === "workspace_admin",
                    workspaceId: resolvedWorkspaceId,
                    organizationId: organizationId || undefined,
                    role: normalizeRoleInput(role),
                    passwordChangeRequired: currentSecurityPolicy?.forceChangePasswordOnFirstLogin || false,
                });

                notification.success({
                    title: "Thành công",
                    description: "Thêm người dùng thành công.",
                });
            } else {
                if (!editingAccount?.id) throw new Error("Thiếu ID người dùng để cập nhật.");

                if (values.password.trim()) {
                    const passwordError = validatePassword(values.password, currentSecurityPolicy);
                    if (passwordError) {
                        throw new Error(passwordError);
                    }
                }

                await api.patch<unknown>(`${endpoints.admin.accounts}/${editingAccount.id}`, {
                    fullName: values.fullName.trim() || undefined,
                    email: values.email.trim() || undefined,
                    phone: values.phone.trim() || undefined,
                    password: values.password.trim() || undefined,
                    status: values.status,
                    isAdmin: lockAccountTypeByCreator ? false : accountType === "workspace_admin",
                    workspaceId: resolvedWorkspaceId,
                    organizationId: organizationId || null,
                    role: normalizeRoleInput(role),
                });

                await api.put<unknown>(`${endpoints.admin.accounts}/${editingAccount.id}/role`, {
                    isSuperAdmin: lockAccountTypeByCreator ? false : accountType === "super_admin",
                });

                notification.success({
                    title: "Thành công",
                    description: "Cập nhật người dùng thành công.",
                });
            }

            resetModalValidationState();
            setModalOpen(false);
            setEditingAccount(null);
            userForm.resetFields();
            searchCacheRef.current = null;
            await loadData({ forceSearch: true, reloadReferences: true });
        } catch (err) {
            notification.error({
                key: getModalErrorNotificationKey(),
                title: "Lỗi",
                description:
                    err instanceof ApiError
                        ? err.message
                        : err instanceof Error
                          ? err.message
                          : "Không thể lưu thông tin người dùng.",
            });
        } finally {
            setSaving(false);
        }
    };

    const savePermissionForm = async () => {
        if (!permissionTarget) {
            return;
        }

        setPermissionSaving(true);
        try {
            const values = await permissionForm.validateFields();
            const resolvedWorkspaceId = creatorIsSuperAdmin
                ? String(values.workspaceId ?? "").trim()
                : creatorWorkspaceId;
            const role = String(values.role ?? "").trim();
            const membershipId = String(values.membershipId ?? "").trim();
            const organizationId = String(values.organizationId ?? "").trim();
            const isAdmin = Boolean(values.isAdmin);

            if (!resolvedWorkspaceId) {
                throw new Error("Vui lòng chọn workspace.");
            }
            if (!role) {
                throw new Error("Vui lòng chọn vai trò.");
            }

            if (membershipId) {
                await api.put<unknown>(`${endpoints.members(resolvedWorkspaceId)}/${membershipId}/role`, {
                    role: normalizeRoleInput(role),
                    organizationId: organizationId || undefined,
                    isAdmin,
                });
            } else {
                await api.post<unknown>(endpoints.members(resolvedWorkspaceId), {
                    email: permissionTarget.email,
                    role: normalizeRoleInput(role),
                    organizationId: organizationId || undefined,
                    isAdmin,
                });
            }

            notification.success({
                title: "Thành công",
                description: membershipId
                    ? "Cập nhật phân quyền người dùng thành công."
                    : "Cấp phân quyền người dùng thành công.",
            });

            resetPermissionModalValidationState();
            setPermissionModalOpen(false);
            setPermissionTarget(null);
            permissionForm.resetFields();
            searchCacheRef.current = null;
            await loadData({ forceSearch: true, reloadReferences: true });
        } catch (err) {
            notification.error({
                key: getPermissionModalErrorNotificationKey(),
                title: "Lỗi",
                description:
                    err instanceof ApiError
                        ? err.message
                        : err instanceof Error
                          ? err.message
                          : "Không thể lưu phân quyền người dùng.",
            });
        } finally {
            setPermissionSaving(false);
        }
    };

    const confirmDeleteUser = async () => {
        if (!deleteTarget) return;

        setSaving(true);
        try {
            const membershipsResp = await api.get<unknown>(
                `${endpoints.admin.memberships}?accountId=${deleteTarget.id}&page=1&limit=100`
            );
            const memberships = extractMemberships(membershipsResp);

            await Promise.allSettled(
                memberships.map((membership) =>
                    api.delete(`${endpoints.members(membership.workspaceId)}/${membership.id}`)
                )
            );

            await api.put<unknown>(`${endpoints.admin.accounts}/${deleteTarget.id}/status`, {
                status: "inactive",
            });

            notification.success({
                title: "Thành công",
                description: "Đã xóa người dùng khỏi membership và chuyển trạng thái về không hoạt động.",
            });

            setDeleteTarget(null);
            searchCacheRef.current = null;
            await loadData({ forceSearch: true, reloadReferences: true });
        } catch (err) {
            notification.error({
                title: "Lỗi",
                description: err instanceof ApiError ? err.message : "Không thể xóa người dùng.",
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <TitleSpace
                title="Quản lý người dùng"
                description="Quản lý tài khoản, vai trò, workspace và đơn vị."
                actions={
                    <div className="flex items-center gap-2">
                        <ActionButton type="create" label="Thêm mới" onClick={openCreateModal} />
                    </div>
                }
            />

            <FilterSpace
                actionsPosition="bottom-right"
                actions={
                    <>
                        <ActionButton
                            type="refresh"
                            onClick={() => {
                                searchCacheRef.current = null;
                                void loadData({ forceSearch: true, reloadReferences: true });
                            }}
                        />
                        <ActionButton
                            type="search"
                            onClick={() => {
                                searchCacheRef.current = null;
                                setAppliedSearch(search.trim());
                                setPage(1);
                            }}
                        />
                    </>
                }
            >
                <SearchBox
                    value={search}
                    bold
                    placeholder="Tìm theo họ tên, email, số điện thoại"
                    onChange={setSearch}
                />
            </FilterSpace>

            <div>
                {loading ? (
                    <div className="space-y-2">
                        <div className="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
                        <div className="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
                        <div className="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
                    </div>
                ) : totalVisibleAccounts === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Không có người dùng phù hợp.</p>
                ) : (
                    <>
                        <div className="data-table-shell  md:block">
                            <table className="data-table">
                                <thead className="data-table-head">
                                    <tr>
                                        <th className="data-table-th">STT</th>
                                        <th className="data-table-th">Họ tên</th>
                                        <th className="data-table-th">Email</th>
                                        <th className="data-table-th">Điện thoại</th>
                                        <th className="data-table-th">Đơn vị</th>
                                        <th className="data-table-th">Trạng thái</th>
                                        <th className="data-table-th">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleAccounts.map((item, index) => (
                                        <tr key={item.id} className="data-table-row">
                                            <td className="data-table-cell">{((page - 1) * rowsPerPage) + index + 1}</td>
                                            <td className="data-table-cell">
                                                {item.fullName || "-"}
                                                {item.isSuperAdmin ? (
                                                    <span className="ml-2 inline-flex rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                                        Super Admin
                                                    </span>
                                                ) : item.isAdmin ? (
                                                    <span className="ml-2 inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                        Quản trị đơn vị
                                                    </span>
                                                ) : null}
                                            </td>
                                            <td className="data-table-cell">{item.email || "-"}</td>
                                            <td className="data-table-cell">{item.phone || "-"}</td>
                                            <td className="data-table-cell">
                                                {organizationLabelById.get(item.organizationId || "") || item.organizationName || "-"}
                                            </td>
                                            <td className="data-table-cell">
                                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(item.status)}`}>
                                                    {normalizeStatus(item.status)}
                                                </span>
                                            </td>
                                            <td className="data-table-cell">
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => void openEditModal(item)} title="Sửa" aria-label="Sửa">
                                                        <ActionIcon action="edit" />
                                                    </button>
                                                    <button
                                                        onClick={() => void openPermissionModal(item)}
                                                        title="Phân quyền"
                                                        aria-label="Phân quyền"
                                                    >
                                                        <ActionIcon action="permission" />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteTarget(item)}
                                                        title="Xóa"
                                                        aria-label="Xóa"
                                                    >
                                                        <ActionIcon action="delete" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* <div className="space-y-3 md:hidden">
                            {pagedAccounts.map((item) => (
                                <div key={item.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.fullName || "-"}</p>
                                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(item.status)}`}>
                                            {normalizeStatus(item.status)}
                                        </span>
                                    </div>
                                    <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                                        <p>Email: {item.email || "-"}</p>
                                        <p>Điện thoại: {item.phone || "-"}</p>
                                        <p>Đơn vị: {organizationLabelById.get(item.organizationId || "") || item.organizationName || "-"}</p>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <button onClick={() => void openEditModal(item)}>
                                            <ActionIcon action="edit" />
                                        </button>
                                        <button onClick={() => setDeleteTarget(item)}>
                                            <ActionIcon action="delete" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div> */}

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                <span>Hiển thị</span>
                                <select
                                    value={rowsPerPage}
                                    onChange={(event) => setRowsPerPage(Number(event.target.value))}
                                    className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
                                >
                                    {[5, 10, 20, 50].map((value) => (
                                        <option key={value} value={value}>
                                            {value}
                                        </option>
                                    ))}
                                </select>
                                <span>dòng mỗi trang</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                                    disabled={page === 1}
                                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                >
                                    Trước
                                </button>
                                <span className="text-sm text-gray-600 dark:text-gray-300">Trang {page}/{totalPages}</span>
                                <button
                                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                                    disabled={page >= totalPages}
                                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                >
                                    Sau
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <ActionModal
                open={modalOpen}
                title={modalMode === "create" ? "Thêm người dùng" : "Sửa người dùng"}
                okText={saving ? "Đang lưu..." : "Lưu"}
                cancelText="Đóng"
                loading={saving}
                spinning={saving}
                variant="danger"
                width={900}
                onOk={() => void saveForm()}
                onCancel={closeModal}
            >
                <Form
                    form={userForm}
                    layout="vertical"
                    disabled={saving}
                >
                    <Row gutter={[16, 12]}>
                        <Col xs={24}>
                            <Form.Item
                                label="Họ tên"
                                name="fullName"
                                rules={[
                                    { required: true, message: "Vui lòng nhập họ tên." },
                                ]}
                            >
                                <Input size="large" placeholder="Nhập họ tên người dùng" />
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                            <Form.Item
                                label="Email"
                                name="email"
                                rules={[
                                    { required: true, message: "Vui lòng nhập email." },
                                    {
                                        validator: (_, value) => {
                                            const error = validateEmail(String(value ?? ""));
                                            return error ? Promise.reject(new Error(error)) : Promise.resolve();
                                        },
                                    },
                                ]}
                            >
                                <Input size="large" placeholder="name@domain.com" />
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                            <Form.Item
                                label="Điện thoại"
                                name="phone"
                                rules={[
                                    {
                                        validator: (_, value) => {
                                            const error = validatePhone(String(value ?? ""));
                                            return error ? Promise.reject(new Error(error)) : Promise.resolve();
                                        },
                                    },
                                ]}
                            >
                                <Input size="large" placeholder="Nhập số điện thoại" />
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                            <Form.Item
                                label={modalMode === "create" ? "Mật khẩu" : "Mật khẩu mới"}
                                name="password"
                                rules={[
                                    {
                                        validator: (_, value) => {
                                            const password = String(value ?? "");
                                            if (modalMode === "create" && !password.trim()) {
                                                return Promise.reject(new Error("Vui lòng nhập mật khẩu."));
                                            }
                                            if (!password.trim()) {
                                                return Promise.resolve();
                                            }
                                            const error = validatePassword(password, securityPolicy);
                                            return error ? Promise.reject(new Error(error)) : Promise.resolve();
                                        },
                                    },
                                ]}
                            >
                                <Input.Password
                                    size="large"
                                    placeholder={modalMode === "create" ? "Nhập mật khẩu" : "Để trống nếu không đổi"}
                                />
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                            <Form.Item
                                label="Trạng thái"
                                name="status"
                                rules={[{ required: true, message: "Vui lòng chọn trạng thái." }]}
                            >
                                <Select
                                    size="large"
                                    options={[
                                        { label: "Hoạt động", value: "active" },
                                        { label: "Không hoạt động", value: "inactive" },
                                    ]}
                                />
                            </Form.Item>
                        </Col>

                        <Col xs={24}>
                            <Form.Item
                                label="Loại tài khoản"
                                name="accountType"
                                rules={[{ required: true, message: "Vui lòng chọn loại tài khoản." }]}
                            >
                                <Radio.Group
                                    optionType="button"
                                    buttonStyle="solid"
                                    disabled={lockAccountTypeByCreator}
                                    options={[
                                        { label: "Người dùng", value: "user" },
                                        { label: "Quản trị đơn vị", value: "workspace_admin" },
                                        { label: "Super Admin", value: "super_admin" },
                                    ]}
                                />
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                            <Form.Item
                                label="Workspace"
                                name="workspaceId"
                                rules={[{ required: true, message: "Vui lòng chọn workspace." }]}
                            >
                                <Select
                                    size="large"
                                    options={workspaceSelectOptions}
                                    placeholder="Chọn workspace"
                                    disabled={lockWorkspaceByCreator}
                                    onChange={(value) => {
                                        void handleUserWorkspaceChange(String(value ?? ""));
                                    }}
                                />
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                            <Form.Item
                                label="Vai trò/nhóm quyền"
                                name="role"
                                rules={[{ required: true, message: "Vui lòng chọn vai trò." }]}
                            >
                                <Select
                                    size="large"
                                    options={roleSelectOptions}
                                    placeholder="Chọn vai trò"
                                />
                            </Form.Item>
                        </Col>

                        <Col xs={24}>
                            <Form.Item
                                label="Đơn vị"
                                name="organizationId"
                            >
                                <TreeSelect
                                    treeData={userOrganizationTree}
                                    allowClear
                                    treeDefaultExpandAll
                                    placeholder="Chọn đơn vị"
                                    style={{ width: "100%", height: 40 }}
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </ActionModal>

            <ActionModal
                open={permissionModalOpen}
                title={permissionTarget ? `Phân quyền cho ${permissionTarget.fullName || permissionTarget.email}` : "Phân quyền người dùng"}
                okText={permissionSaving ? "Đang lưu..." : "Lưu phân quyền"}
                cancelText="Đóng"
                loading={permissionSaving}
                spinning={permissionSaving || loadingPermissionForm}
                variant="danger"
                width={760}
                onOk={() => void savePermissionForm()}
                onCancel={closePermissionModal}
            >
                <Form
                    form={permissionForm}
                    layout="vertical"
                    disabled={permissionSaving || loadingPermissionForm}
                >
                    <Form.Item name="membershipId" hidden>
                        <Input />
                    </Form.Item>

                    <Row gutter={[16, 12]}>
                        <Col xs={24} md={12}>
                            <Form.Item label="Người dùng">
                                <Input
                                    size="large"
                                    value={permissionTarget ? `${permissionTarget.fullName || "-"}${permissionTarget.email ? ` - ${permissionTarget.email}` : ""}` : ""}
                                    disabled
                                />
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                            <Form.Item
                                label="Workspace"
                                name="workspaceId"
                                rules={[{ required: true, message: "Vui lòng chọn workspace." }]}
                            >
                                <Select
                                    size="large"
                                    options={workspaceSelectOptions}
                                    placeholder="Chọn workspace"
                                    disabled={!creatorIsSuperAdmin}
                                    onChange={(value) => {
                                        void handlePermissionWorkspaceChange(String(value ?? ""));
                                    }}
                                />
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                            <Form.Item
                                label="Vai trò/nhóm quyền"
                                name="role"
                                rules={[{ required: true, message: "Vui lòng chọn vai trò." }]}
                            >
                                <Select
                                    size="large"
                                    options={roleSelectOptions}
                                    placeholder="Chọn vai trò"
                                />
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                            <Form.Item
                                label="Quản trị workspace"
                                name="isAdmin"
                                valuePropName="checked"
                            >
                                <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </ActionModal>

            <ConfirmModal
                open={Boolean(deleteTarget)}
                title="Xác nhận xóa người dùng"
                subject={deleteTarget?.fullName || deleteTarget?.email}
                descriptionPrefix="Bạn có chắc muốn xóa"
                descriptionSuffix="?"
                okText={saving ? "Đang xóa..." : "Xóa"}
                cancelText="Đóng"
                loading={saving}
                spinning={saving}
                variant="danger"
                onOk={() => void confirmDeleteUser()}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}

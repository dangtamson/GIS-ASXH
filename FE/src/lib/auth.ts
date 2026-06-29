export const AUTH_TOKEN_KEY = "tdnv_token";
export const ACCOUNT_KEY = "tdnv_account";
export const WORKSPACE_ID_KEY = "tdnv_workspace_id";
const LEGACY_TOKEN_KEYS = ["token", "access_token", "auth_token"];
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "";
const PROFILE_PATH = "/me";

function normalizeToken(rawToken: string): string {
    return rawToken
        .trim()
        .replace(/^Bearer\s+/i, "")
        .replace(/^"|"$/g, "")
        .replace(/^'|'$/g, "");
}

function getSessionStorageSafe(): Storage | null {
    if (typeof window === "undefined") {
        return null;
    }
    return window.sessionStorage;
}

function getLocalStorageSafe(): Storage | null {
    if (typeof window === "undefined") {
        return null;
    }
    return window.localStorage;
}

export type Account = {
    id?: string;
    uuid?: string;
    fullName?: string;
    phone?: string;
    createdAt?: string;
    email?: string;
    isSuperAdmin?: boolean;
    isAdmin?: boolean;
    status?: string;
    workspaceId?: string;
    organizationId?: string;
    workspace?: {
        id?: string;
        uuid?: string;
        name?: string;
    };
    organization?: {
        id?: string;
        uuid?: string;
        name?: string;
        code?: string;
    };
    memberships?: Array<{
        workspaceId?: string;
        organizationId?: string;
        roleId?: number;
        role?: {
            id?: number;
            code?: string;
            name?: string;
        };
        workspace?: {
            id?: string;
            uuid?: string;
            name?: string;
        };
        organization?: {
            id?: string;
            uuid?: string;
            name?: string;
            code?: string;
        };
    }>;
    workspaces?: Array<{
        id?: string;
        uuid?: string;
        name?: string;
        organizationId?: string;
        workspace?: {
            id?: string;
            uuid?: string;
            name?: string;
        };
        organization?: {
            id?: string;
            uuid?: string;
            name?: string;
            code?: string;
        };
        profile?: {
            workspaceId?: string;
            organizationId?: string;
        };
        membership?: {
            workspaceId?: string;
            organizationId?: string;
            roleId?: number;
            role?: {
                id?: number;
                code?: string;
                name?: string;
            };
        };
    }>;
    [key: string]: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    return value as Record<string, unknown>;
}

function readWorkspaceIdFromWorkspaceEntry(entry: unknown): string | undefined {
    const workspaceRecord = asRecord(entry);
    if (!workspaceRecord) {
        return undefined;
    }

    const profileRecord = asRecord(workspaceRecord.profile);
    const profileWorkspaceId = profileRecord?.workspaceId;
    if (typeof profileWorkspaceId === "string" && profileWorkspaceId.trim()) {
        return profileWorkspaceId;
    }

    const membershipRecord = asRecord(workspaceRecord.membership);
    const membershipWorkspaceId = membershipRecord?.workspaceId;
    if (typeof membershipWorkspaceId === "string" && membershipWorkspaceId.trim()) {
        return membershipWorkspaceId;
    }

    const nestedWorkspaceRecord = asRecord(workspaceRecord.workspace);
    const nestedWorkspaceId = nestedWorkspaceRecord?.id ?? nestedWorkspaceRecord?.uuid;
    if (typeof nestedWorkspaceId === "string" && nestedWorkspaceId.trim()) {
        return nestedWorkspaceId;
    }

    const directId = workspaceRecord.id ?? workspaceRecord.uuid;
    if (typeof directId === "string" && directId.trim()) {
        return directId;
    }

    return undefined;
}

function readOrganizationIdFromWorkspaceEntry(entry: unknown): string | undefined {
    const workspaceRecord = asRecord(entry);
    if (!workspaceRecord) {
        return undefined;
    }

    const profileRecord = asRecord(workspaceRecord.profile);
    const profileOrganizationId = profileRecord?.organizationId;
    if (typeof profileOrganizationId === "string" && profileOrganizationId.trim()) {
        return profileOrganizationId;
    }

    const membershipRecord = asRecord(workspaceRecord.membership);
    const membershipOrganizationId = membershipRecord?.organizationId;
    if (typeof membershipOrganizationId === "string" && membershipOrganizationId.trim()) {
        return membershipOrganizationId;
    }

    const organizationRecord = asRecord(workspaceRecord.organization);
    const nestedOrganizationId = organizationRecord?.id ?? organizationRecord?.uuid;
    if (typeof nestedOrganizationId === "string" && nestedOrganizationId.trim()) {
        return nestedOrganizationId;
    }

    const directOrganizationId = workspaceRecord.organizationId;
    if (typeof directOrganizationId === "string" && directOrganizationId.trim()) {
        return directOrganizationId;
    }

    return undefined;
}

function isTruthyBooleanLike(value: unknown): boolean {
    if (typeof value === "boolean") {
        return value;
    }
    if (typeof value === "number") {
        return value === 1;
    }
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        return normalized === "true" || normalized === "1" || normalized === "active";
    }
    return false;
}

function isActiveWorkspaceEntry(entry: unknown): boolean {
    const workspaceRecord = asRecord(entry);
    if (!workspaceRecord) {
        return false;
    }

    if (isTruthyBooleanLike(workspaceRecord.isActive) || isTruthyBooleanLike(workspaceRecord.active)) {
        return true;
    }

    const membershipRecord = asRecord(workspaceRecord.membership);
    if (isTruthyBooleanLike(membershipRecord?.isActive) || isTruthyBooleanLike(membershipRecord?.active)) {
        return true;
    }

    // In current BE contract, membership.status=true indicates active membership in workspace.
    if (isTruthyBooleanLike(membershipRecord?.status)) {
        return true;
    }

    const profileRecord = asRecord(workspaceRecord.profile);
    if (isTruthyBooleanLike(profileRecord?.isActive) || isTruthyBooleanLike(profileRecord?.active)) {
        return true;
    }

    const nestedWorkspaceRecord = asRecord(workspaceRecord.workspace);
    if (isTruthyBooleanLike(nestedWorkspaceRecord?.isActive) || isTruthyBooleanLike(nestedWorkspaceRecord?.active)) {
        return true;
    }

    const status = nestedWorkspaceRecord?.status ?? workspaceRecord.status;
    return typeof status === "string" && status.trim().toLowerCase() === "active";
}

export function resolveWorkspaceIdFromMePayload(payload: unknown): string | null {
    const payloadRecord = asRecord(payload);
    const dataRecord = asRecord(payloadRecord?.data);
    const source = dataRecord ?? payloadRecord;
    if (!source) {
        return null;
    }

    // Prefer explicit active/current workspace id fields if BE provides them.
    const explicitKeys = ["activeWorkspaceId", "currentWorkspaceId", "workspaceId"] as const;
    for (const key of explicitKeys) {
        const value = source[key];
        if (typeof value === "string" && value.trim()) {
            return value;
        }
    }

    const workspaces = Array.isArray(source.workspaces) ? source.workspaces : [];

    const activeWorkspaceEntry = workspaces.find((entry) => isActiveWorkspaceEntry(entry));
    if (activeWorkspaceEntry) {
        const activeWorkspaceId = readWorkspaceIdFromWorkspaceEntry(activeWorkspaceEntry);
        if (activeWorkspaceId) {
            return activeWorkspaceId;
        }
    }

    for (const entry of workspaces) {
        const workspaceId = readWorkspaceIdFromWorkspaceEntry(entry);
        if (workspaceId) {
            return workspaceId;
        }
    }

    const accountRecord = asRecord(source.account);
    return pickWorkspaceId(accountRecord) || pickWorkspaceId(source) || null;
}

export function resolveOrganizationIdFromAuthPayload(payload: unknown): string | null {
    const payloadRecord = asRecord(payload);
    const dataRecord = asRecord(payloadRecord?.data);
    const source = dataRecord ?? payloadRecord;
    if (!source) {
        return null;
    }

    const explicitKeys = ["activeOrganizationId", "currentOrganizationId", "organizationId"] as const;
    for (const key of explicitKeys) {
        const value = source[key];
        if (typeof value === "string" && value.trim()) {
            return value;
        }
    }

    const workspaces = Array.isArray(source.workspaces) ? source.workspaces : [];

    const activeWorkspaceEntry = workspaces.find((entry) => isActiveWorkspaceEntry(entry));
    if (activeWorkspaceEntry) {
        const activeOrganizationId = readOrganizationIdFromWorkspaceEntry(activeWorkspaceEntry);
        if (activeOrganizationId) {
            return activeOrganizationId;
        }
    }

    for (const entry of workspaces) {
        const organizationId = readOrganizationIdFromWorkspaceEntry(entry);
        if (organizationId) {
            return organizationId;
        }
    }

    const accountRecord = asRecord(source.account);
    return pickOrganizationId(accountRecord) || pickOrganizationId(source) || null;
}

function pickWorkspaceId(source: Record<string, unknown> | null): string | undefined {
    if (!source) {
        return undefined;
    }

    const directWorkspaceId = source.workspaceId;
    if (typeof directWorkspaceId === "string" && directWorkspaceId.trim()) {
        return directWorkspaceId;
    }

    const workspace = asRecord(source.workspace);
    const workspaceId = workspace?.id ?? workspace?.uuid;
    if (typeof workspaceId === "string" && workspaceId.trim()) {
        return workspaceId;
    }

    const memberships = Array.isArray(source.memberships) ? source.memberships : [];
    for (const membership of memberships) {
        const membershipRecord = asRecord(membership);
        const membershipWorkspaceId = membershipRecord?.workspaceId;
        if (typeof membershipWorkspaceId === "string" && membershipWorkspaceId.trim()) {
            return membershipWorkspaceId;
        }

        const membershipWorkspace = asRecord(membershipRecord?.workspace);
        const membershipNestedId = membershipWorkspace?.id ?? membershipWorkspace?.uuid;
        if (typeof membershipNestedId === "string" && membershipNestedId.trim()) {
            return membershipNestedId;
        }
    }

    const workspaces = Array.isArray(source.workspaces) ? source.workspaces : [];
    for (const entry of workspaces) {
        const resolvedId = readWorkspaceIdFromWorkspaceEntry(entry);
        if (resolvedId) {
            return resolvedId;
        }
    }

    return undefined;
}

function pickOrganizationId(source: Record<string, unknown> | null): string | undefined {
    if (!source) {
        return undefined;
    }

    const directOrganizationId = source.organizationId;
    if (typeof directOrganizationId === "string" && directOrganizationId.trim()) {
        return directOrganizationId;
    }

    const organization = asRecord(source.organization);
    const organizationId = organization?.id ?? organization?.uuid;
    if (typeof organizationId === "string" && organizationId.trim()) {
        return organizationId;
    }

    const memberships = Array.isArray(source.memberships) ? source.memberships : [];
    for (const membership of memberships) {
        const membershipRecord = asRecord(membership);
        const membershipOrganizationId = membershipRecord?.organizationId;
        if (typeof membershipOrganizationId === "string" && membershipOrganizationId.trim()) {
            return membershipOrganizationId;
        }

        const membershipOrganization = asRecord(membershipRecord?.organization);
        const membershipNestedId = membershipOrganization?.id ?? membershipOrganization?.uuid;
        if (typeof membershipNestedId === "string" && membershipNestedId.trim()) {
            return membershipNestedId;
        }
    }

    const workspaces = Array.isArray(source.workspaces) ? source.workspaces : [];
    for (const entry of workspaces) {
        const resolvedId = readOrganizationIdFromWorkspaceEntry(entry);
        if (resolvedId) {
            return resolvedId;
        }
    }

    return undefined;
}

function mergeAccountWithWorkspace(account?: Account, payload?: unknown): Account | undefined {
    const payloadRecord = asRecord(payload);
    const dataRecord = asRecord(payloadRecord?.data);
    const profileRecord = asRecord(dataRecord ?? payloadRecord);
    const accountRecord = asRecord(profileRecord?.account);

    const mergedAccount: Account = {
        ...(account || {}),
        ...(profileRecord || {}),
        ...(accountRecord || {}),
    };

    const workspaceId =
        resolveWorkspaceIdFromMePayload(payload) ||
        pickWorkspaceId(accountRecord) ||
        pickWorkspaceId(profileRecord) ||
        pickWorkspaceId(asRecord(account));

    if (workspaceId) {
        mergedAccount.workspaceId = workspaceId;
    }

    const organizationId =
        resolveOrganizationIdFromAuthPayload(payload) ||
        pickOrganizationId(accountRecord) ||
        pickOrganizationId(profileRecord) ||
        pickOrganizationId(asRecord(account));

    if (organizationId) {
        mergedAccount.organizationId = organizationId;
    }

    return Object.keys(mergedAccount).length ? mergedAccount : account;
}

export function getToken(): string | null {
    const sessionStorage = getSessionStorageSafe();
    const localStorage = getLocalStorageSafe();

    const sessionToken =
        sessionStorage?.getItem(AUTH_TOKEN_KEY) ||
        LEGACY_TOKEN_KEYS.map((key) => sessionStorage?.getItem(key) || null).find(Boolean) ||
        null;

    const rawToken =
        sessionToken ||
        localStorage?.getItem(AUTH_TOKEN_KEY) ||
        LEGACY_TOKEN_KEYS.map((key) => localStorage?.getItem(key) || null).find(Boolean) ||
        null;

    if (!rawToken) {
        return null;
    }

    const normalizedToken = normalizeToken(rawToken);

    if (normalizedToken && sessionStorage && sessionStorage.getItem(AUTH_TOKEN_KEY) !== normalizedToken) {
        sessionStorage.setItem(AUTH_TOKEN_KEY, normalizedToken);
    }

    return normalizedToken || null;
}

export function setSession(token: string, account?: Account, workspaceId?: string): void {
    const sessionStorage = getSessionStorageSafe();
    const localStorage = getLocalStorageSafe();
    if (!sessionStorage && !localStorage) {
        return;
    }

    const normalizedToken = normalizeToken(token);
    sessionStorage?.setItem(AUTH_TOKEN_KEY, normalizedToken);
    localStorage?.removeItem(AUTH_TOKEN_KEY);

    LEGACY_TOKEN_KEYS.forEach((key) => {
        sessionStorage?.removeItem(key);
        localStorage?.removeItem(key);
    });

    const resolvedWorkspaceId =
        workspaceId ||
        (account?.workspaceId && account.workspaceId.trim() ? account.workspaceId : undefined) ||
        pickWorkspaceId(asRecord(account));

    if (resolvedWorkspaceId) {
        sessionStorage?.setItem(WORKSPACE_ID_KEY, resolvedWorkspaceId);
        localStorage?.removeItem(WORKSPACE_ID_KEY);
    }

    if (account) {
        sessionStorage?.setItem(ACCOUNT_KEY, JSON.stringify(account));
        localStorage?.removeItem(ACCOUNT_KEY);
    }
}

export function getAccount(): Account | null {
    const sessionStorage = getSessionStorageSafe();
    const localStorage = getLocalStorageSafe();
    const raw = sessionStorage?.getItem(ACCOUNT_KEY) || localStorage?.getItem(ACCOUNT_KEY) || null;
    if (!raw) {
        return null;
    }

    try {
        const parsed = JSON.parse(raw) as Account;
        if (sessionStorage && sessionStorage.getItem(ACCOUNT_KEY) !== raw) {
            sessionStorage.setItem(ACCOUNT_KEY, raw);
            localStorage?.removeItem(ACCOUNT_KEY);
        }
        return parsed;
    } catch {
        return null;
    }
}

export function getWorkspaceId(): string | null {
    const sessionStorage = getSessionStorageSafe();
    const localStorage = getLocalStorageSafe();
    const directWorkspaceId =
        sessionStorage?.getItem(WORKSPACE_ID_KEY) ||
        localStorage?.getItem(WORKSPACE_ID_KEY) ||
        null;

    if (directWorkspaceId && directWorkspaceId.trim()) {
        if (sessionStorage && sessionStorage.getItem(WORKSPACE_ID_KEY) !== directWorkspaceId) {
            sessionStorage.setItem(WORKSPACE_ID_KEY, directWorkspaceId);
            localStorage?.removeItem(WORKSPACE_ID_KEY);
        }
        return directWorkspaceId;
    }

    const account = getAccount();
    if (!account) {
        return null;
    }

    const resolvedWorkspaceId = account.workspaceId || pickWorkspaceId(asRecord(account)) || null;
    if (resolvedWorkspaceId) {
        sessionStorage?.setItem(WORKSPACE_ID_KEY, resolvedWorkspaceId);
        localStorage?.removeItem(WORKSPACE_ID_KEY);
    }
    return resolvedWorkspaceId;
}

export function getOrganizationId(): string | null {
    const account = getAccount();
    if (!account) {
        return null;
    }

    return pickOrganizationId(asRecord(account)) || null;
}

export function setWorkspaceId(workspaceId: string | null | undefined): void {
    const sessionStorage = getSessionStorageSafe();
    const localStorage = getLocalStorageSafe();
    if (!sessionStorage && !localStorage) {
        return;
    }

    const normalized = String(workspaceId || "").trim();
    if (!normalized) {
        sessionStorage?.removeItem(WORKSPACE_ID_KEY);
        localStorage?.removeItem(WORKSPACE_ID_KEY);
        return;
    }

    sessionStorage?.setItem(WORKSPACE_ID_KEY, normalized);
    localStorage?.removeItem(WORKSPACE_ID_KEY);
}

function writeStoredAccount(account: Account | null | undefined): void {
    const sessionStorage = getSessionStorageSafe();
    const localStorage = getLocalStorageSafe();
    if (!sessionStorage && !localStorage) {
        return;
    }

    if (!account) {
        sessionStorage?.removeItem(ACCOUNT_KEY);
        localStorage?.removeItem(ACCOUNT_KEY);
        return;
    }

    sessionStorage?.setItem(ACCOUNT_KEY, JSON.stringify(account));
    localStorage?.removeItem(ACCOUNT_KEY);
}

function findWorkspaceContext(account: Account | null, workspaceId: string): {
    workspaceId: string;
    organizationId?: string;
    workspace?: Account["workspace"];
    organization?: Account["organization"];
} | null {
    if (!account || !workspaceId.trim()) {
        return null;
    }

    const normalizedWorkspaceId = workspaceId.trim();
    const workspaces = Array.isArray(account.workspaces) ? account.workspaces : [];
    const matchedWorkspace = workspaces.find((entry) => readWorkspaceIdFromWorkspaceEntry(entry) === normalizedWorkspaceId);

    if (matchedWorkspace) {
        const workspaceRecord = asRecord(matchedWorkspace);
        const nestedWorkspace = asRecord(workspaceRecord?.workspace);
        const nestedOrganization = asRecord(workspaceRecord?.organization);
        const resolvedOrganizationId = readOrganizationIdFromWorkspaceEntry(matchedWorkspace) || undefined;

        return {
            workspaceId: normalizedWorkspaceId,
            organizationId: resolvedOrganizationId,
            workspace: {
                id: typeof nestedWorkspace?.id === "string" ? nestedWorkspace.id : normalizedWorkspaceId,
                uuid: typeof nestedWorkspace?.uuid === "string" ? nestedWorkspace.uuid : undefined,
                name: typeof nestedWorkspace?.name === "string"
                    ? nestedWorkspace.name
                    : typeof workspaceRecord?.name === "string"
                        ? workspaceRecord.name
                        : undefined,
            },
            organization: nestedOrganization
                ? {
                    id: typeof nestedOrganization.id === "string" ? nestedOrganization.id : resolvedOrganizationId,
                    uuid: typeof nestedOrganization.uuid === "string" ? nestedOrganization.uuid : undefined,
                    name: typeof nestedOrganization.name === "string" ? nestedOrganization.name : undefined,
                    code: typeof nestedOrganization.code === "string" ? nestedOrganization.code : undefined,
                }
                : account.organization,
        };
    }

    const memberships = Array.isArray(account.memberships) ? account.memberships : [];
    const matchedMembership = memberships.find((entry) => {
        const membershipRecord = asRecord(entry);
        const membershipWorkspaceId =
            (typeof membershipRecord?.workspaceId === "string" && membershipRecord.workspaceId.trim()
                ? membershipRecord.workspaceId
                : undefined) ||
            (() => {
                const nestedWorkspace = asRecord(membershipRecord?.workspace);
                const nestedId = nestedWorkspace?.id ?? nestedWorkspace?.uuid;
                return typeof nestedId === "string" && nestedId.trim() ? nestedId : undefined;
            })();

        return membershipWorkspaceId === normalizedWorkspaceId;
    });

    if (!matchedMembership) {
        return {
            workspaceId: normalizedWorkspaceId,
            organizationId: account.organizationId,
            workspace: account.workspace,
            organization: account.organization,
        };
    }

    const membershipRecord = asRecord(matchedMembership);
    const nestedWorkspace = asRecord(membershipRecord?.workspace);
    const nestedOrganization = asRecord(membershipRecord?.organization);
    const organizationId =
        (typeof membershipRecord?.organizationId === "string" && membershipRecord.organizationId.trim()
            ? membershipRecord.organizationId
            : undefined) ||
        (() => {
            const nestedId = nestedOrganization?.id ?? nestedOrganization?.uuid;
            return typeof nestedId === "string" && nestedId.trim() ? nestedId : undefined;
        })();

    return {
        workspaceId: normalizedWorkspaceId,
        organizationId,
        workspace: {
            id: typeof nestedWorkspace?.id === "string" ? nestedWorkspace.id : normalizedWorkspaceId,
            uuid: typeof nestedWorkspace?.uuid === "string" ? nestedWorkspace.uuid : undefined,
            name: typeof nestedWorkspace?.name === "string" ? nestedWorkspace.name : undefined,
        },
        organization: nestedOrganization
            ? {
                id: typeof nestedOrganization.id === "string" ? nestedOrganization.id : organizationId,
                uuid: typeof nestedOrganization.uuid === "string" ? nestedOrganization.uuid : undefined,
                name: typeof nestedOrganization.name === "string" ? nestedOrganization.name : undefined,
                code: typeof nestedOrganization.code === "string" ? nestedOrganization.code : undefined,
            }
            : account.organization,
    };
}

export function setActiveWorkspaceContext(workspaceId: string | null | undefined): Account | null {
    const normalizedWorkspaceId = String(workspaceId || "").trim();
    const currentAccount = getAccount();

    if (!normalizedWorkspaceId) {
        setWorkspaceId(null);
        return currentAccount;
    }

    setWorkspaceId(normalizedWorkspaceId);

    if (!currentAccount) {
        return null;
    }

    const nextContext = findWorkspaceContext(currentAccount, normalizedWorkspaceId);
    const nextAccount: Account = {
        ...currentAccount,
        workspaceId: normalizedWorkspaceId,
    };

    if (nextContext?.organizationId) {
        nextAccount.organizationId = nextContext.organizationId;
    }

    if (nextContext?.workspace) {
        nextAccount.workspace = nextContext.workspace;
    }

    if (nextContext?.organization) {
        nextAccount.organization = nextContext.organization;
    }

    writeStoredAccount(nextAccount);
    return nextAccount;
}

export async function hydrateSessionFromProfile(token: string, account?: Account): Promise<Account | undefined> {
    if (typeof window === "undefined") {
        return account;
    }

    const normalizedToken = normalizeToken(token);
    const workspaceId =
        account?.workspaceId ||
        pickWorkspaceId(asRecord(account)) ||
        getWorkspaceId() ||
        undefined;

    const response = await fetch(`${API_BASE_URL}${PROFILE_PATH}`, {
        method: "GET",
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${normalizedToken}`,
            ...(workspaceId ? { "x-workspace-id": workspaceId } : {}),
        },
    });

    if (!response.ok) {
        throw new Error(`Không thể lấy thông tin hồ sơ người dùng (${response.status})`);
    }

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : null;
    const mergedAccount = mergeAccountWithWorkspace(account, payload);
    const resolvedWorkspaceId =
        resolveWorkspaceIdFromMePayload(payload) ||
        mergedAccount?.workspaceId ||
        workspaceId;
    setSession(normalizedToken, mergedAccount, resolvedWorkspaceId || undefined);
    return mergedAccount;
}

export function clearSession(): void {
    const sessionStorage = getSessionStorageSafe();
    const localStorage = getLocalStorageSafe();
    if (!sessionStorage && !localStorage) {
        return;
    }

    sessionStorage?.removeItem(AUTH_TOKEN_KEY);
    localStorage?.removeItem(AUTH_TOKEN_KEY);

    LEGACY_TOKEN_KEYS.forEach((key) => {
        sessionStorage?.removeItem(key);
        localStorage?.removeItem(key);
    });

    sessionStorage?.removeItem(ACCOUNT_KEY);
    localStorage?.removeItem(ACCOUNT_KEY);

    sessionStorage?.removeItem(WORKSPACE_ID_KEY);
    localStorage?.removeItem(WORKSPACE_ID_KEY);
}

export function isAuthenticated(): boolean {
    return Boolean(getToken());
}

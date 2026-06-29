import { clearSession, getToken, getWorkspaceId } from "@/lib/auth";

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "";

type ApiEnvelope<T> = {
    code?: number;
    message?: string;
    data?: T;
    error?: string;
};

export class ApiError extends Error {
    status: number;
    payload: unknown;

    constructor(message: string, status: number, payload: unknown) {
        super(message);
        this.status = status;
        this.payload = payload;
    }
}

// Handle 401 Unauthorized - clear session and redirect to login
function handleUnauthorized(): void {
    clearSession();

    // Dispatch custom event so SessionExpiredHandler can show notification
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("sessionExpired"));

        // Only redirect if not already on login page to avoid infinite loop
        if (!window.location.pathname.includes("/signin")) {
            // Small delay to allow notification to be seen
            setTimeout(() => {
                window.location.href = "/signin";
            }, 2000);
        }
    }
}

type RequestOptions = Omit<RequestInit, "body"> & {
    body?: unknown;
};

function shouldAttachWorkspaceHeader(path: string): boolean {
    return !["/login", "/signup", "/sso/enabled", "/sso/login-url", "/sso/exchange"].includes(path);
}

export async function apiRequest<T>(
    path: string,
    options: RequestOptions = {}
): Promise<T> {
    const token = getToken();
    const workspaceId = getWorkspaceId();
    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");

    const requestBody = options.body;

    if (!headers.has("Content-Type") && requestBody !== undefined) {
        headers.set("Content-Type", "application/json");
    }
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }
    if (workspaceId && shouldAttachWorkspaceHeader(path) && !headers.has("x-workspace-id")) {
        headers.set("x-workspace-id", workspaceId);
    }

    const res = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
        body:
            requestBody === undefined
                ? undefined
                : typeof requestBody === "string"
                    ? requestBody
                    : JSON.stringify(requestBody),
    });

    const contentType = res.headers.get("content-type") || "";
    const canParseJson = contentType.includes("application/json");
    const payload: ApiEnvelope<T> | null = canParseJson ? await res.json() : null;

    if (!res.ok) {
        // Handle 401 Unauthorized - token expired or invalid
        if (res.status === 401) {
            handleUnauthorized();
        }

        const message = payload?.message || payload?.error || `Request failed: ${res.status}`;
        throw new ApiError(message, res.status, payload);
    }

    if (payload && "data" in payload && payload.data !== undefined) {
        return payload.data as T;
    }

    return (payload as T) ?? ({} as T);
}

export const api = {
    get: <T>(path: string, init?: RequestOptions) =>
        apiRequest<T>(path, { ...init, method: "GET" }),
    post: <T>(path: string, body?: unknown, init?: RequestOptions) =>
        apiRequest<T>(path, { ...init, method: "POST", body }),
    put: <T>(path: string, body?: unknown, init?: RequestOptions) =>
        apiRequest<T>(path, { ...init, method: "PUT", body }),
    patch: <T>(path: string, body?: unknown, init?: RequestOptions) =>
        apiRequest<T>(path, { ...init, method: "PATCH", body }),
    delete: <T>(path: string, init?: RequestOptions) =>
        apiRequest<T>(path, { ...init, method: "DELETE" }),
};

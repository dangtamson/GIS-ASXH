const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "";

type ApiEnvelope<T> = {
    data?: T;
    message?: string;
    error?: string;
};

export class PublicApiError extends Error {
    status: number;
    payload: unknown;

    constructor(message: string, status: number, payload: unknown) {
        super(message);
        this.status = status;
        this.payload = payload;
    }
}

export async function publicApiGet<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        headers: {
            Accept: "application/json",
        },
    });

    const contentType = res.headers.get("content-type") || "";
    const canParseJson = contentType.includes("application/json");
    const payload: ApiEnvelope<T> | null = canParseJson ? await res.json() : null;

    if (!res.ok) {
        const message = payload?.message || payload?.error || `Request failed: ${res.status}`;
        throw new PublicApiError(message, res.status, payload);
    }

    if (payload && "data" in payload && payload.data !== undefined) {
        return payload.data;
    }

    return (payload as T) ?? ({} as T);
}

export async function publicApiPost<T>(path: string, body: unknown, extraHeaders: HeadersInit = {}): Promise<T> {
    const headers = new Headers(extraHeaders);
    headers.set("Accept", "application/json");
    headers.set("Content-Type", "application/json");

    const res = await fetch(`${API_BASE_URL}${path}`, {
        method: "POST",
        credentials: "omit",
        headers,
        body: JSON.stringify(body),
    });

    const contentType = res.headers.get("content-type") || "";
    const canParseJson = contentType.includes("application/json");
    const payload: ApiEnvelope<T> | null = canParseJson ? await res.json() : null;

    if (!res.ok) {
        const message = payload?.message || payload?.error || `Request failed: ${res.status}`;
        throw new PublicApiError(message, res.status, payload);
    }

    if (payload && "data" in payload && payload.data !== undefined) {
        return payload.data;
    }

    return (payload as T) ?? ({} as T);
}

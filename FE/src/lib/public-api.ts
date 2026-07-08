import { ApiError } from "@/lib/api";

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "";

type ApiEnvelope<T> = {
    data?: T;
    message?: string;
    error?: string;
};

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
        throw new ApiError(message, res.status, payload);
    }

    if (payload && "data" in payload && payload.data !== undefined) {
        return payload.data;
    }

    return (payload as T) ?? ({} as T);
}

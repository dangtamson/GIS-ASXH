'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import { useDebounce } from "@/hooks/data";
import { endpoints } from "@/lib/endpoints";
import { ApiError, api } from "@/lib/api";
import { extractList } from "@/lib/data-utils";

type Option = {
    label: string;
    value: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    return value as Record<string, unknown>;
}

function extractWorkspaceOptions(payload: unknown): Option[] {
    const root = asRecord(payload);
    const data = asRecord(root?.data) ?? root;
    const adminWorkspaces = Array.isArray(data?.workspaces) ? data.workspaces : [];
    const fallback = extractList<Record<string, unknown>>(payload);
    const source = adminWorkspaces.length > 0 ? adminWorkspaces : fallback;

    const options = source
        .map((entry) => {
            const entryRecord = asRecord(entry);
            const nestedWorkspace = asRecord(entryRecord?.workspace);
            const workspace = nestedWorkspace ?? entryRecord;
            const value = String(workspace?.uuid ?? workspace?.id ?? "").trim();
            const label = String(workspace?.name ?? "").trim();

            if (!value) {
                return null;
            }

            return {
                value,
                label: label || value,
            };
        })
        .filter(Boolean) as Option[];

    const uniqueOptions = new Map<string, Option>();
    options.forEach((option) => {
        if (!uniqueOptions.has(option.value)) {
            uniqueOptions.set(option.value, option);
        }
    });

    return Array.from(uniqueOptions.values());
}


type UseWorkspaceSelectProps = {
    limit?: number;
};


export function useWorkspaceSelect({
                                    limit = 100,
                                }: UseWorkspaceSelectProps = {}) {

    const [dsWorkspace, setDsWorkspace] = useState<Option[]>([]);

    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 400);

    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const cacheRef = useRef<Record<string, Option[]>>({});


    /* ================= FETCH ================= */

    const fetchData = useCallback(async (
        pageParam: number,
        searchParam: string,
        append = false
    ) => {


        const cacheKey = `${searchParam}_${pageParam}`;

        if (cacheRef.current[cacheKey]) {

            setDsWorkspace(prev =>
                append
                    ? [...prev, ...cacheRef.current[cacheKey]]
                    : cacheRef.current[cacheKey]
            );

            return;
        }

        setLoading(true);

        try {

            const res = await api.get(
                `${endpoints.admin.workspaces}?page=${pageParam}&limit=${limit}&search=${searchParam}`
            );

            const options = extractWorkspaceOptions(res);

            cacheRef.current[cacheKey] = options;

            setDsWorkspace(prev =>
                append ? [...prev, ...options] : options
            );

            if (options.length < limit) {
                setHasMore(false);
            }
            setError(null);
        } catch (err) {
            if (!append) {
                setDsWorkspace([]);
            }
            setHasMore(false);
            setError(err instanceof ApiError ? err.message : "Không thể tải danh sách workspace.");
        } finally {
            setLoading(false);
        }

    }, [limit]);




    /* ================= SEARCH ================= */

    useEffect(() => {


        setPage(1);
        setHasMore(true);

        fetchData(1, debouncedSearch as string, false);

    }, [debouncedSearch, fetchData]);

    /* ================= LOAD MORE ================= */

    const loadMore = () => {

        if (loading) return;
        if (!hasMore) return;

        const next = page + 1;

        setPage(next);

        fetchData(next, debouncedSearch as string, true);

    };

    return {
        dsWorkspace,
        error,
        loading,
        hasMore,
        setSearch,
        loadMore,
    };

}

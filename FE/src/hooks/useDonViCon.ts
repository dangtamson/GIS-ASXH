'use client';

import { useEffect, useRef, useState } from "react";
import { useDebounce } from "@/hooks/data";
import { endpoints } from "@/lib/endpoints";
import { api } from "@/lib/api";
import { extractList } from "@/lib/data-utils";
import {ApiResponse} from "@/types/api";
import {DonVi} from "@/types/organizations";

type Option = {
    label: string;
    value: string;
};

type UseDonViSelectProps = {
    limit?: number;
    parentId?: string; // ✅ cho phép undefined
};

export function useDonViConSelect({
                                      limit = 20,
                                      parentId
                                  }: UseDonViSelectProps) {

    const [dsDonVi, setDsDonVi] = useState<Option[]>([]);
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 400);

    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const cacheRef = useRef<Record<string, Option[]>>({});

    const fetchData = async (
        pageParam: number,
        searchParam: string,
        append = false
    ) => {

        if (!parentId) return;

        // ✅ thêm parentId vào cache key
        const cacheKey = `${parentId}_${searchParam}_${pageParam}`;

        if (cacheRef.current[cacheKey]) {
            setDsDonVi(prev =>
                append
                    ? [...prev, ...cacheRef.current[cacheKey]]
                    : cacheRef.current[cacheKey]
            );
            return;
        }

        setLoading(true);

        try {
            const parentRes = await api.get<ApiResponse<DonVi>>(`${endpoints.admin.organizations}/${parentId}`)
            const res = await api.get<ApiResponse<DonVi>>(
                `${endpoints.admin.organizations}?page=${pageParam}&limit=${limit}&search=${searchParam}&parentId=${parentId}`,
            );

            const donVis = [
                parentRes.item,
                ...(res.items || []),
            ];

            const options: Option[] = donVis
                .map((doc) => ({
                    value: String(doc?.uuid ?? ""),
                    label: String(doc?.name ?? ""),
                }))
                .filter((item) => item.value);

            cacheRef.current[cacheKey] = options;

            setDsDonVi(prev =>
                append ? [...prev, ...options] : options
            );

            if (options.length < limit) {
                setHasMore(false);
            }

        } finally {
            setLoading(false);
        }
    };

    /* ================= SEARCH + parentId ================= */

    useEffect(() => {

        if (!parentId) return;

        setPage(1);
        setHasMore(true);
        setDsDonVi([]); // ✅ reset data

        fetchData(1, debouncedSearch as string, false);

    }, [debouncedSearch, parentId]); // ✅ thêm parentId

    /* ================= LOAD MORE ================= */

    const loadMore = () => {

        if (loading || !hasMore) return;

        const next = page + 1;

        setPage(next);
        fetchData(next, debouncedSearch as string, true);
    };

    return {
        dsDonVi,
        loading,
        hasMore,
        setSearch,
        loadMore,
    };
}
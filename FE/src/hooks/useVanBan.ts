'use client';

import { useEffect, useRef, useState } from "react";
import { useDebounce } from "@/hooks/data";
import { endpoints } from "@/lib/endpoints";
import { ApiError, api } from "@/lib/api";
import { extractList } from "@/lib/data-utils";

type Option = {
    label: string;
    value: string;
};


type UseVanBanSelectProps = {
    limit?: number;
};


export function useVanBanSelect({
                                     limit = 20,
                                 }: UseVanBanSelectProps = {}) {

    const [dsVanBan, setDsVanBan] = useState<Option[]>([]);

    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 400);

    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const cacheRef = useRef<Record<string, Option[]>>({});


    /* ================= FETCH ================= */

    const fetchData = async (
        pageParam: number,
        searchParam: string,
        append = false
    ) => {


        const cacheKey = `${searchParam}_${pageParam}`;

        if (cacheRef.current[cacheKey]) {

            setDsVanBan(prev =>
                append
                    ? [...prev, ...cacheRef.current[cacheKey]]
                    : cacheRef.current[cacheKey]
            );

            return;
        }

        setLoading(true);

        try {

            const res = await api.get(
                `${endpoints.admin.documents}?page=${pageParam}&limit=${limit}&search=${searchParam}`
            );

            const documents = extractList<Record<string, unknown>>(res)
            const documentById = new Map<string, Record<string, unknown>>();
            documents.forEach((document) => {
                const id = String(document.uuid ?? document.id ?? "");
                if (id) {
                    documentById.set(id, document);
                }
            });

            const options: Option[] = documents
                .map((doc) => ({
                    value: String(doc.uuid ?? doc.id ?? ""),
                    label: String(doc.title ?? doc.documentNumber ?? doc.uuid ?? ""),
                }))
                .filter((item) => item.value);

            cacheRef.current[cacheKey] = options;

            setDsVanBan(prev =>
                append ? [...prev, ...options] : options
            );

            if (options.length < limit) {
                setHasMore(false);
            }
            setError(null);
        } catch (err) {
            if (!append) {
                setDsVanBan([]);
            }
            setHasMore(false);
            setError(err instanceof ApiError ? err.message : "Không thể tải danh sách văn bản.");
        } finally {
            setLoading(false);
        }

    };




    /* ================= SEARCH ================= */

    useEffect(() => {


        setPage(1);
        setHasMore(true);

        fetchData(1, debouncedSearch as string, false);

    }, [debouncedSearch]);

    /* ================= LOAD MORE ================= */

    const loadMore = () => {

        if (loading) return;
        if (!hasMore) return;

        const next = page + 1;

        setPage(next);

        fetchData(next, debouncedSearch as string, true);

    };

    return {

        dsVanBan,
        error,
        loading,
        hasMore,
        setSearch,
        loadMore,

    };

}

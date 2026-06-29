'use client';

import { useEffect, useRef, useState } from "react";
import { useDebounce } from "@/hooks/data";
import { endpoints } from "@/lib/endpoints";
import { api } from "@/lib/api";
import { extractList } from "@/lib/data-utils";

type Option = {
    label: string;
    value: string;
};


type UseNhiemVuSelectProps = {
    limit?: number;
};


export function useNhiemVuSelect({
                                     limit = 20,
                                 }: UseNhiemVuSelectProps = {}) {

    const [dsNhiemVu, setDsNhiemVu] = useState<Option[]>([]);

    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 400);

    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const cacheRef = useRef<Record<string, Option[]>>({});


    /* ================= FETCH ================= */

    const fetchData = async (
        pageParam: number,
        searchParam: string,
        append = false
    ) => {


        const cacheKey = `${searchParam}_${pageParam}`;

        if (cacheRef.current[cacheKey]) {

            setDsNhiemVu(prev =>
                append
                    ? [...prev, ...cacheRef.current[cacheKey]]
                    : cacheRef.current[cacheKey]
            );

            return;
        }

        setLoading(true);

        try {

            const res = await api.get(
                `${endpoints.admin.tasksParentOptions}?page=${pageParam}&limit=${limit}&search=${searchParam}`
            );

            const tasks = extractList<Record<string, unknown>>(res)
            const taskById = new Map<string, Record<string, unknown>>();
            tasks.forEach((task) => {
                const id = String(task.uuid ?? task.id ?? "");
                if (id) {
                    taskById.set(id, task);
                }
            });

            const options: Option[] = tasks
                .map((task) => ({
                    value: String(task.uuid ?? task.id ?? ""),
                    label: String(task.title ?? task.uuid ?? ""),
                }))
                .filter((item) => item.value);

            cacheRef.current[cacheKey] = options;

            setDsNhiemVu(prev =>
                append ? [...prev, ...options] : options
            );

            if (options.length < limit) {
                setHasMore(false);
            }

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

        dsNhiemVu,
        loading,
        hasMore,
        setSearch,
        loadMore,

    };

}

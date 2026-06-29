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

type Category = {
    id?: string;
    uuid?: string;
    code?: string;
};

type CategoryItem = {
    id?: string;
    uuid?: string;
    categoryId?: string;
    name?: string;
    code?: string;
};

type UseChucVuSelectProps = {
    limit?: number;
};

function normalizeText(value: unknown): string {
    return String(value ?? "").trim().toLowerCase();
}

export function useChucVuSelect({
                                     limit = 20,
                                 }: UseChucVuSelectProps = {}) {

    const [dsChucVu, setDsChucVu] = useState<Option[]>([]);
    const [dsLoaiDm, setDsLoaiDm] = useState<Category[]>([]);

    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 400);

    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const cacheRef = useRef<Record<string, Option[]>>({});

    /* ================= CATEGORY ================= */

    const initCategory = async () => {

        const raw = await api.get(
            `${endpoints.admin.categories}?page=1&limit=100`
        );

        const list = extractList<Category>(raw);

        setDsLoaiDm(list);

    };

    /* ================= FETCH ================= */

    const fetchData = async (
        pageParam: number,
        searchParam: string,
        append = false
    ) => {

        if (!dsLoaiDm.length) return;

        const cacheKey = `${searchParam}_${pageParam}`;

        if (cacheRef.current[cacheKey]) {

            setDsChucVu(prev =>
                append
                    ? [...prev, ...cacheRef.current[cacheKey]]
                    : cacheRef.current[cacheKey]
            );

            return;
        }

        setLoading(true);

        try {

            const res = await api.get(
                `${endpoints.admin.categoryItems}?page=${pageParam}&limit=${limit}&search=${searchParam}`
            );

            const fieldCategoryId = dsLoaiDm
                .filter(
                    (cat) =>
                        normalizeText(cat.code) === "position" ||
                        normalizeText(cat.code) === "position"
                )
                .map((cat) => String(cat.uuid ?? cat.id ?? ""))
                .find(Boolean);

            const list = extractList<CategoryItem>(res).filter(
                (item) =>
                    !fieldCategoryId ||
                    String(item.categoryId ?? "") === fieldCategoryId
            );

            const options: Option[] = list.map((item) => ({
                value: String(item.uuid ?? item.id),
                label: String(item.name ?? item.code),
            }));

            cacheRef.current[cacheKey] = options;

            setDsChucVu(prev =>
                append ? [...prev, ...options] : options
            );

            if (options.length < limit) {
                setHasMore(false);
            }

        } finally {
            setLoading(false);
        }

    };

    /* ================= INIT ================= */

    useEffect(() => {
        void initCategory();
    }, []);

    /* ================= SEARCH ================= */

    useEffect(() => {

        if (!dsLoaiDm.length) return;

        setPage(1);
        setHasMore(true);

        fetchData(1, debouncedSearch as string, false);

    }, [debouncedSearch, dsLoaiDm]);

    /* ================= LOAD MORE ================= */

    const loadMore = () => {

        if (loading) return;
        if (!hasMore) return;

        const next = page + 1;

        setPage(next);

        fetchData(next, debouncedSearch as string, true);

    };

    return {

        dsChucVu,
        loading,
        hasMore,
        setSearch,
        loadMore,

    };

}

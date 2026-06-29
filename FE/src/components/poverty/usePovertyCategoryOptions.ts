"use client";

import {api} from "@/lib/api";
import {extractList} from "@/lib/data-utils";
import {endpoints} from "@/lib/endpoints";
import {useEffect, useState} from "react";

type CategoryItem = {
    uuid?: string | null;
    id?: string | null;
    code?: string | null;
    name?: string | null;
};

export type PovertyCategoryOption = {
    label: string;
    value: string;
    code?: string | null;
};

function buildCategoryItemQuery(categoryCode: string): string {
    return new URLSearchParams({
        categoryCode,
        status: "true",
        page: "1",
        limit: "100",
        sortBy: "sortOrder",
        sortOrder: "asc",
    }).toString();
}

export function usePovertyCategoryOptions(categoryCode: "AREA" | "NATION"): PovertyCategoryOption[] {
    const [options, setOptions] = useState<PovertyCategoryOption[]>([]);

    useEffect(() => {
        let active = true;

        api.get<unknown>(`${endpoints.admin.categoryItems}?${buildCategoryItemQuery(categoryCode)}`)
            .then((data) => {
                if (!active) return;
                const items = extractList<CategoryItem>(data);
                const nextOptions: PovertyCategoryOption[] = [];
                items.forEach((item) => {
                        const name = String(item.name ?? "").trim();
                        if (!name) return;
                        nextOptions.push({
                            label: name,
                            value: name,
                            code: item.code ?? item.uuid ?? item.id ?? null,
                        });
                    });
                setOptions(nextOptions);
            })
            .catch(() => {
                if (active) setOptions([]);
            });

        return () => {
            active = false;
        };
    }, [categoryCode]);

    return options;
}

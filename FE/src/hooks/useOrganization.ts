'use client';

import { useEffect, useRef, useState } from "react";
import { endpoints } from "@/lib/endpoints";
import { api } from "@/lib/api";

import { ApiResponse } from "@/types/api";
import { DonVi } from "@/types/organizations";

type UseDonViSelectProps = {
    defaultLimit?: number;
};

export type TreeNode = {
    title: string;
    value: string;
    children?: TreeNode[];
};

function getOrganizationSortOrder(item: DonVi): number {
    const value = item.sortOrder ?? item.sort_order;
    return typeof value === "number" ? value : Number.MAX_SAFE_INTEGER;
}

function sortOrganizations(items: DonVi[]): DonVi[] {
    return [...items].sort((left, right) => {
        const sortOrderDiff = getOrganizationSortOrder(left) - getOrganizationSortOrder(right);
        if (sortOrderDiff !== 0) {
            return sortOrderDiff;
        }

        return String(left.name || "").localeCompare(String(right.name || ""), "vi");
    });
}
/* ===================== BUILD TREE ===================== */

export function buildDonViTreeForAntd(list: DonVi[]): TreeNode[] {
    const sortedList = sortOrganizations(list);

    const map = new Map<string, TreeNode>();

    const roots: TreeNode[] = [];

    for (const item of sortedList) {

        map.set(item.uuid, {
            title: item.name || '',
            value: item.uuid || '',
            children: [],
        });

    }

    for (const item of sortedList) {

        const node = map.get(item.uuid)!;

        if (item.parentId && map.has(item.parentId)) {

            map.get(item.parentId)!.children!.push(node);

        } else {

            roots.push(node);

        }

    }

    return roots;
}


/* ===================== HOOK ===================== */

export function useDonViSelect(
    {}: UseDonViSelectProps = {}
) {

    const [dsDonVi, setDsDonVi] = useState<TreeNode[]>([]);

    const [loading, setLoading] = useState(false);

    const cacheRef = useRef<Record<string, TreeNode[]>>({});


    /* ===================== FETCH ===================== */

    const fetchDonVi = async () => {

        const cacheKey = "all";

        if (cacheRef.current[cacheKey]) {
            setDsDonVi(cacheRef.current[cacheKey]);
            return;
        }

        setLoading(true);

        try {

            const res = await api.get<ApiResponse<DonVi>>(
                `${endpoints.admin.organizations}?limit=1000&page=1`
            );

            const list = res.items ?? [];

            const tree = buildDonViTreeForAntd(list);
            cacheRef.current[cacheKey] = tree;

            setDsDonVi(tree);
        } catch (error) {
            setDsDonVi([]);
        } finally {

            setLoading(false);

        }

    };


    /* ===================== EFFECT ===================== */

    useEffect(() => {
        fetchDonVi();
    }, []);


    /* ===================== API ===================== */

    return {

        dsDonVi,   // ✅ tree

        loading,

    };

}

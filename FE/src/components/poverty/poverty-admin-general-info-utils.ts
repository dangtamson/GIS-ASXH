export type WardListItemLike = {
    code: string;
    name: string;
    fullName?: string | null;
};

export function filterWardItems<T extends WardListItemLike>(items: T[], selectedWardCode?: string | null): T[] {
    if (!selectedWardCode) {
        return items;
    }

    return items.filter((item) => item.code === selectedWardCode);
}

export function buildWardFilterOptions(items: WardListItemLike[]): Array<{ value: string; label: string }> {
    return items.map((item) => ({
        value: item.code,
        label: item.fullName || item.name,
    }));
}

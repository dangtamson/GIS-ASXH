/**
 * Reusable task-related options and helpers for shared use across pages
 */

export type SelectOption = {
    value: string;
    label: string;
    filter?: boolean;
};

export type OrganizationTreeNode = {
    value: string;
    label: string;
    children: OrganizationTreeNode[];
};

/**
 * Fixed priority options (4 levels)
 */
export const PRIORITY_OPTIONS: SelectOption[] = [
    { value: "low", label: "Thấp" },
    { value: "medium", label: "Trung bình" },
    { value: "high", label: "Cao" },
    { value: "urgent", label: "Khẩn cấp" },
];

/**
 * Fixed status options
 */
export const STATUS_OPTIONS: SelectOption[] = [
    { value: "new", label: "Mới", filter: true },
    { value: "in_progress", label: "Đang thực hiện", filter: true },
    { value: "completed", label: "Hoàn thành", filter: true },
    { value: "overdue", label: "Quá hạn", filter: false },
    { value: "not_received", label: "Chờ tiếp nhận", filter: false },
    { value: "issued", label: "Đã ban hành", filter: false},
    { value: "pending", label: "Chờ đánh giá", filter: false},
    { value: "approved", label: "Đã đánh giá", filter: false},
    { value: "rejected", label: "Đã đánh giá", filter: false},
];
export const STATUS_COLOR_MAP: Record<string, string> = {
    // 🟢 nhóm hoàn thành (tách màu khác nhau)
    completed: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    done: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    approved: "bg-lime-50 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300",

    // 🔵 đang xử lý (mỗi cái 1 màu)
    in_progress: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    processing: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
    dang_xu_ly: "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
    thuc_hien: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",

    // 🟡 mới / ban hành
    new: "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    not_received: "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    issued: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",

    // 🔴 lỗi / quá hạn
    overdue: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    failed: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
    rejected: "bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",

    // ⚪ trạng thái chờ
    draft: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
    pending: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export const STATUS_COLOR_STYLE_MAP: Record<string, { backgroundColor: string; color: string }> = {
    completed: { backgroundColor: "#dcfce7", color: "#15803d" },
    done: { backgroundColor: "#d1fae5", color: "#047857" },
    approved: { backgroundColor: "#ecfccb", color: "#4d7c0f" },
    in_progress: { backgroundColor: "#dbeafe", color: "#1d4ed8" },
    processing: { backgroundColor: "#e0e7ff", color: "#4338ca" },
    dang_xu_ly: { backgroundColor: "#cffafe", color: "#0f766e" },
    thuc_hien: { backgroundColor: "#e0f2fe", color: "#0369a1" },
    new: { backgroundColor: "#fef9c3", color: "#a16207" },
    not_received: { backgroundColor: "#ffedd5", color: "#c2410c" },
    issued: { backgroundColor: "#fef3c7", color: "#b45309" },
    overdue: { backgroundColor: "#fee2e2", color: "#b91c1c" },
    failed: { backgroundColor: "#ffe4e6", color: "#be123c" },
    rejected: { backgroundColor: "#fce7f3", color: "#be185d" },
    draft: { backgroundColor: "#f3f4f6", color: "#374151" },
    pending: { backgroundColor: "#f4f4f5", color: "#52525b" },
};

/**
 * Build organization tree from flat list
 */
export function buildOrganizationTree(
    rows: Record<string, unknown>[],
    labelKeys?: string[]
): OrganizationTreeNode[] {
    const toOption = (row: Record<string, unknown>, keys?: string[]): SelectOption => {
        const value = String(row.uuid ?? row.id ?? row._id ?? "");
        const labels = (keys && keys.length
            ? keys
            : ["name", "title", "code"]
        )
            .map((key) => String(row[key] ?? "").trim())
            .filter(Boolean);
        return {
            value,
            label: labels.join(" - ") || value,
        };
    };

    const getNodeId = (row: Record<string, unknown>) => String(row.uuid ?? row.id ?? row._id ?? "").trim();
    const getParentId = (row: Record<string, unknown>) =>
        String(
            row.parentId ??
            row.parent_id ??
            row.parentUUID ??
            row.parentUuid ??
            row.parentOrganizationId ??
            row.parentOrgId ??
            ""
        ).trim();

    const idToRow = new Map<string, Record<string, unknown>>();
    rows.forEach((row) => {
        const id = getNodeId(row);
        if (id) {
            idToRow.set(id, row);
        }
    });

    const childrenByParent = new Map<string, Record<string, unknown>[]>();
    rows.forEach((row) => {
        const id = getNodeId(row);
        if (!id) {
            return;
        }

        const rawParentId = getParentId(row);
        const parentId = rawParentId && idToRow.has(rawParentId) ? rawParentId : "ROOT";
        const list = childrenByParent.get(parentId) || [];
        list.push(row);
        childrenByParent.set(parentId, list);
    });

    childrenByParent.forEach((list) => {
        list.sort((a, b) =>
            toOption(a, labelKeys).label.localeCompare(toOption(b, labelKeys).label, "vi")
        );
    });

    const visited = new Set<string>();
    const buildNodes = (parentId: string): OrganizationTreeNode[] => {
        const children = childrenByParent.get(parentId) || [];
        const nodes: OrganizationTreeNode[] = [];

        children.forEach((row) => {
            const id = getNodeId(row);
            if (!id || visited.has(id)) {
                return;
            }

            visited.add(id);
            const base = toOption(row, labelKeys);
            nodes.push({
                value: base.value,
                label: base.label,
                children: buildNodes(id),
            });
        });
        return nodes;
    };

    return buildNodes("ROOT");
}

/**
 * Flatten organization tree to flat option list
 */
export function flattenOrganizationTree(nodes: OrganizationTreeNode[]): SelectOption[] {
    const options: SelectOption[] = [];
    const walk = (items: OrganizationTreeNode[]) => {
        items.forEach((node) => {
            options.push({ value: node.value, label: node.label });
            if (node.children.length) {
                walk(node.children);
            }
        });
    };
    walk(nodes);
    return options;
}

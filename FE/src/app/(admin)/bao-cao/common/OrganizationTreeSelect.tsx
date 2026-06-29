"use client";

import React from "react";
import {TreeSelect} from "antd";
import {Check, ChevronDown} from "lucide-react";
import {useDonViSelect} from "@/hooks/useOrganization";

type TreeNode = {
    title: string;
    value: string;
    children?: TreeNode[];
};

type LabeledValue = {
    value: string;
    label: React.ReactNode;
};

type OrganizationTreeSelectProps = {
    value: string[];
    onChange: (value: string[]) => void;
    onFilterChange?: (hasFilter: boolean) => void;
    placeholder?: string;
    maxTagCount?: number | 'responsive';
    multiple?: boolean;
};

function collectDescendants(nodes: TreeNode[], map: Map<string, string[]>) {
    nodes.forEach((node) => {
        const childIds: string[] = [];
        if (node.children && node.children.length > 0) {
            const walk = (items: TreeNode[]) => {
                items.forEach((child) => {
                    childIds.push(child.value);
                    if (child.children && child.children.length > 0) {
                        walk(child.children);
                    }
                });
            };
            walk(node.children);
        }
        map.set(node.value, childIds);
        if (node.children && node.children.length > 0) {
            collectDescendants(node.children, map);
        }
    });
}

function collectLabels(nodes: TreeNode[], map: Map<string, string>) {
    nodes.forEach((node) => {
        map.set(node.value, String(node.title ?? ""));
        if (node.children && node.children.length > 0) {
            collectLabels(node.children, map);
        }
    });
}

function normalizeText(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) {
        return nodes;
    }
    const results: TreeNode[] = [];
    nodes.forEach((node) => {
        const selfMatch = normalizeText(String(node.title ?? "")).includes(normalizedQuery);
        const filteredChildren = node.children ? filterTree(node.children, normalizedQuery) : [];
        if (selfMatch) {
            results.push({ ...node, children: node.children ?? [] });
            return;
        }
        if (filteredChildren.length > 0) {
            results.push({ ...node, children: filteredChildren });
        }
    });
    return results;
}

export default function OrganizationTreeSelect({
    value,
    onChange,
    onFilterChange,
    placeholder = "Đơn vị",
    maxTagCount = "responsive",
    multiple,
}: OrganizationTreeSelectProps) {
    const { dsDonVi, loading } = useDonViSelect();
    const [searchValue, setSearchValue] = React.useState("");
    const [selectedValue, setSelectedValue] = React.useState<LabeledValue[]>([]);
    const [hover, setHover] = React.useState<boolean>(false)
    const [focus, setFocus] = React.useState<boolean>(false)

    const treeData = React.useMemo(() => dsDonVi as TreeNode[], [dsDonVi]);
    const filteredTreeData = React.useMemo(
        () => filterTree(treeData, searchValue),
        [treeData, searchValue]
    );
    const descendantMap = React.useMemo(() => {
        const map = new Map<string, string[]>();
        collectDescendants(treeData, map);
        return map;
    }, [treeData]);
    const labelMap = React.useMemo(() => {
        const map = new Map<string, string>();
        collectLabels(treeData, map);
        return map;
    }, [treeData]);

    React.useEffect(() => {
        setSelectedValue(
            value.map((item) => ({
                value: item,
                label: labelMap.get(item) ?? item,
            }))
        );
    }, [value, labelMap]);

    const handleChange = (nextValue: LabeledValue[]) => {
        const normalized = Array.isArray(nextValue) ? nextValue : [];
        setSelectedValue(normalized);
        onChange(normalized.map((item) => String(item.value)));
        onFilterChange?.(normalized.length > 0);
    };

    const toggleSelectBranch = (nodeId: string) => {
        const descendants = descendantMap.get(nodeId) || [];
        const branchIds = [nodeId, ...descendants];
        const hasAll = branchIds.every((id) => value.includes(id));
        const next = new Set(value);
        if (hasAll) {
            branchIds.forEach((id) => next.delete(id));
        } else {
            branchIds.forEach((id) => next.add(id));
        }
        const nextValues = Array.from(next);
        onChange(nextValues);
        onFilterChange?.(nextValues.length > 0);
    };

    return (
        <TreeSelect
            className="org-tree-select"
            classNames={{
                root: 'bg-white py-0',
                content: 'h-[38px] ',
                popup: {
                    root: "org-tree-select-dropdown",
                },
            }}
            placeholder={placeholder}
            showSearch
            labelInValue
            multiple={multiple}
            suffixIcon={<ChevronDown className="h-4 w-4 text-gray-500" />}
            treeData={filteredTreeData}
            value={selectedValue}
            onChange={(nextValue) => handleChange(nextValue as LabeledValue[])}
            treeTitleRender={(node) => {
                const hasChildren = Array.isArray(node.children) && node.children.length > 0;
                const nodeValue = String(node.value);
                const isSelected = value.includes(nodeValue);
                return (
                    <div
                        className="controller-select-option"
                        onDoubleClick={(event) => {
                            if (!hasChildren) {
                                return;
                            }
                            event.stopPropagation();
                            toggleSelectBranch(nodeValue);
                        }}
                    >
                        <span className={`controller-select-option-check${isSelected ? " is-selected" : ""}`}>
                            {isSelected ? <Check className="h-3.5 w-3.5" /> : null}
                        </span>
                        <span className="controller-select-option-label">{node.title as React.ReactNode}</span>
                    </div>
                );
            }}
            filterTreeNode={false}
            onSearch={(valueInput) => setSearchValue(valueInput)}
            onOpenChange={(open) => {
                if (!open) {
                    setSearchValue("");
                }
                setFocus(open)
            }}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            onClear={() => setSearchValue("")}
            loading={loading}
            allowClear
            maxTagCount={maxTagCount}
            maxTagPlaceholder={(omittedValues) => `+${omittedValues.length} khác`}
            style={{ width: "100%", height: "40px", borderColor: (focus || hover) ? '#dc2626' : undefined,
                boxShadow: (focus)
                    ? '0 0 0 2px rgba(220, 38, 38, 0.2)'
                    : 'none', }}
        />
    );
}

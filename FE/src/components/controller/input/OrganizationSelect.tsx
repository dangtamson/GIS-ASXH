'use client';

import React from "react";
import {TreeSelect} from "antd";
import {ChevronDown} from "lucide-react";
import {useDonViSelect} from "@/hooks/useOrganization";
import {
    controllerSelectClassName,
    controllerSelectClassNames,
    controllerSelectStyles
} from "@/components/controller/input/selectShared";

type TreeNode = {
    title: string;
    value: string;
    children?: TreeNode[];
};

type Props = {
    value?: string;
    onChange?: (value?: string) => void;
    placeholder?: string;
    title?: string;
    bold?: boolean;
    hideTitle?: boolean;
    disabled?: boolean;
    allowClear?: boolean;
};

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
        const filteredChildren = node.children ? filterTree(node.children, query) : [];

        if (selfMatch) {
            results.push({...node, children: node.children ?? []});
            return;
        }

        if (filteredChildren.length > 0) {
            results.push({...node, children: filteredChildren});
        }
    });

    return results;
}

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

export default function OrganizationSelect(props: Props) {
    const {
        value,
        onChange,
        placeholder = 'Chọn đơn vị giao',
        title = 'Đơn vị giao',
        bold = false,
        hideTitle = false,
        disabled = false,
        allowClear = true,
    } = props;
    const [hover, setHover] = React.useState<boolean>(false)
    const [focus, setFocus] = React.useState<boolean>(false)

    const {dsDonVi, loading} = useDonViSelect();
    const [searchValue, setSearchValue] = React.useState("");
    const [open, setOpen] = React.useState(false);
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
    const highlightedValues = React.useMemo(() => {
        if (!value) {
            return [];
        }

        return [value, ...(descendantMap.get(value) ?? [])];
    }, [descendantMap, value]);

    const handleSelectBranch = (nextValue?: string) => {
        onChange?.(nextValue === value ? undefined : nextValue);
        setOpen(false);
        setSearchValue("");
    };

    return (
        <label className="w-full">
            {!hideTitle && (
                <span className="mb-1 block text-sm" style={{fontWeight: bold ? 600 : 400}}>
                    {title}
                </span>
            )}
            <TreeSelect
                className={`${controllerSelectClassName} controller-select`}
                classNames={controllerSelectClassNames}
                styles={controllerSelectStyles}
                disabled={disabled}
                value={value}
                open={open}
                placeholder={placeholder}
                treeData={filteredTreeData}
                loading={loading}
                allowClear={allowClear}
                showSearch
                treeDefaultExpandAll
                suffixIcon={<ChevronDown className="h-4 w-4 text-gray-500"/>}
                filterTreeNode={false}
                treeTitleRender={(node) => {
                    const nodeValue = String(node.value);
                    const isSelected = highlightedValues.includes(nodeValue);

                    return (
                        <div
                            className={`controller-select-option${isSelected ? " is-selected" : ""}`}
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                handleSelectBranch(nodeValue);
                            }}
                        >
                            <span className="controller-select-option-label">{node.title as React.ReactNode}</span>
                        </div>
                    );
                }}
                onChange={(nextValue) => handleSelectBranch((nextValue as string | undefined) ?? undefined)}
                onSearch={setSearchValue}
                onClear={() => setSearchValue("")}
                onOpenChange={(open) => {
                    setOpen(open);
                    if (!open) {
                        setSearchValue("");
                    }
                    setFocus(open)
                }}
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
                style={{
                    width: '100%',
                    height: '40px',
                    borderColor: (focus || hover) ? '#dc2626' : undefined,
                    boxShadow: (focus)
                        ? '0 0 0 2px rgba(220, 38, 38, 0.2)'
                        : 'none',
                    transition: 'all 0.2s ease'
            }}
            />
        </label>
    );
}

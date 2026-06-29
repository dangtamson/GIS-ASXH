import React, {useEffect, useMemo, useRef, useState} from "react";
import {ChevronDown} from "lucide-react";

type SelectOption = {
    value: string;
    label: string;
};

type MultiSelectProps = {
    label: string;
    options: SelectOption[];
    value: string[];
    onChange: (value: string[]) => void;
    placeholder?: string;
    maxTagCount?: number | 'responsive';
};

export default function MultiSelect({
    label,
    options,
    value,
    onChange,
    placeholder = "Tất cả",
    maxTagCount = "responsive",
}: MultiSelectProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [containerWidth, setContainerWidth] = useState(0);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const buttonRef = useRef<HTMLButtonElement | null>(null);

    const normalizedOptions = useMemo(() => {
        const seen = new Set<string>();
        const unique = options.filter((option) => {
            if (seen.has(option.value)) {
                return false;
            }
            seen.add(option.value);
            return true;
        });
        return unique;
    }, [options]);

    const selectableOptions = useMemo(
        () => normalizedOptions.filter((option) => option.value),
        [normalizedOptions]
    );

    const isAllSelected = selectableOptions.length > 0 && value.length === selectableOptions.length;

    const selectedLabels = useMemo(() => {
        if (isAllSelected) {
            return placeholder;
        }
        if (!value.length) {
            return "Chưa chọn";
        }

        const map = new Map(normalizedOptions.map((option) => [option.value, option.label]));
        
        let visibleCount = typeof maxTagCount === "number" ? maxTagCount : 3;
        
        if (maxTagCount === "responsive" && containerWidth > 0) {
            // Estimate: ~80px per tag + chevron (40px) + padding (24px)
            const estimatedTagWidth = 85;
            const chevronAndPadding = 64;
            const availableWidth = containerWidth - chevronAndPadding;
            visibleCount = Math.max(1, Math.floor(availableWidth / estimatedTagWidth));
        }

        const visibleValues = value.slice(0, visibleCount);
        const remainCount = value.length - visibleCount;
        
        return visibleValues
            .map((val) => map.get(val) || val)
            .join(", ")
            .concat(remainCount > 0 ? `, +${remainCount} khác` : "");
    }, [isAllSelected, normalizedOptions, placeholder, value, maxTagCount, containerWidth]);

    const filteredOptions = useMemo(() => {
        const normalized = search
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
        if (!normalized) {
            return normalizedOptions;
        }
        return normalizedOptions.filter((option) => {
            if (!option.value) {
                return true;
            }
            const label = option.label
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase();
            return label.includes(normalized);
        });
    }, [normalizedOptions, search]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setOpen(false);
                setSearch("");
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (maxTagCount !== "responsive" || !buttonRef.current) return;

        const observer = new ResizeObserver(() => {
            if (buttonRef.current) {
                setContainerWidth(buttonRef.current.offsetWidth);
            }
        });

        observer.observe(buttonRef.current);
        return () => observer.disconnect();
    }, [maxTagCount]);

    const toggleOption = (optionValue: string) => {
        if (!optionValue) {
            if (isAllSelected) {
                onChange([]);
            } else {
                onChange(selectableOptions.map((option) => option.value));
            }
            return;
        }
        if (value.includes(optionValue)) {
            const next = value.filter((item) => item !== optionValue);
            onChange(next);
            return;
        }
        const next = [...value, optionValue];
        onChange(next);
    };

    return (
        <div ref={containerRef} className="relative">
            <label className="mb-1 block text-xs font-medium text-gray-700">{label}</label>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            >
                <span className="block truncate text-left" title={selectedLabels}>
                    {selectedLabels}
                </span>
                <ChevronDown className="ml-2 h-4 w-4 text-gray-500" />
            </button>
            {open ? (
                <div className="absolute  left-0 right-0 z-100 mt-2 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    <div className="px-3 py-2 border-b border-gray-100">
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Tìm kiếm..."
                            className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                        />
                    </div>
                    {filteredOptions.map((option) => {
                        const isSelected = option.value ? value.includes(option.value) : isAllSelected;
                        return (
                            <label
                                key={`${option.value}-${option.label}`}
                                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleOption(option.value)}
                                    className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                                />
                                <span>{option.label}</span>
                            </label>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
}

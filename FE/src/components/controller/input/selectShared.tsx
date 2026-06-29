'use client';

import React from "react";
import type { SelectProps } from "antd";
import { Check } from "lucide-react";

export type SelectOption = {
    label: string;
    value: string;
};

export const controllerSelectClassName = "no-disabled-style controller-select w-full";
export const controllerSelectPopupClassName = "controller-select-dropdown";
type SelectMaxTagPlaceholder = Exclude<SelectProps<string[], SelectOption>["maxTagPlaceholder"], React.ReactNode | undefined>;
type ControllerSelectClassNames = NonNullable<SelectProps<string | string[], SelectOption>["classNames"]>;
type ControllerSelectStyles = NonNullable<SelectProps<string | string[], SelectOption>["styles"]>;
type ControllerOptionRender = NonNullable<SelectProps<string[], SelectOption>["optionRender"]>;
type ControllerOptionRenderOption = Parameters<ControllerOptionRender>[0];

export const controllerSelectClassNames: ControllerSelectClassNames = {
    popup: {
        root: controllerSelectPopupClassName,
    },
};

export const controllerSelectStyles: ControllerSelectStyles = {
    content: {
        display: "flex",
        alignItems: "center",
        minHeight: "100%",
    },
    placeholder: {
        display: "flex",
        alignItems: "center",
        minHeight: "100%",
    },
    input: {
        minHeight: "100%",
    },
    item: {
        display: "inline-flex",
        alignItems: "center",
        alignSelf: "center",
        marginTop: 0,
        marginBottom: 0,
    },
    itemContent: {
        display: "flex",
        alignItems: "center",
    },
    itemRemove: {
        display: "flex",
        alignItems: "center",
    },
};

export function getSelectedValueList(value?: string | string[]): string[] {
    if (Array.isArray(value)) {
        return value;
    }

    return value ? [value] : [];
}

export function getDisplaySelectedValueList(
    options: SelectOption[],
    selectedValues: string[],
    allOptionValue?: string
): string[] {
    const allValues = options.map((item) => item.value);
    const normalizedValues = options
        .filter((item) => item.value !== allOptionValue)
        .map((item) => item.value);
    const hasExplicitAll = allOptionValue !== undefined && selectedValues.includes(allOptionValue);
    const hasSelectedEveryNonAllOption =
        normalizedValues.length > 0 &&
        normalizedValues.every((value) => selectedValues.includes(value));

    if (hasExplicitAll || hasSelectedEveryNonAllOption) {
        return allValues;
    }

    return selectedValues;
}

export function createMultiSelectOptionRenderer(selectedValues: string[]) {
    return function ControllerSelectOption(
        option: ControllerOptionRenderOption
    ): React.ReactNode {
        const optionValue = String(option.value ?? option.data?.value ?? "");
        const optionLabel = String(option.data?.label ?? option.label ?? optionValue);
        const isSelected = selectedValues.includes(optionValue);

        return (
            <div className="controller-select-option">
                <span className={`controller-select-option-check${isSelected ? " is-selected" : ""}`}>
                    {isSelected ? <Check className="h-3.5 w-3.5" /> : null}
                </span>
                <span className="controller-select-option-label">{optionLabel}</span>
            </div>
        );
    };
}

export function createMaxTagPlaceholder(placeholder?: string): SelectMaxTagPlaceholder {
    return function ControllerMaxTagPlaceholder(omittedValues) {
        const countLabel = `+${omittedValues.length}`;
        return placeholder ? `${placeholder}: ${countLabel}` : countLabel;
    };
}

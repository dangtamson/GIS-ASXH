'use client';

import React from "react";
import {Select} from "antd";
import type {SelectProps} from "antd";
import {
    controllerSelectClassName,
    controllerSelectClassNames,
    controllerSelectStyles,
    createMaxTagPlaceholder,
    createMultiSelectOptionRenderer,
    getDisplaySelectedValueList,
    getSelectedValueList,
    SelectOption
} from "@/components/controller/input/selectShared";

type BaseProps = {
    options: SelectOption[];
    placeholder?: string;
    title?: string;
    bold?: boolean;
    hideTitle?: boolean;
    disabled?: boolean;
    allOptionValue?: string;
    allowClear?: boolean;
    loading?: boolean;
    filterOption?: boolean;
    onSearch?: (value: string) => void;
    onPopupScroll?: (event: React.UIEvent<HTMLElement>) => void;
    getPopupContainer?: (triggerNode: HTMLElement) => HTMLElement;
};

export type AppSelectSingleProps = BaseProps & {
    multiple?: false;
    value?: string;
    onChange?: (value?: string) => void;
};

export type AppSelectMultipleProps = BaseProps & {
    multiple: true;
    value?: string[];
    onChange?: (value: string[]) => void;
};

export type AppSelectProps = AppSelectSingleProps | AppSelectMultipleProps;

export default function AppSelect(props: AppSelectProps) {
    const {
        options,
        placeholder,
        title,
        bold = false,
        hideTitle = false,
        disabled = false,
        allOptionValue,
        allowClear = true,
        loading = false,
        filterOption = true,
        onSearch,
        onPopupScroll,
        getPopupContainer,
    } = props;

    const [hover, setHover] = React.useState<boolean>(false)
    const [focus, setFocus] = React.useState<boolean>(false)

    const normalizedValues = options
        .filter((item) => item.value !== allOptionValue)
        .map((item) => item.value);
    const selectedValues = getSelectedValueList(props.value);
    const displaySelectedValues = getDisplaySelectedValueList(options, selectedValues, allOptionValue);
    const isShowingAllSelection =
        props.multiple &&
        normalizedValues.length > 0 &&
        normalizedValues.every((value) => selectedValues.includes(value));
    const allOptionLabel = options.find((item) => item.value === allOptionValue)?.label ?? "Tất cả";
    const skipNextChangeRef = React.useRef(false);
    const showSearch = Boolean(onSearch) || filterOption === false;
    const renderAllSelectionTag: NonNullable<SelectProps<string[], SelectOption>["tagRender"]> = (tagProps) => {
        const {closable, onClose} = tagProps;
        const isAllTag = String(tagProps.value) === String(allOptionValue);

        if (!isAllTag) {
            return <span style={{display: 'none'}} />;
        }

        return (
            <span
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    maxWidth: '100%',
                    height: 24,
                    marginInlineEnd: 4,
                    paddingInline: 8,
                    overflow: 'hidden',
                    color: 'rgba(0, 0, 0, 0.88)',
                    background: 'rgba(0, 0, 0, 0.06)',
                    border: '1px solid transparent',
                    borderRadius: 6,
                }}
                onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                }}
            >
                <span>{allOptionLabel}</span>
                {closable ? (
                    <span
                        style={{marginInlineStart: 6, cursor: 'pointer', lineHeight: 1}}
                        onMouseDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                        }}
                        onClick={onClose}
                    >
                        ×
                    </span>
                ) : null}
            </span>
        );
    };

    return (
        <label className="w-full">
            {!hideTitle && (
                <span className="mb-1 block text-sm" style={{fontWeight: bold ? 600 : 400}}>
                    {title || "Không xác định"}
                </span>
            )}
            <Select
                className={controllerSelectClassName}
                classNames={controllerSelectClassNames}
                styles={controllerSelectStyles}
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
                disabled={disabled}
                showSearch={showSearch}
                mode={props.multiple ? 'multiple' : undefined}
                maxTagCount={props.multiple ? 'responsive' : undefined}
                maxTagPlaceholder={props.multiple ? createMaxTagPlaceholder(placeholder || 'Đã chọn') : undefined}
                menuItemSelectedIcon={props.multiple ? null : undefined}
                optionRender={props.multiple ? createMultiSelectOptionRenderer(displaySelectedValues) : undefined}
                tagRender={props.multiple && isShowingAllSelection ? renderAllSelectionTag : undefined}
                value={props.multiple ? displaySelectedValues : props.value}
                onChange={(value) => {
                    if (props.multiple) {
                        if (skipNextChangeRef.current) {
                            skipNextChangeRef.current = false;
                            return;
                        }

                        const nextValue = value as string[];
                        props.onChange?.(
                            allOptionValue !== undefined && nextValue.includes(allOptionValue)
                                ? nextValue.filter((item) => item !== allOptionValue)
                                : nextValue
                        );
                        return;
                    }

                    props.onChange?.(value as string | undefined);
                }}
                onSelect={props.multiple ? (value) => {
                    const nextValue = String(value);
                    if (allOptionValue === undefined || nextValue !== allOptionValue) {
                        return;
                    }

                    skipNextChangeRef.current = true;
                    props.onChange?.(normalizedValues);
                } : undefined}
                onDeselect={props.multiple ? (value) => {
                    const nextValue = String(value);
                    if (allOptionValue === undefined || nextValue !== allOptionValue) {
                        return;
                    }

                    skipNextChangeRef.current = true;
                    props.onChange?.([]);
                } : undefined}
                style={{
                    width: '100%',
                    height: '40px',
                    borderColor: (focus || hover) ? '#dc2626' : undefined,
                    boxShadow: (focus)
                        ? '0 0 0 2px rgba(220, 38, 38, 0.2)'
                        : 'none',
                    transition: 'all 0.2s ease'
            }}
                onOpenChange={(visible) => {setFocus(visible)}}
                placeholder={placeholder || 'Chọn'}
                allowClear={allowClear}
                options={options}
                loading={loading}
                filterOption={filterOption}
                onSearch={onSearch}
                onPopupScroll={onPopupScroll}
                getPopupContainer={getPopupContainer}
            />
        </label>
    );
}

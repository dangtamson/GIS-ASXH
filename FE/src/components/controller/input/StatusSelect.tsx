'use client';

import {STATUS_OPTIONS} from "@/lib/task-options";
import AppSelect, {AppSelectMultipleProps, AppSelectSingleProps} from "@/components/controller/input/AppSelect";
import {SelectOption} from "@/components/controller/input/selectShared";

type ExtraProps = {
    extraOptions?: SelectOption[];
    includeAllOption?: boolean;
    allOptionLabel?: string;
    allOptionValue?: string;
};
type Props =
    | (Omit<AppSelectSingleProps, "options" | "allOptionValue"> & ExtraProps)
    | (Omit<AppSelectMultipleProps, "options" | "allOptionValue"> & ExtraProps);

export default function StatusSelect(props: Props) {
    const {
        extraOptions = [],
        includeAllOption = false,
        allOptionLabel = 'Tất cả',
        allOptionValue = '',
    } = props;

    const mergedOptions: SelectOption[] = [
        ...(includeAllOption ? [{label: allOptionLabel, value: allOptionValue}] : []),
        ...extraOptions,
        ...STATUS_OPTIONS.filter((item) => item.filter).map((item) => ({
            value: item.value,
            label: item.label,
        })),
    ].filter((item, index, self) => index === self.findIndex((current) => current.value === item.value));

    if (props.multiple) {
        return (
            <AppSelect
                {...props}
                allOptionValue={allOptionValue}
                options={mergedOptions}
                placeholder={props.placeholder || 'Chọn trạng thái'}
                title={props.title || 'Trạng thái'}
            />
        );
    }

    return (
        <AppSelect
            {...props}
            allOptionValue={allOptionValue}
            options={mergedOptions}
            placeholder={props.placeholder || 'Chọn trạng thái'}
            title={props.title || 'Trạng thái'}
        />
    );
}

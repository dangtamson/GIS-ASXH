'use client';

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

export default function StatusCategorieSelect(props: Props) {
    const {
        extraOptions = [],
        includeAllOption = false,
        allOptionLabel = 'Tất cả',
        allOptionValue = '',
    } = props;

    const mergedOptions: SelectOption[] = [
        ...(includeAllOption ? [{label: allOptionLabel, value: allOptionValue}] : []),
        ...extraOptions
    ].filter((item, index, self) => index === self.findIndex((current) => current.value === item.value));

    if (props.multiple) {
        return (
            <AppSelect
                {...props}
                allOptionValue={allOptionValue}
                options={mergedOptions}
                placeholder={props.placeholder || 'Chọn'}
                title={props.title || 'Không xác định'}
            />
        );
    }

    return (
        <AppSelect
            {...props}
            allOptionValue={allOptionValue}
            options={mergedOptions}
            placeholder={props.placeholder || 'Chọn'}
            title={props.title || 'Không xác định'}
        />
    );
}

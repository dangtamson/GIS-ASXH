'use client';

import {useChucVuSelect} from "@/hooks/useChucVu";
import AppSelect, {AppSelectMultipleProps, AppSelectSingleProps} from "@/components/controller/input/AppSelect";
import {SelectOption} from "@/components/controller/input/selectShared";

type ExtraProps = {
    extraOptions?: SelectOption[];
    includeAllOption?: boolean;
    allOptionLabel?: string;
    allOptionValue?: string;
};
type Props =
    | (Omit<AppSelectSingleProps, "options" | "allOptionValue" | "loading" | "filterOption" | "onSearch" | "onPopupScroll"> & ExtraProps)
    | (Omit<AppSelectMultipleProps, "options" | "allOptionValue" | "loading" | "filterOption" | "onSearch" | "onPopupScroll"> & ExtraProps);

export default function PositionSelect(props: Props) {
    const {
        placeholder,
        extraOptions = [],
        includeAllOption = false,
        allOptionLabel = 'Tất cả',
        allOptionValue = '',
    } = props;

    const {
        dsChucVu,
        loading: chucVuLoading,
        loadMore: chucVuLoadMore,
        setSearch: chucVuSetSearch,
    } = useChucVuSelect();

    const mergedOptions: SelectOption[] = [
        ...(includeAllOption ? [{label: allOptionLabel, value: allOptionValue}] : []),
        ...extraOptions,
        ...dsChucVu,
    ].filter((item, index, self) => index === self.findIndex((current) => current.value === item.value));

    if (props.multiple) {
        return (
            <AppSelect
                {...props}
                allOptionValue={allOptionValue}
                options={mergedOptions}
                placeholder={placeholder || 'Chọn chức vụ'}
                title={props.title || 'Chức vụ'}
                loading={chucVuLoading}
                filterOption={false}
                onSearch={chucVuSetSearch}
                onPopupScroll={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.scrollTop + target.offsetHeight >= target.scrollHeight - 10) {
                        chucVuLoadMore();
                    }
                }}
            />
        );
    }

    return (
        <AppSelect
            {...props}
            allOptionValue={allOptionValue}
            options={mergedOptions}
            placeholder={placeholder || 'Chọn chức vụ'}
            title={props.title || 'Chức vụ'}
            loading={chucVuLoading}
            filterOption={false}
            onSearch={chucVuSetSearch}
            onPopupScroll={(e) => {
                const target = e.target as HTMLElement;
                if (target.scrollTop + target.offsetHeight >= target.scrollHeight - 10) {
                    chucVuLoadMore();
                }
            }}
        />
    );
}

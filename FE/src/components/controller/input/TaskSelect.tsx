'use client';

import {useNhiemVuSelect} from "@/hooks/useNhiemVu";
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

export default function TaskSelect(props: Props) {
    const {
        placeholder,
        extraOptions = [],
        includeAllOption = false,
        allOptionLabel = 'Tất cả',
        allOptionValue = '',
    } = props;

    const {
        dsNhiemVu,
        loading: nhiemVuLoading,
        loadMore: nhiemVuLoadMore,
        setSearch: nhiemVuSetSearch,
    } = useNhiemVuSelect();

    const mergedOptions: SelectOption[] = [
        ...(includeAllOption ? [{label: allOptionLabel, value: allOptionValue}] : []),
        ...extraOptions,
        ...dsNhiemVu,
    ].filter((item, index, self) => index === self.findIndex((current) => current.value === item.value));

    if (props.multiple) {
        return (
            <AppSelect
                {...props}
                allOptionValue={allOptionValue}
                options={mergedOptions}
                placeholder={placeholder || 'Chọn nhiệm vụ'}
                title={props.title || 'Nhiệm vụ'}
                loading={nhiemVuLoading}
                filterOption={false}
                onSearch={nhiemVuSetSearch}
                onPopupScroll={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.scrollTop + target.offsetHeight >= target.scrollHeight - 10) {
                        nhiemVuLoadMore();
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
            placeholder={placeholder || 'Chọn nhiệm vụ'}
            title={props.title || 'Nhiệm vụ'}
            loading={nhiemVuLoading}
            filterOption={false}
            onSearch={nhiemVuSetSearch}
            onPopupScroll={(e) => {
                const target = e.target as HTMLElement;
                if (target.scrollTop + target.offsetHeight >= target.scrollHeight - 10) {
                    nhiemVuLoadMore();
                }
            }}
        />
    );
}

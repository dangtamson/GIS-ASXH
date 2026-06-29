'use client';

import {useVanBanSelect} from "@/hooks/useVanBan";
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

export default function DocumentSelect(props: Props) {
    const {
        placeholder,
        extraOptions = [],
        includeAllOption = false,
        allOptionLabel = 'Tất cả',
        allOptionValue = '',
    } = props;

    const {
        dsVanBan,
        loading: vanBanLoading,
        loadMore: vanBanLoadMore,
        setSearch: vanBanSetSearch,
    } = useVanBanSelect();

    const mergedOptions: SelectOption[] = [
        ...(includeAllOption ? [{label: allOptionLabel, value: allOptionValue}] : []),
        ...extraOptions,
        ...dsVanBan,
    ].filter((item, index, self) => index === self.findIndex((current) => current.value === item.value));

    if (props.multiple) {
        return (
            <AppSelect
                {...props}
                allOptionValue={allOptionValue}
                options={mergedOptions}
                placeholder={placeholder || 'Chọn văn bản'}
                title={props.title || 'Văn bản'}
                loading={vanBanLoading}
                filterOption={false}
                onSearch={vanBanSetSearch}
                onPopupScroll={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.scrollTop + target.offsetHeight >= target.scrollHeight - 10) {
                        vanBanLoadMore();
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
            placeholder={placeholder || 'Chọn văn bản'}
            title={props.title || 'Văn bản'}
            loading={vanBanLoading}
            filterOption={false}
            onSearch={vanBanSetSearch}
            onPopupScroll={(e) => {
                const target = e.target as HTMLElement;
                if (target.scrollTop + target.offsetHeight >= target.scrollHeight - 10) {
                    vanBanLoadMore();
                }
            }}
        />
    );
}

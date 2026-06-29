'use client';

import {useLoaiVanBanSelect} from "@/hooks/useLoaiVanBan";
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

export default function DocumentTypeSelect(props: Props) {
    const {
        placeholder,
        extraOptions = [],
        includeAllOption = false,
        allOptionLabel = 'Tất cả',
        allOptionValue = '',
    } = props;
    const {
        dsLoaiVanBan,
        loading: loaiVanBanLoading,
        loadMore: loaiVanBanLoadMore,
        setSearch: loaiVanBanSetSearch,
    } = useLoaiVanBanSelect();
    const mergedOptions: SelectOption[] = [
        ...(includeAllOption ? [{label: allOptionLabel, value: allOptionValue}] : []),
        ...extraOptions,
        ...dsLoaiVanBan,
    ].filter((item, index, self) => index === self.findIndex((current) => current.value === item.value));
    if (props.multiple) {
        return (
            <AppSelect
                {...props}
                allOptionValue={allOptionValue}
                options={mergedOptions}
                placeholder={placeholder || 'Chọn loại văn bản'}
                title={props.title || 'Loại văn bản'}
                loading={loaiVanBanLoading}
                filterOption={false}
                onSearch={loaiVanBanSetSearch}
                onPopupScroll={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.scrollTop + target.offsetHeight >= target.scrollHeight - 10) {
                        loaiVanBanLoadMore();
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
            placeholder={placeholder || 'Chọn loại văn bản'}
            title={props.title || 'Loại văn bản'}
            loading={loaiVanBanLoading}
            filterOption={false}
            onSearch={loaiVanBanSetSearch}
            onPopupScroll={(e) => {
                const target = e.target as HTMLElement;
                if (target.scrollTop + target.offsetHeight >= target.scrollHeight - 10) {
                    loaiVanBanLoadMore();
                }
            }}
        />
    );
}

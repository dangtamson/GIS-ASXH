'use client';

import {useWorkspaceSelect} from "@/hooks/useWorkspace";
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

export default function WorkspaceSelect(props: Props) {
    const {
        placeholder,
        extraOptions = [],
        includeAllOption = false,
        allOptionLabel = 'Tất cả',
        allOptionValue = '',
    } = props;

    const {
        dsWorkspace,
        loading: workspaceLoading,
        loadMore: workspaceLoadMore,
        setSearch: workspaceSetSearch,
    } = useWorkspaceSelect();

    const mergedOptions: SelectOption[] = [
        ...(includeAllOption ? [{label: allOptionLabel, value: allOptionValue}] : []),
        ...extraOptions,
        ...dsWorkspace,
    ].filter((item, index, self) => index === self.findIndex((current) => current.value === item.value));

    if (props.multiple) {
        return (
            <AppSelect
                {...props}
                allOptionValue={allOptionValue}
                options={mergedOptions}
                placeholder={placeholder || 'Chọn workspace'}
                title={props.title || 'Workspace'}
                loading={workspaceLoading}
                filterOption={false}
                onSearch={workspaceSetSearch}
                onPopupScroll={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.scrollTop + target.offsetHeight >= target.scrollHeight - 10) {
                        workspaceLoadMore();
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
            placeholder={placeholder || 'Chọn workspace'}
            title={props.title || 'Workspace'}
            loading={workspaceLoading}
            filterOption={false}
            onSearch={workspaceSetSearch}
            onPopupScroll={(e) => {
                const target = e.target as HTMLElement;
                if (target.scrollTop + target.offsetHeight >= target.scrollHeight - 10) {
                    workspaceLoadMore();
                }
            }}
        />
    );
}

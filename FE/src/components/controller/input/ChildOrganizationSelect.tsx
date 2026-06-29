'use client';

import React from "react";
import AppSelect, {AppSelectSingleProps} from "@/components/controller/input/AppSelect";
import {useDonViConSelect} from "@/hooks/useDonViCon";

type Props = Omit<AppSelectSingleProps, "options" | "loading" | "filterOption" | "onSearch" | "onPopupScroll"> & {
    excludedValues?: string[];
    parentId?: string;
};

function getCurrentOrgId(): string | undefined {
    try {
        const raw = sessionStorage.getItem('tdnv_account');
        return raw ? JSON.parse(raw)?.workspaces?.[0]?.organization?.uuid : undefined;
    } catch {
        return undefined;
    }
}

export default function ChildOrganizationSelect(props: Props) {
    const {
        value,
        excludedValues = [],
        parentId,
    } = props;

    const [resolvedParentId, setResolvedParentId] = React.useState<string | undefined>(parentId);

    React.useEffect(() => {
        if (parentId !== undefined) {
            setResolvedParentId(parentId);
            return;
        }

        setResolvedParentId(getCurrentOrgId());
    }, [parentId]);

    const {
        dsDonVi,
        loading,
        loadMore,
        setSearch,
    } = useDonViConSelect({parentId: resolvedParentId});

    const filteredOptions = React.useMemo(() => {
        return dsDonVi.filter((option) => !excludedValues.includes(option.value) || option.value === value);
    }, [dsDonVi, excludedValues, value]);

    return (
        <AppSelect
            {...props}
            value={value}
            options={filteredOptions}
            loading={loading}
            filterOption={false}
            onSearch={setSearch}
            onPopupScroll={(e) => {
                const target = e.target as HTMLElement;

                if (target.scrollTop + target.offsetHeight >= target.scrollHeight - 10) {
                    loadMore();
                }
            }}
        />
    );
}

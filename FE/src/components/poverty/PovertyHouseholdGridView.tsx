"use client";

import { Button, Dropdown, Empty, Spin, Tag, Tooltip } from "antd";
import type { MenuProps } from "antd";

import ActionIcon from "@/components/controller/ActionIcon";
import {
    buildHouseholdAreaLabel,
    getHouseholdGridActionAriaLabel,
    hasDropdownActions,
} from "@/components/poverty/poverty-household-list-view-utils";
import {
    householdStatusColor,
    householdStatusLabel,
    povertyTypeColor,
    povertyTypeLabel,
} from "@/components/poverty/poverty-utils";
import type { PoorHousehold } from "@/types/poverty";

type PovertyHouseholdGridViewProps = {
    items: PoorHousehold[];
    loading: boolean;
    canUpdateHousehold: boolean;
    onViewHousehold: (record: PoorHousehold) => void;
    onEditHousehold: (record: PoorHousehold) => void;
    buildExtraActionMenuItems: (record: PoorHousehold) => MenuProps["items"];
};

export default function PovertyHouseholdGridView({
    items,
    loading,
    canUpdateHousehold,
    onViewHousehold,
    onEditHousehold,
    buildExtraActionMenuItems,
}: PovertyHouseholdGridViewProps) {
    if (loading) {
        return (
            <div className="flex min-h-[220px] items-center justify-center px-4 py-10">
                <Spin size="large" />
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="px-4 py-10">
                <Empty description="Chưa có dữ liệu hộ" />
            </div>
        );
    }

    return (
        <div className="grid gap-4 p-4 md:grid-cols-2 2xl:grid-cols-3">
            {items.map((record) => {
                const extraMenuItems = buildExtraActionMenuItems(record) ?? [];

                return (
                    <article key={record.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-sky-200 hover:shadow-md">
                        <div className="flex min-w-0 items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Mã hộ</p>
                                <h3 className="truncate text-base font-semibold text-gray-900">{record.code || "-"}</h3>
                                <p className="mt-2 truncate text-sm font-medium text-gray-600">{record.headFullName || "Chưa có thông tin chủ hộ"}</p>
                            </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                            <Tag className="m-0" color={povertyTypeColor(record.povertyType)}>{povertyTypeLabel(record.povertyType)}</Tag>
                            <Tag className="m-0" color={householdStatusColor(record.status)}>{householdStatusLabel(record.status)}</Tag>
                        </div>

                        <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                            <span className="font-medium text-slate-700">Địa bàn:</span> {buildHouseholdAreaLabel(record)}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                            <Tooltip title={getHouseholdGridActionAriaLabel("view")}>
                                <Button
                                    aria-label={getHouseholdGridActionAriaLabel("view")}
                                    className="rounded-full"
                                    icon={<ActionIcon action="view" />}
                                    onClick={() => onViewHousehold(record)}
                                />
                            </Tooltip>
                            {canUpdateHousehold ? (
                                <Tooltip title={getHouseholdGridActionAriaLabel("edit")}>
                                    <Button
                                        aria-label={getHouseholdGridActionAriaLabel("edit")}
                                        className="rounded-full"
                                        icon={<ActionIcon action="edit" />}
                                        onClick={() => onEditHousehold(record)}
                                    />
                                </Tooltip>
                            ) : null}
                            {hasDropdownActions(extraMenuItems) ? (
                                <Tooltip title={getHouseholdGridActionAriaLabel("more")}>
                                    <Dropdown menu={{ items: extraMenuItems }} trigger={["click"]} placement="bottomRight">
                                        <Button
                                            aria-label={getHouseholdGridActionAriaLabel("more")}
                                            className="rounded-full"
                                            icon={<ActionIcon action="more" />}
                                        />
                                    </Dropdown>
                                </Tooltip>
                            ) : null}
                        </div>
                    </article>
                );
            })}
        </div>
    );
}

"use client";

import { buildCoordinateStatusLabel } from "@/components/poverty/collection/poverty-collection-utils";
import { householdStatusColor, householdStatusLabel, povertyTypeColor, povertyTypeLabel } from "@/components/poverty/poverty-utils";
import type { PoorHousehold } from "@/types/poverty";
import { Alert, Button, Empty, Input, Spin, Tag } from "antd";
import { HousePlus, LocateFixed, Search, Smartphone, Users } from "lucide-react";

type Props = {
    canCreateHousehold: boolean;
    canUpdateHousehold: boolean;
    items: PoorHousehold[];
    loading: boolean;
    searching: boolean;
    searchValue: string;
    onCreateNew: () => void;
    onSearch: () => void;
    onSearchValueChange: (value: string) => void;
    onSelectHousehold: (item: PoorHousehold) => void;
};

export default function PovertyCollectionSearchView({
    canCreateHousehold,
    canUpdateHousehold,
    items,
    loading,
    searching,
    searchValue,
    onCreateNew,
    onSearch,
    onSearchValueChange,
    onSelectHousehold,
}: Props) {
    const canStartCreate = canCreateHousehold;
    const canSelectExisting = canUpdateHousehold;
    const hasSearch = searchValue.trim().length > 0;

    return (
        <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
            <section className="overflow-hidden rounded-[24px] border border-red-100 bg-[radial-gradient(circle_at_top_left,_rgba(248,113,113,0.18),_transparent_42%),linear-gradient(135deg,_#fffaf5_0%,_#ffffff_58%,_#fff1f2_100%)] p-4 shadow-[0_12px_36px_rgba(127,29,29,0.08)] sm:rounded-[28px] sm:p-5">
                <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white shadow-[0_12px_26px_rgba(220,38,38,0.24)]">
                        <Smartphone size={18} />
                    </span>
                    <div className="min-w-0">
                        <h1 className="text-base font-semibold text-gray-900 sm:text-lg">Thu thập thông tin hộ nghèo</h1>
                    </div>
                </div>
            </section>

            <section className="rounded-[22px] border border-gray-200 bg-white p-3 shadow-sm sm:rounded-[24px] sm:p-4">
                <div className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                        <Search size={16} />
                    </span>
                    <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-gray-900">Tìm hộ để cập nhật nhanh</h2>
                        <p className="text-xs text-gray-500">Tìm theo mã hộ, chủ hộ, CCCD hoặc địa chỉ</p>
                    </div>
                </div>

                <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                        <Input
                            size="large"
                            value={searchValue}
                            placeholder="Ví dụ: Nguyễn Văn A, 079..., khu vực 1"
                            onChange={(event) => onSearchValueChange(event.target.value)}
                            onPressEnter={onSearch}
                        />
                        <Button
                            aria-label="Tìm kiếm hộ"
                            size="large"
                            type="primary"
                            danger
                            className="flex h-10 w-10 items-center justify-center rounded-2xl p-0 sm:h-11 sm:w-11"
                            icon={<Search size={16} />}
                            loading={searching}
                            onClick={onSearch}
                        />
                    </div>
                </div>
            </section>

            {!canSelectExisting && !canStartCreate ? (
                <Alert
                    type="warning"
                    showIcon
                    message="Tài khoản hiện chưa có quyền thu thập dữ liệu"
                    description="Cần được cấp quyền tạo mới hoặc cập nhật hộ nghèo để sử dụng mini-app này."
                />
            ) : null}

            <section className="rounded-[22px] border border-gray-200 bg-white p-3 shadow-sm sm:rounded-[24px] sm:p-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                            <Users size={16} />
                        </span>
                        <div className="min-w-0">
                            <h2 className="text-sm font-semibold text-gray-900">Kết quả tìm kiếm</h2>
                            <p className="text-xs text-gray-500">
                                {hasSearch ? `${items.length} hộ phù hợp` : "Nhập từ khóa để bắt đầu"}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-4">
                    {loading ? (
                        <div className="flex min-h-44 items-center justify-center">
                            <Spin />
                        </div>
                    ) : items.length === 0 ? (
                        <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={hasSearch ? "Không tìm thấy hộ phù hợp" : "Chưa có dữ liệu tìm kiếm"}
                        >
                            {canStartCreate ? (
                                <Button type="primary" danger onClick={onCreateNew} icon={<HousePlus size={16} />}>
                                    Thêm hộ mới
                                </Button>
                            ) : null}
                        </Empty>
                    ) : (
                        <div className="space-y-3">
                            {items.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    className="w-full rounded-[18px] border border-gray-200 bg-white p-3 text-left shadow-sm transition hover:border-red-200 hover:shadow-md sm:rounded-[20px] sm:p-4"
                                    onClick={() => onSelectHousehold(item)}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-semibold text-gray-900">
                                                {item.headFullName || item.code || "Hộ chưa có tên chủ hộ"}
                                            </div>
                                            <p className="mt-1 text-xs text-gray-500">
                                                {item.code || "Chưa có mã hộ"}
                                                {item.headCitizenId ? ` • CCCD ${item.headCitizenId}` : ""}
                                            </p>
                                        </div>
                                        <Tag color={povertyTypeColor(item.povertyType)}>{povertyTypeLabel(item.povertyType)}</Tag>
                                    </div>

                                    <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-600">
                                        <div className="rounded-2xl bg-gray-50 px-3 py-2">
                                            {[item.provinceName, item.wardName, item.areaName].filter(Boolean).join(" / ") || "Chưa có địa bàn"}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Tag color={householdStatusColor(item.status)}>{householdStatusLabel(item.status)}</Tag>
                                            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">
                                                {Number(item.memberCount ?? 0)} nhân khẩu
                                            </span>
                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                                                <LocateFixed size={12} />
                                                {buildCoordinateStatusLabel(item)}
                                            </span>
                                        </div>
                                        <p className="line-clamp-2 text-xs text-gray-500">{item.address || "Chưa có địa chỉ chi tiết"}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}

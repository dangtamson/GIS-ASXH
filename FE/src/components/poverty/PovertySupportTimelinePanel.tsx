"use client";

import type { HouseholdSupport } from "@/types/poverty";
import { formatDate } from "@/components/poverty/poverty-utils";
import { formatCurrency, getSupportTotalAmount, sortHouseholdSupports, supportTypeLabel } from "@/components/poverty/poverty-support-utils";
import { Empty, Skeleton, Tag } from "antd";
import { HandCoins } from "lucide-react";
import { useMemo } from "react";

type Props = {
    supports: HouseholdSupport[];
    loading?: boolean;
    variant?: "default" | "compact";
};

export default function PovertySupportTimelinePanel({ supports, loading, variant = "default" }: Props) {
    const sortedSupports = useMemo(() => sortHouseholdSupports(supports), [supports]);
    const totalAmount = useMemo(() => sortedSupports.reduce<number>((total, support) => total + getSupportTotalAmount(support), 0), [sortedSupports]);

    if (variant === "compact") {
        return (
            <div className="space-y-3">
                {loading ? (
                    <Skeleton active paragraph={{ rows: 3 }} />
                ) : sortedSupports.length > 0 ? (
                    <>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-2.5">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Số đợt</p>
                                <p className="mt-1 text-base font-semibold text-gray-900">{sortedSupports.length.toLocaleString("vi-VN")}</p>
                            </div>
                            <div className="rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2.5">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Tổng tiền</p>
                                <p className="mt-1 truncate text-sm font-semibold text-gray-900">{formatCurrency(totalAmount)}</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {sortedSupports.map((support, index) => {
                                const total = getSupportTotalAmount(support);
                                const supportTypes = support.supportTypes ?? [];

                                return (
                                    <div key={support.id} className="relative pl-6">
                                        {index < sortedSupports.length - 1 ? (
                                            <div className="absolute left-[9px] top-5 bottom-[-18px] w-px bg-gradient-to-b from-emerald-200 via-slate-200 to-slate-100" />
                                        ) : null}
                                        <div className="absolute left-0 top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-white bg-emerald-500 shadow-sm">
                                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                                        </div>
                                        <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-gray-900">{index === 0 ? "Hỗ trợ ban đầu" : `Đợt ${index + 1}`}</p>
                                                    <p className="mt-0.5 text-[12px] text-gray-500">{formatDate(support.supportDate)}</p>
                                                </div>
                                                <span className="shrink-0 text-[12px] font-semibold text-emerald-700">{formatCurrency(total)}</span>
                                            </div>

                                            {supportTypes.length > 0 ? (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {supportTypes.slice(0, 3).map((type) => (
                                                        <Tag key={type} className="m-0" color="green">{supportTypeLabel(type)}</Tag>
                                                    ))}
                                                    {supportTypes.length > 3 ? <Tag className="m-0">+{supportTypes.length - 3}</Tag> : null}
                                                </div>
                                            ) : null}

                                            <div className="mt-2 grid gap-1.5 text-[12px]">
                                                <div className="min-w-0">
                                                    <span className="text-gray-400">Đơn vị: </span>
                                                    <span className="font-medium text-gray-700" title={support.supportingUnit ?? undefined}>{support.supportingUnit || "-"}</span>
                                                </div>
                                                {support.content ? (
                                                    <div className="min-w-0">
                                                        <span className="text-gray-400">Nội dung: </span>
                                                        <span className="line-clamp-2 font-medium text-gray-700">{support.content}</span>
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-8">
                        <Empty description="Chưa có thông tin hỗ trợ" />
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                            <HandCoins size={18} />
                        </span>
                        <div>
                            <p className="text-base font-semibold text-gray-900">Quá trình hỗ trợ</p>
                            <p className="text-sm text-gray-500">Theo dõi các đợt hỗ trợ đã ghi nhận cho hộ.</p>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase text-emerald-700">Số đợt</p>
                        <p className="mt-1 text-base font-semibold text-emerald-900">{sortedSupports.length.toLocaleString("vi-VN")}</p>
                    </div>
                    <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase text-amber-700">Tổng tiền</p>
                        <p className="mt-1 text-base font-semibold text-amber-900">{formatCurrency(totalAmount)}</p>
                    </div>
                </div>
            </div>

            <div className="mt-4">
                {loading ? (
                    <Skeleton active paragraph={{ rows: 3 }} />
                ) : sortedSupports.length > 0 ? (
                    <div className="overflow-x-auto pb-2">
                        <div className="flex min-w-max gap-4">
                            {sortedSupports.map((support, index) => {
                                const total = getSupportTotalAmount(support);

                                return (
                                    <div key={support.id} className="relative flex w-[270px] shrink-0 flex-col">
                                        {index < sortedSupports.length - 1 ? (
                                            <div className="absolute left-7 top-7 h-0.5 w-[calc(100%+16px)] bg-gradient-to-r from-emerald-300 to-amber-200" />
                                        ) : null}
                                        <div className="relative z-10 flex items-center gap-3">
                                            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-4 border-white bg-emerald-500 text-sm font-bold text-white shadow">
                                                {index + 1}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-gray-900">{index === 0 ? "Hỗ trợ ban đầu" : `Đợt ${index + 1}`}</p>
                                                <p className="text-xs text-gray-500">{formatDate(support.supportDate)}</p>
                                            </div>
                                        </div>
                                        <div className="mt-3 rounded-lg border border-gray-200 bg-green-50 p-3">
                                            <div className="flex flex-wrap gap-1">
                                                {(support.supportTypes ?? []).slice(0, 3).map((type) => (
                                                    <Tag key={type} className="m-0" color="green">{supportTypeLabel(type)}</Tag>
                                                ))}
                                                {(support.supportTypes ?? []).length > 3 ? <Tag className="m-0">+{(support.supportTypes ?? []).length - 3}</Tag> : null}
                                            </div>
                                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                                <div>
                                                    <p className="text-gray-500">Tổng tiền</p>
                                                    <p className="mt-1 font-semibold text-gray-900">{formatCurrency(total)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-500">Đơn vị</p>
                                                    <p className="mt-1 truncate font-semibold text-gray-900" title={support.supportingUnit ?? undefined}>{support.supportingUnit || "-"}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <Empty description="Chưa có thông tin hỗ trợ" />
                )}
            </div>
        </div>
    );
}

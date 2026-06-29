"use client";

import type {HouseholdAssessment, PoorHousehold, PovertyMarker} from "@/types/poverty";
import {formatDate, normalizePovertyType, povertyTypeColor, povertyTypeLabel} from "@/components/poverty/poverty-utils";
import {Empty, Skeleton, Tag} from "antd";
import {CalendarClock, Clock3, GitBranch, UserRound} from "lucide-react";
import {useMemo} from "react";

type TimelineHousehold = Pick<PoorHousehold, "id" | "code" | "headFullName"> | Pick<PovertyMarker, "id" | "code" | "headFullName">;

type Props = {
    household: TimelineHousehold | null;
    assessments: HouseholdAssessment[];
    loading?: boolean;
    showHouseholdInfo?: boolean;
    variant?: "default" | "compact";
};

export function sortHouseholdAssessments(assessments: HouseholdAssessment[]) {
    return [...assessments].sort((a, b) => {
        const yearDiff = Number(a.assessmentYear ?? 0) - Number(b.assessmentYear ?? 0);
        if (yearDiff !== 0) return yearDiff;
        return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
    });
}

export default function PovertyAssessmentTimelinePanel({
    household,
    assessments,
    loading,
    showHouseholdInfo = true,
    variant = "default",
}: Props) {
    const sortedAssessments = useMemo(() => sortHouseholdAssessments(assessments), [assessments]);
    const latestAssessment = sortedAssessments[sortedAssessments.length - 1] ?? null;

    if (variant === "compact") {
        return (
            <div className="space-y-3">
                {loading ? (
                    <Skeleton active paragraph={{rows: 3}} />
                ) : sortedAssessments.length > 0 ? (
                    <>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-2.5">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600">Số lần</p>
                                <p className="mt-1 text-base font-semibold text-gray-900">{sortedAssessments.length.toLocaleString("vi-VN")}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Hiện tại</p>
                                <div className="mt-1 min-h-[24px]">
                                    {latestAssessment ? (
                                        <Tag className="m-0" color={povertyTypeColor(latestAssessment.povertyType)}>
                                            {povertyTypeLabel(latestAssessment.povertyType)}
                                        </Tag>
                                    ) : (
                                        <span className="text-sm font-medium text-gray-400">-</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {sortedAssessments.map((assessment, index) => {
                                const updatedAt = assessment.updatedAt || assessment.createdAt;

                                return (
                                    <div key={assessment.id} className="relative pl-6">
                                        {index < sortedAssessments.length - 1 ? (
                                            <div className="absolute left-[9px] top-5 bottom-[-18px] w-px bg-gradient-to-b from-indigo-200 via-slate-200 to-slate-100" />
                                        ) : null}
                                        <div className="absolute left-0 top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-white bg-indigo-500 shadow-sm">
                                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                                        </div>
                                        <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-gray-900">
                                                        {index === 0 ? "Đánh giá ban đầu" : `Lần ${index + 1}`}
                                                    </p>
                                                    <p className="mt-0.5 text-[12px] text-gray-500">{formatDate(assessment.createdAt)}</p>
                                                </div>
                                                <Tag className="m-0 shrink-0" color={povertyTypeColor(assessment.povertyType)}>
                                                    {povertyTypeLabel(assessment.povertyType)}
                                                </Tag>
                                            </div>

                                            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
                                                <div>
                                                    <span className="text-gray-400">Năm: </span>
                                                    <span className="font-medium text-gray-700">{assessment.assessmentYear || "-"}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-400">Cập nhật: </span>
                                                    <span className="font-medium text-gray-700">{formatDate(updatedAt)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-8">
                        <Empty description="Chưa có đánh giá" />
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 bg-gradient-to-r from-slate-50 via-white to-indigo-50/60 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase text-indigo-600">
                            <GitBranch size={15} strokeWidth={1.9} />
                            Quá trình đánh giá
                        </div>
                        {showHouseholdInfo ? (
                            <>
                                <h3 className="mt-2 truncate text-lg font-semibold text-gray-900">
                                    {household?.code || "Chưa có mã hộ"}
                                </h3>
                                <div className="mt-2 flex min-w-0 items-center gap-2 text-sm text-gray-600">
                                    <UserRound size={15} strokeWidth={1.9} className="shrink-0" />
                                    <span className="truncate">{household?.headFullName || "Chưa có thông tin chủ hộ"}</span>
                                </div>
                            </>
                        ) : (
                            <p className="mt-2 text-sm text-gray-500">Theo dõi diễn biến đánh giá hộ từ lần đầu đến hiện tại.</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:min-w-[320px]">
                        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                            <p className="text-xs text-gray-500">Số lần</p>
                            <p className="mt-1 text-base font-semibold text-gray-900">{sortedAssessments.length.toLocaleString("vi-VN")}</p>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                            <p className="text-xs text-gray-500">Hiện tại</p>
                            <div className="mt-1">
                                {latestAssessment ? (
                                    <Tag className="m-0" color={povertyTypeColor(latestAssessment.povertyType)}>
                                        {povertyTypeLabel(latestAssessment.povertyType)}
                                    </Tag>
                                ) : (
                                    <span className="text-sm font-medium text-gray-400">-</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-5">
                {loading ? (
                    <Skeleton active paragraph={{rows: 4}} />
                ) : sortedAssessments.length > 0 ? (
                    <div className="overflow-x-auto pb-2">
                        <div className="flex min-w-max items-stretch gap-4">
                            {sortedAssessments.map((assessment, index) => {
                                const normalizedType = normalizePovertyType(assessment.povertyType);
                                const isPoor = normalizedType === "POOR";
                                const isNone = normalizedType === "NONE";
                                const pointClass = isPoor ? "border-red-100 bg-red-600 shadow-red-100" : isNone ? "border-gray-100 bg-gray-500 shadow-gray-100" : "border-amber-100 bg-amber-500 shadow-amber-100";
                                const lineClass = isPoor ? "bg-red-200" : isNone ? "bg-gray-200" : "bg-amber-200";
                                const cardClass = isPoor ? "border-red-100 bg-red-50/40" : isNone ? "border-gray-100 bg-gray-50" : "border-amber-100 bg-amber-50/40";
                                const updatedAt = assessment.updatedAt || assessment.createdAt;

                                return (
                                    <div key={assessment.id} className="relative flex w-[260px] shrink-0 flex-col">
                                        {index < sortedAssessments.length - 1 ? (
                                            <div className={`absolute left-10 right-[-24px] top-5 h-0.5 ${lineClass}`} />
                                        ) : null}
                                        <div className={`relative z-10 mb-3 flex h-10 w-10 items-center justify-center rounded-full border-[5px] text-sm font-semibold text-white shadow-lg ${pointClass}`}>
                                            {index + 1}
                                        </div>
                                        <div className={`min-w-0 rounded-xl border p-4 shadow-sm ${cardClass}`}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-semibold text-gray-900">
                                                        {index === 0 ? "Đánh giá ban đầu" : `Lần ${index + 1}`}
                                                    </p>
                                                    <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                                                        <Clock3 size={13} strokeWidth={1.8} />
                                                        <span>{formatDate(assessment.createdAt)}</span>
                                                    </div>
                                                </div>
                                                <Tag className="m-0 shrink-0" color={povertyTypeColor(assessment.povertyType)}>
                                                    {povertyTypeLabel(assessment.povertyType)}
                                                </Tag>
                                            </div>

                                            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                                                <div className="rounded-lg border border-white/80 bg-white/80 p-2.5">
                                                    <div className="flex items-center gap-1.5 text-gray-500">
                                                        <CalendarClock size={13} strokeWidth={1.8} />
                                                        <span>Năm</span>
                                                    </div>
                                                    <p className="mt-1 text-sm font-semibold text-gray-900">{assessment.assessmentYear || "-"}</p>
                                                </div>
                                                <div className="rounded-lg border border-white/80 bg-white/80 p-2.5">
                                                    <div className="flex items-center gap-1.5 text-gray-500">
                                                        <Clock3 size={13} strokeWidth={1.8} />
                                                        <span>Cập nhật</span>
                                                    </div>
                                                    <p className="mt-1 text-sm font-semibold text-gray-900">{formatDate(updatedAt)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-10">
                        <Empty description="Chưa có đánh giá" />
                    </div>
                )}
            </div>
        </div>
    );
}

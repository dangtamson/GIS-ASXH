"use client";

import TaskBreakdownReportPage from "@/app/(admin)/bao-cao/common/TaskBreakdownReportPage";
import {endpoints} from "@/lib/endpoints";

function asNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

export default function TongHopTheoLoaiVanBanPage() {
    return (
        <TaskBreakdownReportPage
            title="Báo cáo tổng hợp nhiệm vụ theo loại văn bản"
            description="Thống kê tổng hợp tình hình nhiệm vụ theo từng loại văn bản."
            tooltipContent="Báo cáo thống kê theo: ngày giao nhiệm vụ, đơn vị được giao nhiệm vụ, lĩnh vực và loại văn bản."
            reportEndpoint={endpoints.report.reportTaskByDocumentType}
            summaryNameHeader="Tên loại văn bản"
            summaryFilePrefix="bao-cao-theo-loai-van-ban"
            mapSummaryRow={(item, index) => ({
                id: String(item.uuid ?? index),
                name: String(item.name ?? "").trim(),
                totalTasks: asNumber(item.tong_so_nhiem_vu),
                totalMainUnits: asNumber(item.tong_so_don_vi_thuc_hien),
                totalCoordinationUnits: asNumber(item.tong_so_don_vi_phoi_hop),
            })}
        />
    );
}

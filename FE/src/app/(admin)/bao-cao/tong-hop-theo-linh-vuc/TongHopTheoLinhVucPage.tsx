"use client";

import TaskBreakdownReportPage from "@/app/(admin)/bao-cao/common/TaskBreakdownReportPage";
import {endpoints} from "@/lib/endpoints";

function asNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

export default function TongHopTheoLinhVucPage() {
    return (
        <TaskBreakdownReportPage
            title="Báo cáo tổng hợp nhiệm vụ theo lĩnh vực"
            description="Thống kê tổng hợp tình hình nhiệm vụ theo từng lĩnh vực."
            tooltipContent="Báo cáo thống kê theo: ngày giao nhiệm vụ, đơn vị được giao nhiệm vụ, lĩnh vực và loại văn bản."
            reportEndpoint={endpoints.report.reportTaskByField}
            summaryNameHeader="Tên lĩnh vực"
            summaryFilePrefix="bao-cao-theo-linh-vuc"
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

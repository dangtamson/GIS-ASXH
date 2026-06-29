"use client";

import TaskBreakdownReportPage from "@/app/(admin)/bao-cao/common/TaskBreakdownReportPage";
import {endpoints} from "@/lib/endpoints";

function asNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

export default function TongHopTheoVanBanPage() {
    return (
        <TaskBreakdownReportPage
            title="Báo cáo tổng hợp nhiệm vụ theo văn bản"
            description="Thống kê tổng hợp tình hình nhiệm vụ theo từng văn bản chỉ đạo."
            tooltipContent="Báo cáo thống kê theo: ngày ban hành văn bản, đơn vị được giao nhiệm vụ, lĩnh vực và loại văn bản."
            reportEndpoint={endpoints.report.reportTaskByDocument}
            summaryNameHeader="Văn bản chỉ đạo"
            summaryFilePrefix="bao-cao-theo-van-ban"
            mapSummaryRow={(item, index) => {
                const documentNumber = String(item.document_number ?? "").trim();
                const title = String(item.title ?? "").trim();
                return {
                    id: String(item.uuid ?? index),
                    name: [documentNumber, title].filter(Boolean).join(" - ") || title || documentNumber || "Không có tên",
                    totalTasks: asNumber(item.tong_so_nhiem_vu),
                    totalMainUnits: asNumber(item.tong_so_don_vi_thuc_hien),
                    totalCoordinationUnits: asNumber(item.tong_so_don_vi_phoi_hop),
                };
            }}
        />
    );
}

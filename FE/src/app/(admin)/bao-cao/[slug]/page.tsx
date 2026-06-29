import ResourceCrudPage from "@/components/app/ResourceCrudPage";
import {endpoints} from "@/lib/endpoints";

const reportMap: Record<string, { title: string; endpoint: string }> = {
    "nhiem-vu-da-giao": {
        title: "Báo cáo nhiệm vụ đã giao",
        endpoint: endpoints.report.reportTaskByDocument,
    },
    "nhiem-vu-duoc-giao": {
        title: "Báo cáo nhiệm vụ được giao",
        endpoint: endpoints.admin.taskAssignments,
    },
    "tong-hop-theo-van-ban": {
        title: "Báo cáo tổng hợp theo văn bản",
        endpoint: endpoints.admin.documents,
    },
    "tong-hop-theo-don-vi": {
        title: "Báo cáo tổng hợp theo đơn vị",
        endpoint: endpoints.admin.organizations,
    },
    "theo-linh-vuc": {
        title: "Báo cáo nhiệm vụ theo lĩnh vực",
        endpoint: endpoints.admin.categories,
    },
    "theo-loai-van-ban": {
        title: "Báo cáo nhiệm vụ theo loại văn bản",
        endpoint: endpoints.admin.categoryItems,
    },
    "chi-tiet-theo-van-ban": {
        title: "Báo cáo chi tiết theo văn bản",
        endpoint: endpoints.admin.documents,
    },
    "chi-tiet-theo-don-vi": {
        title: "Báo cáo chi tiết theo đơn vị",
        endpoint: endpoints.admin.organizations,
    },
    "chi-tiet-theo-linh-vuc": {
        title: "Báo cáo chi tiết theo lĩnh vực",
        endpoint: endpoints.admin.categories,
    },
};

export default async function ReportPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const report = reportMap[slug] || {
        title: "Báo cáo",
        endpoint: endpoints.admin.tasks,
    };

    return (
        <ResourceCrudPage
            title={report.title}
            endpoint={report.endpoint}
            description="Báo cáo động dựa trên dữ liệu thực tế từ API."
        />
    );
}

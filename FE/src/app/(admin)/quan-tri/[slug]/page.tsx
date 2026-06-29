import CategoriesTablePage from "@/components/app/CategoriesTablePage";
import ResourceCrudPage from "@/components/app/ResourceCrudPage";
import {endpoints} from "@/lib/endpoints";

const adminMap: Record<string, { title: string; endpoint: string }> = {
    // Routes with dedicated pages are handled separately
    // This is for any fallback routes
};

export default async function AdminPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const admin = adminMap[slug] || {
        title: "Quản trị",
        endpoint: endpoints.admin.permissions,
    };

    switch (slug) {
        case "quan-tri-quyen":
            return <CategoriesTablePage slug="quan-tri-quyen" source="quan-tri" />;
        case "loai-danh-muc":
            return <CategoriesTablePage slug="loai-danh-muc" source="quan-tri" />;
        default:
            return (
                <ResourceCrudPage
                    title={admin.title}
                    endpoint={admin.endpoint}
                    description="Các chức năng quản trị và phân quyền hệ thống."
                />
            );
    }
}

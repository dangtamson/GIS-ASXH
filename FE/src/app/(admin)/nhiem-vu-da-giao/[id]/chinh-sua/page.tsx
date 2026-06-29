import ThemMoiNhiemVu from "@/components/app/ThemMoiNhiemVu";

type PageProps = {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ hanhDong?: string }>;
};

export default async function AssignedTaskEditRoute({ params, searchParams }: PageProps) {
    const resolved = await params;
    const resolvedSearch = await searchParams;
    // return <AssignedTaskDetailPage mode="edit" taskId={resolved.id} actionHint={resolvedSearch.hanhDong || ""} />;
    // return <AssignedTaskCreatePage taskId={resolved.id} isEdit={true} actionHint={resolvedSearch.hanhDong || ""} />;
    return <ThemMoiNhiemVu taskId={resolved.id} isEdit={true} actionHint={resolvedSearch.hanhDong || ""} />;

}

import ChiTietNhiemVuDuocGiao from "@/components/app/ChiTietNhiemVuDuocGiao";

type PageProps = {
    params: Promise<{ id: string }>;
};

export default async function AssignedTaskDetailRoute({ params }: PageProps) {
    // const resolved = await params;
    // return <AssignedTaskDetailPage mode="view" isOwner={true} taskId={resolved.id} />;
    return <ChiTietNhiemVuDuocGiao readOnly={true} label={'Chi tiết nhiệm vụ đã giao'}/>
}

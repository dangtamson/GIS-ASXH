import ResourceCrudPage from "@/components/app/ResourceCrudPage";
import {endpoints} from "@/lib/endpoints";

export default function OrganizationGroupsPage() {
    return (
        <ResourceCrudPage
            title="Nhóm tổ chức"
            endpoint={endpoints.admin.workspaces}
            description="Quản lý workspace/nhóm tổ chức và thành viên đi kèm."
        />
    );
}

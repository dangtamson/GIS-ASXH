export type DonVi = {
    uuid: string;
    workspaceId: string;
    name: string;
    code: string;
    parentId: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    status: boolean;
    sortOrder?: number | null;
    sort_order?: number | null;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
    children?: DonVi[];
};

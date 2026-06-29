import {DonVi} from "@/types/organizations";
import {UploadAttachment} from "@/components/controller/input/UploadAttachmentField";

export type ApiResponse<T> = {
    item?: T| undefined
    items?: T[]| undefined;
    files?: FileUploadType[]| undefined
    pagination?: Pagination| undefined;
    filters?: Record<string, unknown>| undefined;
    deployingDocs?: DeployDoc[] | undefined;
};

export type DeployDoc = {uuid: string,
    workspaceId: string,
    title: string,
    documentNumber: string,
    documentTypeId: string,
    fieldId: string,
    issuingOrgId: string,
    issuedDate: string,
    effectiveDate: string,
    summary:string,
    filePath: string,
    statusId: string,
    createdBy: string,
    createdAt: string,
    updatedAt: string,
    deletedAt: string
    organization: DonVi,
    attachments: UploadAttachment[]
}

export type Pagination = {
    page: number;
    limit: number;
    total: number;
    pages: number;
}

export type FileUploadType = {
    uuid: string;

    entityId: string;
    entityType: string;

    fileName: string;
    filePath: string;

    fileSize: number;
    mimeType: string;

    uploadedBy: string | null;

    createdAt: string;
};
import {FileUploadType} from "@/types/api";

export type DocumentSchema = {
    uuid: string;

    title: string;
    summary: string | null;

    documentNumber: string | null;

    documentTypeId: string | null;
    fieldId: string | null;
    issuingOrgId: string | null;
    statusId: string | null;

    issuedDate: string | null;
    effectiveDate: string | null;

    filePath: string | null;

    workspaceId: string;

    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;

    createdBy: string | null;

    files?: FileUploadType[];
};
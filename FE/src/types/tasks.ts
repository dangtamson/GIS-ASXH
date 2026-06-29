import {DonVi} from "@/types/organizations";
import {UploadAttachment} from "@/components/controller/input/UploadAttachmentField";

type TaskOrganization= {
    name?: string | null,
    uuid?: string | null,
    isCoordination?: boolean | null,

}

export type TaskComment = {
    "uuid"?: string,
    "taskId"?: string,
    "accountId"?: string,
    "content"?: string,
    "createdAt"?: string,
    account?: {
        uuid: string,
        fullName?: string,
    }
}

export type ResTaskType= {
    _isFirst?:  boolean;
    _rowSpan?:  number;
    assigner?: TaskOrganization;
    taskId?: string,
    uuid?: string,
    status?: string,
    taskProgress?: {
        progressPercent?: number,
    }
    dueDate?: string,
    completeAt?: string,
    organization?: TaskOrganization,
    taskAssignments?: TaskAssignment[],
    document?: {
        title?: string,
        documentNumber?: string,
        documentTypeId?: string,
        field?: {
            name?: string,
            uuid?: string
        },
    },
    documentId?: string,
    title?: string,
    issuedByName?: string,
    priorityId?: string,
    startDate?: string,
    issuedDate?: string,
    description?: string,
    priority?: string
}

export type ProgressType = {
    uuid?: string,
    taskId?: string,
    progressPercent?: number,
    comment?: string,
    createdAt?: string
    organizationId?: string,
    organization?: DonVi
}

type Role = "implementation" | "coordination";


export type UnitAssignmentRow = {
    id: number;
    unitId: string;
    completionTime: string;
    uuid?: string;
};

export type AssignmentItem = {
    row: UnitAssignmentRow;
    role: Role;
};

export type DeploymentDocumentRow = {
    uuid?: string
    id: string;
    code: string;
    abstract: string;
    issuingOrgId: string;
    issuingOrgLabel: string;
    issueDate: string;
    fieldId: string;
    type: string;
    content: string;
    attachments: UploadAttachment[];
};

export type ResFile =  {
    createdAt?:string
    entityId?:string
    entityType?:string
    fileName?:string
    filePath?:string
    fileSize?:number
    mimeType?:string
    uploadedBy?:string
    uuid?:string
}

export interface TaskDetail {
    uuid: string;
    title: string;
    status: string;

    dueDate: string;
    startDate: string;
    issuedDate: string | null;
    completedAt: string | null;

    description: string;

    fieldId: string;
    documentId: string;

    priority: string;
    priorityId: string | null;

    parentId: string | null;
    statusId: string | null;

    createdAt: string;
    updatedAt: string;
    createdBy: string | null;
    deletedAt: string | null;

    workspaceId: string;
    organizationId: string | null;

    warningDeadlineDays: number | null;

    organization: DonVi | null;

    document: DocumentInfo | null;

    taskProgress: TaskProgress | null;

    taskAssignments: TaskAssignment[];
    coordinationUnits: UnitAssignmentRow[];
    implementationUnits: UnitAssignmentRow[];

}


export interface DocumentInfo {
    title: string;
    documentNumber: string;

    documentType: {
        uuid: string;
        name: string;
    } | null;

    field: {
        uuid: string;
        name: string;
    } | null;
}

export interface TaskProgress {
    uuid?: string;
    progressPercent?: number;
    createdAt?: string;
    // thêm field nếu DB có
}

export interface TaskAssignment {
    uuid?: string;
    is?: string
    assignedAt: string;
    assignedBy: string | null;
    assignedToAccountId?: string,
    assignedToOrgId?: string,
    finishDate?: string,
    isCoordination?: boolean,
    startDate?: string,
    status?: string,
    taskId?: string
    organization: {
        uuid: string | null;
        name: string | null;
        isCoordination: boolean | null;
    };
}


export type TaskResponse = {
    uuid: string;
    documentId: string;
    priority: string;
    fieldId: string;
    parentId: string;
    title: string;
    dueDate: string;
    warningDeadlineDays: number;
    description: string;
    taskAssignments: {
        uuid: string;
        assignedAt: string;
        dueDate?: string;
        organization: {
            uuid: string;
            isCoordination: boolean;
        };
    }[];
};

'use client'

import {Col, Divider, Form, notification, Row} from "antd";
import React, {useEffect, useState} from "react";
import {AssignmentItem, DeploymentDocumentRow, TaskDetail, TaskResponse, UnitAssignmentRow} from "@/types/tasks";
import {BookOutlined} from "@ant-design/icons";
import {PlusCircle} from "lucide-react";
import CreateDocModal from "@/components/tasks/CreateDocModal";
import {ApiResponse} from "@/types/api";
import {DonVi} from "@/types/organizations";
import {api, ApiError} from "@/lib/api";
import {endpoints} from "@/lib/endpoints";
import {UploadAttachment} from "@/components/controller/input/UploadAttachmentField";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import {useRouter} from "next/navigation";
import {
    ActionButton,
    AppDatePicker,
    AppInput,
    ChildOrganizationSelect,
    DocumentSelect,
    FieldSelect,
    PrioritySelect,
    TaskSelect,
    UploadAttachmentsField
} from "@/components/controller";
import ActionIcon from "@/components/controller/ActionIcon";

/* ================= TYPES ================= */

type DocumentModalForm = {
    code: string;
    abstract: string;
    type: string;
    issuingOrgId: string;
    issueDate: string;
    fieldId: string;
    content: string;
    attachments: UploadAttachment[];
};

type DocumentOption = {
    value: string;
    label: string;
    code?: string;
    abstract?: string;
    issuingOrgId?: string;
    issuingOrgLabel?: string;
    issueDate?: string;
    fieldId?: string;
    isLocalDraft?: boolean;
};

type DocumentModalState = {
    open: boolean;
    context: "quick" | "deployment";
};

/* ================= COMPONENT ================= */

export default function ThemMoiNhiemVu({
                                           isEdit,
                                           taskId,
                                           actionHint
                                       }: {
    isEdit?: boolean;
    taskId?: string;
    actionHint?: string;
}) {

    const [deploymentDocuments, setDeploymentDocuments] = useState<DeploymentDocumentRow[]>([]);
    const [documentOption, setDocumentOption] = useState<DocumentOption>();
    const [localDocumentDrafts, setLocalDocumentDrafts] = useState<Record<string, DocumentModalForm>>({});
    const [documentModal, setDocumentModal] = useState<DocumentModalState | undefined>();
    const [currentTask, setCurrentTask] = useState<TaskDetail | null>(null);

    const router = useRouter();
    const [form] = Form.useForm();

    const getDueDateLimit = () => {
        const rawDueDate = form.getFieldValue("dueDate");
        if (!rawDueDate) {
            return null;
        }

        const parsed = dayjs(rawDueDate);
        return parsed.isValid() ? parsed.endOf("day") : null;
    };

    const isUnitCompletionAfterDueDate = (value?: string | Dayjs | null) => {
        if (!value) {
            return false;
        }

        const dueDateLimit = getDueDateLimit();
        if (!dueDateLimit) {
            return false;
        }

        const completionDate = dayjs(value);
        if (!completionDate.isValid()) {
            return false;
        }

        return completionDate.endOf("day").isAfter(dueDateLimit);
    };

    const validateUnitCompletionTime = async (_: unknown, value?: string | Dayjs | null) => {
        if (!value) {
            throw new Error("Chọn ngày");
        }

        if (isUnitCompletionAfterDueDate(value)) {
            throw new Error("Thời gian của đơn vị không được sau hạn xử lý");
        }
    };

    const disableDatesAfterDueDate = (current: Dayjs) => {
        const dueDateLimit = getDueDateLimit();
        if (!dueDateLimit) {
            return false;
        }

        return current.endOf("day").isAfter(dueDateLimit);
    };

    /* ================= EFFECT ================= */

    useEffect(() => {
        if(taskId ) {
            if(actionHint === 'them-nhiem-vu-con')
            {
                setTimeout(() => {
                    form.setFieldsValue({parentId:taskId})
                })
            }
            else
                void layCurrentTask()
        }

    }, []);



    const layCurrentTask = async () => {
        const res = await api.get<ApiResponse<TaskResponse>>(`${endpoints.admin.tasks}/${taskId}`)

        const values = {
            documentId: res?.item?.documentId,
            priority: res?.item?.priority,
            fieldId: res?.item?.fieldId,
            parentId: res?.item?.parentId,
            title: res?.item?.title,
            dueDate: dayjs(res?.item?.dueDate),
            warningDeadlineDays: res?.item?.warningDeadlineDays,
            description: res?.item?.description,
            implementationUnits: res?.item?.taskAssignments
                .filter(item => !item.organization.isCoordination)
                .map((item,index) => ({
                    id: index + 1,
                    unitId: item.organization.uuid,
                    completionTime: dayjs(item.dueDate),
                    uuid: item.uuid
                })),
            coordinationUnits: res?.item?.taskAssignments
                .filter(item => item.organization.isCoordination)
                .map((item, index) => ({
                    id: index + 1,
                    unitId: item.organization.uuid,
                    completionTime: dayjs(item.dueDate),
                    uuid: item.uuid
                })),
            attachments: res?.files?.map((item) => ({
                ...item,
                id: item.uuid
            }))
        }
        form.setFieldsValue(values)

        const deployDocuments = (res.deployingDocs || []).map((doc) => {
            const value = String(doc.uuid  ?? "");
            const label = String(doc.title ?? doc.documentNumber ?? doc.uuid ?? "Không tên");
            return {
                uuid: String(doc.uuid),
                id: String(doc.uuid),
                value,
                label,
                code: String(doc.documentNumber ?? ""),
                abstract: String(doc.summary ?? doc.title ?? ""),
                content: String(doc.summary ?? doc.title ?? ""),
                issuingOrgId: String(doc.issuingOrgId ?? ""),
                issuingOrgLabel: String(doc?.organization?.name ?? doc.issuingOrgId ?? ""),
                issueDate: String(doc.issuedDate ?? ""),
                fieldId: String(doc.fieldId ?? ""),
                type: "",
                attachments: doc.attachments as UploadAttachment[],
            };
        })
            .filter((item) => item.value);

        setDeploymentDocuments(deployDocuments as DeploymentDocumentRow[])
        setCurrentTask(values as unknown as TaskDetail)
    }

    /* ================= SAVE DOCUMENT MODAL ================= */

    const saveDocumentFormModal = async (values: DocumentModalForm) => {
        const localId = `local-${Date.now()}`;

        const documentDraft = {
            ...values,
            code: values.code?.trim(),
            abstract: values.abstract?.trim(),
            content: values.content?.trim(),
            issueDate: values.issueDate,
        };

        const donViRaw = await api.get<ApiResponse<DonVi>>(`${endpoints.admin.organizations}/${values.issuingOrgId}`);
        console.log(values, donViRaw)
        const issuingOrgLabel = donViRaw?.item?.name || '--';

        const newOption: DocumentOption = {
            value: localId,
            label: documentDraft.abstract,
            code: documentDraft.code,
            abstract: documentDraft.abstract,
            issuingOrgId: documentDraft.issuingOrgId,
            issuingOrgLabel,
            issueDate: documentDraft.issueDate,
            fieldId: documentDraft.fieldId,
            isLocalDraft: true,
        };

        setDocumentOption(newOption);
        setLocalDocumentDrafts(prev => ({...prev, [localId]: documentDraft}));

        if (documentModal?.context === "quick") {
            form.setFieldsValue({documentId: localId});
        }

        if (documentModal?.context === "deployment") {
            setDeploymentDocuments(prev => [
                {
                    id: `deploy-${Date.now()}`,
                    code: newOption.code || "",
                    abstract: newOption.abstract || "",
                    issuingOrgId: documentDraft.issuingOrgId,
                    issuingOrgLabel,
                    issueDate: newOption.issueDate || "",
                    fieldId: documentDraft.fieldId,
                    type: documentDraft.type,
                    content: documentDraft.content,
                    attachments: documentDraft.attachments,

                },
                ...prev,
            ]);
        }
    };

    /* ================= CREATE DOC ================= */

    const createDocumentOnBackend = async (draft: DocumentModalForm): Promise<string> => {
        const payload = {
            title: draft.abstract,
            documentNumber: draft.code,
            summary: draft.content || draft.abstract,
            fieldId: draft.fieldId || undefined,
            issuingOrgId: draft.issuingOrgId || undefined,
            issuedDate: dayjs(draft.issueDate).format('YYYY-MM-DD') || undefined,
            effectiveDate: dayjs(draft.issueDate).format('YYYY-MM-DD') || undefined,
            documentTypeId: draft.type || undefined,
            attachments: draft.attachments.map(a => ({
                fileName: a.fileName,
                fileContentBase64: a.fileContentBase64,
                mimeType: a.mimeType,
                fileSize: a.fileSize,
            })),
        };

        const res = await api.post<Record<string, unknown>>(endpoints.admin.documents, payload);
        const responsePayload = res as Record<string, unknown> & {
            item?: Record<string, unknown>;
            uuid?: string;
        };
        const rawId = responsePayload.item?.uuid || responsePayload.uuid;

        if (typeof rawId !== "string" || !rawId) {
            throw new ApiError("Không lấy được ID văn bản", 500, res);
        }

        return rawId;
    };

    /* ================= SAVE TASK ================= */

    const saveTask = async (andDispatch = false) => {
        try {
            const values = await form.validateFields();
            let mainDocumentId = values.documentId;

            if (localDocumentDrafts[mainDocumentId]) {
                mainDocumentId = await createDocumentOnBackend(localDocumentDrafts[mainDocumentId]);
            }

            const newUuids = await Promise.all(
                deploymentDocuments
                    .filter(d => !d.uuid)
                    .map(d =>
                        createDocumentOnBackend({
                            code: d.code,
                            abstract: d.abstract,
                            type: d.type,
                            issuingOrgId: d.issuingOrgId,
                            issueDate: d.issueDate,
                            fieldId: d.fieldId,
                            content: d.content,
                            attachments: d.attachments,
                        })
                    )
            );

            const payload = {
                title: values.title,
                description: values.description?.trim() || undefined,
                documentId: mainDocumentId || undefined,
                priorityId: values.priorityId || undefined,
                fieldId: values.fieldId || undefined,
                dueDate: values.dueDate
                    ? dayjs(values.dueDate).format('YYYY-MM-DD')
                    : undefined,
                parentTaskId: values.parentId || undefined,
                warningDeadlineDays: values.warningDeadlineDays
                    ? Number(values.warningDeadlineDays)
                    : undefined,
                attachments: (values.attachments || []).map((a: { fileName: string; fileContentBase64: string; mimeType: string; fileSize: string; uuid: string; }) => ({
                    fileName: a?.fileName,
                    fileContentBase64: a?.fileContentBase64,
                    mimeType: a?.mimeType,
                    fileSize: a?.fileSize,
                    uuid: a?.uuid,
                })),
                deployingDocs: [
                    ...newUuids,
                    ...deploymentDocuments
                        .filter(d => d.uuid)
                        .map(d => d.uuid),
                ].join(";"),
            };

            if(isEdit) {
                const assignmentRows  = [
                    ...values.implementationUnits
                        .filter((row: UnitAssignmentRow) => row.unitId)
                        .map((row: UnitAssignmentRow) => ({row, role: "implementation" as const})),
                    ...values.coordinationUnits
                        .filter((row: UnitAssignmentRow) => row.unitId)
                        .map((row: UnitAssignmentRow) => ({row, role: "coordination" as const})),
                ];
                const oldAssignments = [
                    ...(currentTask?.implementationUnits
                        ?.filter((row) => row.unitId)
                        ?.map((row) => ({ row, role: "implementation" as const })) ?? []),

                    ...(currentTask?.coordinationUnits
                        ?.filter((row) => row.unitId)
                        ?.map((row) => ({ row, role: "coordination" as const })) ?? []),
                ];

                const added: AssignmentItem[] = assignmentRows.filter(newItem =>
                    !oldAssignments.some(
                        oldItem =>
                            oldItem.role === newItem.role &&
                            oldItem.row.unitId === newItem.row.unitId
                    )
                );

                const deleted: AssignmentItem[] = oldAssignments.filter(oldItem =>
                    !assignmentRows.some(
                        newItem =>
                            newItem.role === oldItem.role &&
                            newItem.row.unitId === oldItem.row.unitId
                    )
                );

                const updated: AssignmentItem[] = assignmentRows
                    .map(newItem => {
                        const oldItem = oldAssignments.find(
                            oldItem =>
                                oldItem.role === newItem.role &&
                                oldItem.row.unitId === newItem.row.unitId
                        );

                        if (!oldItem) return null;

                        if (
                            oldItem.row.completionTime !== newItem.row.completionTime
                        ) {
                            return {
                                role: newItem.role,
                                row: {
                                    ...oldItem.row,
                                    ...newItem.row,
                                },
                            } as AssignmentItem;
                        }

                        return null;
                    })
                    .filter((x): x is AssignmentItem => x !== null);

                await Promise.all([
                    api.patch<Record<string,  unknown>>(`${endpoints.admin.tasks}/${taskId}`, payload),
                    ...added.map(({ row, role }) =>
                        api.post(endpoints.admin.taskAssignments, {
                            taskId,
                            assignedToOrgId: row.unitId,
                            dueDate:
                                row.completionTime ??
                                new Date().toISOString(),
                            note:
                                role === "coordination"
                                    ? "Đơn vị phối hợp"
                                    : "Đơn vị thực hiện",
                            isCoordination:
                                role === "coordination",
                        })
                    ),

                    ...updated
                        .filter(x => x.row.uuid)
                        .map(({ row, role }) =>
                            api.patch(
                                `${endpoints.admin.taskAssignments}/${row.uuid}`,
                                {
                                    dueDate:
                                        row.completionTime ??
                                        new Date().toISOString(),
                                    note:
                                        role === "coordination"
                                            ? "Đơn vị phối hợp"
                                            : "Đơn vị thực hiện",
                                    isCoordination:
                                        role === "coordination",
                                }
                            )
                        ),

                    ...deleted
                        .filter(x => x.row.uuid)
                        .map(({ row }) =>
                            api.delete(
                                `${endpoints.admin.taskAssignments}/${row.uuid}`
                            )
                        ),
                ]);
            }

            let newTaskId: string | undefined = undefined;
            if(!isEdit) {
                const createdTaskRaw = await api.post<Record<string, unknown>>(endpoints.admin.tasks, payload);
                const createdTaskPayload = createdTaskRaw as Record<string, unknown>;
                const createdTaskItem =
                    (createdTaskPayload.item as Record<string, unknown> | undefined) ?? createdTaskPayload;
                const createdTaskId = String(createdTaskItem.uuid ?? createdTaskItem.id ?? "");
                newTaskId = createdTaskId;

                if (!createdTaskId) {
                    throw new ApiError("Không lấy được ID nhiệm vụ sau khi tạo.", 500, createdTaskRaw);
                }

                const assignmentRows = [
                    ...values.implementationUnits
                        .filter((row:UnitAssignmentRow) => row.unitId)
                        .map((row:UnitAssignmentRow) => ({row, role: "implementation" as const})),
                    ...values.coordinationUnits
                        .filter((row:UnitAssignmentRow) => row.unitId)
                        .map((row:UnitAssignmentRow) => ({row, role: "coordination" as const})),
                ];

                if (assignmentRows.length > 0) {
                    await Promise.all(
                        assignmentRows.map(({row, role}) =>
                            api.post(endpoints.admin.taskAssignments, {
                                taskId: createdTaskId,
                                assignedToOrgId: row.unitId,
                                dueDate: row.completionTime || new Date().toISOString(),
                                note: role === "coordination" ? "Đơn vị phối hợp" : "Đơn vị thực hiện",
                                isCoordination: role === "coordination"
                            })
                        )
                    );
                }
            }

            if (andDispatch && (newTaskId || taskId)) {
                await api.post(`${endpoints.admin.tasks}/${newTaskId || taskId}/send-promulgate-data`);
            }

            notification.success({
                title: "Thành công",
                description: andDispatch ? "Đã ghi và ban hành" : "Đã lưu nhiệm vụ",
            });

            router.push("/nhiem-vu-da-giao");

        } catch (err) {
            notification.error({
                title: "Lỗi",
                description: err instanceof ApiError ? err.message : "Không thể lưu",
            });
        }
    };

    const getSelectedUnitIds = (): string[] => {
        const coordination = form.getFieldValue("coordinationUnits") || [];
        const implementation = form.getFieldValue("implementationUnits") || [];

        return [...coordination, ...implementation]
            .map((item: {unitId?: string}) => item?.unitId)
            .filter((item): item is string => Boolean(item));
    };

    return <Form layout="vertical" form={form} initialValues={{ warningDeadlineDays: 3 }}>

    <Row gutter={16}>
        <Col span={24}>
            <div className={'flex flex-col gap-2 mb-4 rounded-2xl bg-gradient-to-r from-[#b91c1c] to-[#dc2626] p-4 text-white shadow-sm sm:p-5'}>
                <h2 className={'text-lg font-semibold sm:text-xl'}>{isEdit ? 'Chỉnh sửa nhiệm vụ' : 'Thêm mới nhiệm vụ'}</h2>
                <span className={'mb-1 text-sm text-white/90'}>Thiết lập thông tin nhiệm vụ, đơn vị thực hiện và kế hoạch xử lý trong một màn hình thống nhất.</span>
                <Row gutter={[16,16]}>
                    <Col lg={8} md={14}>
                        <div className="rounded-xl bg-white/10 px-3 py-2">
                            <div className="text-xs text-white/80">Đơn vị thực hiện</div>
                            <Form.Item noStyle shouldUpdate>
                                {({ getFieldValue }) => (
                                    <div className="text-lg font-semibold">{getFieldValue('implementationUnits')?.length || 0}</div>
                                )}
                            </Form.Item>
                        </div>
                    </Col>
                    <Col lg={8} md={14}>
                        <div className="rounded-xl bg-white/10 px-3 py-2">
                            <div className="text-xs text-white/80">Đơn vị phối hợp</div>
                            <Form.Item noStyle shouldUpdate>
                                {({ getFieldValue }) => (
                                    <div className="text-lg font-semibold">{getFieldValue('coordinationUnits')?.length || 0}</div>
                                )}
                            </Form.Item>
                        </div>
                    </Col>
                    <Col lg={8} md={14}>
                        <div className="rounded-xl bg-white/10 px-3 py-2">
                            <div className="text-xs text-white/80">Văn bản triển khai</div>
                            <div className="text-lg font-semibold">{deploymentDocuments?.length || 0}</div>
                        </div>
                    </Col>
                </Row>
            </div>
        </Col>

        <Col span={24}>
            <div className={'flex flex-col mb-4 rounded-2xl bg-white p-4 shadow-sm sm:p-5'}>
                <h3 className={'text-sm font-semibold text-gray-800 flex items-center gap-2  '}>
                    <BookOutlined style={{color: '#dc2626' }} />
                    Thông tin nhiệm vụ
                </h3>
                <Divider/>
                <Row gutter={[16,16]}>
                    <Col lg={6} md={12} xs={24}>

                        <Form.Item label={<><span className="text-red-500 mr-1">* </span> Văn bản</>} rules={[
                            {
                                required: true,
                                message: 'Chọn văn bản'
                            }
                        ]}>
                            <div className="flex gap-2">

                                <Form.Item
                                    name="documentId"
                                    noStyle
                                    rules={[
                                        {
                                            required: true,
                                            message: 'Chọn văn bản'
                                        }
                                    ]}
                                >
                                    <DocumentSelect hideTitle  extraOptions={documentOption ? [
                                        {
                                            label: documentOption.label,
                                            value: documentOption.value
                                        }
                                    ] : []}/>
                                </Form.Item>

                                <button
                                    type="button" // ✅ QUAN TRỌNG
                                    onClick={() => setDocumentModal({open: true, context: 'quick'})}
                                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-[#dc2626] hover:bg-gray-50"
                                    title="Thêm nhanh văn bản"
                                >
                                    <PlusCircle className="h-4 w-4" />
                                </button>

                            </div>
                        </Form.Item>

                    </Col>
                    <Col lg={6} md={12} xs={24}>
                        <Form.Item
                            name={'priority'}
                            label={'Mức độ ưu tiên'}
                            rules={[{required: true, message: 'Chọn mức độ ưu tiên'}]}
                        >
                            <PrioritySelect hideTitle/>
                        </Form.Item>

                    </Col>
                    <Col lg={6} md={12} xs={24}>
                        <Form.Item
                            name={'fieldId'}
                            label={'Lĩnh vực'}
                            rules={[{required: true, message: 'Chọn lĩnh vực'}]}
                        >
                            <FieldSelect hideTitle/>
                        </Form.Item>
                    </Col>
                    <Col lg={6} md={12} xs={24}>
                        <Form.Item name={'parentId'} label={'Nhiệm vụ cha'}>
                            <TaskSelect hideTitle placeholder={'Chọn nhiệm vụ cha'}/>

                        </Form.Item>
                    </Col>
                    <Col lg={6} md={12} xs={24}>
                        <Form.Item
                            name={'title'}
                            label={'Tên nhiệm vụ'}
                            rules={[{required: true, message: 'Nhập tên nhiệm vụ'}]}
                        >
                            <AppInput placeholder={'Nhập tên nhiệm vụ'} type={'text'}/>
                        </Form.Item>
                    </Col>
                </Row>
            </div>
        </Col>

        <Col md={24} xs={24} lg={24}>
            <div className={'flex flex-col mb-4 rounded-2xl bg-white p-4 shadow-sm sm:p-5'}>
                <h3 className={'text-sm font-semibold text-gray-800 flex items-center gap-2  '}>
                Kế hoạch thực hiện
                </h3>
                <Divider/>
                <Row gutter={[16,16]}>
                    <Col lg={6} md={12} xs={24}>
                        <Form.Item
                            name={'dueDate'}
                            label={'Hạn xử lý'}
                            rules={[{required: true, message: 'Chọn hạn xử lý'}]}
                        >
                            <AppDatePicker
                                hideTitle
                                onChange={(nextValue) => {
                                    form.setFieldValue("dueDate", nextValue);
                                    void Promise.allSettled([
                                        form.validateFields(["implementationUnits"]),
                                        form.validateFields(["coordinationUnits"]),
                                    ]);
                                }}
                            />

                            {/*<DatePicker style={{width: '100%'}} placeholder={'Chọn ngày'} format={'DD/MM/YYYY'}/>*/}
                        </Form.Item>

                    </Col>
                    <Col lg={6} md={12} xs={24}>
                        <Form.Item
                            name={'warningDeadlineDays'}
                            label={'Thời hạn cảnh báo (Ngày)'}
                            rules={[{required: true, message: 'Nhập thời hạn cảnh báo'}]}
                        >
                            <AppInput type={'number'} placeholder={'Nhập ngày'}/>
                            {/*<Input type={'number'} placeholder={'Nhập ngày'}/>*/}
                        </Form.Item>
                    </Col>
                    <Col lg={24} md={24} xs={24}>
                        <Form.Item
                            name={'description'}
                            label={'Nội dung nhiệm vụ'}
                            rules={[{required: true, message: 'Nhập nội dung nhiệm vụ'}]}
                        >
                        <AppInput type={'textarea'} placeholder={'Nhập nội dung nhiệm vụ'}/>
                    </Form.Item>
                    </Col>
                </Row>

            </div>
        </Col>

        <Col md={24} xs={24} lg={12}>
                <Form.List
                    name="implementationUnits"
                    rules={[
                        {
                            validator: async (_, value) => {
                                const hasValidUnit = Array.isArray(value) && value.some((item) => item?.unitId);
                                if (!hasValidUnit) {
                                    throw new Error("Chọn ít nhất 1 đơn vị thực hiện");
                                }
                            },
                        },
                    ]}
                >
                    {(fields, { add, remove }, {errors}) => (
                        <div className="rounded-2xl bg-white p-4 shadow-sm">

                            {/* HEADER */}
                            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                                <h3 className="text-sm font-semibold text-gray-800">
                                    <span className="text-red-500">* </span>Đơn vị thực hiện
                                </h3>

                                <button
                                    type="button"
                                    onClick={() => {
                                        const dueDate = form.getFieldValue("dueDate");
                                        add({completionTime: dueDate || null})
                                    }}
                                    className="text-sm text-red-600 hover:underline"
                                >
                                    + Thêm đơn vị
                                </button>
                            </div>

                            {/* TABLE */}
                            <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200">
                                <table className="w-full min-w-[520px] text-sm">

                                    <thead className="bg-gray-50">
                                    <tr>
                                        <th className="w-16 px-3 py-2 text-left">STT</th>
                                        <th className="px-3 py-2 text-left">Đơn vị thực hiện</th>
                                        <th className="w-44 px-3 py-2 text-left">Thời gian</th>
                                        <th className="w-20 px-3 py-2 text-left">Xóa</th>
                                    </tr>
                                    </thead>

                                    <tbody>
                                    {fields.map(({key, ...restField }, index) => (
                                        <tr key={key} className="border-t">
                                            {/* STT */}
                                            <td className="px-3 py-2">{index + 1}</td>

                                            {/* ĐƠN VỊ */}
                                            <td className="px-3 py-2">
                                                <Form.Item
                                                    key={key}
                                                    {...restField}
                                                    name={[restField.name, "unitId"]}
                                                    rules={[{ required: true, message: "Chọn đơn vị" }]}
                                                    style={{ marginBottom: 0 }}
                                                >
                                                    <ChildOrganizationSelect
                                                        hideTitle
                                                        placeholder="Chọn đơn vị"
                                                        value={form.getFieldValue(["implementationUnits", restField.name, "unitId"])}
                                                        excludedValues={getSelectedUnitIds()}
                                                        onChange={(nextValue) => {
                                                            form.setFieldValue(["implementationUnits", restField.name, "unitId"], nextValue);
                                                        }}
                                                    />
                                                </Form.Item>
                                            </td>

                                            {/* NGÀY */}
                                            <td className="px-3 py-2">
                                                <Form.Item
                                                    key={key}
                                                    {...restField}
                                                    name={[restField.name, "completionTime"]}
                                                    dependencies={["dueDate"]}
                                                    rules={[
                                                        { required: true, message: "Chọn ngày" },
                                                        { validator: validateUnitCompletionTime },
                                                    ]}
                                                    style={{ marginBottom: 0 }}
                                                >
                                                    <AppDatePicker
                                                        hideTitle
                                                        disabledDate={disableDatesAfterDueDate}
                                                    />
                                                </Form.Item>
                                            </td>

                                            {/* XÓA */}
                                            <td className="px-3 py-2">
                                                <button
                                                    type="button"
                                                    onClick={() => remove(restField.name)}
                                                    className="text-red-600 hover:underline"
                                                >
                                                    <ActionIcon action={"delete"}/>
                                                </button>
                                            </td>

                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="text-sm text-red-500">
                                <Form.ErrorList errors={errors}/>
                            </div>

                        </div>
                    )}
                </Form.List>
        </Col>
        <Col md={24} xs={24} lg={12}>
            <Form.List name="coordinationUnits">
                {(fields, { add, remove }) => (
                    <div className="rounded-2xl bg-white p-4 shadow-sm">

                        {/* HEADER */}
                        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                            <h3 className="text-sm font-semibold text-gray-800">
                                Đơn vị phối hợp
                            </h3>

                            <button
                                type="button"
                                onClick={() => {
                                    const dueDate = form.getFieldValue("dueDate");
                                    add({completionTime: dueDate || null})
                                }}
                                className="text-sm text-red-600 hover:underline"
                            >
                                + Thêm đơn vị
                            </button>
                        </div>

                        {/* TABLE */}
                        <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200">
                            <table className="w-full min-w-[520px] text-sm">

                                <thead className="bg-gray-50">
                                <tr>
                                    <th className="w-16 px-3 py-2 text-left">STT</th>
                                    <th className="px-3 py-2 text-left">Đơn vị phối hợp</th>
                                    <th className="w-44 px-3 py-2 text-left">Thời gian</th>
                                    <th className="w-20 px-3 py-2 text-left">Xóa</th>
                                </tr>
                                </thead>

                                <tbody>
                                {fields.map(({key, ...restField}, index) => (
                                    <tr key={key} className="border-t">

                                        {/* STT */}
                                        <td className="px-3 py-2">{index + 1}</td>

                                        {/* ĐƠN VỊ */}
                                        <td className="px-3 py-2">
                                            <Form.Item
                                                {...restField}
                                                name={[restField.name, "unitId"]}
                                                rules={[{ required: true, message: "Chọn đơn vị" }]}
                                                style={{ marginBottom: 0 }}
                                            >
                                                <ChildOrganizationSelect
                                                    hideTitle
                                                    placeholder="Chọn đơn vị"
                                                    value={form.getFieldValue(["coordinationUnits", restField.name, "unitId"])}
                                                    excludedValues={getSelectedUnitIds()}
                                                    onChange={(nextValue) => {
                                                        form.setFieldValue(["coordinationUnits", restField.name, "unitId"], nextValue);
                                                    }}
                                                />
                                            </Form.Item>
                                        </td>

                                        {/* NGÀY */}
                                        <td className="px-3 py-2">
                                            <Form.Item
                                                {...restField}
                                                name={[restField.name, "completionTime"]}
                                                dependencies={["dueDate"]}
                                                rules={[
                                                    { required: true, message: "Chọn ngày" },
                                                    { validator: validateUnitCompletionTime },
                                                ]}
                                                style={{ marginBottom: 0 }}
                                            >
                                                <AppDatePicker
                                                    hideTitle
                                                    disabledDate={disableDatesAfterDueDate}
                                                />
                                            </Form.Item>
                                        </td>

                                        {/* XÓA */}
                                        <td className="px-3 py-2">
                                            <button
                                                type="button"
                                                onClick={() => remove(restField.name)}
                                                className="text-red-600 hover:underline"
                                            >
                                                <ActionIcon action={'delete'}/>
                                            </button>
                                        </td>

                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>

                    </div>
                )}
            </Form.List>
        </Col>
        <Col md={24} xs={24}  lg={24}>
            <div className={'flex flex-col gap-1 mb-4 mt-4 rounded-2xl bg-white p-4 shadow-sm sm:p-5'}>
                <div className="flex items-center justify-between border-b border-gray-200 pb-3 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Văn bản triển khai</h3>
                    <button onClick={() => setDocumentModal({context: "deployment", open: true})} className="flex items-center gap-1.5 text-sm text-[#dc2626] hover:underline">
                        <PlusCircle className="h-4 w-4" />
                        Thêm văn bản triển khai
                    </button>
                </div>

                <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                    <table className="w-full min-w-[900px] text-sm">
                        <thead className={'bg-[#f3f4f6] text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300'}>

                        <tr>
                            <th className="w-16 px-3 py-2 text-left">STT</th>
                            <th className="px-3 py-2 text-left">Trích yếu</th>
                            <th className="w-32 px-3 py-2 text-left">Số ký hiệu</th>
                            <th className="w-44 px-3 py-2 text-left">Cơ quan ban hành</th>
                            <th className="w-36 px-3 py-2 text-left">Ngày ban hành</th>
                            <th className="px-3 py-2 text-left">Văn bản đính kèm</th>
                            <th className="w-20 px-3 py-2 text-left">Hành động</th>
                        </tr>
                        </thead>
                        <tbody>
                        {deploymentDocuments.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                                    {'Chưa có văn bản triển khai. Bấm "Thêm văn bản triển khai" để thêm mới.'}
                                </td>
                            </tr>
                        ) : (
                            deploymentDocuments.map((row, index) => (
                                <tr key={row.id} className="border-t border-gray-200 dark:border-gray-700">
                                    <td className="px-3 py-2">{index + 1}</td>
                                    <td className="px-3 py-2">{row.abstract}</td>
                                    <td className="px-3 py-2">{row.code}</td>
                                    <td className="px-3 py-2">{row.issuingOrgLabel || "--"}</td>
                                    <td className="px-3 py-2">{dayjs(row.issueDate).format('DD/M/YYYY') || "--"}</td>
                                    <td className="px-3 py-2">
                                        {row.attachments.length > 0 ? row.attachments.map((item) => item.fileName).join(", ") : "--"}
                                    </td>
                                    <td className="px-3 py-2">
                                        <button
                                            onClick={() => setDeploymentDocuments((currentRows) => currentRows.filter((item) => item.id !== row.id))}
                                            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
                                            title="Xóa"
                                        >
                                            <ActionIcon action={"delete"}/>
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
        </Col>
        <Col md={24} xs={24}  lg={24}>
            <div className={'flex flex-col gap-1 mb-4 rounded-2xl bg-white p-4 shadow-sm sm:p-5'}>
                <h3 className={'text-sm font-semibold text-gray-800 flex items-center gap-1 '}>
                    Tài liệu đính kèm
                </h3>
                <Divider/>
                <Form.Item
                    name="attachments"
                    label={false}
                >
                    <UploadAttachmentsField />
                </Form.Item>
            </div>
        </Col>
    </Row>
        <div className="sticky bottom-0 flex gap-2 justify-center p-3 border-t bg-[#f5f0e8]">
            <ActionButton type={'close'} onClick={()  => router.back()} />
            <ActionButton type={'save'} onClick={()  => saveTask(false)} />
            <ActionButton type={'send'} onClick={()  => saveTask(true)} label={'Lưu và ban hành'}/>
        </div>

        <CreateDocModal
            open={documentModal?.open || false}
            onCancel={() => setDocumentModal(undefined)}
            onSubmit={(values) => saveDocumentFormModal(values as DocumentModalForm)}
            context={documentModal?.context || "quick"}
        />
    </Form>

}

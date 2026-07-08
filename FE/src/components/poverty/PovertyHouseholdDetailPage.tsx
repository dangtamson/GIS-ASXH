"use client";

import { api, ApiError } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { HouseholdAssessment, HouseholdChangeLog, HouseholdContextHistory, HouseholdDetailResponse, HouseholdFieldPhoto, HouseholdMember, HouseholdSupport, HouseholdSupportType, PoorHousehold } from "@/types/poverty";
import {
    formatDate,
    householdStatusColor,
    householdStatusLabel,
    povertyTypeColor,
    povertyTypeLabel,
    povertyTypeOptions,
} from "@/components/poverty/poverty-utils";
import { ActionButton, TitleSpace, UploadAttachmentsField } from "@/components/controller";
import ActionIcon from "@/components/controller/ActionIcon";
import { formatFileSize, getFileExtension, type AttachmentType } from "@/components/controller/input/UploadAttachmentField";
import PovertyAssessmentTimelinePanel from "@/components/poverty/PovertyAssessmentTimelinePanel";
import PovertySupportTimelinePanel from "@/components/poverty/PovertySupportTimelinePanel";
import { formatCurrency, getSupportTotalAmount, supportTypeLabel, supportTypeOptions } from "@/components/poverty/poverty-support-utils";
import { usePovertyCategoryOptions } from "@/components/poverty/usePovertyCategoryOptions";
import { usePermission } from "@/hooks/usePermission";
import { App, Button, Checkbox, Col, DatePicker, Empty, Form, Input, InputNumber, Modal, Popconfirm, Row, Segmented, Select, Space, Table, Tabs, Tag } from "antd";
import dayjs from "dayjs";
import type { TableColumnsType } from "antd";
import { Grid3X3, List } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type Props = {
    id: string;
};

type PhotoViewMode = "grid" | "list";

const isHeadMember = (value: unknown): boolean => value === true || value === 1 || value === "1" || value === "true";
const currentYear = new Date().getFullYear();
const fieldPhotoExtensions = ["jpg", "jpeg", "png", "webp", "gif", "heic"];
const fieldPhotoEntityType = "poor_household";
const fieldPhotoStorageBucket = "poor_household";

const toSafeStorageFileName = (fileName: string): string =>
    fileName.trim().replace(/[^\w.\-]+/g, "_").replace(/^_+|_+$/g, "") || "field-photo";

function InfoCard({
    label,
    value,
    children,
}: {
    label: string;
    value?: React.ReactNode;
    children?: React.ReactNode;
}) {
    return (
        <div className="min-w-0 rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
            <div className="mt-2 min-w-0 text-sm font-medium text-gray-900">{children ?? value ?? "-"}</div>
        </div>
    );
}

export default function PovertyHouseholdDetailPage({ id }: Props) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { notification } = App.useApp();
    const [loading, setLoading] = useState(false);
    const [household, setHousehold] = useState<PoorHousehold | null>(null);
    const [members, setMembers] = useState<HouseholdMember[]>([]);
    const [assessments, setAssessments] = useState<HouseholdAssessment[]>([]);
    const [supports, setSupports] = useState<HouseholdSupport[]>([]);
    const [contextHistories, setContextHistories] = useState<HouseholdContextHistory[]>([]);
    const [latestContextHistory, setLatestContextHistory] = useState<HouseholdContextHistory | null>(null);
    const [changeLogs, setChangeLogs] = useState<HouseholdChangeLog[]>([]);
    const [fieldPhotos, setFieldPhotos] = useState<NonNullable<HouseholdDetailResponse["fieldPhotos"]>>([]);
    const [fieldPhotoPreviewUrls, setFieldPhotoPreviewUrls] = useState<Record<string, string>>({});
    const [photoViewMode, setPhotoViewMode] = useState<PhotoViewMode>("grid");
    const [photoAttachments, setPhotoAttachments] = useState<AttachmentType[]>([]);
    const [savingPhotos, setSavingPhotos] = useState(false);
    const [memberModalOpen, setMemberModalOpen] = useState(false);
    const [assessmentModalOpen, setAssessmentModalOpen] = useState(false);
    const [supportModalOpen, setSupportModalOpen] = useState(false);
    const [contextHistoryModalOpen, setContextHistoryModalOpen] = useState(false);
    const [editingMember, setEditingMember] = useState<HouseholdMember | null>(null);
    const [editingAssessment, setEditingAssessment] = useState<HouseholdAssessment | null>(null);
    const [editingSupport, setEditingSupport] = useState<HouseholdSupport | null>(null);
    const [editingContextHistory, setEditingContextHistory] = useState<HouseholdContextHistory | null>(null);
    const [memberForm] = Form.useForm();
    const [assessmentForm] = Form.useForm();
    const [supportForm] = Form.useForm();
    const [contextHistoryForm] = Form.useForm();
    const selectedSupportTypes = (Form.useWatch("supportTypes", supportForm) ?? []) as HouseholdSupportType[];
    const nationOptions = usePovertyCategoryOptions("NATION");
    const { can: canUpdateDetail } = usePermission("poverty.household.detail.update");
    const returnPath = searchParams.get("from") === "map"
        ? `/ho-ngheo/ban-do?householdId=${searchParams.get("householdId") || id}`
        : "/ho-ngheo";

    const loadDetail = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.get<HouseholdDetailResponse>(endpoints.poverty.household(id));
            setHousehold(data.household ?? null);
            setMembers(data.members ?? []);
            setAssessments(data.assessments ?? []);
            setSupports(data.supports ?? []);
            setContextHistories(data.contextHistories ?? []);
            setLatestContextHistory(data.latestContextHistory ?? null);
            setChangeLogs(data.changeLogs ?? []);
            setFieldPhotos(data.fieldPhotos ?? []);
        } catch (error) {
            notification.error({
                message: "Không thể tải chi tiết hộ",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
        } finally {
            setLoading(false);
        }
    }, [id, notification]);

    useEffect(() => {
        loadDetail();
    }, [loadDetail]);

    useEffect(() => {
        let cancelled = false;
        const imagePhotos = fieldPhotos.filter((photo) => {
            const extension = getFileExtension(photo.fileName);
            return String(photo.mimeType ?? "").startsWith("image/") || fieldPhotoExtensions.includes(extension);
        });

        if (imagePhotos.length === 0) {
            setFieldPhotoPreviewUrls({});
            return;
        }

        void Promise.all(
            imagePhotos.map(async (photo) => {
                try {
                    const response = await api.get<{ previewUrl?: string }>(endpoints.admin.filePreview(photo.uuid, 600));
                    return [photo.uuid, String(response.previewUrl ?? "")] as const;
                } catch {
                    return [photo.uuid, ""] as const;
                }
            })
        ).then((entries) => {
            if (cancelled) return;
            setFieldPhotoPreviewUrls(Object.fromEntries(entries.filter(([, url]) => url)));
        });

        return () => {
            cancelled = true;
        };
    }, [fieldPhotos]);

    const openMemberModal = useCallback((member?: HouseholdMember) => {
        setEditingMember(member ?? null);
        memberForm.resetFields();
        memberForm.setFieldsValue(member ? {
            ...member,
            dateOfBirth: member.dateOfBirth ? dayjs(String(member.dateOfBirth).slice(0, 10)) : undefined,
            isHead: isHeadMember(member.isHead),
        } : { isHead: false });
        setMemberModalOpen(true);
    }, [memberForm]);

    const openAssessmentModal = useCallback((assessment?: HouseholdAssessment) => {
        setEditingAssessment(assessment ?? null);
        assessmentForm.resetFields();
        assessmentForm.setFieldsValue(assessment ? {
            ...assessment,
            decisionDate: assessment.decisionDate ? String(assessment.decisionDate).slice(0, 10) : undefined,
        } : { assessmentYear: household?.year ?? currentYear, povertyType: household?.povertyType ?? "POOR" });
        setAssessmentModalOpen(true);
    }, [assessmentForm, household?.povertyType, household?.year]);

    const openSupportModal = useCallback((support?: HouseholdSupport) => {
        setEditingSupport(support ?? null);
        supportForm.resetFields();
        supportForm.setFieldsValue(support ? {
            ...support,
            supportDate: support.supportDate ? dayjs(String(support.supportDate).slice(0, 10)) : undefined,
            supportTypes: support.supportTypes ?? [],
            amounts: support.amounts ?? {},
        } : { supportDate: dayjs(), supportTypes: [], amounts: {} });
        setSupportModalOpen(true);
    }, [supportForm]);

    const openContextHistoryModal = useCallback((contextHistory?: HouseholdContextHistory) => {
        setEditingContextHistory(contextHistory ?? null);
        contextHistoryForm.resetFields();
        contextHistoryForm.setFieldsValue(contextHistory ? {
            ...contextHistory,
            recordedAt: contextHistory.recordedAt ? dayjs(String(contextHistory.recordedAt).slice(0, 10)) : undefined,
        } : { recordedAt: dayjs() });
        setContextHistoryModalOpen(true);
    }, [contextHistoryForm]);

    const updatePhotoAttachments = useCallback((attachments: AttachmentType[]) => {
        if (attachments.length > 3) {
            notification.warning({ message: "Mỗi lần chỉ được thêm tối đa 3 ảnh" });
        }
        setPhotoAttachments(attachments.slice(0, 3));
    }, [notification]);

    const saveFieldPhotos = async () => {
        if (photoAttachments.length === 0) {
            notification.warning({ message: "Vui lòng chọn ít nhất một ảnh" });
            return;
        }

        setSavingPhotos(true);
        try {
            await Promise.all(photoAttachments.map((attachment, index) => api.post<{ item?: HouseholdFieldPhoto }>(endpoints.admin.files, {
                fileName: attachment.fileName,
                fileSize: attachment.fileSize,
                mimeType: attachment.mimeType,
                fileContentBase64: attachment.fileContentBase64,
                storageBucket: fieldPhotoStorageBucket,
                storagePath: `image/${id}/${Date.now()}-${index}-${toSafeStorageFileName(attachment.fileName)}`,
                entityType: fieldPhotoEntityType,
                entityId: id,
            })));
            notification.success({ message: "Đã thêm ảnh thực tế" });
            setPhotoAttachments([]);
            await loadDetail();
        } catch (error) {
            notification.error({
                message: "Không thể thêm ảnh thực tế",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
        } finally {
            setSavingPhotos(false);
        }
    };

    const deleteFieldPhoto = useCallback(async (photo: HouseholdFieldPhoto) => {
        try {
            await api.delete(`${endpoints.admin.files}/${photo.uuid}`);
            notification.success({ message: "Đã xóa ảnh thực tế" });
            await loadDetail();
        } catch (error) {
            notification.error({
                message: "Không thể xóa ảnh thực tế",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
        }
    }, [loadDetail, notification]);

    const saveMember = async () => {
        const values = await memberForm.validateFields(['fullName', 'relationship', 'gender', 'dateOfBirth', 'ethnicity', 'citizenId', 'phone', 'occupation', 'isHead', 'changeNote']);
        const payload = {
            ...values,
            isHead: Boolean(values.isHead),
            dateOfBirth: values.dateOfBirth ? (dayjs.isDayjs(values.dateOfBirth) ? values.dateOfBirth.format("YYYY-MM-DD") : String(values.dateOfBirth).slice(0, 10)) : undefined,
        };
        try {
            if (editingMember) {
                await api.patch(endpoints.poverty.householdMember(id, editingMember.id), payload);
            } else {
                await api.post(endpoints.poverty.householdMembers(id), payload);
            }
            notification.success({ message: editingMember ? "Đã cập nhật thành viên" : "Đã thêm thành viên" });
            setMemberModalOpen(false);
            await loadDetail();
        } catch (error) {
            notification.error({ message: "Không thể lưu thành viên", description: error instanceof ApiError ? error.message : "Vui lòng thử lại" });
        }
    };

    const saveAssessment = async () => {
        const values = await assessmentForm.validateFields();
        try {
            if (editingAssessment) {
                await api.patch(endpoints.poverty.householdAssessment(id, editingAssessment.id), values);
            } else {
                await api.post(endpoints.poverty.householdAssessments(id), values);
            }
            notification.success({ message: editingAssessment ? "Đã cập nhật đánh giá" : "Đã thêm đánh giá" });
            setAssessmentModalOpen(false);
            await loadDetail();
        } catch (error) {
            notification.error({ message: "Không thể lưu đánh giá", description: error instanceof ApiError ? error.message : "Vui lòng thử lại" });
        }
    };

    const saveSupport = async () => {
        const values = await supportForm.validateFields();
        const supportTypes = (values.supportTypes ?? []) as HouseholdSupportType[];
        const sourceAmounts = values.amounts ?? {};
        const amounts = Object.fromEntries(
            supportTypes.map((type) => [type, Number(sourceAmounts[type] ?? 0)])
        );
        const supportDate = values.supportDate
            ? dayjs.isDayjs(values.supportDate)
                ? values.supportDate.format("YYYY-MM-DD")
                : String(values.supportDate).slice(0, 10)
            : undefined;
        const payload = { ...values, supportDate, supportTypes, amounts };
        try {
            if (editingSupport) {
                await api.patch(endpoints.poverty.householdSupport(id, editingSupport.id), payload);
            } else {
                await api.post(endpoints.poverty.householdSupports(id), payload);
            }
            notification.success({ message: editingSupport ? "Đã cập nhật hỗ trợ" : "Đã thêm hỗ trợ" });
            setSupportModalOpen(false);
            await loadDetail();
        } catch (error) {
            notification.error({ message: "Không thể lưu hỗ trợ", description: error instanceof ApiError ? error.message : "Vui lòng thử lại" });
        }
    };

    const saveContextHistory = async () => {
        const values = await contextHistoryForm.validateFields();
        const payload = {
            ...values,
            recordedAt: values.recordedAt
                ? dayjs.isDayjs(values.recordedAt)
                    ? values.recordedAt.format("YYYY-MM-DD")
                    : String(values.recordedAt).slice(0, 10)
                : undefined,
        };
        try {
            if (editingContextHistory) {
                await api.patch(endpoints.poverty.householdContextHistory(id, editingContextHistory.id), payload);
            } else {
                await api.post(endpoints.poverty.householdContextHistories(id), payload);
            }
            notification.success({ message: editingContextHistory ? "Đã cập nhật hoàn cảnh & hiện trạng" : "Đã thêm cập nhật hoàn cảnh & hiện trạng" });
            setContextHistoryModalOpen(false);
            await loadDetail();
        } catch (error) {
            notification.error({ message: "Không thể lưu hoàn cảnh & hiện trạng", description: error instanceof ApiError ? error.message : "Vui lòng thử lại" });
        }
    };

    const deleteMember = useCallback(async (memberId: string) => {
        try {
            await api.delete(endpoints.poverty.householdMember(id, memberId));
            notification.success({ message: "Đã xóa thành viên" });
            await loadDetail();
        } catch (error) {
            notification.error({ message: "Không thể xóa thành viên", description: error instanceof ApiError ? error.message : "Vui lòng thử lại" });
        }
    }, [id, loadDetail, notification]);

    const deleteAssessment = useCallback(async (assessmentId: string) => {
        try {
            await api.delete(endpoints.poverty.householdAssessment(id, assessmentId));
            notification.success({ message: "Đã xóa đánh giá" });
            await loadDetail();
        } catch (error) {
            notification.error({ message: "Không thể xóa đánh giá", description: error instanceof ApiError ? error.message : "Vui lòng thử lại" });
        }
    }, [id, loadDetail, notification]);

    const deleteSupport = useCallback(async (supportId: string) => {
        try {
            await api.delete(endpoints.poverty.householdSupport(id, supportId));
            notification.success({ message: "Đã xóa hỗ trợ" });
            await loadDetail();
        } catch (error) {
            notification.error({ message: "Không thể xóa hỗ trợ", description: error instanceof ApiError ? error.message : "Vui lòng thử lại" });
        }
    }, [id, loadDetail, notification]);

    const deleteContextHistory = useCallback(async (contextHistoryId: string) => {
        try {
            await api.delete(endpoints.poverty.householdContextHistory(id, contextHistoryId));
            notification.success({ message: "Đã xóa cập nhật hoàn cảnh & hiện trạng" });
            await loadDetail();
        } catch (error) {
            notification.error({ message: "Không thể xóa cập nhật hoàn cảnh & hiện trạng", description: error instanceof ApiError ? error.message : "Vui lòng thử lại" });
        }
    }, [id, loadDetail, notification]);

    const headMember = useMemo(() => members.find((member) => isHeadMember(member.isHead)), [members]);
    const householdArea = useMemo(
        () => [household?.provinceName, household?.wardName, household?.areaName].filter(Boolean).join(" / ") || "-",
        [household?.areaName, household?.provinceName, household?.wardName]
    );
    const householdCoordinate = household?.latitude != null && household.longitude != null ? `${household.latitude}, ${household.longitude}` : "-";
    const latestContextRecordedAt = latestContextHistory?.recordedAt ? formatDate(latestContextHistory.recordedAt) : "-";

    const memberColumns: TableColumnsType<HouseholdMember> = useMemo(() => [
        {
            title: "Họ tên",
            dataIndex: "fullName",
            width: 240,
            ellipsis: true,
            render: (value, record) => (
                <div className="min-w-0">
                    <div className="truncate font-medium text-gray-900">{value || "-"}</div>
                    {isHeadMember(record.isHead) ? <Tag className="mt-1" color="blue">Chủ hộ</Tag> : null}
                </div>
            ),
        },
        { title: "Quan hệ", dataIndex: "relationship", width: 130, render: (value) => value || "-" },
        { title: "Giới tính", dataIndex: "gender", width: 110, render: (value) => value || "-" },
        { title: "Ngày sinh", dataIndex: "dateOfBirth", width: 130, render: formatDate },
        { title: "CCCD", dataIndex: "citizenId", width: 150, render: (value) => value || "-" },
        { title: "Điện thoại", dataIndex: "phone", width: 140, render: (value) => value || "-" },
        { title: "Nghề nghiệp", dataIndex: "occupation", width: 180, ellipsis: true, render: (value) => value || "-" },
        {
            title: "Thao tác",
            width: 110,
            fixed: "right",
            render: (_, record) => (
                <Space size={4} wrap={false}>
                    {canUpdateDetail ? <Button type="text" icon={<ActionIcon action="edit" />} onClick={() => openMemberModal(record)} /> : null}
                    {canUpdateDetail ? <Popconfirm title="Xóa thành viên này?" onConfirm={() => deleteMember(record.id)} okText="Xóa" cancelText="Hủy">
                        <Button type="text" icon={<ActionIcon action="delete" />} />
                    </Popconfirm> : null}
                </Space>
            ),
        },
    ], [canUpdateDetail, deleteMember, openMemberModal]);

    const assessmentColumns: TableColumnsType<HouseholdAssessment> = useMemo(() => [
        { title: "Năm", dataIndex: "assessmentYear", width: 100 },
        { title: "Loại hộ", dataIndex: "povertyType", width: 150, render: (value) => <Tag color={povertyTypeColor(value)}>{povertyTypeLabel(value)}</Tag> },
        { title: "Điểm B1", dataIndex: "scoreB1", width: 100, render: (value) => value ?? "-" },
        { title: "Điểm B2", dataIndex: "scoreB2", width: 100, render: (value) => value ?? "-" },
        { title: "Quyết định", dataIndex: "decisionNo", width: 180, ellipsis: true, render: (value) => value || "-" },
        { title: "Ngày QĐ", dataIndex: "decisionDate", width: 130, render: formatDate },
        {
            title: "Thao tác",
            width: 110,
            fixed: "right",
            render: (_, record) => (
                <Space size={4} wrap={false}>
                    {canUpdateDetail ? <Button type="text" icon={<ActionIcon action="edit" />} onClick={() => openAssessmentModal(record)} /> : null}
                    {canUpdateDetail ? <Popconfirm title="Xóa đánh giá này?" onConfirm={() => deleteAssessment(record.id)} okText="Xóa" cancelText="Hủy">
                        <Button type="text" icon={<ActionIcon action="delete" />} />
                    </Popconfirm> : null}
                </Space>
            ),
        },
    ], [canUpdateDetail, deleteAssessment, openAssessmentModal]);

    const supportColumns: TableColumnsType<HouseholdSupport> = useMemo(() => [
        { title: "Thời điểm", dataIndex: "supportDate", width: 130, render: formatDate },
        {
            title: "Loại hỗ trợ",
            dataIndex: "supportTypes",
            width: 260,
            render: (value: string[] = []) => (
                <div className="flex flex-wrap gap-1">
                    {value.length > 0 ? value.map((type) => <Tag key={type} color="green">{supportTypeLabel(type)}</Tag>) : "-"}
                </div>
            ),
        },
        { title: "Tổng tiền", width: 140, render: (_, record) => formatCurrency(getSupportTotalAmount(record)) },
        { title: "Đơn vị hỗ trợ", dataIndex: "supportingUnit", width: 180, ellipsis: true, render: (value) => value || "-" },
        { title: "Nội dung", dataIndex: "content", width: 260, ellipsis: true, render: (value) => value || "-" },
        {
            title: "Thao tác",
            width: 110,
            fixed: "right",
            render: (_, record) => (
                <Space size={4} wrap={false}>
                    {canUpdateDetail ? <Button type="text" icon={<ActionIcon action="edit" />} onClick={() => openSupportModal(record)} /> : null}
                    {canUpdateDetail ? <Popconfirm title="Xóa hỗ trợ này?" onConfirm={() => deleteSupport(record.id)} okText="Xóa" cancelText="Hủy">
                        <Button type="text" icon={<ActionIcon action="delete" />} />
                    </Popconfirm> : null}
                </Space>
            ),
        },
    ], [canUpdateDetail, deleteSupport, openSupportModal]);

    const contextHistoryColumns: TableColumnsType<HouseholdContextHistory> = useMemo(() => [
        { title: "Ngày cập nhật", dataIndex: "recordedAt", width: 140, render: formatDate },
        { title: "Hoàn cảnh gia đình", dataIndex: "familySituation", width: 280, ellipsis: true, render: (value) => value || "-" },
        { title: "Hiện trạng", dataIndex: "currentStatus", width: 280, ellipsis: true, render: (value) => value || "-" },
        { title: "Ghi chú", dataIndex: "note", width: 220, ellipsis: true, render: (value) => value || "-" },
        {
            title: "Thao tác",
            width: 110,
            fixed: "right",
            render: (_, record) => (
                <Space size={4} wrap={false}>
                    {canUpdateDetail ? <Button type="text" icon={<ActionIcon action="edit" />} onClick={() => openContextHistoryModal(record)} /> : null}
                    {canUpdateDetail ? <Popconfirm title="Xóa cập nhật này?" onConfirm={() => deleteContextHistory(record.id)} okText="Xóa" cancelText="Hủy">
                        <Button type="text" icon={<ActionIcon action="delete" />} />
                    </Popconfirm> : null}
                </Space>
            ),
        },
    ], [canUpdateDetail, deleteContextHistory, openContextHistoryModal]);

    return (
        <div className="min-w-0 space-y-4 overflow-hidden">
            <TitleSpace
                title="Chi tiết hộ nghèo/cận nghèo"
                actions={<ActionButton type="close" label="Quay lại" onClick={() => router.push(returnPath)} />}
            />
            <div className="min-w-0 rounded-lg border border-gray-200 bg-white p-5">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase text-gray-500">Thông tin hộ</p>
                        <h2 className="mt-2 truncate text-xl font-semibold text-gray-900">{household?.code || "Chưa có mã hộ"}</h2>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <Tag color={povertyTypeColor(household?.povertyType)}>{povertyTypeLabel(household?.povertyType)}</Tag>
                            <Tag color={householdStatusColor(household?.status)}>{householdStatusLabel(household?.status)}</Tag>
                        </div>
                    </div>
                    <div className="shrink-0 rounded-md bg-gray-50 px-3 py-2 text-right">
                        <p className="text-xs text-gray-500">Năm quản lý</p>
                        <p className="text-lg font-semibold text-gray-900">{household?.year || "-"}</p>
                    </div>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <div className="min-w-0 rounded-md bg-gray-50 p-3">
                        <p className="text-xs font-semibold uppercase text-gray-500">Địa bàn</p>
                        <p className="mt-2 break-words text-sm font-medium text-gray-900">{householdArea}</p>
                    </div>
                    <div className="min-w-0 rounded-md bg-gray-50 p-3">
                        <p className="text-xs font-semibold uppercase text-gray-500">Địa chỉ</p>
                        <p className="mt-2 break-words text-sm font-medium text-gray-900">{household?.address || "-"}</p>
                    </div>
                </div>
                <div className="mt-3 grid min-w-0 gap-3 md:grid-cols-3">
                    <InfoCard label="Chủ hộ">
                        <div className="min-w-0">
                            <div className="truncate">{headMember?.fullName || household?.headFullName || "-"}</div>
                            <div className="mt-1 text-xs font-normal text-gray-500">CCCD: {headMember?.citizenId || household?.headCitizenId || "-"}</div>
                        </div>
                    </InfoCard>
                    <InfoCard label="Số nhân khẩu" value={members.length.toLocaleString("vi-VN")} />
                    <InfoCard label="Tọa độ" value={householdCoordinate} />
                </div>
                <div className="mt-3 grid min-w-0 gap-3 md:grid-cols-2">
                    <InfoCard label="Hoàn cảnh gia đình">
                        <div className="min-w-0">
                            <div className="line-clamp-3 break-words">{latestContextHistory?.familySituation || "-"}</div>
                            <div className="mt-1 text-xs font-normal text-gray-500">Cập nhật gần nhất: {latestContextRecordedAt}</div>
                        </div>
                    </InfoCard>
                    <InfoCard label="Hiện trạng">
                        <div className="min-w-0">
                            <div className="line-clamp-3 break-words">{latestContextHistory?.currentStatus || "-"}</div>
                            <div className="mt-1 text-xs font-normal text-gray-500">Cập nhật gần nhất: {latestContextRecordedAt}</div>
                        </div>
                    </InfoCard>
                </div>
            </div>

            <Tabs
                className="min-w-0 overflow-hidden"
                items={[
                    {
                        key: "members",
                        label: "Thành viên",
                        children: (
                            <div className="min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 p-3">
                                    <div className="text-sm text-gray-600">
                                        Tổng {members.length.toLocaleString("vi-VN")} thành viên
                                        {headMember ? <span className="ml-2 text-gray-400">Chủ hộ: {headMember.fullName}</span> : null}
                                    </div>
                                    {canUpdateDetail ? <ActionButton type="create" label="Thêm thành viên" onClick={() => openMemberModal()} /> : null}
                                </div>
                                <Table rowKey="id" loading={loading} columns={memberColumns} dataSource={members} pagination={false} scroll={{ x: 1180 }} />
                            </div>
                        ),
                    },
                    {
                        key: "assessments",
                        label: "Đánh giá",
                        children: (
                            <div className="min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white">
                                {canUpdateDetail ? <div className="flex flex-wrap justify-end gap-2 border-b border-gray-100 p-3"><ActionButton type="create" label="Thêm đánh giá" onClick={() => openAssessmentModal()} /></div> : null}
                                <div className="border-b border-gray-100 bg-gray-50 p-4">
                                    <PovertyAssessmentTimelinePanel household={household} assessments={assessments} loading={loading} showHouseholdInfo={false} />
                                </div>
                                <Table rowKey="id" loading={loading} columns={assessmentColumns} dataSource={assessments} pagination={false} scroll={{ x: 870 }} />
                            </div>
                        ),
                    },
                    {
                        key: "supports",
                        label: "Hỗ trợ",
                        children: (
                            <div className="min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white">
                                {canUpdateDetail ? <div className="flex flex-wrap justify-end gap-2 border-b border-gray-100 p-3"><ActionButton type="create" label="Thêm hỗ trợ" onClick={() => openSupportModal()} /></div> : null}
                                <div className="border-b border-gray-100 bg-gray-50 p-4">
                                    <PovertySupportTimelinePanel supports={supports} loading={loading} />
                                </div>
                                <Table rowKey="id" loading={loading} columns={supportColumns} dataSource={supports} pagination={false} scroll={{ x: 1080 }} />
                            </div>
                        ),
                    },
                    {
                        key: "context-history",
                        label: "Hoàn cảnh & hiện trạng",
                        children: (
                            <div className="min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white">
                                {canUpdateDetail ? <div className="flex flex-wrap justify-end gap-2 border-b border-gray-100 p-3"><ActionButton type="create" label="Thêm cập nhật" onClick={() => openContextHistoryModal()} /></div> : null}
                                <div className="border-b border-gray-100 bg-gray-50 p-4">
                                    {contextHistories.length > 0 ? (
                                        <div className="grid gap-3 lg:grid-cols-3">
                                            {contextHistories.slice(0, 3).map((item) => (
                                                <div key={item.id} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                                                    <div className="text-xs font-semibold uppercase text-gray-500">{formatDate(item.recordedAt)}</div>
                                                    <div className="mt-2 line-clamp-2 text-sm font-medium text-gray-900">{item.familySituation || "-"}</div>
                                                    <div className="mt-2 line-clamp-2 text-sm text-gray-600">{item.currentStatus || "-"}</div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <Empty description="Chưa có cập nhật hoàn cảnh & hiện trạng" />
                                    )}
                                </div>
                                <Table rowKey="id" loading={loading} columns={contextHistoryColumns} dataSource={contextHistories} pagination={false} scroll={{ x: 1030 }} />
                            </div>
                        ),
                    },
                    {
                        key: "photos",
                        label: "Ảnh thực tế",
                        children: (
                            <div className="min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white p-4">
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-900">Ảnh thực tế</h3>
                                        <p className="mt-1 text-xs text-gray-500">Tổng {fieldPhotos.length.toLocaleString("vi-VN")} ảnh đã thêm</p>
                                    </div>
                                    {fieldPhotos.length > 0 ? (
                                        <Segmented
                                            value={photoViewMode}
                                            onChange={(value) => setPhotoViewMode(value as PhotoViewMode)}
                                            options={[
                                                { label: <span className="flex h-6 w-7 items-center justify-center"><Grid3X3 size={16} /></span>, value: "grid" },
                                                { label: <span className="flex h-6 w-7 items-center justify-center"><List size={16} /></span>, value: "list" },
                                            ]}
                                        />
                                    ) : null}
                                </div>

                                {fieldPhotos.length > 0 ? (
                                    <div className="space-y-4">
                                        {photoViewMode === "grid" ? (
                                            <div className="grid min-w-0 grid-cols-[repeat(auto-fill,minmax(180px,200px))] gap-3">
                                                {fieldPhotos.map((photo) => {
                                                    const previewUrl = fieldPhotoPreviewUrls[photo.uuid];
                                                    return (
                                                        <div
                                                            key={photo.uuid}
                                                            className="group min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 transition hover:border-red-200 hover:bg-red-50/30"
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() => previewUrl ? window.open(previewUrl, "_blank", "noopener,noreferrer") : undefined}
                                                                className="block w-full text-left"
                                                            >
                                                                <div className="aspect-square w-full overflow-hidden bg-gray-100">
                                                                    {previewUrl ? (
                                                                        <img src={previewUrl} alt={photo.fileName} className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
                                                                    ) : (
                                                                        <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-gray-500">Không thể xem trước</div>
                                                                    )}
                                                                </div>
                                                            </button>
                                                            <div className="min-w-0 p-2">
                                                                <p className="truncate text-xs font-medium text-gray-900">{photo.fileName}</p>
                                                                <p className="mt-1 text-xs text-gray-500">
                                                                    {photo.fileSize ? formatFileSize(Number(photo.fileSize)) : "-"} · {formatDate(photo.createdAt)}
                                                                </p>
                                                                {canUpdateDetail ? <div className="mt-2 flex justify-end">
                                                                    <Popconfirm
                                                                        title="Xóa ảnh này?"
                                                                        okText="Xóa"
                                                                        cancelText="Hủy"
                                                                        onConfirm={() => deleteFieldPhoto(photo)}
                                                                    >
                                                                        <Button size="small" danger type="text" icon={<ActionIcon action="delete" />} />
                                                                    </Popconfirm>
                                                                </div> : null}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <Table
                                                rowKey="uuid"
                                                pagination={false}
                                                dataSource={fieldPhotos}
                                                scroll={{ x: 760 }}
                                                columns={[
                                                    { title: "Tên file", dataIndex: "fileName", width: 280, ellipsis: true },
                                                    { title: "Kiểu", dataIndex: "mimeType", width: 180, render: (value) => value || "-" },
                                                    { title: "Dung lượng", dataIndex: "fileSize", width: 130, render: (value) => value ? formatFileSize(Number(value)) : "-" },
                                                    { title: "Ngày tải", dataIndex: "createdAt", width: 140, render: formatDate },
                                                    {
                                                        title: "Thao tác",
                                                        width: 120,
                                                        fixed: "right",
                                                        render: (_, photo) => (
                                                            <Space size={4} wrap={false}>
                                                                <Button
                                                                    type="text"
                                                                    icon={<ActionIcon action="view" />}
                                                                    disabled={!fieldPhotoPreviewUrls[photo.uuid]}
                                                                    onClick={() => window.open(fieldPhotoPreviewUrls[photo.uuid], "_blank", "noopener,noreferrer")}
                                                                />
                                                                {canUpdateDetail ? <Popconfirm title="Xóa ảnh này?" okText="Xóa" cancelText="Hủy" onConfirm={() => deleteFieldPhoto(photo)}>
                                                                    <Button type="text" icon={<ActionIcon action="delete" />} />
                                                                </Popconfirm> : null}
                                                            </Space>
                                                        ),
                                                    },
                                                ]}
                                            />
                                        )}
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-10">
                                        <Empty description="Chưa có ảnh thực tế" />
                                    </div>
                                )}

                                {canUpdateDetail ? <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <h4 className="text-sm font-semibold text-gray-900">Thêm ảnh thực tế</h4>
                                            <p className="mt-1 text-xs text-gray-500">Chọn tối đa 3 ảnh trong một lần thêm. Hỗ trợ JPG, PNG, WEBP, GIF, HEIC.</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {photoAttachments.length > 0 ? (
                                                <Button onClick={() => setPhotoAttachments([])} disabled={savingPhotos}>
                                                    Xóa file chờ lưu
                                                </Button>
                                            ) : null}
                                            <ActionButton
                                                type="save"
                                                label="Lưu ảnh"
                                                loading={savingPhotos}
                                                disabled={photoAttachments.length === 0}
                                                onClick={saveFieldPhotos}
                                            />
                                        </div>
                                    </div>
                                    <UploadAttachmentsField
                                        value={photoAttachments}
                                        onChange={updatePhotoAttachments}
                                        visibleExtensions={fieldPhotoExtensions}
                                        readOnly={savingPhotos}
                                        multiple
                                    />
                                </div> : null}
                            </div>
                        ),
                    },
                    {
                        key: "logs",
                        label: "Lịch sử thay đổi",
                        children: (
                            <div className="min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white">
                                <Table
                                    rowKey="id"
                                    loading={loading}
                                    dataSource={changeLogs}
                                    pagination={false}
                                    scroll={{ x: 760 }}
                                    columns={[
                                        { title: "Thời gian", dataIndex: "changedAt", width: 160, render: formatDate },
                                        { title: "Hành động", dataIndex: "actionType", width: 140 },
                                        { title: "Đối tượng", dataIndex: "objectType", width: 140 },
                                        { title: "Ghi chú", dataIndex: "changeNote", width: 300, ellipsis: true, render: (value) => value || "-" },
                                    ]}
                                />
                            </div>
                        ),
                    },
                ]}
            />

            <Modal title={editingMember ? "Cập nhật thành viên" : "Thêm thành viên"} open={memberModalOpen} onCancel={() => setMemberModalOpen(false)} onOk={saveMember} width={820} style={{ maxWidth: "calc(100vw - 32px)" }} styles={{ body: { maxHeight: "calc(100vh - 220px)", overflowX: "hidden", overflowY: "auto" } }} okText="Lưu" cancelText="Hủy">
                <Form form={memberForm} layout="vertical" className="[&_.ant-form-item]:mb-0">
                    <div className="space-y-5">
                        <section className="min-w-0">
                            <div className="mb-3 text-sm font-semibold text-gray-800">Thông tin cá nhân</div>
                            <Row gutter={[16, 16]}>
                                <Col xs={24} md={12}><Form.Item name="fullName" label="Họ tên" rules={[{ required: true }]}><Input /></Form.Item></Col>
                                <Col xs={24} sm={12} md={6}><Form.Item name="relationship" label="Quan hệ"><Input /></Form.Item></Col>
                                <Col xs={24} sm={12} md={6}><Form.Item name="gender" label="Giới tính"><Input /></Form.Item></Col>
                                <Col xs={24} sm={12} md={6}><Form.Item name="dateOfBirth" label="Ngày sinh"><DatePicker className="w-full" style={{ width: "100%" }} format="DD/MM/YYYY" placeholder="DD/MM/YYYY" /></Form.Item></Col>
                                <Col xs={24} sm={12} md={6}><Form.Item name="ethnicity" label="Dân tộc"><Select allowClear showSearch optionFilterProp="label" options={nationOptions} /></Form.Item></Col>
                            </Row>
                        </section>

                        <section className="min-w-0 border-t border-gray-100 pt-4">
                            <div className="mb-3 text-sm font-semibold text-gray-800">Liên hệ và vai trò</div>
                            <Row gutter={[16, 16]}>
                                <Col xs={24} sm={6}><Form.Item name="citizenId" label="CCCD"><Input /></Form.Item></Col>
                                <Col xs={24} sm={6}><Form.Item name="phone" label="Điện thoại"><Input /></Form.Item></Col>
                                <Col xs={24} sm={12}><Form.Item name="occupation" label="Nghề nghiệp"><Input /></Form.Item></Col>
                                <Col xs={24} sm={6}>
                                    <Form.Item name="isHead" valuePropName="checked" className="w-full rounded-md bg-gray-50 px-3 py-2">
                                        <Checkbox>Là chủ hộ</Checkbox>
                                    </Form.Item>
                                </Col>
                                <Col xs={24}><Form.Item name="note" label="Ghi chú" rules={[]}><Input.TextArea rows={2} /></Form.Item></Col>
                            </Row>
                        </section>
                    </div>
                </Form>
            </Modal>

            <Modal title={editingAssessment ? "Cập nhật đánh giá" : "Thêm đánh giá"} open={assessmentModalOpen} onCancel={() => setAssessmentModalOpen(false)} onOk={saveAssessment} width={760} style={{ maxWidth: "calc(100vw - 32px)" }} styles={{ body: { maxHeight: "calc(100vh - 220px)", overflowX: "hidden", overflowY: "auto" } }} okText="Lưu" cancelText="Hủy">
                <Form form={assessmentForm} layout="vertical" className="[&_.ant-form-item]:mb-0">
                    <div className="space-y-5">
                        <section className="min-w-0">
                            <div className="mb-3 text-sm font-semibold text-gray-800">Thông tin đánh giá</div>
                            <Row gutter={[16, 16]}>
                                <Col xs={24} sm={12} md={8}><Form.Item name="assessmentYear" label="Năm đánh giá" rules={[{ required: true }]}><InputNumber className="w-full" min={1900} max={2200} /></Form.Item></Col>
                                <Col xs={24} sm={12} md={8}><Form.Item name="povertyType" label="Loại hộ" rules={[{ required: true }]}><Select options={povertyTypeOptions} /></Form.Item></Col>
                                <Col xs={24} sm={12} md={4}><Form.Item name="scoreB1" label="Điểm B1"><InputNumber className="w-full" /></Form.Item></Col>
                                <Col xs={24} sm={12} md={4}><Form.Item name="scoreB2" label="Điểm B2"><InputNumber className="w-full" /></Form.Item></Col>
                            </Row>
                        </section>

                        <section className="min-w-0 border-t border-gray-100 pt-4">
                            <div className="mb-3 text-sm font-semibold text-gray-800">Quyết định</div>
                            <Row gutter={[16, 16]}>
                                <Col xs={24} sm={12} md={8}><Form.Item name="decisionNo" label="Số quyết định"><Input /></Form.Item></Col>
                                <Col xs={24} sm={12} md={8}><Form.Item name="decisionDate" label="Ngày quyết định"><Input type="date" /></Form.Item></Col>
                                <Col xs={24} md={8}><Form.Item name="approvedBy" label="Người duyệt"><Input /></Form.Item></Col>
                                <Col xs={24}><Form.Item name="note" label="Ghi chú"><Input.TextArea rows={2} /></Form.Item></Col>
                            </Row>
                        </section>
                    </div>
                </Form>
            </Modal>

            <Modal title={editingSupport ? "Cập nhật hỗ trợ" : "Thêm hỗ trợ"} open={supportModalOpen} onCancel={() => setSupportModalOpen(false)} onOk={saveSupport} width={860} style={{ maxWidth: "calc(100vw - 32px)" }} styles={{ body: { maxHeight: "calc(100vh - 220px)", overflowX: "hidden", overflowY: "auto" } }} okText="Lưu" cancelText="Hủy">
                <Form form={supportForm} layout="vertical" className="[&_.ant-form-item]:mb-0">
                    <div className="space-y-5">
                        <section className="min-w-0">
                            <div className="mb-3 text-sm font-semibold text-gray-800">Thông tin hỗ trợ</div>
                            <Row gutter={[16, 16]}>
                                <Col xs={24} sm={12} md={8}>
                                    <Form.Item name="supportDate" label="Thời điểm hỗ trợ" rules={[{ required: true }]}>
                                        <DatePicker className="w-full" style={{ width: "100%" }} format="DD/MM/YYYY" placeholder="Chọn ngày hỗ trợ" />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12} md={8}>
                                    <Form.Item name="supportingUnit" label="Đơn vị hỗ trợ">
                                        <Input placeholder="Nhập đơn vị hỗ trợ" />
                                    </Form.Item>
                                </Col>
                                <Col xs={24}>
                                    <Form.Item
                                        name="supportTypes"
                                        label="Loại hỗ trợ"
                                        rules={[
                                            {
                                                required: true,
                                                message: "Vui lòng chọn ít nhất một loại hỗ trợ",
                                            },
                                        ]}
                                    >
                                        <Checkbox.Group className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                                            {supportTypeOptions.map((option) => (
                                                <Checkbox
                                                    key={option.value}
                                                    value={option.value}
                                                    className="
                                                        m-0 flex items-center gap-2 rounded-md px-2 py-2
                                                        hover:bg-gray-50
                                                        [&_.ant-checkbox]:flex-none
                                                        [&_.ant-checkbox]:self-center
                                                        [&_.ant-checkbox+span]:flex
                                                        [&_.ant-checkbox+span]:items-center
                                                        [&_.ant-checkbox+span]:leading-normal
                                                    "
                                                >
                                                    <span className="text-base font-medium text-gray-900">
                                                        {option.label}
                                                    </span>
                                                </Checkbox>
                                            ))}
                                        </Checkbox.Group>
                                    </Form.Item>
                                </Col>
                            </Row>
                        </section>

                        {selectedSupportTypes.length > 0 ? (
                            <section className="min-w-0 border-t border-gray-100 pt-4">
                                <div className="mb-3 text-sm font-semibold text-gray-800">Số tiền theo loại hỗ trợ</div>
                                <Row gutter={[16, 16]}>
                                    {selectedSupportTypes.map((type) => (
                                        <Col xs={24} sm={12} md={4} key={type}>
                                            <Form.Item name={["amounts", type]} label={supportTypeLabel(type)}>
                                                <InputNumber className="w-full" min={0} addonAfter="đ" />
                                            </Form.Item>
                                        </Col>
                                    ))}
                                </Row>
                            </section>
                        ) : null}

                        <section className="min-w-0 border-t border-gray-100 pt-4">
                            <div className="mb-3 text-sm font-semibold text-gray-800">Nội dung và ghi chú</div>
                            <Row gutter={[16, 16]}>
                                <Col xs={24}>
                                    <Form.Item name="content" label="Nội dung hỗ trợ">
                                        <Input.TextArea rows={3} placeholder="Nhập nội dung hỗ trợ" />
                                    </Form.Item>
                                </Col>
                                <Col xs={24}>
                                    <Form.Item name="note" label="Ghi chú" rules={[]}>
                                        <Input.TextArea rows={2} placeholder="Nhập ghi chú nếu có" />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </section>
                    </div>
                </Form>
            </Modal>

            <Modal title={editingContextHistory ? "Cập nhật hoàn cảnh & hiện trạng" : "Thêm cập nhật hoàn cảnh & hiện trạng"} open={contextHistoryModalOpen} onCancel={() => setContextHistoryModalOpen(false)} onOk={saveContextHistory} width={820} style={{ maxWidth: "calc(100vw - 32px)" }} styles={{ body: { maxHeight: "calc(100vh - 220px)", overflowX: "hidden", overflowY: "auto" } }} okText="Lưu" cancelText="Hủy">
                <Form form={contextHistoryForm} layout="vertical" className="[&_.ant-form-item]:mb-0">
                    <div className="space-y-5">
                        <section className="min-w-0">
                            <div className="mb-3 text-sm font-semibold text-gray-800">Mốc cập nhật</div>
                            <Row gutter={[16, 16]}>
                                <Col xs={24} sm={12} md={8}>
                                    <Form.Item name="recordedAt" label="Ngày cập nhật" rules={[{ required: true, message: "Vui lòng chọn ngày cập nhật" }]}>
                                        <DatePicker className="w-full" style={{ width: "100%" }} format="DD/MM/YYYY" placeholder="Chọn ngày cập nhật" />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </section>

                        <section className="min-w-0 border-t border-gray-100 pt-4">
                            <div className="mb-3 text-sm font-semibold text-gray-800">Nội dung cập nhật</div>
                            <Row gutter={[16, 16]}>
                                <Col xs={24}>
                                    <Form.Item
                                        name="familySituation"
                                        label="Hoàn cảnh gia đình"
                                        rules={[{
                                            validator: async (_, value) => {
                                                const currentStatus = contextHistoryForm.getFieldValue("currentStatus");
                                                if (String(value ?? "").trim() || String(currentStatus ?? "").trim()) return;
                                                throw new Error("Vui lòng nhập Hoàn cảnh gia đình hoặc Hiện trạng");
                                            }
                                        }]}
                                    >
                                        <Input.TextArea rows={4} placeholder="Nhập hoàn cảnh gia đình" />
                                    </Form.Item>
                                </Col>
                                <Col xs={24}>
                                    <Form.Item
                                        name="currentStatus"
                                        label="Hiện trạng"
                                        rules={[{
                                            validator: async (_, value) => {
                                                const familySituation = contextHistoryForm.getFieldValue("familySituation");
                                                if (String(value ?? "").trim() || String(familySituation ?? "").trim()) return;
                                                throw new Error("Vui lòng nhập Hoàn cảnh gia đình hoặc Hiện trạng");
                                            }
                                        }]}
                                    >
                                        <Input.TextArea rows={4} placeholder="Nhập hiện trạng" />
                                    </Form.Item>
                                </Col>
                                <Col xs={24}>
                                    <Form.Item name="note" label="Ghi chú">
                                        <Input.TextArea rows={2} placeholder="Nhập ghi chú nếu có" />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </section>
                    </div>
                </Form>
            </Modal>

        </div>
    );
}

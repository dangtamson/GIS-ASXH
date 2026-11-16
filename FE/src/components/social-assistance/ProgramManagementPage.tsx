"use client";

import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { getSocialAssistanceCategoryLabel } from "@/lib/social-assistance-utils";
import { SocialAssistancePage, SocialAssistanceToolbar } from "./SocialAssistanceLayout";
import type { SocialAssistanceProgram, SocialAssistanceProgramStatus } from "@/types/social-assistance";
import { Alert, App, Button, DatePicker, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Tooltip } from "antd";
import type { TableColumnsType } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { FolderHeart, Pencil, Plus, Radio, Search, X } from "lucide-react";
import { useEffect, useState } from "react";

const CATEGORY_OPTIONS = [
    { value: "FOOD", label: "Lương thực, thực phẩm" },
    { value: "HEALTHCARE", label: "Y tế" },
    { value: "HOUSING", label: "Nhà ở" },
    { value: "EDUCATION", label: "Giáo dục" },
    { value: "LIVELIHOOD", label: "Sinh kế" },
    { value: "CASH", label: "Tiền mặt" },
    { value: "OTHER", label: "Khác" }
];

const STATUS_COLORS: Record<SocialAssistanceProgramStatus, string> = {
    DRAFT: "default",
    PUBLISHED: "green",
    CLOSED: "red"
};
const STATUS_LABELS: Record<SocialAssistanceProgramStatus, string> = {
    DRAFT: "Bản nháp",
    PUBLISHED: "Đang công khai",
    CLOSED: "Đã đóng"
};

type ProgramResponse = { items: SocialAssistanceProgram[] };
type ProgramItemResponse = { item: SocialAssistanceProgram };
type ProgramFormValues = Omit<SocialAssistanceProgram, "id" | "startDate" | "endDate" | "status"> & {
    startDate: Dayjs;
    endDate: Dayjs;
};

export default function ProgramManagementPage() {
    const [form] = Form.useForm<ProgramFormValues>();
    const { message } = App.useApp();
    const [items, setItems] = useState<SocialAssistanceProgram[]>([]);
    const [editing, setEditing] = useState<SocialAssistanceProgram | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<SocialAssistanceProgramStatus>();
    const visibleItems = items.filter((item) => (!statusFilter || item.status === statusFilter)
        && `${item.title} ${getSocialAssistanceCategoryLabel(item.category)}`.toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi")));

    const loadPrograms = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get<ProgramResponse>(endpoints.socialAssistance.programs);
            setItems(response.items ?? []);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "Không thể tải chương trình.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadPrograms();
    }, []);

    const openCreate = () => {
        setEditing(null);
        form.resetFields();
        setModalOpen(true);
    };

    const openEdit = (program: SocialAssistanceProgram) => {
        setEditing(program);
        form.setFieldsValue({
            title: program.title,
            publicDescription: program.publicDescription,
            category: program.category,
            eligibilitySummary: program.eligibilitySummary,
            startDate: dayjs(program.startDate),
            endDate: dayjs(program.endDate)
        });
        setModalOpen(true);
    };

    const saveProgram = async () => {
        try {
            const values = await form.validateFields();
            setSaving(true);
            const payload = {
                ...values,
                startDate: values.startDate.format("YYYY-MM-DD"),
                endDate: values.endDate.format("YYYY-MM-DD")
            };
            if (editing) {
                const response = await api.patch<ProgramItemResponse>(endpoints.socialAssistance.program(editing.id), payload);
                setItems((current) => current.map((item) => item.id === response.item.id ? response.item : item));
                message.success("Đã cập nhật chương trình.");
            } else {
                await api.post(endpoints.socialAssistance.programs, payload);
                message.success("Đã tạo chương trình ở trạng thái bản nháp.");
                await loadPrograms();
            }
            setModalOpen(false);
        } catch (saveError) {
            if (saveError instanceof Error && "errorFields" in saveError) return;
            message.error(saveError instanceof Error ? saveError.message : "Không thể lưu chương trình.");
        } finally {
            setSaving(false);
        }
    };

    const setProgramStatus = async (program: SocialAssistanceProgram, status: SocialAssistanceProgramStatus) => {
        try {
            const response = await api.patch<ProgramItemResponse>(endpoints.socialAssistance.program(program.id), { status });
            setItems((current) => current.map((item) => item.id === response.item.id ? response.item : item));
            message.success(status === "PUBLISHED" ? "Đã công khai chương trình." : "Đã đóng chương trình.");
        } catch (statusError) {
            message.error(statusError instanceof Error ? statusError.message : "Không thể đổi trạng thái.");
        }
    };

    const columns: TableColumnsType<SocialAssistanceProgram> = [
        { title: "Chương trình", dataIndex: "title", key: "title", width: 220 },
        { title: "Nhóm hỗ trợ", dataIndex: "category", key: "category", width: 160, render: getSocialAssistanceCategoryLabel },
        { title: "Thời gian", key: "dates", render: (_, row) => `${dayjs(row.startDate).format("DD/MM/YYYY")} – ${dayjs(row.endDate).format("DD/MM/YYYY")}` },
        {
            title: "Trạng thái",
            dataIndex: "status",
            key: "status",
            render: (status: SocialAssistanceProgramStatus) => <Tag color={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Tag>
        },
        {
            title: "Thao tác",
            key: "actions",
            width: 190,
            render: (_, row) => (
                <Space wrap>
                    <Tooltip title="Sửa chương trình"><Button aria-label="Sửa chương trình" icon={<Pencil size={15} />} onClick={() => openEdit(row)} /></Tooltip>
                    {row.status === "DRAFT" ? (
                        <Button icon={<Radio size={15} />} onClick={() => void setProgramStatus(row, "PUBLISHED")}>Công khai</Button>
                    ) : null}
                    {row.status === "PUBLISHED" ? (
                        <Popconfirm title="Đóng chương trình này?" okText="Đóng chương trình" cancelText="Hủy" onConfirm={() => void setProgramStatus(row, "CLOSED")}><Button danger icon={<X size={15} />}>Đóng</Button></Popconfirm>
                    ) : null}
                </Space>
            )
        }
    ];

    return (
        <SocialAssistancePage title="Chương trình an sinh" icon={FolderHeart} actions={<Button type="primary" icon={<Plus size={16} />} onClick={openCreate}>Tạo chương trình</Button>}>
            {error ? <Alert type="error" showIcon message={error} /> : null}
            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <SocialAssistanceToolbar>
                    <Input aria-label="Tìm chương trình" prefix={<Search size={16} className="text-gray-400" />} allowClear placeholder="Tên chương trình, nhóm hỗ trợ" value={search} onChange={(event) => setSearch(event.target.value)} />
                    <Select aria-label="Trạng thái chương trình" allowClear placeholder="Tất cả trạng thái" value={statusFilter} options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))} onChange={setStatusFilter} />
                    <span className="self-center text-sm text-gray-500">{visibleItems.length} chương trình</span>
                </SocialAssistanceToolbar>
                <Table rowKey="id" columns={columns} dataSource={visibleItems} loading={loading} pagination={{ pageSize: 20, hideOnSinglePage: true }} scroll={{ x: 800 }} locale={{ emptyText: "Không có chương trình phù hợp" }} />
            </section>

            <Modal
                title={editing ? "Cập nhật chương trình" : "Tạo chương trình an sinh"}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={() => void saveProgram()}
                confirmLoading={saving}
                okText="Lưu"
                cancelText="Hủy"
                destroyOnHidden
            >
                <Form form={form} layout="vertical">
                    <Form.Item label="Tên chương trình" name="title" rules={[{ required: true, whitespace: true }]}>
                        <Input maxLength={255} />
                    </Form.Item>
                    <Form.Item label="Nhóm hỗ trợ" name="category" rules={[{ required: true }]}>
                        <Select options={CATEGORY_OPTIONS} />
                    </Form.Item>
                    <Form.Item label="Mô tả công khai" name="publicDescription" rules={[{ required: true, whitespace: true }]}>
                        <Input.TextArea autoSize={{ minRows: 3, maxRows: 6 }} maxLength={5000} showCount />
                    </Form.Item>
                    <Form.Item label="Điều kiện tham gia" name="eligibilitySummary" rules={[{ required: true, whitespace: true }]}>
                        <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} maxLength={2000} />
                    </Form.Item>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Form.Item label="Ngày bắt đầu" name="startDate" rules={[{ required: true }]}>
                            <DatePicker className="w-full" format="DD/MM/YYYY" />
                        </Form.Item>
                        <Form.Item label="Ngày kết thúc" name="endDate" rules={[{ required: true }]}>
                            <DatePicker className="w-full" format="DD/MM/YYYY" />
                        </Form.Item>
                    </div>
                </Form>
            </Modal>
        </SocialAssistancePage>
    );
}
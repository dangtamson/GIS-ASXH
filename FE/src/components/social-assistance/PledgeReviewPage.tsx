"use client";

import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { SocialAssistancePage, SocialAssistanceToolbar } from "./SocialAssistanceLayout";
import type { SocialAssistancePledge, SocialAssistancePledgeStatus } from "@/types/social-assistance";
import { Alert, App, Button, Drawer, Empty, Input, Select, Space, Spin, Table, Tag, Typography } from "antd";
import type { TableColumnsType } from "antd";
import { Check, HandHeart, RotateCw, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const STATUS_OPTIONS: Array<{ value: SocialAssistancePledgeStatus | ""; label: string }> = [
    { value: "", label: "Tất cả trạng thái" },
    { value: "PENDING_REVIEW", label: "Chờ rà soát" },
    { value: "REVIEWED", label: "Đã xác nhận cam kết" },
    { value: "RECEIVED", label: "Đã nhận" },
    { value: "RECONCILED", label: "Đã đối soát" },
    { value: "REJECTED", label: "Từ chối" }
];

const STATUS_COLORS: Record<SocialAssistancePledgeStatus, string> = {
    PENDING_REVIEW: "gold",
    REVIEWED: "blue",
    RECEIVED: "green",
    RECONCILED: "cyan",
    REJECTED: "red"
};
const STATUS_LABELS: Record<SocialAssistancePledgeStatus, string> = {
    PENDING_REVIEW: "Chờ rà soát",
    REVIEWED: "Đã xác nhận cam kết",
    RECEIVED: "Đã nhận",
    RECONCILED: "Đã đối soát",
    REJECTED: "Từ chối"
};
const formatCurrency = (amount: number | null) => amount == null ? "—" : `${amount.toLocaleString("vi-VN")} đ`;

type ResponseData = { items: SocialAssistancePledge[] };

export default function PledgeReviewPage() {
    const { message } = App.useApp();
    const [items, setItems] = useState<SocialAssistancePledge[]>([]);
    const [selected, setSelected] = useState<SocialAssistancePledge | null>(null);
    const [statusFilter, setStatusFilter] = useState<SocialAssistancePledgeStatus | "">("");
    const [receivedAmount, setReceivedAmount] = useState<number | null>(null);
    const [receivedDescription, setReceivedDescription] = useState("");
    const [internalNote, setInternalNote] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const visibleItems = items.filter((item) => `${item.donorName} ${item.programTitle} ${item.contactPhone}`.toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi")));

    const loadPledges = useCallback(async (nextStatus: SocialAssistancePledgeStatus | "") => {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (nextStatus) params.set("status", nextStatus);
        try {
            const suffix = params.size ? `?${params.toString()}` : "";
            const response = await api.get<ResponseData>(`${endpoints.socialAssistance.pledges}${suffix}`);
            setItems(response.items ?? []);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "Không thể tải cam kết ủng hộ.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void loadPledges(""); }, [loadPledges]);

    const openPledge = (pledge: SocialAssistancePledge) => {
        setSelected(pledge);
        setReceivedAmount(pledge.receivedAmount);
        setReceivedDescription(pledge.receivedDescription ?? "");
        setInternalNote(pledge.internalNote ?? "");
    };

    const updateStatus = async (status: SocialAssistancePledgeStatus) => {
        if (!selected) return;
        const payload = {
            status,
            receivedAmount: selected.pledgeType === "CASH" ? receivedAmount ?? undefined : undefined,
            receivedDescription: selected.pledgeType === "IN_KIND" ? receivedDescription.trim() || undefined : undefined,
            internalNote: internalNote.trim() || undefined
        };
        setSaving(true);
        try {
            const response = await api.patch<{ item: SocialAssistancePledge }>(
                endpoints.socialAssistance.pledgeReconcile(selected.id),
                payload
            );
            setSelected(response.item);
            message.success("Đã cập nhật cam kết.");
            await loadPledges(statusFilter);
        } catch (saveError) {
            message.error(saveError instanceof Error ? saveError.message : "Không thể cập nhật cam kết.");
        } finally {
            setSaving(false);
        }
    };

    const columns: TableColumnsType<SocialAssistancePledge> = [
        {
            title: "Nhà tài trợ", dataIndex: "donorName", key: "donorName", render: (name: string, row) => (
                <button className="text-left font-medium text-blue-700 hover:underline" onClick={() => openPledge(row)}>{name}<span className="mt-1 block text-xs font-normal text-gray-500">{row.contactPhone}</span></button>
            )
        },
        { title: "Chương trình", dataIndex: "programTitle", key: "programTitle" },
        { title: "Hình thức", dataIndex: "pledgeType", key: "pledgeType", render: (type: string, row) => type === "CASH" ? formatCurrency(row.pledgedAmount) : "Hiện vật" },
        { title: "Trạng thái", dataIndex: "status", key: "status", render: (status: SocialAssistancePledgeStatus) => <Tag color={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Tag> }
    ];

    return (
        <SocialAssistancePage title="Cam kết ủng hộ" icon={HandHeart} actions={
            <Button icon={<RotateCw size={15} />} loading={loading} onClick={() => void loadPledges(statusFilter)}>Làm mới</Button>
        }>
            {error ? <Alert type="error" showIcon message={error} /> : null}
            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <SocialAssistanceToolbar>
                    <Input aria-label="Tìm cam kết trong danh sách" prefix={<Search size={16} className="text-gray-400" />} allowClear placeholder="Nhà tài trợ, điện thoại, chương trình" value={search} onChange={(event) => setSearch(event.target.value)} />
                    <Select aria-label="Trạng thái cam kết" value={statusFilter} options={STATUS_OPTIONS} onChange={(value) => { setStatusFilter(value); void loadPledges(value); }} />
                    <span className="self-center text-sm text-gray-500">{visibleItems.length} cam kết</span>
                </SocialAssistanceToolbar>
                <Spin spinning={loading}>
                    <Table rowKey="id" columns={columns} dataSource={visibleItems} pagination={{ pageSize: 25, hideOnSinglePage: true }} scroll={{ x: 700 }} locale={{ emptyText: <Empty description="Không có cam kết phù hợp" /> }} />
                </Spin>
            </section>
            <Drawer title={selected?.donorName ?? "Chi tiết cam kết"} open={Boolean(selected)} onClose={() => setSelected(null)} width="min(560px, calc(100vw - 24px))">
                {selected ? (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <Tag color={STATUS_COLORS[selected.status]}>{STATUS_LABELS[selected.status]}</Tag>
                            <Typography.Text type="secondary">{selected.programTitle}</Typography.Text>
                        </div>
                        <dl className="grid gap-4 break-words rounded-lg bg-gray-50 p-4 text-sm sm:grid-cols-2">
                            <div><dt className="text-xs text-slate-500">Liên hệ</dt><dd className="mt-1">{selected.contactPhone}</dd></div>
                            <div><dt className="text-xs text-slate-500">Email</dt><dd className="mt-1">{selected.contactEmail || "—"}</dd></div>
                            <div><dt className="text-xs text-slate-500">Cam kết</dt><dd className="mt-1">{selected.pledgeType === "CASH" ? formatCurrency(selected.pledgedAmount) : selected.itemDescription}</dd></div>
                        </dl>
                        {selected.status === "REVIEWED" && selected.pledgeType === "CASH" ? (
                            <Input type="number" min={1} value={receivedAmount ?? undefined} onChange={(event) => setReceivedAmount(event.target.value ? Number(event.target.value) : null)} addonAfter="đ" placeholder="Số tiền thực nhận" />
                        ) : null}
                        {selected.status === "REVIEWED" && selected.pledgeType === "IN_KIND" ? (
                            <Input.TextArea value={receivedDescription} onChange={(event) => setReceivedDescription(event.target.value)} placeholder="Hiện vật thực nhận" autoSize={{ minRows: 2, maxRows: 4 }} />
                        ) : null}
                        {selected.status !== "RECONCILED" && selected.status !== "REJECTED" ? (
                            <Input.TextArea value={internalNote} onChange={(event) => setInternalNote(event.target.value)} placeholder="Ghi chú đối soát nội bộ" autoSize={{ minRows: 2, maxRows: 4 }} />
                        ) : null}
                        <Space wrap>
                            {selected.status === "PENDING_REVIEW" ? (
                                <>
                                    <Button type="primary" loading={saving} onClick={() => void updateStatus("REVIEWED")}>Xác nhận cam kết</Button>
                                    <Button danger loading={saving} onClick={() => void updateStatus("REJECTED")}>Từ chối</Button>
                                </>
                            ) : null}
                            {selected.status === "REVIEWED" ? <Button type="primary" loading={saving} onClick={() => void updateStatus("RECEIVED")}>Xác nhận đã nhận</Button> : null}
                            {selected.status === "RECEIVED" ? <Button type="primary" icon={<Check size={15} />} loading={saving} onClick={() => void updateStatus("RECONCILED")}>Đối soát xong</Button> : null}
                        </Space>
                    </div>
                ) : null}
            </Drawer>
        </SocialAssistancePage>
    );
}
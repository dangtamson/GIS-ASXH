"use client";

import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { getSocialAssistanceCategoryLabel, getSocialAssistanceRequestStatusLabel } from "@/lib/social-assistance-utils";
import { SocialAssistancePage, SocialAssistanceToolbar } from "./SocialAssistanceLayout";
import type {
    PotentialSocialAssistanceDuplicate,
    SocialAssistanceRequest,
    SocialAssistanceRequestList,
    SocialAssistanceRequestStatus
} from "@/types/social-assistance";
import { Alert, Button, Drawer, Empty, Input, Select, Space, Spin, Table, Tag, Tooltip, Typography, message } from "antd";
import type { TableColumnsType } from "antd";
import { Check, ChevronLeft, ChevronRight, Eye, Inbox, RotateCw, Settings2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const STATUS_OPTIONS: Array<{ value: SocialAssistanceRequestStatus | ""; label: string }> = [
    { value: "", label: "Tất cả trạng thái" },
    { value: "RECEIVED", label: "Mới tiếp nhận" },
    { value: "IN_REVIEW", label: "Đang rà soát" },
    { value: "NEEDS_INFORMATION", label: "Cần bổ sung thông tin" },
    { value: "VERIFIED", label: "Đã xác minh" },
    { value: "REJECTED", label: "Từ chối" }
];

const STATUS_COLORS: Record<SocialAssistanceRequestStatus, string> = {
    RECEIVED: "gold",
    IN_REVIEW: "blue",
    NEEDS_INFORMATION: "orange",
    VERIFIED: "green",
    REJECTED: "red"
};

const SOURCE_LABELS: Record<string, string> = {
    MAP: "Bản đồ số",
    WEBSITE: "Website",
    FACEBOOK: "Facebook",
    ZALO_OA: "Zalo OA",
    STAFF: "Cán bộ nhập",
    OTHER: "Khác"
};

const PAGE_SIZE = 25;

export default function RequestQueuePage() {
    const [items, setItems] = useState<SocialAssistanceRequest[]>([]);
    const [selected, setSelected] = useState<SocialAssistanceRequest | null>(null);
    const [potentialDuplicates, setPotentialDuplicates] = useState<PotentialSocialAssistanceDuplicate[]>([]);
    const [statusFilter, setStatusFilter] = useState<SocialAssistanceRequestStatus | "">("");
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    const [savingStatus, setSavingStatus] = useState(false);
    const [statusNote, setStatusNote] = useState("");
    const [error, setError] = useState<string | null>(null);

    const loadRequests = useCallback(async (nextPage: number, nextStatus: SocialAssistanceRequestStatus | "") => {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({ page: String(nextPage), limit: String(PAGE_SIZE) });
        if (nextStatus) params.set("status", nextStatus);
        try {
            const result = await api.get<SocialAssistanceRequestList>(
                `${endpoints.socialAssistance.requests}?${params.toString()}`
            );
            setItems(result.items ?? []);
            setHasMore(result.hasMore ?? false);
            setPage(result.page ?? nextPage);
        } catch (loadError) {
            setItems([]);
            setError(loadError instanceof Error ? loadError.message : "Không thể tải danh sách hồ sơ.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadRequests(1, "");
    }, [loadRequests]);

    const openRequest = async (requestId: string) => {
        setDetailLoading(true);
        setStatusNote("");
        setPotentialDuplicates([]);
        try {
            const result = await api.get<{ item: SocialAssistanceRequest; potentialDuplicates?: PotentialSocialAssistanceDuplicate[] }>(
                endpoints.socialAssistance.request(requestId)
            );
            setSelected(result.item);
            setPotentialDuplicates(result.potentialDuplicates ?? []);
        } catch (loadError) {
            message.error(loadError instanceof Error ? loadError.message : "Không thể tải hồ sơ.");
        } finally {
            setDetailLoading(false);
        }
    };

    const changeStatus = async (status: SocialAssistanceRequestStatus) => {
        if (!selected) return;
        if (status === "REJECTED" && !statusNote.trim()) {
            message.warning("Vui lòng ghi lý do từ chối.");
            return;
        }

        setSavingStatus(true);
        try {
            const result = await api.patch<{ item: SocialAssistanceRequest }>(
                endpoints.socialAssistance.requestStatus(selected.id),
                { status, internalReason: statusNote.trim() || undefined }
            );
            setSelected(result.item);
            message.success("Đã cập nhật trạng thái hồ sơ.");
            await loadRequests(page, statusFilter);
        } catch (saveError) {
            message.error(saveError instanceof Error ? saveError.message : "Không thể cập nhật hồ sơ.");
        } finally {
            setSavingStatus(false);
        }
    };

    const columns: TableColumnsType<SocialAssistanceRequest> = [
        {
            title: "Mã hồ sơ",
            dataIndex: "receiptCode",
            key: "receiptCode",
            width: 205,
            render: (value: string) => <span className="font-mono text-xs">{value}</span>
        },
        {
            title: "Người liên hệ",
            dataIndex: "contactName",
            key: "contactName",
            render: (value: string, row) => (
                <button className="text-left font-medium text-blue-700 hover:underline" onClick={() => void openRequest(row.id)}>
                    {value}<span className="mt-1 block text-xs font-normal text-gray-500">{getSocialAssistanceCategoryLabel(row.needCategory)}</span>
                </button>
            )
        },
        {
            title: "Địa bàn",
            key: "location",
            render: (_, row) => `${row.wardCode}${row.areaId ? ` · ${row.areaId.slice(0, 8)}` : ""}`
        },
        {
            title: "Nguồn",
            dataIndex: "source",
            key: "source",
            render: (source: string) => SOURCE_LABELS[source] ?? source
        },
        {
            title: "Trạng thái",
            dataIndex: "status",
            key: "status",
            render: (status: SocialAssistanceRequestStatus) => (
                <Tag color={STATUS_COLORS[status]}>{getSocialAssistanceRequestStatusLabel(status)}</Tag>
            )
        },
        {
            title: "Thao tác",
            key: "action",
            width: 90,
            render: (_, row) => (
                <Tooltip title="Xem hồ sơ"><Button aria-label="Xem hồ sơ" icon={<Eye size={15} />} onClick={() => void openRequest(row.id)} /></Tooltip>
            )
        }
    ];

    return (
        <SocialAssistancePage title="Tiếp nhận yêu cầu hỗ trợ" icon={Inbox} actions={
            <Space wrap>
                <Button href="/an-sinh/cong-khai" icon={<Settings2 size={15} />}>
                    Cổng công khai
                </Button>
                <Button icon={<RotateCw size={15} />} onClick={() => void loadRequests(page, statusFilter)} loading={loading}>
                    Làm mới
                </Button>
            </Space>
        }>

            {error ? <Alert type="error" showIcon message={error} /> : null}

            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <SocialAssistanceToolbar>
                    <Select aria-label="Trạng thái hồ sơ" value={statusFilter} options={STATUS_OPTIONS} onChange={(value) => { setStatusFilter(value); setPage(1); void loadRequests(1, value); }} />
                    <span className="self-center text-sm text-gray-500">{items.length} hồ sơ trên trang {page}</span>
                </SocialAssistanceToolbar>
                <Spin spinning={loading}>
                    <Table
                        rowKey="id"
                        columns={columns}
                        dataSource={items}
                        pagination={false}
                        size="middle"
                        locale={{ emptyText: <Empty description="Chưa có hồ sơ trong phạm vi này" /> }}
                        scroll={{ x: 850 }}
                    />
                </Spin>
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                    <Typography.Text type="secondary">Trang {page} · {PAGE_SIZE} hồ sơ/trang</Typography.Text>
                    <Space>
                        <Button
                            aria-label="Trang trước"
                            icon={<ChevronLeft size={15} />}
                            disabled={page <= 1 || loading}
                            onClick={() => void loadRequests(page - 1, statusFilter)}
                        />
                        <Button
                            aria-label="Trang sau"
                            icon={<ChevronRight size={15} />}
                            disabled={!hasMore || loading}
                            onClick={() => void loadRequests(page + 1, statusFilter)}
                        />
                    </Space>
                </div>
            </section>

            <Drawer
                title={selected?.receiptCode ?? "Chi tiết hồ sơ"}
                open={Boolean(selected) || detailLoading}
                onClose={() => setSelected(null)}
                width="min(640px, calc(100vw - 24px))"
                loading={detailLoading}
            >
                {selected ? (
                    <div className="space-y-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <Tag color={STATUS_COLORS[selected.status]}>{getSocialAssistanceRequestStatusLabel(selected.status)}</Tag>
                            <span className="text-xs text-slate-500">Nguồn: {SOURCE_LABELS[selected.source] ?? selected.source}</span>
                        </div>
                        <dl className="grid gap-3 sm:grid-cols-2">
                            <div><dt className="text-xs text-slate-500">Người liên hệ</dt><dd className="mt-1 font-medium">{selected.contactName}</dd></div>
                            <div><dt className="text-xs text-slate-500">Điện thoại</dt><dd className="mt-1 font-medium">{selected.phone}</dd></div>
                            <div><dt className="text-xs text-slate-500">Tỉnh / xã</dt><dd className="mt-1 font-medium">{selected.provinceCode} / {selected.wardCode}</dd></div>
                            <div><dt className="text-xs text-slate-500">Địa chỉ</dt><dd className="mt-1 font-medium">{selected.address}</dd></div>
                        </dl>
                        <div>
                            <p className="text-xs text-slate-500">Nhu cầu</p>
                            <p className="mt-1 font-medium">{getSocialAssistanceCategoryLabel(selected.needCategory)}</p>
                            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selected.needDescription}</p>
                        </div>
                        {potentialDuplicates.length > 0 ? (
                            <Alert
                                type="warning"
                                showIcon
                                message={`Có ${potentialDuplicates.length} hồ sơ cần đối chiếu`}
                                description={(
                                    <div className="mt-2 space-y-2">
                                        {potentialDuplicates.map((candidate) => (
                                            <div key={candidate.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-200 pt-2">
                                                <span className="font-mono text-xs">{candidate.receiptCode}</span>
                                                <Tag color={STATUS_COLORS[candidate.status]}>{getSocialAssistanceRequestStatusLabel(candidate.status)}</Tag>
                                                <span className="text-xs">{getSocialAssistanceCategoryLabel(candidate.needCategory)}</span>
                                            </div>
                                        ))}
                                        <p className="text-xs">Đây chỉ là gợi ý; cán bộ tự xác minh, hệ thống không tự gộp hồ sơ.</p>
                                    </div>
                                )}
                            />
                        ) : null}
                        {selected.internalReason ? (
                            <div className="rounded-md bg-slate-50 p-3">
                                <p className="text-xs text-slate-500">Ghi chú nội bộ</p>
                                <p className="mt-1 whitespace-pre-wrap text-sm">{selected.internalReason}</p>
                            </div>
                        ) : null}

                        {!(["VERIFIED", "REJECTED"] as SocialAssistanceRequestStatus[]).includes(selected.status) ? (
                            <div className="space-y-3 border-t border-slate-200 pt-4">
                                <Input.TextArea
                                    value={statusNote}
                                    onChange={(event) => setStatusNote(event.target.value)}
                                    maxLength={2000}
                                    showCount
                                    autoSize={{ minRows: 2, maxRows: 5 }}
                                    placeholder="Ghi chú nội bộ hoặc nội dung cần bổ sung"
                                />
                                <Space wrap>
                                    {selected.status === "RECEIVED" ? (
                                        <Button loading={savingStatus} onClick={() => void changeStatus("IN_REVIEW")}>
                                            Bắt đầu rà soát
                                        </Button>
                                    ) : null}
                                    {selected.status === "IN_REVIEW" ? (
                                        <>
                                            <Button loading={savingStatus} onClick={() => void changeStatus("NEEDS_INFORMATION")}>
                                                Yêu cầu bổ sung
                                            </Button>
                                            <Button type="primary" icon={<Check size={15} />} loading={savingStatus} onClick={() => void changeStatus("VERIFIED")}>
                                                Xác minh
                                            </Button>
                                            <Button danger icon={<X size={15} />} loading={savingStatus} onClick={() => void changeStatus("REJECTED")}>
                                                Từ chối
                                            </Button>
                                        </>
                                    ) : null}
                                    {selected.status === "NEEDS_INFORMATION" ? (
                                        <Button loading={savingStatus} onClick={() => void changeStatus("IN_REVIEW")}>
                                            Tiếp tục rà soát
                                        </Button>
                                    ) : null}
                                </Space>
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </Drawer>
        </SocialAssistancePage>
    );
}
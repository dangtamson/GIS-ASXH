"use client";

import {api, ApiError} from "@/lib/api";
import {endpoints} from "@/lib/endpoints";
import {App, Col, ConfigProvider, Form, Row, Table, TableColumnsType} from "antd";
import React, {useCallback, useEffect, useState} from "react";
import ActionIcon from "@/components/controller/ActionIcon";
import {
    ActionButton,
    ActionModal,
    AppPagination,
    AppInput,
    ConfirmModal,
    FilterSpace,
    SearchBox,
    TitleSpace
} from "@/components/controller";
import dayjs from "dayjs";

type Workspace = {
    id?: string;
    uuid?: string;
    name?: string;
    description?: string;
    createdAt?: string;
    accountId?: string;
    status?: string;
};

type AdminWorkspaceRow = {
    workspace?: {
        uuid?: string;
        name?: string;
        description?: string;
        createdAt?: string;
        accountId?: string;
        status?: string;
    };
};

type PaginationMeta = {
    page: number;
    limit: number;
    total: number;
    pages: number;
};

type WorkspaceModalState = {
    type: 'create' | 'update';
    label: string;
    object?: Workspace;
    open: boolean;
    loading?: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    return value as Record<string, unknown>;
}

function getWorkspaceId(item: Workspace): string {
    return String(item.id ?? item.uuid ?? "");
}

function extractWorkspaces(payload: unknown): Workspace[] {
    const payloadRecord = asRecord(payload);
    const dataRecord = asRecord(payloadRecord?.data) ?? payloadRecord;
    if (!dataRecord) {
        return [];
    }

    if (Array.isArray(dataRecord.workspaces)) {
        return (dataRecord.workspaces as AdminWorkspaceRow[])
            .map((row) => {
                const nested = row.workspace;
                if (nested && typeof nested === "object") {
                    return {
                        uuid: nested.uuid,
                        name: nested.name,
                        description: nested.description,
                        createdAt: nested.createdAt,
                        accountId: nested.accountId,
                        status: nested.status,
                    } as Workspace;
                }

                return row as unknown as Workspace;
            })
            .filter((item) => Boolean(item.uuid || item.id));
    }

    if (Array.isArray(payload)) {
        return payload as Workspace[];
    }

    return [];
}

function extractPagination(input: unknown): PaginationMeta | null {
    const root = asRecord(input);
    const data = asRecord(root?.data) ?? root;
    const pagination = asRecord(data?.pagination);
    if (!pagination) {
        return null;
    }
    return {
        page: Number(pagination.page ?? 1) || 1,
        limit: Number(pagination.limit ?? 10) || 10,
        total: Number(pagination.total ?? 0) || 0,
        pages: Number(pagination.pages ?? 1) || 1,
    };
}

export default function QuanLyWorkspacePage() {
    const [items, setItems] = useState<Workspace[]>([]);
    const [loading, setLoading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
    const [deletePolicy, setDeletePolicy] = useState<"restrict" | "cascade">("restrict");
    const { notification } = App.useApp();
    const [search, setSearch] = useState("");
    const [searchDraft, setSearchDraft] = useState("");
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalItems, setTotalItems] = useState(0);

    const [actionModal, setActionModal] = useState<WorkspaceModalState | undefined>(undefined);

    const [form] = Form.useForm();

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: String(rowsPerPage),
            });

            if (search.trim()) {
                params.set("search", search.trim());
            }

            const data = await api.get<unknown>(`${endpoints.admin.workspaces}?${params.toString()}`);
            const nextItems = extractWorkspaces(data);
            const pagination = extractPagination(data);
            setItems(nextItems);
            setTotalItems(pagination?.total ?? nextItems.length);
        } catch (err) {
            if (err instanceof ApiError) {
                notification.error({
                    title: "Lỗi",
                    description: err.message,
                });
            } else {
                notification.error({
                    title: "Lỗi",
                    description: "Không thể tải danh sách workspace.",
                });
            }
            setItems([]);
            setTotalItems(0);
        } finally {
            setLoading(false);
        }
    }, [notification, page, rowsPerPage, search]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));

    useEffect(() => {
        setPage(1);
    }, [rowsPerPage]);

    const handleSearch = () => {
        const nextSearch = searchDraft.trim();

        if (page !== 1) {
            setPage(1);
        }

        if (nextSearch !== search) {
            setSearch(nextSearch);
            return;
        }

        void loadData();
    };

    const handleResetSearch = () => {
        setSearchDraft("");

        if (search) {
            setSearch("");
        }

        if (page !== 1) {
            setPage(1);
            return;
        }

        if (!search) {
            void loadData();
        }
    };

    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

    const handleSubmitWorkspace = async () => {
        if (!actionModal) {
            return;
        }

        try {
            const draftValues = form.getFieldsValue();
            const normalizedName = String(draftValues.name ?? "").trim();
            const normalizedDescription = String(draftValues.description ?? "").trim();

            if (!normalizedName) {
                form.setFields([
                    {
                        name: 'name',
                        errors: ['Vui lòng nhập tên workspace'],
                    },
                ]);
                return;
            }

            form.setFieldsValue({
                name: normalizedName,
                description: normalizedDescription,
            });

            const values = await form.validateFields();

            setActionModal((prevState) => {
                if (!prevState) return prevState;

                return {
                    ...prevState,
                    loading: true
                };
            });

            const payload = {
                name: String(values.name ?? "").trim(),
                description: String(values.description ?? "").trim() || undefined,
            };

            if (actionModal.type === 'create') {
                await api.post<unknown>(endpoints.admin.workspaces, payload);
            } else {
                const workspaceId = getWorkspaceId(actionModal.object ?? {});
                if (!workspaceId) {
                    throw new Error("Không tìm thấy workspace để cập nhật.");
                }

                await api.patch<unknown>(`${endpoints.admin.workspaces}/${workspaceId}`, payload);
            }

            form.resetFields();
            setActionModal(undefined);
            notification.success({
                title: "Thành công",
                description: actionModal.type === 'create'
                    ? "Tạo workspace thành công."
                    : "Cập nhật workspace thành công.",
            });
            await loadData();
        } catch (err) {
            if (err && typeof err === "object" && "errorFields" in err) {
                return;
            }

            if (err instanceof ApiError) {
                notification.error({
                    title: "Lỗi",
                    description: err.message,
                });
            } else {
                notification.error({
                    title: "Lỗi",
                    description: actionModal.type === 'create'
                        ? "Không thể tạo workspace."
                        : err instanceof Error
                            ? err.message
                            : "Không thể cập nhật workspace.",
                });
            }
        } finally {
            setActionModal((prevState) => {
                if (!prevState) return prevState;

                return {
                    ...prevState,
                    loading: false
                };
            });
        }
    };

    const beginEdit = (item: Workspace) => {
        form.setFieldsValue({
            name: String(item.name || ""),
            description: String(item.description || ""),
        });
        setActionModal({
            open: true,
            type: 'update',
            label: 'Cập nhật',
            object: item,
        });
    };

    const requestDelete = (id: string, name: string) => {
        if (!id) {
            return;
        }

        setDeletePolicy("restrict");
        setDeleteTarget({ id, name });
    };

    const confirmDelete = async () => {
        const id = deleteTarget?.id;
        if (!id) {
            return;
        }

        setDeletingId(id);
        try {
            await api.delete(`${endpoints.admin.workspaces}/${id}?policy=${deletePolicy}`);
            notification.success({
                title: "Thành công",
                description:
                    deletePolicy === "cascade"
                        ? "Đã xóa workspace theo chế độ cascade."
                        : "Đã xóa workspace an toàn (restrict).",
            });
            setDeleteTarget(null);
            await loadData();
        } catch (err) {
            if (err instanceof ApiError) {
                notification.error({
                    title: "Lỗi",
                    description: err.message,
                });
            } else {
                notification.error({
                    title: "Lỗi",
                    description: "Không thể xóa workspace.",
                });
            }
        } finally {
            setDeletingId(null);
        }
    };

    const columns:TableColumnsType<Workspace> = [
        {
            key: 'stt',
            title: 'STT',
            align: 'center',
            render: (_, __, index: number) => ((page-1) * rowsPerPage) + index + 1
        },
        {
            key: 'name',
            dataIndex: 'name',
            title: 'Tên',
        },
        {
            key: 'description',
            dataIndex: 'description',
            title: 'Mô tả',
        },
        {
            key: 'createdAt',
            dataIndex: 'createdAt',
            title: 'Ngày tạo',
            render: (text) => dayjs(text).format('DD/MM/YYYY hh:mm:ss')
        },
        {
            key: 'actions',
            title: 'Hành động',
            render: (_, record) => <div className={'flex gap-1'}>
                <button type="button" onClick={() => beginEdit(record)}>
                    <ActionIcon action={'edit'}/>
                </button>
                <button type="button" onClick={() => requestDelete(getWorkspaceId(record), String(record.name || ""))}>
                    <ActionIcon action={'delete'}/>
                </button>
            </div>
        }
    ];

    return (
        <Row gutter={[16,16]}>
            <Col span={24}>
                <TitleSpace
                    title={'Quản lý Workspace'}
                    description={'Quản lý danh sách workspace và cập nhật thông tin không gian làm việc trong hệ thống'}
                    actions={
                        <ActionButton
                            type={'create'}
                            onClick={() => {
                                form.resetFields();
                                setActionModal({open: true, type: 'create', label:'Thêm mới', object: undefined});
                            }}
                        />
                    }
                />
            </Col>
            <Col span={24}>
                <FilterSpace
                    responsive={{ xs: 24, md: 24, lg: 12 }}
                    actionsPosition="bottom-right"
                    actions={
                        <>
                            <ActionButton type="refresh" variant="outlined" onClick={handleResetSearch} />
                            <ActionButton type="search" onClick={handleSearch} />
                        </>
                    }
                >
                    <SearchBox
                        value={searchDraft}
                        onChange={setSearchDraft}
                        placeholder="Tìm theo tên workspace hoặc mô tả"
                        bold
                    />
                </FilterSpace>
            </Col>
            <Col span={24}>
                <ConfigProvider
                    theme={{
                        components: {
                            Table: {
                                headerBg: "#d4a574",
                                headerSplitColor: "transparent",
                                borderColor: "transparent",
                                lineWidth: 0,
                                cellPaddingBlock: 16,
                                cellPaddingInline: 16,
                                headerBorderRadius: 4,
                            },
                        },
                    }}
                >
                    <Table
                        size={'small'}
                        rowKey={'uuid'}
                        columns={columns}
                        dataSource={items}
                        loading={loading}
                        pagination={false}
                        scroll={{x: "max-content"}}
                    />
                    <AppPagination
                        currentPage={page}
                        totalPages={totalPages}
                        totalRows={totalItems}
                        rowsPerPage={rowsPerPage}
                        rowsPerPageOptions={[5, 10, 20, 50]}
                        onRowsPerPageChange={(value) => setRowsPerPage(value)}
                        onPageChange={(nextPage) => setPage(nextPage)}
                    />
                </ConfigProvider>
            </Col>
            <ActionModal
                open={Boolean(actionModal?.open)}
                onCancel={() => {
                    form.resetFields();
                    setActionModal(undefined);
                }}
                title={actionModal?.label}
                onOk={() => {
                    void handleSubmitWorkspace();
                }}
                spinning={Boolean(actionModal?.loading)}
            >
                <Form layout="vertical" form={form}>
                    <Form.Item
                        name={'name'}
                        label={'Tên workspace'}
                        rules={[{
                            required: true,
                            message: 'Vui lòng nhập tên workspace',
                        }]}
                    >
                        <AppInput type={'text'}/>
                    </Form.Item>
                    <Form.Item name={'description'} label={'Mô tả'}>
                        <AppInput type={'textarea'}/>
                    </Form.Item>
                </Form>
            </ActionModal>

            <ConfirmModal
                open={Boolean(deleteTarget)}
                title="Xác nhận xóa workspace"
                variant="danger"
                loading={Boolean(deletingId)}
                spinning={Boolean(deletingId)}
                okText={deletePolicy === "cascade" ? "Xóa cascade" : "Xóa restrict"}
                onOk={() => {
                    void confirmDelete();
                }}
                onCancel={() => setDeleteTarget(null)}
                content={deleteTarget ? (
                    <div className="space-y-3">
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            Bạn có chắc muốn xóa workspace <span className="font-semibold text-gray-900 dark:text-white">{deleteTarget.name}</span>? Hành động này không thể hoàn tác.
                        </p>

                        <label className="flex items-start gap-2 rounded-lg border border-warning-200 bg-warning-50 p-3 text-sm text-warning-800 dark:border-warning-900/50 dark:bg-warning-900/20 dark:text-warning-200">
                            <input
                                type="checkbox"
                                checked={deletePolicy === "cascade"}
                                onChange={(event) => setDeletePolicy(event.target.checked ? "cascade" : "restrict")}
                                disabled={Boolean(deletingId)}
                                className="mt-0.5"
                            />
                            <span>
                                Bật <strong>xoá cưỡng bức (cascade)</strong>: xoá toàn bộ dữ liệu phụ thuộc trong workspace.
                                Nếu tắt, hệ thống dùng chế độ <strong>restrict</strong> và sẽ chặn xoá nếu còn dữ liệu phụ thuộc.
                            </span>
                        </label>
                    </div>
                ) : null}
            />
        </Row>
    );
}

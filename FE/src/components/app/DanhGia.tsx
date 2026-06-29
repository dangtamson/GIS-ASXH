'use client';

import { CheckCircleOutlined, CloseCircleOutlined, EyeOutlined } from "@ant-design/icons";
import {Button, Col, ConfigProvider, Dropdown, notification, Row, Table, TableColumnsType, Tag} from "antd";
import React, {useEffect, useState} from "react";
import {api, ApiError} from "@/lib/api";
import {endpoints} from "@/lib/endpoints";
import dayjs from "dayjs";
import {ResTaskType} from "@/types/tasks";
import {useRouter} from "next/navigation";
import {ApiResponse} from "@/types/api";
import {
    ActionButton,
    ConfirmModal,
    DocumentSelect,
    FieldSelect,
    FilterSpace,
    PaginationBar,
    PrioritySelect,
    SearchBox,
    TitleSpace
} from "@/components/controller";
import ActionIcon from "@/components/controller/ActionIcon";
import {resolveDisplayStatus, resolveEvaluationMeta} from "@/lib/task-display";
import type {MenuProps} from "antd";

type TaskTableRow = ResTaskType & {
    progressPercent?: number;
};

type RowActionItem = {
    key: string;
    label: string;
    icon: React.ReactNode;
    iconAction: Parameters<typeof ActionIcon>[0]["action"];
    onClick: () => void;
    danger?: boolean;
};

export default function DanhGia() {
    const [selectedPriorityId, setSelectedPriorityId] = React.useState<string | undefined>(undefined);
    const [selectedDocumentId, setSelectedDocumentId] = React.useState<string | undefined>(undefined);
    const [selectedFieldId, setSelectedFieldId] = React.useState<string | undefined>(undefined);
    const [search, setSearch] = React.useState("");
    const [currentPage, setCurrentPage] = React.useState(1);
    const [rowsPerPage, setRowsPerPage] = React.useState(10);
    const [totalRows, setTotalRows] = React.useState(0);
    const [data, setData] = React.useState<ResTaskType[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [totalPage, setTotalPage] = React.useState(0);
    const [selectedRemind, setSelectedRemind] = useState<string | null>("total");
    const [remind, setRemind] = useState({
        total: 0,
        dueSoon: 0,
        overDue: 0,
    });
    const [selectedRowKeys, setSelectedRowKeys] = React.useState<React.Key[]>([]);
    const [selectedRows, setSelectedRows] = React.useState<TaskTableRow[]>([]);
    const [batchSubmitting, setBatchSubmitting] = React.useState(false);
    const [xacNhanTarget, setXacNhanTarget] = React.useState<{
        assignIds: string[];
        label?: string;
        count: number;
        type: 'approved' | 'rejected';
        open: boolean;
    } | undefined>()

    const router = useRouter();

    const buildRowActions = (record: TaskTableRow): RowActionItem[] => [
        {
            key: "view",
            label: "Xem chi tiết",
            icon: <EyeOutlined />,
            iconAction: "view",
            onClick: () => router.push(`/danh-gia/${record.uuid}`),
        },
        {
            key: "approve",
            label: "Đạt",
            icon: <CheckCircleOutlined />,
            iconAction: "check",
            onClick: () =>
                setXacNhanTarget({
                    open: true,
                    label: `${record.title} - ${record?.organization?.name}`,
                    type: 'approved',
                    assignIds: record.uuid ? [record.uuid] : [],
                    count: 1,
                }),
        },
        {
            key: "reject",
            label: "Chưa đạt",
            icon: <CloseCircleOutlined />,
            iconAction: "reject",
            danger: true,
            onClick: () =>
                setXacNhanTarget({
                    open: true,
                    label: `${record.title} - ${record?.organization?.name}`,
                    type: 'rejected',
                    assignIds: record.uuid ? [record.uuid] : [],
                    count: 1,
                }),
        },
    ];

    const buildActionMenuItems = (actions: RowActionItem[]): MenuProps["items"] =>
        actions.map((action) => ({
            key: action.key,
            icon: action.icon,
            label: action.label,
            danger: action.danger,
            onClick: action.onClick,
        }));


    const fetchData = async (page = currentPage, limit = rowsPerPage, remind:string | null = null) => {

        setLoading(true);

        let params = `page=${page}&limit=${limit}`;

        if (selectedDocumentId)
            params += "&documentId=" + selectedDocumentId;

        if (selectedPriorityId)
            params += "&priority=" + selectedPriorityId;

        if (selectedFieldId)
            params += "&fieldId=" + selectedFieldId;

        if (search)
            params += "&search=" + search;

        if (remind)
            params += "&remind=" + remind;

        const res = await api.get<ApiResponse<ResTaskType>>(`${endpoints.admin.tasksReviews}?${params}`);



        if(res.items)
            setData(res.items);

        setSelectedRowKeys([]);
        setSelectedRows([]);

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        setRemind(res.reminds);

        if(res.pagination)
            setTotalRows(res.pagination.total ?? 0);

        setCurrentPage(page);
        if(res.pagination)
            setTotalPage(res.pagination.pages ?? 0);
        setRowsPerPage(limit);

        setLoading(false);
    };

    const selectedPendingRows = React.useMemo(
        () => selectedRows.filter((row) => row.uuid?.trim() && row.status === 'pending'),
        [selectedRows]
    );

    const selectedPendingIds = React.useMemo(
        () => selectedPendingRows.map((row) => row.uuid!.trim()),
        [selectedPendingRows]
    );

    const selectedPendingCount = selectedPendingIds.length;

    const moXacNhanHangLoat = (type: 'approved' | 'rejected') => {
        if (selectedPendingCount < 2) return;

        setXacNhanTarget({
            open: true,
            type,
            assignIds: selectedPendingIds,
            count: selectedPendingCount,
        });
    };

    const handleXacNhan = async () => {
        if (!xacNhanTarget?.assignIds?.length) {
            notification.warning(
                {
                    title: 'Cảnh báo',
                    description: `Vui lòng chọn bản ghi để ${xacNhanTarget?.type === 'approved' ? 'đánh giá đạt.' : 'đánh giá chưa đạt.'}`
                }
            )
            return;
        }

        const actionPath = xacNhanTarget.type === 'approved' ? 'approve-data' : 'reject-approval-data';
        const isBatchAction = xacNhanTarget.assignIds.length > 1;

        try {
            if (isBatchAction) {
                setBatchSubmitting(true);
                let successCount = 0;
                let failedCount = 0;

                for (const assignId of xacNhanTarget.assignIds) {
                    try {
                        await api.post(`${endpoints.admin.tasks}/${assignId}/${actionPath}`);
                        successCount += 1;
                    } catch {
                        failedCount += 1;
                    }
                }

                if (successCount > 0) {
                    notification.success({
                        title: 'Thành công',
                        description:
                            failedCount > 0
                                ? `${xacNhanTarget.type === 'approved' ? 'Đánh giá đạt' : 'Đánh giá chưa đạt'} thành công ${successCount}/${xacNhanTarget.assignIds.length} bản ghi. ${failedCount} bản ghi không xử lý được.`
                                : `${xacNhanTarget.type === 'approved' ? 'Đánh giá đạt' : 'Đánh giá chưa đạt'} thành công ${successCount} bản ghi.`
                    })
                } else {
                    notification.error({
                        title: 'Thất bại',
                        description: `Không thể ${xacNhanTarget.type === 'approved' ? 'đánh giá đạt' : 'đánh giá chưa đạt'} các bản ghi đã chọn.`
                    });
                }
            } else {
                await api.post(`${endpoints.admin.tasks}/${xacNhanTarget.assignIds[0]}/${actionPath}`);
                notification.success({
                    title: 'Thành công',
                    description: `${xacNhanTarget.type === 'approved' ? 'Đánh giá đạt' : 'Đánh giá chưa đạt'} bản ghi thành công`
                })
            }

            await fetchData();
        } catch (err) {
            if (err instanceof ApiError) {
                notification.error({
                    title: 'Thất bại',
                    description: err.message
                });
            } else {
                notification.error({
                    title: 'Thất bại',
                    description: "Thao tác thất bại."
                })
            }
        } finally {
            setBatchSubmitting(false);
            setXacNhanTarget(undefined);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void fetchData(1, 10)
    }, []);


    const baseIndex = (currentPage - 1) * 10;

    let stt = 0;
    const columns :TableColumnsType<TaskTableRow> = [
        {
            key: 'STT',
            title: 'STT',
            align: 'center',
            width: 70,
            render: (_, record) => {
                if (!record._isFirst) return null;

                stt += 1;
                return baseIndex + stt;
            },
            onCell: (record) => ({
                rowSpan: record._isFirst ? record._rowSpan : 0
            })
        },
        {
            key: 'title',
            title: 'Tên nhiệm vụ',
            dataIndex: 'title',
            width: 250,
            render: (text, record) => {
                if (!record._isFirst) return null;
                return text;
            },
            onCell: (record) => ({
                rowSpan: record._isFirst ? record._rowSpan : 0
            })
        },
        {
            key: 'taskAssignments',
            title: 'Đơn vị giao > Người thực hiện',
            width: 300,
            render: (_, record) => (
                <>
                    <div className="text-[#dc2626] text-xs">
                        {record?.assigner?.name}
                    </div>

                    <div className="text-xs">
                        Giao cho {" > "}{record?.organization?.name} {record.organization?.isCoordination ? '(Phối hợp)' : ''}
                    </div>
                </>
            )
        },
        {
            key: 'dueDate',
            dataIndex: 'dueDate', // ✅ đúng
            title: 'Hạn hoàn thành',
            width: 150,
            render: (text) => dayjs(text).format('DD/MM/YYYY')
        },
        {
            key: 'progressPercent',
            dataIndex: 'progressPercent',
            width: 150,
            title: 'Tiến độ (%)',
            render: (text) => {
                const percent = text || 0;

                // 0 = đỏ, 120 = xanh
                const color = `hsl(${(percent * 120) / 100}, 70%, 45%)`;

                return (
                    <div className="flex gap-1 items-center">
                        <div className="h-2 max-w-[90px] flex-1 rounded-full bg-gray-200">
                            <div
                                className="h-2 rounded-full transition-all"
                                style={{
                                    width: `${percent}%`,
                                    backgroundColor: color
                                }}
                            />
                        </div>
                        <span className="text-xs">{percent}%</span>
                    </div>
                );
            }
        },
        {
            key: 'status',
            dataIndex: 'status',
            width: 150,
            align: 'center',
            title: 'Trạng thái',
            render: (text, record) => {
                const status = resolveDisplayStatus(text, {
                    issuedDate: record.issuedDate,
                    startDate: record.startDate,
                });

                return (
                    <Tag className="m-0 rounded-full border-0 px-3 py-1 text-xs font-medium" style={status.style}>
                        {status.label}
                    </Tag>
                );
            }
        },
        {
            key: 'evaluationResult',
            dataIndex: 'status',
            width: 170,
            align: 'center',
            title: 'Kết quả đánh giá',
            render: (status) => {
                const evaluation = resolveEvaluationMeta(status);

                return (
                    <Tag className="m-0 rounded-full border-0 px-3 py-1 text-xs font-medium" style={evaluation.style}>
                        {evaluation.label}
                    </Tag>
                );
            }
        },
        {
            key: 'action',
            dataIndex: 'action',
            title: 'Thao tác',
            width: 160,
            align: 'center',
            render: (_, record) => {
                const actions = buildRowActions(record);
                const primaryActions = actions.slice(0, 3);
                const overflowActions = actions.slice(3);

                return (
                    <div className="flex items-center justify-center gap-1">
                        {primaryActions.map((action) => (
                            <button
                                key={action.key}
                                type="button"
                                onClick={action.onClick}
                                className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                                title={action.label}
                            >
                                <ActionIcon action={action.iconAction} />
                            </button>
                        ))}
                        {overflowActions.length > 0 ? (
                            <Dropdown
                                trigger={['click']}
                                menu={{ items: buildActionMenuItems(overflowActions) }}
                                placement="bottom"
                            >
                                <Button
                                    type="text"
                                    className="!flex !h-auto !min-w-0 !items-center !justify-center !p-0 hover:!bg-transparent"
                                    title="Thêm thao tác"
                                >
                                    <ActionIcon action="more" />
                                </Button>
                            </Dropdown>
                        ) : null}
                    </div>
                );
            }
        }
    ]

    const rowSelection = {
        selectedRowKeys,
        onChange: (nextSelectedRowKeys: React.Key[], nextSelectedRows: TaskTableRow[]) => {
            setSelectedRowKeys(nextSelectedRowKeys);
            setSelectedRows(nextSelectedRows);
        },
        getCheckboxProps: (record: TaskTableRow) => ({
            disabled: record.status !== 'pending' || !record.uuid?.trim(),
        }),
    };


    const normalBtn =
        "inline-flex max-w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-left text-sm text-gray-600 transition-colors hover:bg-gray-50";

    const activeBtn =
        "inline-flex max-w-full items-center gap-3 rounded-xl border border-[#dc2626] bg-[#dc2626] px-4 py-2.5 text-left text-sm text-white transition-colors shadow-sm";



    return <Row gutter={[16, 16]}>
        <style>
            {`
.task-start-row td {
    border-top: 0.5px solid #d1d5db !important;
}
`}
        </style>
        <Col span={24}>
            <TitleSpace title={'Nhiệm vụ cần đánh giá'} description={'Nhiệm vụ đã hoàn thành cần thực hiện đánh giá'}/>
        </Col>
        <Col span={24}>
            <FilterSpace
                actionsPosition={'bottom-center'}
                actions={
                    <>

                        <ActionButton type={'refresh'} onClick={() => {
                            setSearch("");
                            setSelectedDocumentId(undefined);
                            setSelectedFieldId(undefined);
                            setSelectedPriorityId(undefined);
                        }}/>
                        <ActionButton type={'search'}    onClick={() => fetchData(1, rowsPerPage)}/>
                    </>
                }
            >
                <SearchBox value={search} onChange={setSearch} bold/>
                <DocumentSelect onChange={setSelectedDocumentId} value={selectedDocumentId} bold/>
                <PrioritySelect onChange={setSelectedPriorityId} value={selectedPriorityId} bold/>
                <FieldSelect onChange={setSelectedFieldId} value={selectedFieldId} bold/>
            </FilterSpace>
        </Col>

        <Col span={24}>
            <Row gutter={[10, 16]}>
                <Col flex="0 1 auto" style={{ minWidth: 0 }}>
                    <button
                        onClick={() => {
                            if (selectedRemind != 'total') {
                                setSelectedRemind('total');
                                void fetchData();
                            }
                        }}
                        className={selectedRemind == 'total' ? activeBtn : normalBtn}
                    >
                        <span className="min-w-0 text-sm font-semibold leading-5">
                            Kết quả tìm kiếm
                        </span>
                        <span
                            className={
                                selectedRemind == 'total'
                                    ? "shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-[#dc2626]"
                                    : "shrink-0 rounded-full bg-[#dc2626] px-2.5 py-1 text-xs font-semibold text-white"
                            }
                        >
                        {remind?.total}
                      </span>
                    </button>
                </Col>
                {remind?.dueSoon != 0 && ( <Col flex="0 1 auto" style={{ minWidth: 0 }}>
                        <button
                            onClick={() => {
                                if (selectedRemind !== "due_soon") {
                                    setSelectedRemind("due_soon");
                                    void fetchData(1,rowsPerPage,"due_soon");
                                }
                            }}
                            className={selectedRemind === "due_soon" ? activeBtn : normalBtn}
                        >
                            <span className="min-w-0 text-sm font-semibold leading-5">
                                Nhiệm vụ tới hạn
                            </span>
                            <span
                                className={
                                    selectedRemind === "due_soon"
                                        ? "shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-[#dc2626]"
                                        : "shrink-0 rounded-full bg-[#dc2626] px-2.5 py-1 text-xs font-semibold text-white"
                                }
                            >
                              {remind.dueSoon}
                            </span>
                        </button>

                    </Col>
                )}
                {remind?.overDue != 0 && <Col flex="0 1 auto" style={{ minWidth: 0 }}>

                    <button
                        onClick={() => {
                            if (selectedRemind !== "over_due") {
                                setSelectedRemind("over_due");
                                void fetchData(1,rowsPerPage,"over_due");
                            }
                        }}
                        className={selectedRemind === "over_due" ? activeBtn : normalBtn}
                    >
                        <span className="min-w-0 text-sm font-semibold leading-5">
                            Nhiệm vụ quá hạn
                        </span>
                        <span
                            className={
                                selectedRemind === "over_due"
                                    ? "shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-[#dc2626]"
                                    : "shrink-0 rounded-full bg-[#dc2626] px-2.5 py-1 text-xs font-semibold text-white"
                            }
                        >
                              {remind.overDue}
                            </span>
                    </button>
                </Col>
                }

            </Row>

        </Col>

        {selectedPendingCount >= 2 ? (
            <Col span={24}>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#f3d4d4] bg-[#fff7f5] px-4 py-3">
                    <div className="text-sm text-gray-700">
                        Đã chọn <span className="font-semibold text-[#b91c1c]">{selectedPendingCount}</span> bản ghi chờ đánh giá.
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <ActionButton
                            type={'approve'}
                            label={'Đánh giá đạt'}
                            onClick={() => moXacNhanHangLoat('approved')}
                            loading={batchSubmitting && xacNhanTarget?.type === 'approved'}
                        />
                        <ActionButton
                            type={'reject'}
                            label={'Đánh giá chưa đạt'}
                            onClick={() => moXacNhanHangLoat('rejected')}
                            loading={batchSubmitting && xacNhanTarget?.type === 'rejected'}
                        />
                    </div>
                </div>
            </Col>
        ) : null}


        <Col span={24}>
            <ConfigProvider
                theme={{ components:
                        { Table:
                                {
                                    headerBg: "#d4a574",
                                    headerSplitColor: "transparent",
                                    borderColor: "transparent",
                                    lineWidth: 0,
                                    cellPaddingBlock:16,
                                    cellPaddingInline: 16,
                                    headerBorderRadius: 4,
                                }
                        }
                }}>
                <Table
                    rowSelection={rowSelection}
                    onRow={(record) => ({
                        className: record._isFirst ? "task-start-row" : ""
                    })}
                    size={'small'}
                    rowKey={(record) => `${record.taskId}_${record.uuid}`}
                    columns={columns}
                    dataSource={data.flatMap((task): TaskTableRow[] => {
                        if (!task.taskAssignments?.length) {
                            return [{
                                ...task,
                                _isFirst: true,
                                _rowSpan: 1
                            }];
                        }

                        return task?.taskAssignments?.map((a, index) => ({
                            ...task,
                            ...a,
                            assigner: task?.organization,
                            taskId: task?.uuid,
                            _isFirst: index === 0,
                            _rowSpan: task?.taskAssignments?.length
                        }));
                    })}
                    loading={loading}
                    pagination={false}
                    scroll={{x: "max-content"}}
                />
                <PaginationBar
                    totalRows={totalRows}
                    rowsPerPage={rowsPerPage}
                    currentPage={currentPage}
                    totalPage={totalPage}
                    onRowsPerPageChange={(value) => fetchData(1, value)}
                    onPageChange={(page) => fetchData(page, rowsPerPage)}
                />
            </ConfigProvider>
        </Col>

        <ConfirmModal open={
            Boolean(xacNhanTarget?.open)
        }
                      onOk={handleXacNhan}
                      loading={batchSubmitting}
                      onCancel={() => {
                          if (batchSubmitting) return;
                          setXacNhanTarget(undefined)
                      }}
                      okText={xacNhanTarget?.type === 'approved' ? 'Đạt' : 'Chưa đạt'}
                      content={
                          xacNhanTarget?.count && xacNhanTarget.count > 1 ? (
                              <span>
                                  Bạn có chắc chắn muốn {xacNhanTarget?.type === 'approved' ? 'đánh giá đạt ' : 'đánh giá chưa đạt '}
                                  <span className={'font-semibold'}>{xacNhanTarget.count} bản ghi đã chọn</span>?
                              </span>
                          ) : undefined
                      }
                      descriptionPrefix={`Bạn có chắc chắn muốn ${xacNhanTarget?.type === 'approved' ? 'đánh giá đạt ' : 'đánh giá chưa đạt ' }`}
                      subject={xacNhanTarget?.label}
                      descriptionSuffix={'?'}
                      variant={xacNhanTarget?.type === 'rejected' ? 'danger' : 'default'}
        />

    </Row>
}

'use client';

import { DeleteOutlined, EditOutlined, EyeOutlined, FileSearchOutlined, FileTextOutlined, SendOutlined } from "@ant-design/icons";
import {Button, Col, ConfigProvider, Dropdown, notification, Row, Table, TableColumnsType, Tag} from "antd";
import React, {useEffect, useState} from "react";
import {api, ApiError} from "@/lib/api";
import {endpoints} from "@/lib/endpoints";
import dayjs from "dayjs";
import {ResTaskType} from "@/types/tasks";
import {useRouter} from "next/navigation";
import {ApiResponse} from "@/types/api";
import DocumentInfoModal from "@/components/tasks/DocumentModal";
import ReportModal from "@/components/tasks/ReportModal";
import {
    ActionButton,
    ConfirmModal,
    DocumentSelect,
    FieldSelect,
    FilterSpace,
    PaginationBar,
    PrioritySelect,
    SearchBox,
    StatusSelect,
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

export default function NhiemVuDaGiao() {
    const [selectedStatusId, setSelectedStatusId] = React.useState<string | undefined>(undefined);
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
    const [reportModal, setReportModal] = useState<{id: string | undefined, open:boolean, title: string}>({open: false, id: undefined, title: ''})
    const [deletedTarget, setDeleteTarget] = useState<{id: string, label: string, } | undefined>()


    const [docInfoId, setDocInfoId] = React.useState<string | undefined>(undefined);
    const [isDocInfoOpen, setIsDocInfoOpen] = React.useState(false);
    const [dispatch, setDispatch] = React.useState<{
        open: boolean;
        taskId: string;
        label: string;
    }>();
    const router = useRouter();

    const openReportModal = (record: ResTaskType) => {
        setReportModal({
            id: record.taskId || record.uuid,
            open: true,
            title: record.title || ''
        });
    };

    const openDocumentModal = (record: ResTaskType) => {
        setDocInfoId(record.documentId);
        setIsDocInfoOpen(true);
    };

    const buildRowActions = (record: TaskTableRow): RowActionItem[] => {
        const items: RowActionItem[] = [
            {
                key: "view",
                label: "Xem chi tiết",
                icon: <EyeOutlined />,
                iconAction: "view",
                onClick: () => router.push(`/nhiem-vu-da-giao/${record.taskId}`),
            },
            
        ];

        if (!record.issuedDate) {
            items.push(
                {
                    key: "edit",
                    label: "Chỉnh sửa",
                    icon: <EditOutlined />,
                    iconAction: "edit",
                    onClick: () => router.push(`/nhiem-vu-da-giao/${record.taskId}/chinh-sua`),
                },
                {
                    key: "dispatch",
                    label: "Giao việc",
                    icon: <SendOutlined />,
                    iconAction: "send",
                    onClick: () =>
                        setDispatch({
                            open: true,
                            taskId: record.taskId ?? "",
                            label: String(record.title || record.taskId || "bản ghi"),
                        }),
                },
                {
                    key: "delete",
                    label: "Xóa nhiệm vụ",
                    icon: <DeleteOutlined />,
                    iconAction: "delete",
                    danger: true,
                    onClick: () =>
                        setDeleteTarget({
                            id: record.taskId ?? "",
                            label: String(record.title || record.taskId || "bản ghi"),
                        }),
                }
            );
        }

        items.push({
                key: "report",
                label: "Xem báo cáo",
                icon: <FileSearchOutlined />,
                iconAction: "report",
                onClick: () => openReportModal(record),
            },
            {
                key: "document",
                label: "Xem văn bản",
                icon: <FileTextOutlined />,
                iconAction: "document",
                onClick: () => openDocumentModal(record),
            },)

        return items;
    };

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

        if (selectedStatusId)
            params += "&status=" + selectedStatusId;

        if (selectedFieldId)
            params += "&fieldId=" + selectedFieldId;

        if (search)
            params += "&search=" + search;

        if (remind)
            params += "&remind=" + remind;

        const res = await api.get<ApiResponse<ResTaskType>>(`${endpoints.admin.tasksAssignments}?${params}`);


        if(res.items)
        setData(res.items);

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

    const handleDelete = async () => {
        if (!deletedTarget?.id?.trim()) {
            notification.warning(
                {
                    title: 'Cảnh báo',
                    description: "Vui lòng chọn bản ghi để xóa."
                }
            )
            return;
        }

        try {
            await api.delete(`${endpoints.admin.tasks}/${deletedTarget.id.trim()}`);
            notification.success({
                title: 'Thành công',
                description: 'Xóa bản ghi thành công'
            })
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
                    description: "Xóa thất bại."
                })
            }
        } finally {
            setDeleteTarget(undefined);
        }
    };

    const handleBanHanh = async () => {
        if (!dispatch?.taskId?.trim()) {
            notification.warning(
                {
                    title: 'Cảnh báo',
                    description: "Vui lòng chọn bản ghi để giao việc."
                }
            )
            return;
        }

        try {
            await api.post(`${endpoints.admin.tasks}/${dispatch?.taskId?.trim()}/send-promulgate-data`);
            notification.success({
                title: 'Thành công',
                description: 'Giao việc thành công'
            })
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
                    description: "Giao việc thất bại."
                })
            }
        } finally {
            setDispatch(undefined);
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
            title: 'Người thực hiện',
            width: 300,
            render: (_, record) => (
                <>
                    {/*<div className="text-[#dc2626] text-xs">*/}
                    {/*    {record?.assigner?.name}*/}
                    {/*</div>*/}

                    <div className="">
                        {record?.organization?.name} {record.organization?.isCoordination ? '(Phối hợp)' : ''}
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
                if (!record._isFirst) return null;
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
                                placement="bottomCenter"
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
            },
            onCell: (record) => ({
                rowSpan: record._isFirst ? record._rowSpan : 0
            })
        }
    ]



    const normalBtn =
        "flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-colors bg-white text-gray-600 hover:bg-gray-50 w-full";

    const activeBtn =
        "flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-colors bg-[#dc2626] text-white w-full";



    return <Row gutter={[16, 16]}>
        <style>
            {`
.task-start-row td {
    border-top: 0.5px solid #d1d5db !important;
}
`}
        </style>
        <Col span={24}>
            <TitleSpace title={'Nhiệm vụ đã giao'} description={'Nhiệm vụ do đơn vị giao'} actions={
                <ActionButton type={'create'} onClick={()  => router.push("/nhiem-vu-da-giao/them-moi")} />
            }/>
        </Col>
        <Col span={24}>
            <FilterSpace
                actionsPosition={'bottom-center'}
                actions={
                    <>
                        <ActionButton type={'refresh'}  onClick={() => {
                            setSearch("");
                            setSelectedDocumentId(undefined);
                            setSelectedFieldId(undefined);
                            setSelectedPriorityId(undefined);
                            setSelectedStatusId(undefined);
                        }} />
                        <ActionButton type={'search'}  onClick={() => fetchData(1, rowsPerPage)}/>
                    </>
                }
            >
                <SearchBox value={search} onChange={setSearch} bold/>
                <DocumentSelect onChange={setSelectedDocumentId} value={selectedDocumentId} bold/>
                <StatusSelect value={selectedStatusId} onChange={setSelectedStatusId} bold/>
                <PrioritySelect onChange={setSelectedPriorityId} value={selectedPriorityId} bold/>
                <FieldSelect onChange={setSelectedFieldId} value={selectedFieldId} bold/>
            </FilterSpace>
        </Col>

        {/*bộ đếm nhắc nhở*/}
        <Col span={24}>
            <Row gutter={[10, 16]}>
                <Col md={24} lg={3}>
                    <button
                        onClick={() => {
                            if (selectedRemind != 'total') {
                                setSelectedRemind('total');
                                void fetchData();
                            }
                        }}
                        className={selectedRemind == 'total' ? activeBtn : normalBtn}
                    >
                        Kết quả tìm kiếm
                        <span
                            className={
                                selectedRemind == 'total'
                                    ? "px-2 py-0.5 rounded-full bg-gray-100 text-[#dc2626] text-xs"
                                    : "px-2 py-0.5 rounded-full bg-[#dc2626] text-white text-xs"
                            }
                        >
                        {remind?.total}
                      </span>
                    </button>
                </Col>
                {remind?.dueSoon != 0 && ( <Col md={24} lg={3}>
                        <button
                            onClick={() => {
                                if (selectedRemind !== "due_soon") {
                                    setSelectedRemind("due_soon");
                                    void fetchData(1,rowsPerPage,"due_soon");
                                }
                            }}
                            className={selectedRemind === "due_soon" ? activeBtn : normalBtn}
                        >
                            Nhiệm vụ tới hạn
                            <span
                                className={
                                    selectedRemind === "due_soon"
                                        ? "px-2 py-0.5 rounded-full bg-gray-100 text-[#dc2626] text-xs"
                                        : "px-2 py-0.5 rounded-full bg-[#dc2626] text-white text-xs"
                                }
                            >
                              {remind.dueSoon}
                            </span>
                        </button>

                </Col>
                        )}
                {remind?.overDue != 0 && <Col md={24} lg={3}>

                        <button
                            onClick={() => {
                                if (selectedRemind !== "over_due") {
                                    setSelectedRemind("over_due");
                                    void fetchData(1,rowsPerPage,"over_due");
                                }
                            }}
                            className={selectedRemind === "over_due" ? activeBtn : normalBtn}
                        >
                            Nhiệm vụ quá hạn
                            <span
                                className={
                                    selectedRemind === "over_due"
                                        ? "px-2 py-0.5 rounded-full bg-gray-100 text-[#dc2626] text-xs"
                                        : "px-2 py-0.5 rounded-full bg-[#dc2626] text-white text-xs"
                                }
                            >
                              {remind.overDue}
                            </span>
                        </button>
                </Col>
                }

            </Row>

        </Col>


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
        <DocumentInfoModal open={isDocInfoOpen} onClose={() => {
            setIsDocInfoOpen(false);
            setDocInfoId(undefined);
        }} documentId={docInfoId}/>
        <ReportModal open={reportModal.open} id={reportModal?.id || ''} onClose={() => {
            setReportModal({
                id: undefined,
                open: false,
                title: ''
            })
        }} taskName={reportModal.title}/>
        <ConfirmModal
            open={Boolean(deletedTarget)}
            onOk={() => handleDelete()} onCancel={() => setDeleteTarget(undefined)}
            variant={'danger'}
            descriptionPrefix={'Bạn có chắc chắn muốn xóa'}
            subject={deletedTarget?.label}
            descriptionSuffix={'?'}
            okText={'Xóa'}

            />

        <ConfirmModal
            open={Boolean(dispatch?.open)}
            onOk={handleBanHanh}
            okText={'Giao việc'}
            onCancel={() => setDispatch(undefined)}
            descriptionPrefix={'Bạn có chắc chắn muốn giao việc'}
            subject={dispatch?.label}
            descriptionSuffix={'?'}
            />


    </Row>
}

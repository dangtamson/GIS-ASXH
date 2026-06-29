'use client';

import { EditOutlined, EyeOutlined, FileTextOutlined, InboxOutlined, SendOutlined } from "@ant-design/icons";
import {Button, Col, ConfigProvider, Dropdown, notification, Row, Table, TableColumnsType, Tag} from "antd";
import React, {useEffect, useState} from "react";
import {api, ApiError} from "@/lib/api";
import {endpoints} from "@/lib/endpoints";
import dayjs from "dayjs";
import {ResTaskType} from "@/types/tasks";
import {useRouter} from "next/navigation";
import {ApiResponse} from "@/types/api";
import DocumentInfoModal from "@/components/tasks/DocumentModal";
import {
    ActionButton,
    ConfirmModal,
    DocumentSelect,
    FieldSelect,
    FilterSpace,
    OrganizationSelect,
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


const normalBtn =
    "inline-flex max-w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-left text-sm text-gray-600 transition-colors hover:bg-gray-50";

const activeBtn =
    "inline-flex max-w-full items-center gap-3 rounded-xl border border-[#dc2626] bg-[#dc2626] px-4 py-2.5 text-left text-sm text-white transition-colors shadow-sm";


export default function NhiemVuDuocGiao() {
    const [selectedOrg, setSelectedOrg] = React.useState<string | undefined>(undefined);
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

    const [docInfoId, setDocInfoId] = React.useState<string | undefined>(undefined);
    const [isDocInfoOpen, setIsDocInfoOpen] = React.useState(false);
    const [remind, setRemind] = useState({
        total: 0,
        dueSoon: 0,
        overDue: 0,
    });

    const [submit, setSubmit] = React.useState<{
        open: boolean;
        taskId: string;
        label: string;
    }>()
    const router = useRouter();
    const [tiepNhanNhiemVu, setTiepNhanNhiemVu] = React.useState<{taskId: string, assignId: string, open: boolean, label: string} | undefined>();

    const openDocumentModal = (record: ResTaskType) => {
        setDocInfoId(record.documentId);
        setIsDocInfoOpen(true);
    };

    const buildRowActions = (record: TaskTableRow): RowActionItem[] => {
        const isWorkflowLocked = ['pending', 'approved', 'rejected'].includes(record.status ?? '');
        const items: RowActionItem[] = [
            {
                key: "view",
                label: "Xem chi tiết",
                icon: <EyeOutlined />,
                iconAction: "view",
                onClick: () => router.push(`/nhiem-vu-duoc-giao/${record.taskId}/${record.uuid}`),
            },
            {
                key: "document",
                label: "Xem văn bản",
                icon: <FileTextOutlined />,
                iconAction: "document",
                onClick: () => openDocumentModal(record),
            },
        ];

        if (record.startDate && !isWorkflowLocked) {
            items.push({
                key: "edit",
                label: "Ghi nhật ký",
                icon: <EditOutlined />,
                iconAction: "edit",
                onClick: () => router.push(`/nhiem-vu-duoc-giao/${record.taskId}/${record.uuid}/chinh-sua`),
            });
        }

        if (record.status === 'completed') {
            items.push({
                key: "submit",
                label: "Gửi phê duyệt",
                icon: <SendOutlined />,
                iconAction: "send",
                onClick: () =>
                    setSubmit({
                        open: true,
                        taskId: record.taskId ?? "",
                        label: String(record.title || record.taskId || "bản ghi"),
                    }),
            });
        }

        if (!record.startDate) {
            items.push({
                key: "receive",
                label: "Tiếp nhận nhiệm vụ",
                icon: <InboxOutlined />,
                iconAction: "receive",
                onClick: () =>
                    setTiepNhanNhiemVu({
                        open: true,
                        taskId: record.taskId ?? "",
                        assignId: record.uuid ?? "",
                        label: String(record.title || record.taskId || "bản ghi"),
                    }),
            });
        }

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


    const fetchData = async (page = currentPage, limit = rowsPerPage,remind:string | null = null) => {

        setLoading(true);

        let params = `page=${page}&limit=${limit}&isAssigned=true`;

        if (selectedDocumentId)
            params += "&documentId=" + selectedDocumentId;

        if (selectedOrg)
            params += "&organizationId=" + selectedOrg;

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

        const res = await api.get<ApiResponse<ResTaskType>>(`${endpoints.admin.tasksAssigned}?${params}`);


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

    const handleTiepNhan = async () => {
        setLoading(true);
        try {
            await api.post(`${endpoints.admin.tasks}/${tiepNhanNhiemVu?.taskId}/receive`)
            void fetchData(currentPage, rowsPerPage)
            setTiepNhanNhiemVu(undefined)
        }
        catch {

            notification.error({
                title: 'Lỗi tiếp nhận',
                description: 'Tiếp nhận nhiệm vụ thất bại',
            })
        }
        finally {
            setLoading(false);
        }
    }

    const handleGuiPheDuyet = async () => {
        if (!submit?.taskId?.trim()) {
            notification.warning(
                {
                    title: 'Cảnh báo',
                    description: "Vui lòng chọn bản ghi để gửi phê duyệt."
                }
            )
            return;
        }

        try {
            await api.post(`${endpoints.admin.tasks}/${submit?.taskId?.trim()}/send-approval-data`);
            notification.success({
                title: 'Thành công',
                description: 'Gửi phê duyệt nhiệm vụ thành công'
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
                    description: "Gửi phê duyệt nhiệm vụ thất bại."
                })
            }
        } finally {
            setSubmit(undefined);
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

            },
            onCell: (record) => ({
                rowSpan: record._isFirst ? record._rowSpan : 0
            })
        }
    ]

    return <Row gutter={[16, 16]}>
        <style>
            {`
.task-start-row td {
    border-top: 0.5px solid #d1d5db !important;
}
`}
        </style>
        <Col span={24}>
            {/*<h2 className={'text-xl mb-4 font-semibold'}></h2>*/}
            <TitleSpace title={'Nhiệm vụ được giao'} description={'Nhiệm vụ giao cho đơn vị'}/>
        </Col>
        <Col span={24}>
            <FilterSpace
                actionsPosition={'bottom-center'}
                actions={
                <>

                    <ActionButton type={'refresh'} onClick={() => {
                        setSearch("");
                        setSelectedDocumentId(undefined);
                        setSelectedOrg(undefined);
                        setSelectedFieldId(undefined);
                        setSelectedPriorityId(undefined);
                        setSelectedStatusId(undefined);
                    }}/>
                    <ActionButton type={'search'} onClick={() => fetchData(1, rowsPerPage)} />

                </>
            }
                >
                <SearchBox value={search} onChange={setSearch} bold/>
                <DocumentSelect onChange={setSelectedDocumentId} value={selectedDocumentId} bold/>
                <OrganizationSelect
                    value={selectedOrg}
                    onChange={setSelectedOrg}
                    bold
                />
                <StatusSelect value={selectedStatusId} onChange={setSelectedStatusId} bold/>
                <PrioritySelect onChange={setSelectedPriorityId} value={selectedPriorityId} bold/>
                <FieldSelect onChange={setSelectedFieldId} value={selectedFieldId} bold/>
            </FilterSpace>
        </Col>
        {/*bộ đếm nhắc nhở*/}
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
                    rowKey="uuid"
                    columns={columns}
                    dataSource={ data.flatMap((task): TaskTableRow[] => {
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
                            taskId: task.uuid,
                            assigner: task?.organization,
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
        <ConfirmModal
            open={Boolean(tiepNhanNhiemVu?.open)}
            onCancel={() => {
                setTiepNhanNhiemVu(undefined)
            }}
            okText={'Tiếp nhận nhiệm vụ'}
            onOk={() => {
                handleTiepNhan()
            }}
            descriptionPrefix={'Bạn có chắc chắn muốn tiếp nhận nhiệm vụ'}
            subject={tiepNhanNhiemVu?.label}
            descriptionSuffix={'?'}
        />
        <ConfirmModal
            open={Boolean(submit?.open)}
            onCancel={() => {
                setSubmit(undefined)
            }}
            onOk={() => {
                handleGuiPheDuyet()
            }}
            descriptionPrefix={'Bạn có chắc chắn muốn gửi phê duyệt nhiệm vụ'}
            subject={submit?.label}
            descriptionSuffix={'?'}
            okText={'Gửi'}

        />
    </Row>
}

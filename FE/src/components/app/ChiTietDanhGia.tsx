'use client'

import {Avatar, Card, Col, Empty, Input, notification, Progress, Row, Space, Spin, Typography} from "antd";
import {ResTaskType, TaskAssignment} from "@/types/tasks";
import {api, ApiError} from "@/lib/api";
import {ApiResponse, FileUploadType} from "@/types/api";
import {endpoints} from "@/lib/endpoints";
import React, {type ReactNode, useCallback, useEffect, useRef, useState} from "react";
import {useParams, useRouter} from "next/navigation";
import {FileText, MessageSquare, Pencil, Search} from "lucide-react";
import dayjs from "dayjs";
import {PRIORITY_OPTIONS, STATUS_OPTIONS} from "@/lib/task-options";
import DocumentInfoComponent from "@/components/tasks/DocumentComponent";
import DiscussionComponent, {DiscussionRef} from "@/components/tasks/DiscussionComponent";
import FilesDisplayComponents from "@/components/tasks/FilesDisplayComponents";
import {ActionButton, AppPagination, ConfirmModal} from "@/components/controller";

type DetailTab = "basic" | "progress" | "discussion" | "document" | "history";

export default function ChiTietNhiemVuDanhGia() {
    const {id} = useParams()
    const [loading, setLoading] = useState<boolean>(false);

    const [task, setTask] = useState<ResTaskType>();
    const [assignedTask, setAssignedTask] = useState<TaskAssignment>();
    const [activeTab, setActiveTab] = useState<DetailTab>("progress");
    const [xacNhanTarget, setXacNhanTarget] = React.useState<{
        label: string;
        type: 'approved' | 'rejected';
        open: boolean;
    } | undefined>()

    const router = useRouter()

    const binhLuanRef = useRef<DiscussionRef>(null);


    const getTask = useCallback(async () => {
        setLoading(true);
        try {
            const assignRes = await api.get<ApiResponse<TaskAssignment>>(`${endpoints.admin.taskAssignments}/${id}`);
            if (!assignRes.item) {
                throw new Error("Không tìm thấy bản ghi phân công.");
            }

            setAssignedTask(assignRes.item);

            const res = await api.get<ApiResponse<ResTaskType>>(
                `${endpoints.admin.tasks}/${assignRes.item.taskId}`
            );

            if (!res.item) {
                throw new Error("Không tìm thấy thông tin nhiệm vụ.");
            }

            setTask(res.item);

        } catch (err) {
            notification.error({
                title: 'Lỗi!',
                description: err instanceof Error ? err.message : "Lỗi khi lấy nhiệm vụ"
            });
        }
        finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        void getTask();
    }, [getTask]);


    const tabs: Array<{ key: DetailTab; label: string; icon: ReactNode }> = [];

    tabs.push({key: "basic", label: "Thông tin cơ bản", icon: <FileText className="h-4 w-4"/>})

    tabs.push({key: 'progress', label: 'Quá trình xử lý', icon: <Pencil className="h-4 w-4"/>})

    tabs.push({
        key: "discussion",
        label: "Nội dung trao đổi",
        icon: (
            <span className="flex items-center gap-1">
            <MessageSquare className="h-4 w-4"/>
                </span>
        ),
    })
    tabs.push({key: "document", label: "Thông tin văn bản", icon: <Search className="h-4 w-4"/>})
    // tabs.push({ key: "history", label: "Lịch sử", icon: <Search className="h-4 w-4" /> })

    const renderMain = (task: ResTaskType, activeTab: string) => {
        if (activeTab === "basic") {
            return <ThongTinCoBan task={task}/>;
        }
        else if (activeTab === "progress") {
            return <QuaTrinhXuLy taskAssign={assignedTask!} />
        }
        else if (activeTab === 'document') {
            return <DocumentInfoComponent documentId={task.documentId}/>;
        }
        else if(activeTab === 'discussion')
            return <DiscussionComponent taskId={task.uuid} ref={binhLuanRef} showInput={false} />

        return <div></div>;
    };

    const handleXacNhan = async () => {
        if (!id) {
            notification.warning(
                {
                    title: 'Cảnh báo',
                    description: `Vui lòng chọn bản ghi để ${xacNhanTarget?.type === 'approved' ? 'đánh giá đạt.' : 'đánh giá chưa đạt.'}`
                }
            )
            return;
        }

        try {
            await api.post(`${endpoints.admin.tasks}/${(id || '')}/${xacNhanTarget?.type === 'approved' ? 'approve-data' : 'reject-approval-data'}`);
            notification.success({
                title: 'Thành công',
                description: `${xacNhanTarget?.type === 'approved' ? 'Đánh giá đạt' : 'Đánh giá chưa đạt'} bản ghi thành công`
            })
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
            router.back()
            setXacNhanTarget(undefined);
        }
    };



    return (
        <Spin spinning={loading} size={'large'}>
            <Row gutter={[16, 16]}>
                <Col span={24}>
                    <div
                        className={'bg-gradient-to-r from-[#b91c1c] to-[#dc2626] rounded-2xl text-white p-4 sm:p-5 shadow-sm'}>
                        <h2 className={'text-lg sm:text-xl font-semibold'}>Nhiệm vụ cần đánh giá</h2>
                        <span className={'text-sm text-white/90 mt-1'}>{task?.title}</span>
                    </div>

                </Col>

                <Col span={24}>
                    <Card>
                        <div className="overflow-x-auto">
                            <div className="flex min-w-max gap-2">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() => setActiveTab(tab.key)}
                                        className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${
                                            activeTab === tab.key
                                                ? "bg-[#dc2626] text-white"
                                                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
                                        }`}
                                    >
                                        {tab.icon}
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </Card>
                </Col>
                <Col span={24}>
                    <Card>
                        {task && renderMain(task, activeTab)}
                    </Card>
                </Col>

                <div className={'sticky bottom-0 w-full flex gap-2 justify-center p-3 border-t bg-[#f5f0e8]'}>

                    <ActionButton type={'close'} onClick={() => router.back()}  />
                    <ActionButton type={'approve'} label={'Đạt'} onClick={() => setXacNhanTarget({
                        open: true,
                        label: task?.title || 'nhiệm vụ này',
                        type: 'approved',
                    })}  />
                    <ActionButton type={'reject'} label={'Chưa đạt'} onClick={() => setXacNhanTarget({
                        open: true,
                        label: task?.title || 'nhiệm vụ này',
                        type: 'rejected',
                    })}   />
                </div>
            </Row>
            <ConfirmModal open={
                Boolean(xacNhanTarget?.open)
            }
                          onOk={handleXacNhan}
                          onCancel={() => {
                              setXacNhanTarget(undefined)
                          }}
                          okText={xacNhanTarget?.type === 'approved' ? 'Đạt' : 'Chưa đạt'}
                          descriptionPrefix={`Bạn có chắc chắn muốn ${xacNhanTarget?.type === 'approved' ? 'đánh giá đạt ' : 'đánh giá chưa đạt ' }`}
                          subject={xacNhanTarget?.label}
                          descriptionSuffix={'?'}
                          variant={xacNhanTarget?.type === 'rejected' ? 'danger' : 'default'}
            />
        </Spin>
    );
}


function ThongTinCoBan({task}: { task: ResTaskType }) {
    return <Row gutter={[16, 16]}>
        <Col lg={12} md={24}>
            <label>
                <span>Tên nhiệm vụ</span>
                <Input value={task?.title} disabled/>
            </label>
        </Col>
        <Col lg={12} md={24}>
            <span>Mức độ ưu tiên</span>
            <Input value={PRIORITY_OPTIONS.find(e => e.value === task?.priority)?.label} disabled/>
        </Col>
        <Col lg={12} md={24}>
            <span>Đơn vị thực hiện</span>
            <Input value={task?.taskAssignments?.map(e => e?.organization?.name).filter(e => e).join(', ')}/>
        </Col>
        <Col lg={12} md={24}>
            <span>Trạng thái</span>
            <Input value={STATUS_OPTIONS.find(e => e.value === task?.status)?.label} disabled/>
        </Col>
        <Col lg={12} md={24}>
            <span>Ngày ban hành</span>
            <Input value={dayjs(task?.issuedDate).format('DD/MM/YYYY')} disabled/>
        </Col>
        <Col lg={12} md={24}>
            <span>Hạn hoàn thành</span>
            <Input value={dayjs(task?.dueDate).format('DD/MM/YYYY')} disabled/>
        </Col>
        <Col span={24}>
            <span>Nội dung</span>
            <Input value={task?.description} disabled/>
        </Col>
    </Row>
}

type TaskAssignProgress = {
    uuid: string,
    attachments: FileUploadType[],
    createdAt: string,
    createdBy: {
        uuid: string,
        fullName: string,
    },
    organizationId: string,
    progressPercent: number
    updatedBy: string,
    comment: string,
}

function getProgressColor(value?: number): string {
    const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
    const hue = (safeValue * 120) / 100;
    return `hsl(${hue}, 70%, 45%)`;
}

function ProgressHistoryCard({item}: {item: TaskAssignProgress}) {
    const progressColor = getProgressColor(item.progressPercent);

    return (
        <Card size="small" styles={{body: {padding: 14}}} style={{width: '100%', borderRadius: 12}}>
            <Space orientation="vertical" size={10} style={{width: '100%'}}>
                <div className="flex items-start justify-between gap-3">
                    <Space size={10} align="start">
                        <Avatar style={{background: '#f3f4f6', color: '#111827'}}>
                            {item.createdBy.fullName?.charAt(0)?.toUpperCase()}
                        </Avatar>
                        <div>
                            <Typography.Text strong>
                                {item.createdBy.fullName}
                            </Typography.Text>
                            <div className="text-xs text-gray-500">
                                {dayjs(item.createdAt).format('DD/MM/YYYY HH:mm')}
                            </div>
                        </div>
                    </Space>
                    <div
                        className="rounded-full px-2.5 py-1 text-xs font-medium text-white"
                        style={{backgroundColor: progressColor}}
                    >
                        {item.progressPercent}%
                    </div>
                </div>

                <Progress
                    percent={item.progressPercent}
                    size="small"
                    strokeColor={progressColor}
                    showInfo={false}
                />

                <Typography.Paragraph
                    ellipsis={{rows: 2, expandable: true, symbol: 'Xem thêm'}}
                    style={{marginBottom: 0}}
                >
                    {item.comment || 'Không có nội dung cập nhật'}
                </Typography.Paragraph>

                {item.attachments?.length > 0 ? (
                    <FilesDisplayComponents files={item.attachments} orientation="horizontal" />
                ) : null}
            </Space>
        </Card>
    );
}

function QuaTrinhXuLy({ taskAssign }: { taskAssign: TaskAssignment }) {
    const [progresses, setProgresses] = useState<TaskAssignProgress[]>([])
    const [loading, setLoading] = useState(false)

    const [page, setPage] = useState(1)
    const [limit, setLimit] = useState(10)
    const [total, setTotal] = useState(0)

    const getProgresses = useCallback(async (page: number, limit: number) => {
        setLoading(true)
        try {
            const res = await api.get<ApiResponse<TaskAssignProgress>>(
                `${endpoints.admin.taskAssignmentProgress}?page=${page}&limit=${limit}&taskAssignmentId=${taskAssign.uuid}`
            )

            setProgresses(res.items ?? [])
            setTotal(res.pagination?.total ?? 0)
        }
        catch {
            notification.error({
                title: 'Lỗi',
                description: 'Lấy quá trình xử lý lỗi'
            })
        }
        finally {
            setLoading(false)
        }
    }, [taskAssign.uuid])

    useEffect(() => {
        if (taskAssign) void getProgresses(page, limit)
    }, [getProgresses, taskAssign, page, limit])

    const currentProgress = progresses[0]?.progressPercent ?? 0
    const currentProgressColor = getProgressColor(currentProgress)

    return (
        <Spin spinning={loading}>
            <Card
                size="small"
                title="Quá trình xử lý"
                extra={<div className="text-xs text-gray-500">{total > 0 ? `${total} cập nhật` : ''}</div>}
            >
                <div className="mb-4 grid gap-3 grid-cols-1 md:grid-cols-3">
                    <div className="rounded-xl border border-gray-200 bg-white p-3">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Tiến độ hiện tại</div>
                        <div className="mt-2 text-2xl font-semibold" style={{color: currentProgressColor}}>
                            {currentProgress}%
                        </div>
                        <Progress percent={currentProgress} showInfo={false} strokeColor={currentProgressColor} />
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-3">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Tổng cập nhật</div>
                        <div className="mt-2 text-2xl font-semibold text-gray-900">{total}</div>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-3">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Cập nhật mới nhất</div>
                        <div className="mt-2 text-sm font-medium text-gray-900">
                            {progresses[0]?.createdBy?.fullName || '--'}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                            {progresses[0]?.createdAt ? dayjs(progresses[0].createdAt).format('DD/MM/YYYY HH:mm') : '--'}
                        </div>
                    </div>
                </div>

                {progresses.length === 0 ? (
                    <Empty description="Chưa có cập nhật tiến độ" />
                ) : (
                    <>
                        <div className="space-y-3">
                            {progresses.map((item) => (
                                <ProgressHistoryCard key={item.uuid} item={item} />
                            ))}
                        </div>
                        <div className="mt-4 flex justify-end">
                            {total > limit && (
                                <AppPagination
                                    currentPage={page}
                                    totalPages={Math.max(1, Math.ceil(total / limit))}
                                    totalRows={total}
                                    rowsPerPage={limit}
                                    rowsPerPageOptions={[5, 10, 20]}
                                    summaryLabel={`Có ${total} cập nhật`}
                                    pageSizeSuffix="cập nhật/trang"
                                    onRowsPerPageChange={(nextLimit) => {
                                        setLimit(nextLimit);
                                        setPage(1);
                                    }}
                                    onPageChange={(nextPage) => {
                                        setPage(nextPage);
                                    }}
                                />
                            )}
                        </div>
                    </>
                )}
            </Card>
        </Spin>
    )
}

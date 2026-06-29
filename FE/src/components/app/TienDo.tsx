'use client'

import {Avatar, Card, Col, Empty, Input, notification, Progress, Row, Space, Spin, Typography} from "antd";
import React, {forwardRef, useCallback, useImperativeHandle, useState} from "react";
import {api} from "@/lib/api";
import {endpoints} from "@/lib/endpoints";
import {ApiResponse, FileUploadType} from "@/types/api";
import {AppPagination} from "@/components/controller";
import UploadAttachmentsField, {AttachmentType} from "@/components/controller/input/UploadAttachmentField";
import FilesDisplayComponents from "@/components/tasks/FilesDisplayComponents";
import dayjs from "dayjs";
import {ChevronDown, ChevronUp} from "lucide-react";

export type TienDoRef = {
    submit: () => Promise<void>;
};

type Props = {
    assignId: string | undefined,
    readOnly: boolean,
    setPercentProgress?: (progress: undefined | number) => void,
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
    progressPercent: number,
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
            <Space direction="vertical" size={10} style={{width: '100%'}}>
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

const TienDo = forwardRef<TienDoRef, Props>(
    ({assignId, readOnly, setPercentProgress}, ref) => {

        const [progressPercent, setProgressPercent] = React.useState<number | undefined>( 0);
        const [comment, setComment] = React.useState<string | undefined>('');
        const [loading, setLoading] = useState(false);
        const [attachments, setAttachments] = useState<AttachmentType[]>([])
        const [progresses, setProgresses] = useState<TaskAssignProgress[]>([])
        const [page, setPage] = useState(1)
        const [limit, setLimit] = useState(10)
        const [total, setTotal] = useState(0)
        const [historyExpanded, setHistoryExpanded] = useState(readOnly)
        const currentProgressColor = getProgressColor(progressPercent);

    const getCurrentProgress = async () => {
        setLoading(true)
        const res = await api.get<ApiResponse<{ progressPercent: number }>>(`${endpoints.admin.taskAssignmentProgress}?taskAssignmentId=${assignId}&limit=1`)
        if(res.items) {
            setProgressPercent(res?.items[0]?.progressPercent || 0)
            setPercentProgress?.(res.items[0]?.progressPercent || 0);
        }
        setLoading(false)
    }

    const getProgresses = useCallback(async (nextPage: number, nextLimit: number) => {
        if (!assignId) {
            setProgresses([]);
            setTotal(0);
            return;
        }

        setLoading(true);
        try {
            const res = await api.get<ApiResponse<TaskAssignProgress>>(
                `${endpoints.admin.taskAssignmentProgress}?page=${nextPage}&limit=${nextLimit}&taskAssignmentId=${assignId}`
            );

            setProgresses(res.items ?? []);
            setTotal(res.pagination?.total ?? 0);
        } catch {
            notification.error({
                title: 'Lỗi',
                description: 'Lấy lịch sử tiến độ lỗi'
            });
        } finally {
            setLoading(false);
        }
    }, [assignId]);

    const submit = async () => {
        try {
            setLoading(true)
            await api.post(`${endpoints.admin.taskAssignmentProgress}`, {
                taskAssignmentId: assignId,
                progressPercent,
                comment,
                attachments
            })
            setComment('')
            setAttachments([])
            setProgressPercent(0)
            setPercentProgress?.(0)
            notification.success({title: 'Thành công', description: 'Ghi tiến độ thành công.'})
            getCurrentProgress()
            getProgresses(page, limit)
        } catch (error) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            notification.error({title: 'Lỗi', description: String(error.message ?? 'Lỗi lưu tiến độ')});
        }
        finally {
            setLoading(false)
        }
    }

    useImperativeHandle(ref, () => ({submit}))


    React.useEffect(() => {
        setPage(1);
        getCurrentProgress()
    }, [assignId])

    React.useEffect(() => {
        setHistoryExpanded(readOnly);
    }, [readOnly]);

    React.useEffect(() => {
        if (!assignId) {
            return;
        }

        getProgresses(page, limit);
    }, [assignId, getProgresses, page, limit])

    return <Spin spinning={loading} size={'large'}>
        <Row gutter={[16, 16]}>
            <Col span={24}>
                <Card
                    size="small"
                    title="Quá trình xử lý"
                    extra={
                        <div className="flex items-center gap-3">
                            <div className="text-xs text-gray-500">
                                {total > 0 ? `${total} cập nhật` : ''}
                            </div>
                            {!readOnly ? (
                                <button
                                    type="button"
                                    onClick={() => setHistoryExpanded((prev) => !prev)}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#dc2626] transition hover:bg-red-50"
                                    title={historyExpanded ? 'Thu gọn' : 'Mở rộng'}
                                    aria-label={historyExpanded ? 'Thu gọn' : 'Mở rộng'}
                                >
                                    {historyExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </button>
                            ) : null}
                        </div>
                    }
                >
                    {(readOnly || historyExpanded) ? (
                        <>
                            <div className={`mb-4 grid gap-3 ${readOnly ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                                <div className="rounded-xl border border-gray-200 bg-white p-3">
                                    <div className="text-xs uppercase tracking-wide text-gray-500">Tiến độ hiện tại</div>
                                    <div className="mt-2 text-2xl font-semibold" style={{color: currentProgressColor}}>
                                        {progressPercent ?? 0}%
                                    </div>
                                    <Progress percent={progressPercent ?? 0} showInfo={false} strokeColor={currentProgressColor} />
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
                        </>
                    ) : (
                        <div className="py-2 text-sm text-gray-500">
                            Lịch sử cập nhật đang được thu gọn. Bấm &quot;Mở rộng&quot; để xem chi tiết.
                        </div>
                    )}
                </Card>
            </Col>
            {!readOnly ? (
                <Col span={24}>
                    <Card size="small" title="Cập nhật tiến độ">
                        <Row gutter={[16, 16]} align="top">
                            <Col xs={24} lg={8}>
                                <div className="">
                                    <label className="block">
                                        <span className="mb-2 block text-sm font-medium text-gray-700">% Tiến độ</span>
                                        <Input
                                            max={100}
                                            min={0}
                                            type={"number"}
                                            disabled={readOnly}
                                            style={{width: '100%'}}
                                            value={progressPercent}
                                            onChange={(e) => {
                                                const raw = e.target.value;
                                                if (raw === '') {
                                                    setProgressPercent(undefined);
                                                    setPercentProgress?.(undefined);
                                                    return;
                                                }
                                                const val = Number(raw);
                                                if (!isNaN(val) && val >= 0 && val <= 100) {
                                                    setProgressPercent(val);
                                                    setPercentProgress?.(val);
                                                }
                                            }}
                                            placeholder={'Nhập % tiến độ'}
                                        />
                                        </label>
                                        <div className="mt-4">
                                            <Progress percent={progressPercent ?? 0} strokeColor={currentProgressColor} />
                                        </div>
                                    </div>
                                </Col>
                            <Col xs={24} lg={24}>
                                <label className="block">
                                    <span className="mb-2 block text-sm font-medium text-gray-700">Nội dung báo cáo</span>
                                    <Input.TextArea
                                        disabled={readOnly}
                                        value={comment}
                                        onChange={e => setComment(e.target.value)}
                                        rows={3}
                                        placeholder="Nhập nội dung báo cáo"
                                    />
                                </label>
                            </Col>
                            <Col span={24}>
                                <label className="block">
                                    <span className="mb-2 block text-sm font-medium text-gray-700">Kết quả dạng file</span>
                                    <UploadAttachmentsField value={attachments} onChange={(e) => setAttachments(e)} />
                                </label>
                            </Col>
                        </Row>
                    </Card>
                </Col>
            ) : null}


        </Row>
    </Spin>
}
);

TienDo.displayName = "TienDo";

export default TienDo;

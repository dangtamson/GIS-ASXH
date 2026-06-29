'use client'

import {Avatar, Col, Input, notification, Row, Button, Empty} from "antd";
import React, {forwardRef, useImperativeHandle} from "react";
import {api} from "@/lib/api";
import {endpoints} from "@/lib/endpoints";
import {ApiResponse} from "@/types/api";
import {TaskComment} from "@/types/tasks";
import dayjs from "dayjs";
import AppEmpty from "@/components/common/AppEmpty";
import {AppInput, AppPagination} from "@/components/controller";

export type DiscussionRef = {
    submit: () => Promise<void>;
};

type Props = {
    taskId?: string,
    showInput?: boolean,
}

const DiscussionComponent = forwardRef<DiscussionRef, Props>(({taskId, showInput}, ref) => {
    const [content, setContent] = React.useState<string | undefined>(undefined);
    const [comments, setComments] = React.useState<TaskComment[]>([]);
    const [total, setTotal] = React.useState(0);
    const [page, setPage] = React.useState(1);
    const [limit] = React.useState(5);

    const layBinhLuan = async (page: number, limit: number) => {
        const res =  await api.get<ApiResponse<TaskComment>>(`${endpoints.admin.taskComments}?page=${page}&limit=${limit}&taskId=${taskId}`);
        setComments(res.items || []);
        setTotal(res.pagination?.total || 0);
    }

    const submit = async () => {
        try {
            await api.post(`${endpoints.admin.taskComments}`, {
                taskId: taskId,
                content,
            })
            setContent('')
            notification.success({title: 'Thành công', description: 'Ghi bình luận thành công.'})
            setPage(1);
            void layBinhLuan(1, limit);

        } catch (error) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            notification.error({title: 'Lỗi', description: String(error.message ?? 'Lỗi lưu bình luận')});
        }
    }

    useImperativeHandle(ref, () => ({submit}))

        React.useEffect(() => {
            void layBinhLuan(page, limit);
        }, [page, taskId]);

    return (
        <Row gutter={[16,16]}>
            {(!comments || comments.length === 0) ? (
                <Col span={24}>
                    <AppEmpty />
                </Col>
            ) : (
                comments.map((comment) => (
                    <Col key={comment.uuid} span={24}>
                        <div className={`flex gap-3 mb-3`}>
                            <Avatar>{comment.account?.fullName?.charAt(0)?.toUpperCase()}</Avatar>
                            <div className={`w-full`}>
                                <div className={'flex items-center justify-between gap-2 text-gray-400 text-xs'}>
                                    <span className={'font-medium text-gray-800'}>{comment.account?.fullName}</span>
                                    <span>{dayjs(comment.createdAt).format('DD/MM/YYYY HH:mm')}</span>
                                </div>

                                <div className={`mt-1 p-3 rounded bg-red-300/10 text-gray-900`}>
                                    {comment.content}
                                </div>
                            </div>
                        </div>
                    </Col>
                ))
            )}

            {comments && comments.length > 0 && total > limit && (
                <Col span={24}>
                    <div className="flex justify-center">
                        <AppPagination
                            currentPage={page}
                            totalPages={Math.max(1, Math.ceil(total / limit))}
                            totalRows={total}
                            rowsPerPage={limit}
                            summaryLabel={`Có ${total} bình luận`}
                            pageSizeSuffix="bình luận/trang"
                            align="center"
                            onPageChange={(nextPage) => setPage(nextPage)}
                        />
                    </div>
                </Col>
            )}

            {showInput !== false && (
                <Col span={24}>
                    <AppInput type={'textarea'} value={content} onChange={e => setContent(e)}
                                  placeholder={'Nhập bình luận'}/>
                </Col>
            )}
        </Row>
    )
}
);

DiscussionComponent.displayName = "DiscussionComponent";

export default DiscussionComponent

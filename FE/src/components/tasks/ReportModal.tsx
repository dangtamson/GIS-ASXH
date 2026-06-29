'use client';

import {ConfigProvider, Modal, notification, Spin, Table, TableColumnsType} from "antd";
import React, {useEffect, useState} from "react";
import {api} from "@/lib/api";
import {ApiResponse, FileUploadType} from "@/types/api";
import {endpoints} from "@/lib/endpoints";
import { Eye, Download } from "lucide-react";
import { Tag, Space, Tooltip } from "antd";
import {formatFileSize, getFileExtension} from "@/components/controller/input/UploadAttachmentField";
import dayjs from "dayjs";
import FilesDisplayComponents from "@/components/tasks/FilesDisplayComponents";

type Props = {id?: string, open?: boolean, onClose: () => void, taskName: string}

type AssignmentProgress = {
    organization?: {
        uuid?: string;
        name?: string;
    };
    progressPercent?: number;
    comments?: string;
    attachments?: FileUploadType[];
};

export default function ReportModal({id, open, onClose, taskName}: Props) {
    const [loading, setLoading] = useState<boolean>(false);
    const [taskAssignmentProgresses, setTaskAssignmentProgresses] = useState<AssignmentProgress[]>([]);


    const getAssignments = async () => {
        setLoading(true)
        try {
            const assignmentRes = await api.get<ApiResponse<never>>(`${endpoints.admin.taskAssignmentProgress}?groupBy=organization&taskId=${id}`)
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            setTaskAssignmentProgresses(assignmentRes.items)
        }
        catch (error) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            notification.error({title: 'Lỗi', description: error.message as string});
        }
        finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if(open && id)
            void getAssignments()
        return () => {
            setLoading(false)
            setTaskAssignmentProgresses([])
        }
    }, [open, id])



    const columns:TableColumnsType<AssignmentProgress> = [
        {
            key: 'STT',
            title: 'STT',
            render: (_, __, index: number) => index + 1,
            width: 50,
            align: 'center',
        },
        {
            key: 'organization',
            dataIndex: ['organization', 'name'],
            width: 250,
            title: 'Đơn vị',
        },
        {
            key: 'progressPercent',
            dataIndex: 'progressPercent',
            title: 'Tiến độ',
            width: 150,
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
            key: 'startDate',
            dataIndex: 'startDate',
            title: 'Ngày tiếp nhận',
            width: 150,
            render: (text) => text ? dayjs(text).format('DD/MM/YYYY') : <span className={'text-gray-400 italic'}>Chưa tiếp nhận</span>
        },
        {
            key: 'finishDate',
            dataIndex: 'finishDate',
            title: 'Ngày hoàn thành',
            width: 150,
            render: (text) => text ? dayjs(text).format('DD/MM/YYYY') : <span className={'text-gray-400 italic'}>Chưa hoàn thành</span>
        },
        {
            key: 'assignedAt',
            dataIndex: 'assignedAt',
            title: 'Hạn xử lý',
            width: 150,
            render: (text) => text ? dayjs(text).format('DD/MM/YYYY') : 'Chưa hoàn thành'
        },
        {
            key: 'comments',
            dataIndex: 'comments',
            title: 'Nội dung xử lý',
            width: 300
        },
        {
            key: 'attachments',
            dataIndex: 'attachments',
            title: 'Đính kèm',
            width: 250,
            render: (text:FileUploadType[],) => <FilesDisplayComponents files={text}/>
        }
    ];

    return <Spin spinning={loading} size={'large'} >
        <Modal open={open} cancelText={'Đóng'} onCancel={onClose}
               width={'80vw'} title={taskName || 'Báo cáo nhiệm vụ'}  okButtonProps={{ style: { display: "none" } }}>
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
                    size={'small'}
                    rowKey={(record) => `${record.organization?.uuid || "org"}`}
                    columns={columns}
                    dataSource={taskAssignmentProgresses}
                    loading={loading}
                    pagination={false}
                    scroll={{x: "max-content"}}
                />
            </ConfigProvider>
        </Modal>
    </Spin>
}
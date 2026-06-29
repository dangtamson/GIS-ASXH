'use client'

import {ResTaskType} from "@/types/tasks";
import {Avatar, Card, Col, Progress, Row, Space, Spin, Typography, notification} from "antd";
import {api} from "@/lib/api";
import {ApiResponse, FileUploadType} from "@/types/api";
import {endpoints} from "@/lib/endpoints";
import React from "react";
import dayjs from "dayjs";
import FilesDisplayComponents from "@/components/tasks/FilesDisplayComponents";
import { Collapse } from 'antd'
import AppEmpty from "@/components/common/AppEmpty";

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

type AssignmentProgressData = {
    items: TaskAssignProgress[],
    total: number
}

function getProgressColor(value?: number): string {
    const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
    const hue = (safeValue * 120) / 100;
    return `hsl(${hue}, 70%, 45%)`;
}

function ProgressHistoryCard({item}: { item: TaskAssignProgress }) {
    const progressColor = getProgressColor(item.progressPercent);

    return (
        <Col md={24} lg={24}>
        <Card size="small" styles={{body: {padding: 14}}} style={{borderRadius: 12}}>
            <Space orientation="vertical" size={10} style={{width: "100%"}}>
                <div className="flex items-start justify-between gap-3">
                    <Space size={10} align="start">
                        <Avatar style={{background: "#f3f4f6", color: "#111827"}}>
                            {item.createdBy.fullName?.charAt(0)?.toUpperCase() || "U"}
                        </Avatar>
                        <div>
                            <Typography.Text strong>
                                {item.createdBy.fullName || "Người cập nhật"}
                            </Typography.Text>
                            <div className="text-xs text-gray-500">
                                {dayjs(item.createdAt).format("DD/MM/YYYY HH:mm")}
                            </div>
                        </div>
                    </Space>
                    <div
                        className="rounded-full px-2.5 py-1 text-xs font-medium text-white"
                        style={{backgroundColor: progressColor}}
                    >
                        {item.progressPercent ?? 0}%
                    </div>
                </div>

                <Progress
                    percent={item.progressPercent ?? 0}
                    size="small"
                    strokeColor={progressColor}
                    showInfo={false}
                />

                <Typography.Paragraph
                    ellipsis={{rows: 2, expandable: true, symbol: "Xem thêm"}}
                    style={{marginBottom: 0}}
                >
                    {item.comment || "Không có nội dung cập nhật"}
                </Typography.Paragraph>

                {item.attachments?.length > 0 ? (
                    <FilesDisplayComponents files={item.attachments} orientation="horizontal" />
                ) : null}
            </Space>
        </Card>
        </Col>
    );
}

export default function TienDoNhiemVu({task}: { task: ResTaskType }) {
    const [progressMap, setProgressMap] = React.useState<Record<string, AssignmentProgressData>>({});

    React.useEffect(() => {
        const fetchAllProgresses = async () => {
            if (!task.taskAssignments?.length) return;

            try {
                const results = await Promise.all(
                    task.taskAssignments.map(async (assignment) => {
                        if (!assignment.uuid) {
                            return null;
                        }

                        const res = await api.get<ApiResponse<TaskAssignProgress>>(
                            `${endpoints.admin.taskAssignmentProgress}?page=1&limit=5&taskAssignmentId=${assignment.uuid}`
                        );

                        return {
                            assignId: assignment.uuid,
                            items: res.items ?? [],
                            total: res.pagination?.total ?? 0
                        };
                    })
                );

                const map: Record<string, AssignmentProgressData> = {};
                results.forEach((result) => {
                    if (!result?.assignId) {
                        return;
                    }

                    map[result.assignId] = {
                        items: result.items,
                        total: result.total
                    };
                });

                setProgressMap(map);
            } catch {
                notification.error({
                    title: "Lỗi",
                    description: "Không lấy được danh sách tiến độ"
                });
            }
        };

        fetchAllProgresses();
    }, [task.taskAssignments]);

    const sortedAssignments = React.useMemo(() => {
        if (!task.taskAssignments) return [];

        return [...task.taskAssignments].sort((a, b) => {
            const aId = a.uuid;
            const bId = b.uuid;

            const aData = aId ? progressMap[aId] : undefined;
            const bData = bId ? progressMap[bId] : undefined;

            // 1. Ưu tiên không phối hợp trước
            if (a.organization?.isCoordination !== b.organization?.isCoordination) {
                return a.organization?.isCoordination ? 1 : -1;
            }

            // 2. Có tiến độ lên trên
            const aHasProgress = (aData?.items?.length ?? 0) > 0;
            const bHasProgress = (bData?.items?.length ?? 0) > 0;

            if (aHasProgress !== bHasProgress) {
                return aHasProgress ? -1 : 1;
            }

            return 0;
        });
    }, [task.taskAssignments, progressMap]);

    return (
        <Row gutter={[16, 16]}>
            {sortedAssignments.map((assignment, index) => {
                const assignmentId = assignment.uuid;
                const data = assignmentId ? progressMap[assignmentId] : undefined;

                return (
                    <Col span={24} key={assignmentId ?? assignment.organization?.uuid ?? assignment.organization?.name ?? "assignment"}>
                        <Collapse
                            items={[
                                {
                                    key: assignmentId,
                                    label: (
                                        <div className="flex items-center gap-2">
                                            <span>{assignment.organization?.name}</span>
                                            {assignment.organization?.isCoordination && (
                                                <span className="italic text-gray-500">(phối hợp)</span>
                                            )}
                                        </div>
                                    ),
                                    children: !data ? (
                                        <Spin />
                                    ) : data.items.length === 0 ? (
                                        <AppEmpty  />
                                    ) : (
                                        <Row gutter={[16, 16]}>
                                            {data.items.map((item) => (
                                                <ProgressHistoryCard key={item.uuid} item={item} />
                                            ))}
                                        </Row>
                                    )
                                }
                            ]}
                        />
                    </Col>
                );
            })}
        </Row>
    );
}

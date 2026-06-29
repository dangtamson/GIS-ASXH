'use client'

import {Card, Col, Input, notification, Row} from "antd";
import {ResTaskType} from "@/types/tasks";
import {api} from "@/lib/api";
import {ApiResponse} from "@/types/api";
import {endpoints} from "@/lib/endpoints";
import React, {type ReactNode, useEffect, useRef, useState} from "react";
import {useParams, useRouter} from "next/navigation";
import {CalendarCheck, FileText, MessageSquare, Pencil, Search} from "lucide-react";
import dayjs from "dayjs";
import {PRIORITY_OPTIONS, STATUS_OPTIONS} from "@/lib/task-options";
import DocumentInfoComponent from "@/components/tasks/DocumentComponent";
import TienDo, {TienDoRef} from "@/components/app/TienDo";
import DiscussionComponent, {DiscussionRef} from "@/components/tasks/DiscussionComponent";
import {ActionButton} from "@/components/controller";
import TienDoNhiemVu from "@/components/tasks/TienDoNhiemVu";

type DetailTab = "basic" | "progress" | "discussion" | "document" | "history" | "multi-progress";

type AssignmentDetail = {
    uuid?: string;
    status?: string;
    startDate?: string | null;
};

const getDefaultDetailTab = (readOnly: boolean): DetailTab => (readOnly ? "basic" : "progress");

export default function ChiTietNhiemVuDuocGiao({readOnly = true, label}: { readOnly?: boolean, label?: string | undefined }) {
    const {id} = useParams()
    const {assignId} = useParams()

    const [task, setTask] = useState<ResTaskType>();
    const [assignedTask, setAssignedTask] = useState<AssignmentDetail>();
    const [activeTab, setActiveTab] = useState<DetailTab>(getDefaultDetailTab(readOnly));
    const router = useRouter()

    const tienDoRef = useRef<TienDoRef>(null);
    const binhLuanRef = useRef<DiscussionRef>(null);
    const [percentProgress, setPercentProgress] = useState<number | undefined>()
    const isWorkflowLocked = ['pending', 'approved', 'rejected'].includes(assignedTask?.status ?? '');

    const getTask = async () => {
        try {
            const res = await api.get<ApiResponse<ResTaskType>>(
                `${endpoints.admin.tasks}/${id}`
            );

            if(assignId) {
                const assignRes = await api.get<ApiResponse<AssignmentDetail>>(`${endpoints.admin.taskAssignments}/${assignId}`);
                setAssignedTask(assignRes.item);
            }
            setTask(res.item);

        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Không thể tải chi tiết nhiệm vụ.";
            notification.error({title:'Lỗi!',description: message});
        }
    };

    const handleTiepNhan = async () => {
        try {
            await api.post(`${endpoints.admin.tasks}/${id}/receive`)
            notification.success({title: 'Thành công', description: 'Tiếp nhận thành công!'})
            void getTask()
        }
        catch {

            notification.error({
                title: 'Lỗi tiếp nhận',
                description: 'Tiếp nhận nhiệm vụ thất bại',
            })
        }
    }

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void getTask();
    }, []);


    const statusSteps = [
        {key: "new", label: "Chờ tiếp nhận"},
        {key: "in_progress", label: "Đang thực hiện"},
        {key: "completed", label: "Hoàn thành"},
        {key: "pending", label: "Chờ phê duyệt"},
        {key: "rejected", label: "Từ chối"},
        {key: "approved", label: "Đã phê duyệt"},
    ] as const;

    const tabs: Array<{ key: DetailTab; label: string; icon: ReactNode }> = [];

    tabs.push({key: "basic", label: "Thông tin cơ bản", icon: <FileText className="h-4 w-4"/>})
    if(!label)
        tabs.push({key: "progress", label: "Tiến độ (Đơn vị thực hiện / phối hợp)", icon: <Pencil className="h-4 w-4"/>})
    else
        tabs.push({key: "multi-progress", label: 'Tiến độ chi tiết', icon: <CalendarCheck className={'h-4 w-4'} />})
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

    useEffect(() => {
        if (label && activeTab === "progress") {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setActiveTab("basic");
        }
    }, [activeTab, label]);

    const renderMain = (task: ResTaskType, activeTab: string) => {
        if (activeTab === "basic") {
            return <ThongTinCoBan task={task}/>;
        } else if (activeTab === "progress") {
            return <TienDo assignId={assignId as string} readOnly={readOnly || isWorkflowLocked} ref={tienDoRef} setPercentProgress={setPercentProgress}/>
        } else if (activeTab === 'document') {
            return <DocumentInfoComponent documentId={task.documentId}/>;
        }
        else if(activeTab === 'discussion')
            return <DiscussionComponent taskId={task.uuid} ref={binhLuanRef} showInput={!readOnly && !isWorkflowLocked}/>
        else if(activeTab === 'multi-progress') {
            return <TienDoNhiemVu task={task}/>
        }

        return <div></div>;
    };




    const handleSave = async () => {
        if (activeTab === "progress") {
            await tienDoRef.current?.submit();
            await getTask()
        }
        if (activeTab === "discussion") {
            await binhLuanRef.current?.submit();
        }
    }

    const handleSaveAndSubmit = async () => {
        if (isWorkflowLocked) {
            notification.warning({
                title: 'Cảnh báo',
                description: 'Nhiệm vụ đã kết thúc quy trình đánh giá, không thể gửi lại.'
            });
            return;
        }

        if (activeTab === "progress") {
            await tienDoRef.current?.submit();
            await api.post(`${endpoints.admin.tasks}/${id}/send-approval-data`);
            await getTask()
        }
    }

    return (
        <Row gutter={[16, 16]}>
            <Col span={24}>
                <div
                    className={'bg-gradient-to-r from-[#b91c1c] to-[#dc2626] rounded-2xl text-white p-4 sm:p-5 shadow-sm'}>
                    <h2 className={'text-lg sm:text-xl font-semibold'}>{label ? label : (readOnly ? 'Chi tiết nhiệm vụ được giao' : 'Cập nhật nhiệm vụ được giao')}</h2>
                    <span className={'text-sm text-white/90 mt-1'}>{task?.title}</span>
                    {
                        label ? null : <div className="mt-4 hidden items-center text-xs md:flex">
                            {statusSteps.map((stepItem, index) => (
                                <div key={stepItem.key} className={`flex min-w-0 flex-1 items-center `}>
                                    <div
                                        className={`
                                        w-full rounded-lg px-3 py-2 text-center transition-all duration-200
                                        ${assignedTask?.status === stepItem.key
                                            ? 'bg-white text-[#dc2626] font-semibold shadow-md scale-105'
                                            : 'bg-white/10 text-white/80'}
                                      `}
                                    >
                                        {stepItem.label}
                                    </div>
                                    {index < statusSteps.length - 1 ?
                                        <div className="mx-1 h-0.5 min-w-[12px] flex-1 bg-white/30"/> : null}
                                </div>
                            ))}
                        </div>
                    }
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
                    <Card>
                        {task && renderMain(task, activeTab)}
                    </Card>
                </
                    Card>
            </Col>
            <div className={'sticky bottom-0 w-full flex gap-2 justify-center p-3 border-t bg-[#f5f0e8]'}>
                <ActionButton type={'close'} onClick={() => router.back()}/>
                {assignId && !assignedTask?.startDate && <ActionButton type={'save'} label={'Tiếp nhận'} onClick={handleTiepNhan}/>}
                {!readOnly && assignedTask?.status === 'in_progress' && activeTab === 'progress' && <ActionButton type={'save'} onClick={handleSave}/>}
                {!readOnly && (percentProgress == 100) && (assignedTask?.status === 'in_progress' || assignedTask?.status === 'completed') && activeTab === 'progress'
                    && <ActionButton type={'send'} label={'Lưu và chuyển duyệt'} onClick={handleSaveAndSubmit}/>}
                {!readOnly && !isWorkflowLocked && assignedTask?.status !== 'new' && activeTab === 'discussion' && <ActionButton type={'create'} label={'Thêm bình luận'} onClick={handleSave}/>}
            </div>
        </Row>
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
            <Input  disabled value={task?.taskAssignments?.map(e => e?.organization?.name).filter(e => e).join(', ')}/>
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

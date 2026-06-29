'use client'

import React, {useEffect, useState} from "react";
import {ProgressType, ResTaskType} from "@/types/tasks";
import {endpoints} from "@/lib/endpoints";
import {api} from "@/lib/api";
import {ApiResponse} from "@/types/api";
import {DonVi} from "@/types/organizations";
import {Col, Row, Tree} from "antd";

type Props = {
    task: ResTaskType
}

export default function DanhSachTienDo({task}: Props) {
    const [progressList, setProgressList] = useState<(ProgressType | undefined)[]>([])

    const getProgressList = async () => {
        try {

            const tienDoRaw =
                await api.get<ApiResponse<ProgressType>>(
                    `${endpoints.admin.taskProgress}?taskId=${task.uuid}&limit=100&page=1&groupBy=organization`
                );

            const donViRaw =
                await api.get<ApiResponse<DonVi>>(
                    `${endpoints.admin.organizations}?limit=100&page=1`
                );
            const merged = tienDoRaw?.items?.map(
                (item: ProgressType) => {

                    const org =
                        donViRaw?.items?.find(
                            (d: DonVi) =>
                                d.uuid === item.organizationId
                        );

                    return {
                        ...item,
                        organization: org,
                    };
                }
            ) || [];


            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            setProgressList(merged as ProgressType);

        } catch (error) {
            console.log(error);
        }
    };

    useEffect(() => {
        const load = async () => {
            await getProgressList();
        };

        void load();
    }, [task]);

    return <Tree defaultExpandAll={false} treeData={ [
        {
            title: task?.title || 'Nhiệm vụ',
            key: "root",
            children: progressList.map((e, index) => ({
                key: index,
                title: (
                    <div className="flex items-center gap-4">

                    <span className="w-[200px]">
                        {e?.organization?.name || "Cơ quan"}
                    </span>

                        <div className="flex items-center gap-2">

                            <div className="h-2 w-[150px] rounded-full bg-gray-200">
                                <div
                                    className="h-2 rounded-full bg-blue-500"
                                    style={{
                                        width: `${e?.progressPercent || 0}%`,
                                    }}
                                />
                            </div>

                            <span>
                            {e?.progressPercent || 0}%
                        </span>

                        </div>

                    </div>
                ),
            })),
        },
    ]}/>

}
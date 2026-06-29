"use client";

import {api, ApiError} from "@/lib/api";
import {endpoints} from "@/lib/endpoints";
import type {HouseholdAssessment, PoorHousehold, PovertyMarker} from "@/types/poverty";
import PovertyAssessmentTimelinePanel from "@/components/poverty/PovertyAssessmentTimelinePanel";
import {App, Modal} from "antd";
import {useEffect, useState} from "react";

type TimelineHousehold = Pick<PoorHousehold, "id" | "code" | "headFullName"> | Pick<PovertyMarker, "id" | "code" | "headFullName">;

type Props = {
    household: TimelineHousehold | null;
    open: boolean;
    onClose: () => void;
};

export default function PovertyAssessmentTimelineModal({household, open, onClose}: Props) {
    const {notification} = App.useApp();
    const [loading, setLoading] = useState(false);
    const [assessments, setAssessments] = useState<HouseholdAssessment[]>([]);

    useEffect(() => {
        if (!open || !household?.id) {
            setAssessments([]);
            return;
        }

        let cancelled = false;
        setLoading(true);

        void api.get<{items?: HouseholdAssessment[]}>(endpoints.poverty.householdAssessments(household.id))
            .then((data) => {
                if (!cancelled) setAssessments(data.items ?? []);
            })
            .catch((error) => {
                if (cancelled) return;
                notification.error({
                    message: "Không thể tải timeline đánh giá",
                    description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
                });
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [household?.id, notification, open]);

    return (
        <Modal
            title={null}
            open={open}
            onCancel={onClose}
            footer={null}
            width={980}
            style={{maxWidth: "calc(100vw - 32px)"}}
            styles={{body: {paddingTop: 18, maxHeight: "calc(100vh - 120px)", overflowY: "auto"}}}
        >
            <PovertyAssessmentTimelinePanel household={household} assessments={assessments} loading={loading} />
        </Modal>
    );
}

"use client";

import { api, ApiError } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { HouseholdSupport, PoorHousehold, PovertyMarker } from "@/types/poverty";
import PovertySupportTimelinePanel from "@/components/poverty/PovertySupportTimelinePanel";
import { App, Modal } from "antd";
import { useEffect, useState } from "react";

type TimelineHousehold = Pick<PoorHousehold, "id" | "code" | "headFullName"> | Pick<PovertyMarker, "id" | "code" | "headFullName">;

type Props = {
    household: TimelineHousehold | null;
    open: boolean;
    onClose: () => void;
};

export default function PovertySupportTimelineModal({ household, open, onClose }: Props) {
    const { notification } = App.useApp();
    const [loading, setLoading] = useState(false);
    const [supports, setSupports] = useState<HouseholdSupport[]>([]);

    useEffect(() => {
        if (!open || !household?.id) {
            return;
        }

        let cancelled = false;
        const loadingTimer = window.setTimeout(() => {
            if (!cancelled) setLoading(true);
        }, 0);

        void api.get<{ items?: HouseholdSupport[] }>(endpoints.poverty.householdSupports(household.id))
            .then((data) => {
                if (!cancelled) setSupports(data.items ?? []);
            })
            .catch((error) => {
                if (cancelled) return;
                notification.error({
                    message: "Không thể tải timeline hỗ trợ",
                    description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
                });
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
            window.clearTimeout(loadingTimer);
        };
    }, [household?.id, notification, open]);

    return (
        <Modal
            title={null}
            open={open}
            onCancel={onClose}
            footer={null}
            width={980}
            style={{ maxWidth: "calc(100vw - 32px)" }}
            styles={{ body: { paddingTop: 18, maxHeight: "calc(100vh - 120px)", overflowY: "auto" } }}
        >
            <PovertySupportTimelinePanel supports={supports} loading={loading} />
        </Modal>
    );
}

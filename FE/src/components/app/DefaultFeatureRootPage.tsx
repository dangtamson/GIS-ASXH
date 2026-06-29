"use client";

import DashboardOverview from "@/components/app/DashboardOverview";
import { api } from "@/lib/api";
import { getAccount, getWorkspaceId } from "@/lib/auth";
import {
    getCurrentRoleId,
    normalizeAdminFeatures,
    normalizeRoleFeatures,
} from "@/lib/default-feature-access";
import { selectDefaultFeaturePath } from "@/lib/default-feature";
import { extractList } from "@/lib/data-utils";
import { endpoints } from "@/lib/endpoints";
import { Spin } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type SystemConfigResponse = {
    item?: {
        general?: {
            defaultFeatureId?: string | null;
        };
    };
};

export default function DefaultFeatureRootPage() {
    const router = useRouter();
    const [resolving, setResolving] = useState(true);
    const [showFallback, setShowFallback] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const resolveDefaultPage = async () => {
            try {
                const account = getAccount();
                const workspaceId = getWorkspaceId();
                const roleId = getCurrentRoleId(account, workspaceId);
                const isSuperAdmin = Boolean(account?.isSuperAdmin);
                const [configResponse, featureResponse] = await Promise.all([
                    api.get<SystemConfigResponse>(endpoints.admin.systemConfig),
                    isSuperAdmin
                        ? api.get<unknown>(endpoints.admin.features)
                        : roleId
                            ? api.get<unknown>(endpoints.admin.getRoleFeatures(roleId))
                            : Promise.resolve([]),
                ]);

                const rawFeatures = extractList<unknown>(featureResponse);
                const accessibleFeatures = isSuperAdmin
                    ? normalizeAdminFeatures(rawFeatures)
                    : normalizeRoleFeatures(rawFeatures);
                const target = selectDefaultFeaturePath(
                    accessibleFeatures,
                    configResponse.item?.general?.defaultFeatureId
                );

                if (cancelled) return;
                if (target) {
                    router.replace(target);
                    return;
                }

                setShowFallback(true);
            } catch {
                if (!cancelled) {
                    setShowFallback(true);
                }
            } finally {
                if (!cancelled) {
                    setResolving(false);
                }
            }
        };

        void resolveDefaultPage();

        return () => {
            cancelled = true;
        };
    }, [router]);

    if (resolving && !showFallback) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <Spin tip="Đang mở trang mặc định..." />
            </div>
        );
    }

    return <DashboardOverview />;
}

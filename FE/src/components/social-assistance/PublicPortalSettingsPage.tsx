"use client";

import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { SocialAssistancePage } from "./SocialAssistanceLayout";
import type { SocialAssistancePublicPortal } from "@/types/social-assistance";
import { Alert, App, Button, Spin, Switch, Tag } from "antd";
import { Copy, ExternalLink, Globe } from "lucide-react";
import { useEffect, useState } from "react";

type PortalResponse = { item: SocialAssistancePublicPortal };
type PortalFlag = "intakeEnabled" | "programsEnabled" | "resultsEnabled";

export default function PublicPortalSettingsPage() {
    const { message } = App.useApp();
    const [portal, setPortal] = useState<SocialAssistancePublicPortal | null>(null);
    const [origin, setOrigin] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<PortalFlag | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setOrigin(window.location.origin);
        void api.get<PortalResponse>(endpoints.socialAssistance.publicPortal)
            .then((response) => {
                setPortal(response.item);
            })
            .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Không thể tải cổng công khai."))
            .finally(() => setLoading(false));
    }, []);

    const updateFlag = async (flag: PortalFlag, enabled: boolean) => {
        setSaving(flag);
        setError(null);
        try {
            const response = await api.put<PortalResponse>(endpoints.socialAssistance.publicPortal, { [flag]: enabled });
            setPortal(response.item);
            message.success("Đã cập nhật cổng công khai.");
        } catch (updateError) {
            setError(updateError instanceof Error ? updateError.message : "Không thể cập nhật cổng công khai.");
        } finally {
            setSaving(null);
        }
    };

    const portalPath = portal?.publicAlias || portal?.publicSlug;
    const portalUrl = portalPath && origin ? `${origin}/an-sinh/${encodeURIComponent(portalPath)}` : "";
    const intakeUrl = portalPath && origin ? `${origin}/an-sinh/${encodeURIComponent(portalPath)}/dang-ky?source=WEBSITE` : "";

    const copyLink = async () => {
        if (!intakeUrl) return;
        try {
            await navigator.clipboard.writeText(intakeUrl);
            message.success("Đã sao chép liên kết đăng ký.");
        } catch {
            message.error("Không thể sao chép liên kết.");
        }
    };

    return (
        <SocialAssistancePage title="Cổng thông tin công khai" icon={Globe} actions={portalUrl ? <Button href={portalUrl} target="_blank" icon={<ExternalLink size={16} />}>Xem cổng công khai</Button> : null}>

            {error ? <Alert type="error" showIcon message={error} /> : null}
            <Spin spinning={loading}>
                {portal ? (
                    <section className="divide-y divide-slate-200 border-y border-slate-200 bg-white">
                        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                            <div>
                                <p className="font-medium text-slate-900">Tiếp nhận yêu cầu</p>
                                <p className="mt-1 text-sm text-slate-500">Mở biểu mẫu công khai cho người dân.</p>
                            </div>
                            <div className="flex items-center gap-3"><Tag color={portal.intakeEnabled ? "green" : "default"}>{portal.intakeEnabled ? "Đang mở" : "Tạm đóng"}</Tag><Switch aria-label="Mở tiếp nhận yêu cầu" checked={portal.intakeEnabled} loading={saving === "intakeEnabled"} disabled={saving !== null} onChange={(value) => void updateFlag("intakeEnabled", value)} /></div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                            <div>
                                <p className="font-medium text-slate-900">Chương trình và đăng ký ủng hộ</p>
                                <p className="mt-1 text-sm text-slate-500">Cho phép xem chương trình và gửi cam kết tiền/hiện vật.</p>
                            </div>
                            <div className="flex items-center gap-3"><Tag color={portal.programsEnabled ? "green" : "default"}>{portal.programsEnabled ? "Đang mở" : "Tạm đóng"}</Tag><Switch aria-label="Mở chương trình và đăng ký ủng hộ" checked={portal.programsEnabled} loading={saving === "programsEnabled"} disabled={saving !== null} onChange={(value) => void updateFlag("programsEnabled", value)} /></div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                            <div>
                                <p className="font-medium text-slate-900">Kết quả giám sát</p>
                                <p className="mt-1 text-sm text-slate-500">Cho phép xem số liệu đã được duyệt công khai.</p>
                            </div>
                            <div className="flex items-center gap-3"><Tag color={portal.resultsEnabled ? "green" : "default"}>{portal.resultsEnabled ? "Đang mở" : "Tạm đóng"}</Tag><Switch aria-label="Mở kết quả giám sát" checked={portal.resultsEnabled} loading={saving === "resultsEnabled"} disabled={saving !== null} onChange={(value) => void updateFlag("resultsEnabled", value)} /></div>
                        </div>
                        <div className="space-y-3 p-4">
                            <div>
                                <p className="font-medium text-slate-900">URL portal theo tỉnh/thành</p>
                                <p className="mt-1 text-sm text-slate-500">Địa chỉ cổng thông tin của đơn vị.</p>
                            </div>
                            <p className="break-all font-mono text-xs text-slate-600">{portalUrl || portal.publicAlias || portal.publicSlug}</p>
                            <div className="border-t border-slate-100 pt-3">
                                <div>
                                    <p className="font-medium text-slate-900">Liên kết đăng ký</p>
                                    <p className="mt-1 break-all font-mono text-xs text-slate-600">{intakeUrl || portal.publicSlug}</p>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <Button icon={<Copy size={15} />} disabled={!portal.intakeEnabled || !intakeUrl} onClick={() => void copyLink()}>
                                        Sao chép liên kết
                                    </Button>
                                    <Button
                                        icon={<ExternalLink size={15} />}
                                        disabled={!portal.intakeEnabled || !intakeUrl}
                                        href={intakeUrl || undefined}
                                        target="_blank"
                                    >
                                        Mở thử
                                    </Button>
                                </div>
                                <p className="text-xs text-slate-500">Liên kết dùng chung cho website, Facebook và Zalo OA. Hồ sơ chỉ hiển thị cho cán bộ có quyền đến khi được xác minh.</p>
                            </div>
                        </div>
                    </section>
                ) : null}
            </Spin>
        </SocialAssistancePage>
    );
}
"use client";

import { buildPublicAreaAdministrativeSections } from "@/components/poverty/poverty-public-area-modal-utils";
import type { PublicPovertyAreaDetailResponse } from "@/types/poverty";
import { Button, Modal } from "antd";
import { Building2, LandPlot, MapPinned, Phone, Shield, X } from "lucide-react";

type PovertyPublicAreaAdministrativeModalProps = {
    open: boolean;
    onClose: () => void;
    area: PublicPovertyAreaDetailResponse["area"] | null;
};

export default function PovertyPublicAreaAdministrativeModal({
    open,
    onClose,
    area,
}: PovertyPublicAreaAdministrativeModalProps) {
    const sections = buildPublicAreaAdministrativeSections(area);
    const quickStats = [
        {
            key: "code",
            icon: <MapPinned size={16} />,
            label: "Mã khu vực",
            value: area?.code || "Chưa cập nhật",
        },
        {
            key: "area",
            icon: <LandPlot size={16} />,
            label: "Diện tích",
            value: area?.naturalArea ? `${area.naturalArea} ha` : "Chưa cập nhật",
        },
        {
            key: "contact",
            icon: <Phone size={16} />,
            label: "Liên hệ chính",
            value: area?.hamletHeadPhone || area?.secretaryPhone || "Chưa cập nhật",
        },
    ];

    return (
        <Modal
            open={open}
            onCancel={onClose}
            footer={null}
            title={null}
            width={680}
            rootClassName="public-area-administrative-modal"
            closeIcon={<X size={18} className="text-white/80" />}
            styles={{
                body: { padding: 0, overflow: "hidden" },
            }}
            style={{ maxWidth: "calc(100vw - 32px)" }}
        >
            <div className="public-area-administrative-modal__surface overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)]">
                <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.18),_transparent_26%),linear-gradient(135deg,#1d4ed8,#2563eb_46%,#60a5fa_100%)] px-6 py-6 text-white">
                    <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(255,255,255,0.06),rgba(255,255,255,0.06))]" />
                    <div className="relative">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/14 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur">
                                    <Building2 size={20} />
                                </span>
                                <div>
                                    <p className="mt-3 text-xl font-semibold tracking-tight">Thông tin hành chính - Địa lý</p>
                                    <p className="mt-1 text-sm text-white/78">{area?.name || "Khu vực/Ấp công khai"}</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 grid gap-3 md:grid-cols-3">
                            {quickStats.map((item) => (
                                <div
                                    key={item.key}
                                    className="rounded-[1.35rem] border border-white/14 bg-white/12 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-sm"
                                >
                                    <div className="flex items-center gap-2 text-white/76">
                                        {item.icon}
                                        <span className="text-xs font-semibold uppercase tracking-[0.18em]">{item.label}</span>
                                    </div>
                                    <p className="mt-3 text-base font-semibold text-white">{item.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-white px-6 py-6 md:px-7">
                    <div className="grid gap-4 xl:grid-cols-1">
                        {sections.map((section) => (
                            <section
                                key={section.key}
                                className="rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-[0_16px_32px_rgba(15,23,42,0.05)]"
                            >
                                <div className="flex items-start gap-3">
                                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                                        {section.key === "personnel" ? <Phone size={18} /> : <LandPlot size={18} />}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-lg font-semibold text-slate-900">{section.title}</p>
                                        <p className="mt-1 text-sm leading-6 text-slate-500">{section.description}</p>
                                    </div>
                                </div>

                                <div className="mt-5 space-y-3">
                                    {section.items.map((row) => (
                                        <div
                                            key={row.label}
                                            className="rounded-2xl border border-slate-100 bg-white/90 px-4 py-3 shadow-sm"
                                        >
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                                {row.label}
                                            </p>
                                            <p className="mt-2 text-sm font-medium leading-6 text-slate-800">
                                                {row.value}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                </div>
            </div>
        </Modal>
    );
}

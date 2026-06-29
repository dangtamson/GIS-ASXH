"use client";

import { useCommandDashboardStore } from "./useCommandDashboardStore";
import { BarChart3, Cloud, Flame, Layers, PanelLeftClose, Rotate3D } from "lucide-react";

const actions = [
    { key: "cloud" as const, label: "Mây", icon: Cloud },
    { key: "rotation" as const, label: "Hiệu ứng nền", icon: Rotate3D },
    { key: "mode" as const, label: "Panel", icon: PanelLeftClose },
    { key: "heat" as const, label: "Vùng nhiệt", icon: Flame },
    { key: "bar" as const, label: "Cột dữ liệu", icon: BarChart3 },
];

const baseLayerLabels = {
    terrain: "Địa hình",
    roadmap: "Giao thông",
    satellite: "Vệ tinh",
};

function FooterBackground() {
    return (
        <svg viewBox="0 0 1920 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
            <defs>
                <linearGradient id="poverty-command-footer" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#fff7ed" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#fff7ed" stopOpacity="0.95" />
                </linearGradient>
            </defs>
            <path
                d="M0,100 H1920 V100 Q1600,100 1450,100 Q1300,80 1200,60 Q960,10 720,60 Q620,80 470,100 Q320,100 0,100 Z"
                fill="url(#poverty-command-footer)"
            />
            <path
                d="M0,100 Q320,100 470,100 Q620,80 720,60 Q960,10 1200,60 Q1300,80 1450,100 Q1600,100 1920,100"
                fill="none"
                stroke="#ff6715"
                strokeOpacity="0.45"
            />
            <path d="M720,60 Q960,10 1200,60" fill="none" stroke="#ff6715" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

export default function CommandDashboardActions() {
    const state = useCommandDashboardStore();

    return (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[104px]">
            <FooterBackground />
            <div className="pointer-events-auto absolute bottom-5 left-1/2 flex -translate-x-1/2 items-end justify-center gap-4 sm:gap-6">
                <button
                    type="button"
                    aria-label="Đổi lớp nền"
                    title={`Lớp nền: ${baseLayerLabels[state.baseLayer]}`}
                    onClick={state.cycleBaseLayer}
                    className={[
                        "relative inline-flex items-center justify-center rounded-xl border transition-all duration-300",
                        "h-12 w-12 overflow-hidden text-orange-700 shadow-lg backdrop-blur",
                        "hover:-translate-y-1 hover:scale-105 hover:border-orange-500 hover:text-orange-500 hover:shadow-orange-400/40",
                        "mb-1 h-14 w-14 border-orange-500 bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-orange-500/40",
                    ].join(" ")}
                >
                    <span className="absolute inset-0 bg-gradient-to-br from-orange-100/40 to-transparent opacity-0 transition-opacity hover:opacity-100" />
                    <Layers className="relative" size={22} />
                </button>
                {actions.map((action) => {
                    const Icon = action.icon;
                    const active = state[action.key];
                    return (
                        <button
                            key={action.key}
                            type="button"
                            aria-label={action.label}
                            title={action.label}
                            onClick={() => state.toggle(action.key)}
                            className={[
                                "relative inline-flex items-center justify-center rounded-xl border transition-all duration-300",
                                "h-12 w-12 overflow-hidden text-orange-700 shadow-lg backdrop-blur",
                                "hover:-translate-y-1 hover:scale-105 hover:border-orange-500 hover:text-orange-500 hover:shadow-orange-400/40",
                                active
                                    ? "mb-1 h-14 w-14 border-orange-500 bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-orange-500/40"
                                    : "border-orange-200 bg-white/90",
                            ].join(" ")}
                        >
                            <span className="absolute inset-0 bg-gradient-to-br from-orange-100/40 to-transparent opacity-0 transition-opacity hover:opacity-100" />
                            <Icon className="relative" size={22} />
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

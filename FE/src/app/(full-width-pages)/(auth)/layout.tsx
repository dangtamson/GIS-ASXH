import ThemeTogglerTwo from "@/components/common/ThemeTogglerTwo";
import { ThemeProvider } from "@/context/ThemeContext";
import { HandHeart, MapPinned, ShieldCheck, Sparkles } from "lucide-react";
import React from "react";

const COMMUNITY_PILLARS = [
  {
    icon: MapPinned,
    title: "Bản đồ GIS 4.0",
    description: "Theo dõi không gian hỗ trợ trực quan theo từng địa bàn xã/phường.",
    accent: "from-sky-400/25 to-blue-500/25 text-sky-200",
  },
  {
    icon: HandHeart,
    title: "Kết nối cộng đồng",
    description: "Điều phối kịp thời giữa nhu cầu hỗ trợ và nguồn lực tài trợ.",
    accent: "from-emerald-400/25 to-teal-500/25 text-emerald-200",
  },
  {
    icon: ShieldCheck,
    title: "Minh bạch & Bảo mật",
    description: "Công khai số liệu tổng hợp đã duyệt, bảo vệ dữ liệu công dân.",
    accent: "from-indigo-400/25 to-cyan-500/25 text-indigo-200",
  },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative z-1 min-h-screen overflow-hidden bg-slate-50 font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100"
      style={{
        fontFamily: "var(--font-plus-jakarta), sans-serif",
        backgroundImage:
          "radial-gradient(circle at 10% 8%, rgba(17, 64, 154, 0.08), transparent 36%), radial-gradient(circle at 86% 90%, rgba(5, 150, 105, 0.08), transparent 34%)",
      }}
    >
      <ThemeProvider>
        <div className="relative flex min-h-screen flex-col lg:flex-row">
          <div className="h-1 w-full bg-gradient-to-r from-[#0b2f7a] via-[#0284c7] to-[#059669] lg:hidden" aria-hidden="true" />

          <div className="pointer-events-none absolute inset-0 lg:hidden" aria-hidden="true">
            <div className="absolute -right-14 -top-14 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="absolute -left-14 bottom-12 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
            <div
              className="absolute inset-0 opacity-35"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.12) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
          </div>

          {children}

          <aside className="relative hidden overflow-hidden border-l border-white/10 bg-gradient-to-br from-[#071842] via-[#103888] to-[#0b6673] lg:flex lg:w-[52%] lg:flex-col xl:w-[56%]">
            <div
              className="pointer-events-none absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgba(255,255,255,0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.14) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
              aria-hidden="true"
            />
            <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl" aria-hidden="true" />
            <div className="pointer-events-none absolute -bottom-28 left-1/4 h-96 w-96 rounded-full bg-emerald-400/18 blur-3xl" aria-hidden="true" />

            <div
              className="pointer-events-none absolute right-[12%] top-[10%] h-52 w-52 rounded-full border border-white/10"
              style={{ animation: "authRadarSweep 14s linear infinite" }}
              aria-hidden="true"
            >
              <div className="absolute left-1/2 top-1/2 h-px w-1/2 origin-left -translate-y-1/2 bg-gradient-to-r from-sky-300/75 via-emerald-200/30 to-transparent" />
            </div>
            <div
              className="pointer-events-none absolute right-[18%] top-[16%] h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_24px_rgba(52,211,153,0.85)]"
              style={{ animation: "authMapPulse 4.6s ease-in-out infinite" }}
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute bottom-[16%] left-[14%] h-2.5 w-2.5 rounded-full bg-sky-300 shadow-[0_0_20px_rgba(125,211,252,0.8)]"
              style={{ animation: "authSignalFloat 6s ease-in-out infinite 0.5s" }}
              aria-hidden="true"
            />

            <div className="relative z-10 flex h-full flex-col justify-between px-10 py-10 text-white xl:px-14 xl:py-12">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-sky-100 ring-1 ring-white/20 backdrop-blur-md">
                  <Sparkles size={13} className="text-emerald-300" />
                  Hệ thống thông tin địa lý · GIS 4.0
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-semibold text-emerald-100 ring-1 ring-emerald-300/30 backdrop-blur-md">
                  <span className="h-2 w-2 rounded-full bg-emerald-300" />
                  Mặt trận Tổ quốc Việt Nam
                </span>
              </div>

              <div className="my-auto space-y-8 py-8">
                <div className="space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200/90">
                    Nền tảng điều hành &amp; kết nối
                  </p>
                  <h2 className="text-3xl font-bold tracking-tight text-white xl:text-5xl">
                    An sinh cộng đồng
                  </h2>
                  <p className="max-w-xl text-sm leading-7 text-sky-100/85 xl:text-base">
                    Số hóa bản đồ không gian an sinh xã hội, kết nối nguồn lực cộng đồng và theo dõi hành trình hỗ trợ minh bạch đến từng địa bàn.
                  </p>
                </div>

                <div className="grid max-w-2xl gap-3.5 sm:grid-cols-3">
                  {COMMUNITY_PILLARS.map(({ icon: Icon, title, description, accent }) => (
                    <div
                      key={title}
                      className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-md"
                    >
                      <span className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${accent}`}>
                        <Icon size={19} />
                      </span>
                      <h3 className="mt-3.5 text-sm font-bold text-white">{title}</h3>
                      <p className="mt-1.5 text-xs leading-5 text-sky-100/80">{description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/12 pt-5 text-xs text-sky-100/70">
                <span>An sinh cộng đồng · Nền tảng GIS 4.0</span>
                <span>Minh bạch · Kịp thời · Vì cộng đồng</span>
              </div>
            </div>
          </aside>

          <div className="fixed bottom-6 right-6 z-50 hidden sm:block">
            <ThemeTogglerTwo />
          </div>
        </div>
      </ThemeProvider>
    </div>
  );
}

import ThemeTogglerTwo from "@/components/common/ThemeTogglerTwo";

import { ThemeProvider } from "@/context/ThemeContext";
import Image from "next/image";
import Link from "next/link";
import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative z-1 min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.42),_transparent_28%),linear-gradient(135deg,#f7efe9_0%,#f4ddd2_48%,#efe7e2_100%)] dark:bg-gray-950">
      <ThemeProvider>
        <div className="relative flex min-h-screen flex-col lg:flex-row dark:bg-gray-900">
          <div className="pointer-events-none absolute inset-0 lg:hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.42),_transparent_24%),linear-gradient(180deg,rgba(26,17,24,0.08)_0%,rgba(255,255,255,0)_38%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_8%,rgba(251,146,60,0.18),transparent_26%),radial-gradient(circle_at_12%_76%,rgba(255,255,255,0.2),transparent_28%)]" />
            <div className="absolute right-[-3rem] top-[-2rem] h-40 w-40 rounded-full border border-white/30 opacity-55" />
            <div className="absolute right-[0.5rem] top-[0.5rem] h-28 w-28 rounded-full border border-white/22 opacity-55" />
            <div className="absolute right-[2.25rem] top-[2.25rem] h-16 w-16 rounded-full border border-orange-200/30 opacity-75" />
            <div className="absolute left-[-2.5rem] bottom-[5%] h-44 w-44 rounded-full border border-white/18 opacity-55" />
            <div className="absolute left-[0.75rem] bottom-[9%] h-32 w-32 rounded-full border border-orange-200/18 opacity-70" />
            <div className="absolute left-[-1rem] top-[24%] h-px w-40 rotate-[18deg] bg-gradient-to-r from-transparent via-orange-300/55 to-transparent" />
            <div className="absolute right-[8%] top-[18%] h-px w-32 -rotate-[24deg] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
            <div className="absolute left-[10%] bottom-[21%] h-px w-32 rotate-[14deg] bg-gradient-to-r from-transparent via-orange-200/45 to-transparent" />
            <div className="absolute right-[6%] bottom-[12%] h-px w-28 -rotate-[20deg] bg-gradient-to-r from-transparent via-white/45 to-transparent" />
            <div className="absolute inset-0 opacity-15 [background-image:linear-gradient(rgba(255,255,255,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.16)_1px,transparent_1px)] [background-size:42px_42px]" />
            <div className="absolute inset-0 opacity-18 [background-image:radial-gradient(circle_at_center,transparent_0,transparent_43%,rgba(255,255,255,0.12)_43.5%,transparent_44%,transparent_100%)] [background-size:180px_180px]" />
            <div
              className="absolute right-[10%] top-[4%] h-28 w-28 rounded-full border border-white/22"
              style={{ animation: "authRadarSweep 10s linear infinite" }}
            >
              <div className="absolute left-1/2 top-1/2 h-px w-1/2 origin-left -translate-y-1/2 bg-gradient-to-r from-orange-200/80 via-white/35 to-transparent" />
            </div>
            <div
              className="absolute left-[12%] bottom-[12%] h-24 w-24 rounded-full border border-white/20"
              style={{ animation: "authRadarSweep 12s linear infinite reverse" }}
            >
              <div className="absolute left-1/2 top-1/2 h-px w-1/2 origin-left -translate-y-1/2 bg-gradient-to-r from-white/65 via-orange-200/30 to-transparent" />
            </div>
            <div
              className="absolute right-[18%] top-[16%] h-2.5 w-2.5 rounded-full border border-white/35 bg-orange-300/80 shadow-[0_0_18px_rgba(251,146,60,0.55)]"
              style={{ animation: "authMapPulse 4.8s ease-in-out infinite" }}
            />
            <div
              className="absolute left-[12%] top-[30%] h-2 w-2 rounded-full border border-brand-200/45 bg-brand-400 shadow-[0_0_16px_rgba(228,61,47,0.5)]"
              style={{ animation: "authSignalFloat 6.2s ease-in-out infinite 0.4s" }}
            />
            <div
              className="absolute right-[24%] bottom-[18%] h-2 w-2 rounded-full border border-white/35 bg-white/85 shadow-[0_0_16px_rgba(255,255,255,0.45)]"
              style={{ animation: "authSignalFloat 5.8s ease-in-out infinite 0.8s" }}
            />
          </div>
          {children}
          <aside className="relative hidden overflow-hidden border-l border-white/10 lg:flex lg:w-[54%] lg:flex-col xl:w-[58%]">
            <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(32,17,22,0.94)_0%,rgba(15,22,32,0.98)_52%,rgba(22,18,24,0.97)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.14),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(251,146,60,0.18),_transparent_26%),radial-gradient(circle_at_center,_rgba(255,255,255,0.06),_transparent_38%)]" />
            <div className="absolute inset-0 opacity-18 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:64px_64px]" />
            <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_center,transparent_0,transparent_44%,rgba(255,255,255,0.08)_44.5%,transparent_45%,transparent_100%)] [background-size:340px_340px]" />
            <div className="absolute left-[11%] top-[22%] h-px w-[38%] rotate-[18deg] bg-gradient-to-r from-transparent via-orange-200/75 to-transparent" />
            <div className="absolute left-[30%] top-[58%] h-px w-[34%] -rotate-[10deg] bg-gradient-to-r from-transparent via-white/35 to-transparent" />
            <div className="absolute right-[12%] top-[18%] h-52 w-52 rounded-full border border-white/8 opacity-60" />
            <div className="absolute right-[16%] top-[22%] h-40 w-40 rounded-full border border-white/10 opacity-55" />
            <div className="absolute right-[20%] top-[26%] h-28 w-28 rounded-full border border-orange-200/20 opacity-70" />
            <div
              className="absolute right-[21%] top-[32%] h-3 w-3 rounded-full border border-white/35 bg-orange-300/80 shadow-[0_0_32px_rgba(251,146,60,0.45)]"
              style={{ animation: "authMapPulse 4.8s ease-in-out infinite" }}
            />
            <div
              className="absolute left-[18%] top-[60%] h-2.5 w-2.5 rounded-full border border-brand-200/50 bg-brand-400 shadow-[0_0_26px_rgba(228,61,47,0.55)]"
              style={{ animation: "authSignalFloat 6.3s ease-in-out infinite 0.4s" }}
            />
            <div
              className="absolute right-[28%] bottom-[18%] h-4 w-4 rounded-full border border-white/30 bg-white/80 shadow-[0_0_24px_rgba(255,255,255,0.28)]"
              style={{ animation: "authSignalFloat 5.7s ease-in-out infinite 0.9s" }}
            />
            <div className="absolute left-[38%] top-[32%] h-24 w-24 rounded-full border border-white/10 bg-white/[0.03] blur-sm" />
            <div className="absolute bottom-[20%] right-[12%] h-40 w-40 rounded-full border border-orange-200/10 bg-orange-100/5 blur-2xl" />
            <div
              className="absolute right-[20%] top-[20%] h-56 w-56 rounded-full border border-white/10"
              style={{ animation: "authRadarSweep 8s linear infinite" }}
            >
              <div className="absolute left-1/2 top-1/2 h-px w-1/2 origin-left -translate-y-1/2 bg-gradient-to-r from-orange-200/80 via-white/30 to-transparent" />
            </div>

            <div className="relative z-10 flex h-full items-center justify-center px-10 py-12 xl:px-14 xl:py-14">
              <div className="flex items-center justify-center">
                <Link href="#" className="inline-flex items-center justify-center rounded-2xl border border-white/12 bg-white/[0.08] px-5 py-4 backdrop-blur-xl">
                  <Image
                    width={700}
                    height={250}
                    src="/images/logo/imagebannerlogingis.png"
                    alt="Logo"
                  />
                </Link>
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

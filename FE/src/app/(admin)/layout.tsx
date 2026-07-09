"use client";

import { useSidebar } from "@/context/SidebarContext";
import { isAuthenticated } from "@/lib/auth";
import AppHeader from "@/layout/AppHeader";
import dynamic from "next/dynamic";
// import AppSidebar from "@/layout/AppSidebar";
import Backdrop from "@/layout/Backdrop";
import { usePathname, useRouter } from "next/navigation";
import React from "react";
import { App } from "antd";
import { Menu, X } from "lucide-react";

const AppSidebar = dynamic(() => import("@/layout/AppSidebar"), {
  ssr: false
});

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const [isStandaloneCollectionApp, setIsStandaloneCollectionApp] = React.useState(false);
  const [showStandaloneChrome, setShowStandaloneChrome] = React.useState(false);

  React.useEffect(() => {
    if (!isAuthenticated()) {
      const nextPath = `${window.location.pathname || "/"}${window.location.search || ""}`;
      router.replace(`/signin?redirect=${encodeURIComponent(nextPath)}`);
    }
  }, [router]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const evaluateStandaloneState = () => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      setIsStandaloneCollectionApp(standalone && pathname === "/ho-ngheo/thu-thap");
    };

    evaluateStandaloneState();
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    mediaQuery.addEventListener("change", evaluateStandaloneState);

    return () => {
      mediaQuery.removeEventListener("change", evaluateStandaloneState);
    };
  }, [pathname]);

  React.useEffect(() => {
    if (!isStandaloneCollectionApp) {
      setShowStandaloneChrome(false);
    }
  }, [isStandaloneCollectionApp]);

  const shouldShowLayoutChrome = !isStandaloneCollectionApp || showStandaloneChrome;

  // Dynamic class for main content margin based on sidebar state
  const mainContentMargin = !shouldShowLayoutChrome
    ? "ml-0"
    : isMobileOpen
      ? "ml-0"
      : isExpanded || isHovered
        ? "lg:ml-[290px]"
        : "lg:ml-[90px]";

  return (
    <div className="min-h-screen bg-[#f5f0e8] flex flex-col">

      {isStandaloneCollectionApp ? (
        <button
          type="button"
          className="fixed left-3 top-3 z-[1100] inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/92 text-gray-800 shadow-lg backdrop-blur-xl transition hover:bg-white sm:left-4 sm:top-4 sm:h-auto sm:w-auto sm:gap-2 sm:px-4 sm:py-2 sm:text-sm sm:font-medium"
          onClick={() => setShowStandaloneChrome((current) => !current)}
          aria-label={shouldShowLayoutChrome ? "Thu gọn menu" : "Mở menu"}
          title={shouldShowLayoutChrome ? "Thu gọn menu" : "Mở menu"}
        >
          {shouldShowLayoutChrome ? <X size={16} /> : <Menu size={16} />}
          <span className="hidden sm:inline">{shouldShowLayoutChrome ? "Thu gọn menu" : "Mở menu"}</span>
        </button>
      ) : null}

      {/* Header nằm trên cùng */}
      {shouldShowLayoutChrome ? <AppHeader /> : null}

      {/* Phần dưới header */}
      <div className="flex flex-1">
        {/* Sidebar */}
        {shouldShowLayoutChrome ? <AppSidebar /> : null}
        {shouldShowLayoutChrome ? <Backdrop /> : null}

        {/* Content */}
        <App style={{ width: '100%' }}>
          <div
            className={`flex-1 transition-all duration-300 ease-in-out ${mainContentMargin}`}
          >
            <div className="p-4 mx-auto md:p-6">
              {children}
            </div>
          </div>
        </App>

      </div>

    </div>
  );
}

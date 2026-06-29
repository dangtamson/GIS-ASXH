"use client";

import {useSidebar} from "@/context/SidebarContext";
import {isAuthenticated} from "@/lib/auth";
import AppHeader from "@/layout/AppHeader";
import dynamic from "next/dynamic";
// import AppSidebar from "@/layout/AppSidebar";
import Backdrop from "@/layout/Backdrop";
import {useRouter} from "next/navigation";
import React from "react";
import {App} from "antd";

const AppSidebar = dynamic(() => import("@/layout/AppSidebar"), {
    ssr: false
});

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  React.useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/signin");
    }
  }, [router]);

  // Dynamic class for main content margin based on sidebar state
  const mainContentMargin = isMobileOpen
    ? "ml-0"
    : isExpanded || isHovered
      ? "lg:ml-[290px]"
      : "lg:ml-[90px]";

  return (
      <div className="min-h-screen bg-[#f5f0e8] flex flex-col">

          {/* Header nằm trên cùng */}
          <AppHeader />

          {/* Phần dưới header */}
          <div className="flex flex-1">
              {/* Sidebar */}
              <AppSidebar />
              <Backdrop />

              {/* Content */}
              <App style={{width:'100%'}}>
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

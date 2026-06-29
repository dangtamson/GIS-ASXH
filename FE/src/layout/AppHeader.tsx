"use client";
import NotificationDropdown from "@/components/header/NotificationDropdown";
import UserDropdown from "@/components/header/UserDropdown";
import { useSidebar } from "@/context/SidebarContext";
import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import { useSystemConfig } from "@/hooks/useSystemConfig";

const AppHeader: React.FC = () => {
  const [isApplicationMenuOpen, setApplicationMenuOpen] = useState(false);

  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();

  const { config } = useSystemConfig()

  const handleToggle = () => {
    if (window.innerWidth >= 1024) {
      toggleSidebar();
    } else {
      setApplicationMenuOpen(false);
      toggleMobileSidebar();
    }
  };

  const toggleApplicationMenu = () => {
    setApplicationMenuOpen((prev) => !prev);
  };
  const inputRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!isApplicationMenuOpen) {
        return;
      }

      if (headerRef.current?.contains(event.target as Node)) {
        return;
      }

      setApplicationMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isApplicationMenuOpen]);

  return (
    <header className="sticky top-0 z-[1010] w-full bg-linear-to-r from-[#b91c1c] to-[#dc2626] text-white left-0 right-0">
      <div ref={headerRef} className="relative flex min-h-14 items-center px-3 sm:px-4 lg:min-h-12">
        <div className="flex w-full items-center justify-between gap-2 sm:gap-4 lg:justify-normal lg:py-2">
          <button
            className="flex h-10 w-10 items-center justify-center bg-transparent text-white shadow-none hover:bg-transparent lg:h-9 lg:w-9"
            onClick={handleToggle}
            aria-label="Toggle Sidebar"
          >
            {isMobileOpen ? (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z"
                  fill="currentColor"
                />
              </svg>
            ) : <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="lucide lucide-menu w-5 h-5">
              <line x1="4" x2="20" y1="12" y2="12"></line>
              <line x1="4" x2="20" y1="6" y2="6"></line>
              <line x1="4" x2="20" y1="18" y2="18"></line>
            </svg>}
            {/* Cross Icon */}
          </button>

          <Link href="/" className="flex items-center lg:hidden">
            <Image
              width={112}
              height={24}
              className="h-6 w-auto dark:hidden"
              src="/images/logo/logo.svg"
              alt="Logo"
              priority
            />
            <Image
              width={112}
              height={24}
              className="hidden h-6 w-auto dark:block"
              src="/images/logo/logo-dark.svg"
              alt="Logo"
              priority
            />
          </Link>

          <button
            onClick={toggleApplicationMenu}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white transition hover:bg-white/10 lg:hidden"
            aria-label="Mở menu thao tác"
            aria-expanded={isApplicationMenuOpen}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M5.99902 10.4951C6.82745 10.4951 7.49902 11.1667 7.49902 11.9951V12.0051C7.49902 12.8335 6.82745 13.5051 5.99902 13.5051C5.1706 13.5051 4.49902 12.8335 4.49902 12.0051V11.9951C4.49902 11.1667 5.1706 10.4951 5.99902 10.4951ZM17.999 10.4951C18.8275 10.4951 19.499 11.1667 19.499 11.9951V12.0051C19.499 12.8335 18.8275 13.5051 17.999 13.5051C17.1706 13.5051 16.499 12.8335 16.499 12.0051V11.9951C16.499 11.1667 17.1706 10.4951 17.999 10.4951ZM13.499 11.9951C13.499 11.1667 12.8275 10.4951 11.999 10.4951C11.1706 10.4951 10.499 11.1667 10.499 11.9951V12.0051C10.499 12.8335 11.1706 13.5051 11.999 13.5051C12.8275 13.5051 13.499 12.8335 13.499 12.0051V11.9951Z"
                fill="currentColor"
              />
            </svg>
          </button>

          <div className="hidden lg:block">
            <h1 className="font-semibold text-sm sm:text-lg truncate">{config?.general.systemName}</h1>
          </div>
        </div>
        <div
          className={`${isApplicationMenuOpen ? "flex" : "hidden"
            } absolute left-3 right-3 top-[calc(100%-2px)] z-[70] flex-col gap-3 rounded-xl border border-white/20 bg-linear-to-r from-[#b91c1c] to-[#dc2626] px-4 py-4 text-white shadow-lg lg:static lg:left-auto lg:right-auto lg:top-auto lg:z-auto lg:flex lg:w-auto lg:flex-row lg:items-center lg:justify-end lg:gap-4 lg:rounded-none lg:border-0 lg:bg-none lg:from-transparent lg:to-transparent lg:px-0 lg:py-0 lg:text-white lg:shadow-none`}
        >
          <div className="flex items-center gap-2 2xsm:gap-3">
            {/* <!-- Dark Mode Toggler --> */}
            {/*<ThemeToggleButton />*/}
            {/* <!-- Dark Mode Toggler --> */}

            <NotificationDropdown triggerClassName="rounded-lg border border-white/20 bg-white/10 hover:bg-white/15 lg:border-0 lg:bg-transparent lg:hover:bg-transparent" />
            {/* <!-- Notification Menu Area --> */}
          </div>
          {/* <!-- User Area --> */}
          <UserDropdown
            triggerClassName="rounded-lg border border-white/20 bg-white/10 px-3 py-2 hover:bg-white/15 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:hover:bg-transparent"
            labelClassName="text-sm lg:text-base"
            iconClassName="shrink-0"
          />

        </div>
      </div>
    </header>
  );
};

export default AppHeader;

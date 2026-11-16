import type { Metadata } from 'next';
import { Be_Vietnam_Pro, Plus_Jakarta_Sans } from 'next/font/google';
import "@/app/globals.css";
import "flatpickr/dist/flatpickr.css";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { SidebarProvider } from '@/context/SidebarContext';
import { ThemeProvider } from '@/context/ThemeContext';
import SessionExpiredHandler from '@/components/auth/SessionExpiredHandler';
import AppReadyBoundary from '@/components/app/AppReadyBoundary';
import AppProvider from "@/app/AppProvider";
import DynamicFavicon from "@/layout/DynamicFavicon";
import React from "react";
import { AppInit } from "@/layout/AppInit";


const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plus-jakarta",
});

export const metadata: Metadata = {
  title: {
    default: 'Hệ thống cập nhật, theo dõi An sinh xã hội | GIS ASXH',
    template: "%s | Hệ thống cập nhật, theo dõi An sinh xã hội | GIS ASXH",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [], // ❗ disable auto favicon
  },
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={`${beVietnamPro.className} ${plusJakarta.variable} dark:bg-gray-900`}>
        <AppInit />

        <AppProvider>
          <AppReadyBoundary>
            <ThemeProvider>
              <SidebarProvider>
                {children}
                <SessionExpiredHandler />
              </SidebarProvider>
            </ThemeProvider>
          </AppReadyBoundary>
        </AppProvider>
        <DynamicFavicon />
      </body>
    </html>
  );
}

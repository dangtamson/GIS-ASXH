"use client";

import { App, Breadcrumb, ConfigProvider } from "antd";
import viVN from "antd/locale/vi_VN";
import { ArrowDownToLine, ArrowLeft, ExternalLink, HandHeart, Lock, MapPinned, ShieldCheck, SlidersHorizontal, Sparkles, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function SocialAssistancePage({ title, icon: Icon, actions, children }: {
    title: string;
    icon: LucideIcon;
    actions?: ReactNode;
    children: ReactNode;
}) {
    return (
        <ConfigProvider locale={viVN} theme={{ components: { Form: { itemMarginBottom: 20 } } }}>
            <div className="min-w-0 space-y-5 [&_.ant-table-cell]:break-words [&_.ant-table-thead>tr>th]:!bg-gray-50">
                <header className="space-y-4 border-b border-gray-200 pb-5">
                    <Breadcrumb items={[{ title: <Link href="/">Trang chủ</Link> }, { title: "An sinh xã hội" }, { title }]} />
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-700"><Icon size={22} /></span>
                            <h1 className="min-w-0 break-words text-xl font-semibold text-gray-900">{title}</h1>
                        </div>
                        {actions ? <div className="flex w-full flex-wrap gap-2 sm:w-auto [&_.ant-btn]:min-h-9">{actions}</div> : null}
                    </div>
                </header>
                {children}
            </div>
        </ConfigProvider>
    );
}

export function SocialAssistanceToolbar({ children, title = "Bộ lọc", layout = "wrap" }: {
    children: ReactNode;
    title?: string;
    layout?: "wrap" | "grid";
}) {
    return (
        <section aria-label={title} className="min-w-0 border-b border-gray-200 bg-gray-50/70 px-4 py-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700"><SlidersHorizontal size={16} className="text-red-700" />{title}</div>
            <div className={`min-w-0 items-end gap-3 ${layout === "grid" ? "grid grid-cols-2" : "flex flex-wrap"} sm:flex sm:flex-wrap [&>.ant-select]:!w-full [&>.ant-select]:min-w-0 sm:[&>.ant-select]:!w-56 [&>.ant-input-affix-wrapper]:!w-full sm:[&>.ant-input-affix-wrapper]:!w-72`}>{children}</div>
        </section>
    );
}

export function PublicAssistanceToolbar({ children, title = "Bộ lọc", subtitle, layout = "wrap" }: {
    children: ReactNode;
    title?: string;
    subtitle?: string;
    layout?: "wrap" | "grid";
}) {
    return (
        <section aria-label={title} className="min-w-0 rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm shadow-slate-200/50 backdrop-blur-sm sm:p-5">
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#11409a] ring-1 ring-blue-100">
                        <SlidersHorizontal size={15} />
                    </span>
                    <div>
                        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
                        {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
                    </div>
                </div>
            </div>
            <div className={`min-w-0 items-end gap-3 ${layout === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap" : "flex flex-wrap"} [&>.ant-select]:!w-full [&>.ant-select]:min-w-0 lg:[&>.ant-select]:!w-56 [&>.ant-input-affix-wrapper]:!w-full lg:[&>.ant-input-affix-wrapper]:!w-72`}>
                {children}
            </div>
        </section>
    );
}

export function PublicAssistanceLayout({
    slug,
    title,
    subtitle,
    badge,
    hidePageHeader = false,
    children
}: {
    slug: string;
    title: string;
    subtitle?: string;
    badge?: string;
    hidePageHeader?: boolean;
    children: ReactNode;
}) {
    const pathname = usePathname();
    const basePath = `/an-sinh/${encodeURIComponent(slug)}`;
    const links = [
        { href: basePath, label: "Bản đồ địa lý" },
        { href: `${basePath}/chuong-trinh`, label: "Chương trình" },
        { href: `${basePath}/phan-bo`, label: "Phân bổ hỗ trợ" },
        { href: `${basePath}/ban-do`, label: "Kết quả hỗ trợ" },
        { href: `${basePath}#privacy`, label: "Kiểm chứng & Minh bạch" }
    ];
    return (
        <ConfigProvider locale={viVN} theme={{
            token: {
                colorPrimary: "#11409a",
                colorLink: "#11409a",
                colorLinkHover: "#0b2c6f",
                colorBgBase: "#ffffff",
                colorTextBase: "#0f172a",
                colorBorder: "#cbd5e1",
                borderRadius: 10,
                controlHeight: 42,
                fontFamily: "var(--font-plus-jakarta), sans-serif"
            },
            components: {
                Form: { itemMarginBottom: 20 },
                Table: {
                    headerBg: "#f8fafc",
                    headerColor: "#334155",
                    borderColor: "#e2e8f0",
                    rowHoverBg: "#f8fafc"
                },
                Segmented: {
                    trackBg: "#f1f5f9",
                    itemSelectedBg: "#ffffff",
                    itemSelectedColor: "#11409a"
                },
                Button: {
                    borderRadius: 10,
                    fontWeight: 600
                }
            }
        }}>
            <App>
                <div
                    className="relative flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900 antialiased [letter-spacing:0] [&_.ant-input]:!text-base sm:[&_.ant-input]:!text-sm"
                    style={{
                        fontFamily: "var(--font-plus-jakarta), sans-serif",
                        backgroundImage: "radial-gradient(circle at 12% 0%, rgba(17, 64, 154, 0.06), transparent 36%), radial-gradient(circle at 88% 0%, rgba(5, 150, 105, 0.06), transparent 32%)"
                    }}
                >
                    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 shadow-xs shadow-slate-200/40 backdrop-blur-xl">
                        <div className="h-1 w-full bg-gradient-to-r from-[#0b2f7a] via-[#1346a8] to-[#0d9488]" aria-hidden="true" />
                        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-x-5 gap-y-3 px-4 py-3 sm:px-6 lg:px-8">
                            <Link href={basePath} className="group flex min-w-0 items-center gap-3 !text-slate-900">
                                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#0b2f7a] via-[#1346a8] to-[#0d9488] text-white shadow-md shadow-blue-900/15 transition-transform duration-200 group-hover:scale-[1.03]">
                                    <MapPinned size={22} />
                                </span>
                                <span className="min-w-0">
                                    <strong className="block text-sm font-bold uppercase tracking-tight text-slate-900 sm:text-base">
                                        An sinh cộng đồng
                                    </strong>
                                    <span className="block text-xs font-medium text-slate-500">Mặt trận Tổ quốc Việt Nam</span>
                                </span>
                            </Link>

                            <nav aria-label="Điều hướng an sinh" className="grid w-full grid-cols-2 gap-1 rounded-xl bg-slate-100/85 p-1 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
                                {links.map(({ href, label }) => {
                                    const isActive = href === basePath
                                        ? pathname === basePath
                                        : pathname === href || pathname.startsWith(`${href}/`);
                                    return (
                                        <Link
                                            key={href}
                                            href={href}
                                            aria-current={isActive ? "page" : undefined}
                                            className={`inline-flex min-h-9 items-center justify-center rounded-lg px-2.5 py-1.5 text-center text-xs font-semibold transition-all duration-150 sm:px-3.5 sm:text-sm ${
                                                isActive
                                                    ? "!bg-white !text-[#11409a] shadow-xs ring-1 ring-slate-200/80"
                                                    : "!text-slate-600 hover:!bg-white/70 hover:!text-[#11409a]"
                                            }`}
                                        >
                                            {label}
                                        </Link>
                                    );
                                })}
                            </nav>

                            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
                                <Link
                                    href={`${basePath}/dang-ky?source=WEBSITE`}
                                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl !bg-gradient-to-r !from-[#0b2f7a] !to-[#1346a8] px-3.5 text-center text-xs font-semibold !text-white shadow-sm shadow-blue-900/20 transition-all duration-150 hover:!from-[#08245e] hover:!to-[#0f3a8a] hover:shadow-md sm:px-4 sm:text-sm"
                                >
                                    <ArrowDownToLine size={15} />
                                    <span>Gửi yêu cầu hỗ trợ</span>
                                </Link>
                                <Link
                                    href={`${basePath}/chuong-trinh#pledge`}
                                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-teal-200 !bg-teal-50/90 px-3.5 text-center text-xs font-semibold !text-teal-800 transition-all duration-150 hover:border-teal-300 hover:!bg-teal-100/90 sm:px-4 sm:text-sm"
                                >
                                    <HandHeart size={15} />
                                    <span>Ủng hộ quỹ</span>
                                </Link>
                            </div>
                        </div>
                    </header>

                    <main className="mx-auto w-full min-w-0 max-w-[1600px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
                        {!hidePageHeader ? (
                            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white/95 px-5 py-4 shadow-xs backdrop-blur-sm sm:px-6">
                                <div className="min-w-0 space-y-1">
                                    {badge ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#11409a] ring-1 ring-blue-100">
                                            <Sparkles size={12} />
                                            {badge}
                                        </span>
                                    ) : null}
                                    <div className="flex min-w-0 items-center gap-2.5">
                                        <h1 className="min-w-0 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
                                        {pathname === basePath ? (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700 ring-1 ring-teal-200/80">
                                                <ShieldCheck size={14} aria-label="Dữ liệu tổng hợp công khai" />
                                                <span className="hidden sm:inline">Đã kiểm duyệt</span>
                                            </span>
                                        ) : null}
                                    </div>
                                    {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
                                </div>
                                {pathname !== basePath ? (
                                    <Link
                                        href={basePath}
                                        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 !bg-slate-50 px-3.5 text-sm font-semibold !text-slate-700 transition-colors hover:border-blue-200 hover:!bg-blue-50 hover:!text-[#11409a]"
                                    >
                                        <ArrowLeft size={16} />
                                        <span>Bản đồ địa lý</span>
                                    </Link>
                                ) : null}
                            </div>
                        ) : null}
                        {children}
                    </main>

                    <footer className="mt-10 border-t border-slate-800 bg-slate-950 text-slate-300">
                        <div className="h-1 w-full bg-gradient-to-r from-[#0b2f7a] via-[#1346a8] to-[#0d9488]" aria-hidden="true" />
                        <div className="mx-auto grid max-w-[1600px] gap-8 px-4 py-10 text-sm sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
                            <section className="space-y-3">
                                <div className="flex items-center gap-2.5">
                                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#1346a8] to-[#0d9488] text-white">
                                        <MapPinned size={18} />
                                    </span>
                                    <h2 className="font-bold text-white">An sinh cộng đồng</h2>
                                </div>
                                <p className="leading-6 text-slate-400">
                                    Nền tảng số hóa quản lý không gian an sinh cộng đồng thuộc Mặt trận Tổ quốc Việt Nam.
                                </p>
                            </section>

                            <section className="space-y-2.5">
                                <h2 className="flex items-center gap-2 font-bold text-white">
                                    <ShieldCheck size={16} className="text-teal-400" />
                                    Tiêu chuẩn dữ liệu
                                </h2>
                                <p className="leading-6 text-slate-400">
                                    Dữ liệu tổng hợp được công khai sau khi duyệt; vị trí và thông tin cá nhân không hiển thị trên bản đồ.
                                </p>
                            </section>

                            <section className="space-y-2">
                                <h2 className="font-bold text-white">Kênh tương tác</h2>
                                <div className="flex flex-col gap-1.5 pt-1">
                                    <Link href={`${basePath}/dang-ky?source=WEBSITE`} className="inline-flex min-h-8 items-center gap-1.5 !text-sky-300 transition-colors hover:!text-white">
                                        <span>Gửi nhu cầu hỗ trợ</span>
                                        <ExternalLink size={13} />
                                    </Link>
                                    <Link href={`${basePath}/chuong-trinh#pledge`} className="inline-flex min-h-8 items-center gap-1.5 !text-teal-300 transition-colors hover:!text-white">
                                        <span>Đăng ký cam kết ủng hộ</span>
                                        <ExternalLink size={13} />
                                    </Link>
                                    <Link href={`${basePath}/phan-bo`} className="inline-flex min-h-8 items-center gap-1.5 !text-sky-300 transition-colors hover:!text-white">
                                        <span>Chỉ tiêu phân bổ</span>
                                        <ExternalLink size={13} />
                                    </Link>
                                </div>
                            </section>

                            <section id="privacy" className="scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                                <h2 className="flex items-center gap-2 font-bold text-white">
                                    <Lock size={15} className="text-teal-400" />
                                    Cam kết dữ liệu
                                </h2>
                                <p className="mt-2 leading-6 text-slate-400">
                                    Thông tin cá nhân được bảo mật và chỉ dùng để xem xét, phối hợp hỗ trợ theo quy định.
                                </p>
                            </section>
                        </div>
                        <div className="border-t border-slate-800/80">
                            <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-slate-500 sm:px-6 lg:px-8">
                                <span>© Cổng công khai An sinh cộng đồng</span>
                                <span>Minh bạch · Kịp thời · Bảo mật thông tin công dân</span>
                            </div>
                        </div>
                    </footer>
                </div>
            </App>
        </ConfigProvider>
    );
}
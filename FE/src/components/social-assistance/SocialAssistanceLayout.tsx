"use client";

import { App, Breadcrumb, ConfigProvider } from "antd";
import viVN from "antd/locale/vi_VN";
import { ArrowDownToLine, ArrowLeft, HandHeart, MapPinned, ShieldCheck, SlidersHorizontal, type LucideIcon } from "lucide-react";
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

export function PublicAssistanceLayout({ slug, title, children }: { slug: string; title: string; children: ReactNode }) {
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
                colorPrimary: "#00288e",
                colorLink: "#00288e",
                colorBgBase: "#faf8ff",
                colorTextBase: "#131b2e",
                borderRadius: 4,
                controlHeight: 44,
                fontFamily: "var(--font-plus-jakarta), sans-serif"
            },
            components: { Form: { itemMarginBottom: 20 } }
        }}>
            <App>
                <div className="min-h-screen bg-[#faf8ff] font-sans text-[#131b2e] [letter-spacing:0] [&_.ant-input]:!text-base sm:[&_.ant-input]:!text-sm" style={{ fontFamily: "var(--font-plus-jakarta), sans-serif" }}>
                    <header className="border-b border-[#dae2fd] bg-white shadow-sm">
                        <div className="mx-auto flex max-w-[1920px] flex-wrap items-center justify-between gap-x-5 gap-y-3 px-4 py-3 sm:px-6 lg:px-8">
                            <Link href={basePath} className="flex min-w-0 items-center gap-3">
                                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#00288e] text-white"><MapPinned size={23} /></span>
                                <span className="min-w-0"><strong className="block text-sm font-bold uppercase text-[#131b2e] sm:text-base">Bản đồ an sinh số <span className="ml-1 rounded bg-[#dae2fd] px-1.5 py-0.5 font-mono text-[10px] text-[#00288e]">GIS 4.0</span></strong><span className="block text-xs text-[#444653]">Mặt trận Tổ quốc Việt Nam</span></span>
                            </Link>
                            <nav aria-label="Điều hướng an sinh" className="grid w-full grid-cols-2 gap-1 sm:flex sm:w-auto sm:flex-wrap">
                                {links.map(({ href, label }) => {
                                    const isActive = href === basePath
                                        ? pathname === basePath
                                        : pathname === href || pathname.startsWith(`${href}/`);
                                    return <Link key={href} href={href} aria-current={isActive ? "page" : undefined} className={`inline-flex min-h-10 items-center justify-center rounded px-2 py-2 text-center text-xs font-semibold transition-colors sm:px-3 sm:text-sm ${isActive ? "bg-[#e2e7ff] text-[#00288e]" : "text-[#444653] hover:bg-[#f2f3ff] hover:text-[#00288e]"}`}>{label}</Link>;
                                })}
                            </nav>
                            <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
                                <Link href={`${basePath}/dang-ky?source=WEBSITE`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded bg-[#e11d48] px-3 text-center text-xs font-semibold text-white transition-colors hover:bg-[#be123c] sm:px-4 sm:text-sm"><ArrowDownToLine size={16} />Gửi yêu cầu hỗ trợ</Link>
                                <Link href={`${basePath}/chuong-trinh#pledge`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded border border-[#006c4a] bg-white px-3 text-center text-xs font-semibold text-[#006c4a] transition-colors hover:bg-[#f0fdf4] sm:px-4 sm:text-sm"><HandHeart size={16} />Ủng hộ quỹ</Link>
                            </div>
                        </div>
                    </header>
                    <main className="mx-auto min-w-0 max-w-[1920px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
                        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#dae2fd] pb-5">
                            <div className="flex min-w-0 items-center gap-3"><h1 className="min-w-0 text-xl font-bold leading-tight text-[#131b2e] sm:text-2xl">{title}</h1>{pathname === basePath ? <ShieldCheck size={18} className="shrink-0 text-[#006c4a]" aria-label="Dữ liệu tổng hợp công khai" /> : null}</div>
                            {pathname !== basePath ? <Link href={basePath} className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#00288e] hover:underline"><ArrowLeft size={16} />Bản đồ địa lý</Link> : null}
                        </div>
                        {children}
                    </main>
                    <footer className="border-t border-[#dae2fd] bg-[#f2f3ff]">
                        <div className="mx-auto grid max-w-[1920px] gap-6 px-4 py-8 text-sm text-[#444653] sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
                            <section><h2 className="font-bold text-[#131b2e]">Hệ thống GIS an sinh xã hội</h2><p className="mt-2 leading-6">Nền tảng số hóa quản lý không gian an sinh cộng đồng thuộc Mặt trận Tổ quốc Việt Nam.</p></section>
                            <section><h2 className="font-bold text-[#131b2e]">Tiêu chuẩn dữ liệu</h2><p className="mt-2 leading-6">Dữ liệu tổng hợp được công khai sau khi duyệt; vị trí và thông tin cá nhân không hiển thị trên bản đồ.</p></section>
                            <section><h2 className="font-bold text-[#131b2e]">Kênh tương tác</h2><Link href={`${basePath}/dang-ky?source=WEBSITE`} className="mt-2 inline-flex min-h-9 items-center text-[#00288e] hover:underline">Gửi nhu cầu hỗ trợ</Link><Link href={`${basePath}/phan-bo`} className="mt-1 inline-flex min-h-9 items-center text-[#00288e] hover:underline">Chỉ tiêu phân bổ</Link></section>
                            <section id="privacy"><h2 className="font-bold text-[#131b2e]">Cam kết dữ liệu</h2><p className="mt-2 leading-6">Thông tin cá nhân được bảo mật và chỉ dùng để xem xét, phối hợp hỗ trợ theo quy định.</p></section>
                        </div>
                    </footer>
                </div>
            </App>
        </ConfigProvider>
    );
}
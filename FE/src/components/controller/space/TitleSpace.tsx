'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Breadcrumb, Space, Typography } from "antd";
import type { CSSProperties, ReactNode } from "react";
import { useMemo } from "react";

type TitleSpaceProps = {
    title: ReactNode;
    actions?: ReactNode;
    description?: ReactNode;
    className?: string;
    style?: CSSProperties;
};

type BreadcrumbConfigItem = {
    path: string;
    label: string;
};

const BREADCRUMB_CONFIG: BreadcrumbConfigItem[] = [
    { path: "/", label: "Trang chủ" },
    {
        path: '/bao-cao',
        label: 'Báo cáo'
    },
    {
        path: '/danh-muc',
        label: 'Danh mục'
    },
    {
        path: '/quan-tri',
        label: 'Quản trị'
    }
];

function formatBreadcrumbLabel(segment: string): string {
    const decodedSegment = decodeURIComponent(segment);
    return decodedSegment
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getBreadcrumbLabel(path: string, fallbackSegment: string): string {
    const normalizedPath = path.endsWith("/") && path !== "/" ? path.slice(0, -1) : path;
    const segmentPath = fallbackSegment ? `/${fallbackSegment}` : "/";

    const matchedItem = BREADCRUMB_CONFIG.find((item) => {
        const normalizedItemPath =
            item.path.endsWith("/") && item.path !== "/" ? item.path.slice(0, -1) : item.path;

        return normalizedItemPath === normalizedPath || normalizedItemPath === segmentPath;
    });
    if (matchedItem) {
        return matchedItem.label;
    }

    return formatBreadcrumbLabel(fallbackSegment);
}

export default function TitleSpace({
    title,
    actions,
    description,
    className,
    style,
}: TitleSpaceProps) {
    const pathname = usePathname();
    const titleLabel = typeof title === "string" ? title : null;

    const breadcrumbItems = useMemo(() => {
        const segments = pathname.split("/").filter(Boolean);

        const items: {
            title: ReactNode;
        }[] = [
            {
                title: <Link href="/">{getBreadcrumbLabel("/", "")}</Link>,
            },
        ];

        segments.forEach((segment, index) => {
            const href = `/${segments.slice(0, index + 1).join("/")}`;
            const isLast = index === segments.length - 1;
            const label = isLast && titleLabel ? titleLabel : getBreadcrumbLabel(href, segment);

            items.push({
                title: isLast ? label : <Link href={href}>{label}</Link>,
            });
        });

        return items;
    }, [pathname, titleLabel]);

    return (
        <div
            className={className}
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 20,
                flexWrap: "wrap",
                // padding: "18px 22px",
                // border: "1px solid #f1c7c7",
                borderRadius: 14,
                // background: "#fff7f5",
                // boxShadow: "0 10px 28px rgba(185, 28, 28, 0.08)",
                ...style,
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    minWidth: 0,
                    flex: 1,
                }}
            >
                <Space orientation="vertical" size={2} style={{ minWidth: 0 }}>
                    <Breadcrumb items={breadcrumbItems} />
                    {/*{typeof title === "string" ? (*/}
                    {/*    <Typography.Title*/}
                    {/*        level={4}*/}
                    {/*        style={{*/}
                    {/*            margin: 0,*/}
                    {/*            color: "#991b1b",*/}
                    {/*            lineHeight: 1.2,*/}
                    {/*        }}*/}
                    {/*    >*/}
                    {/*        {title}*/}
                    {/*    </Typography.Title>*/}
                    {/*) : (*/}
                    {/*    title*/}
                    {/*)}*/}
                    {/*{description ? (*/}
                    {/*    <Typography.Text*/}
                    {/*        style={{*/}
                    {/*            color: "#7f1d1d",*/}
                    {/*            opacity: 0.72,*/}
                    {/*        }}*/}
                    {/*    >*/}
                    {/*        {description}*/}
                    {/*    </Typography.Text>*/}
                    {/*) : null}*/}
                </Space>
            </div>

            {actions ? (
                <Space
                    size={8}
                    wrap
                    style={{
                        marginLeft: "auto",
                        justifyContent: "flex-end",
                    }}
                >
                    {actions}
                </Space>
            ) : null}
        </div>
    );
}

'use client';

import {Button} from "antd";
import type {ButtonHTMLType} from "antd/es/button/buttonHelpers";
import {
    BarChart3,
    CheckCircle2,
    Eye,
    FileDown,
    FileSpreadsheet,
    FileText,
    Plus,
    Pencil,
    ShieldX,
    Save,
    Search,
    Send,
    type LucideIcon,
    X,
    RotateCcw,
} from "lucide-react";
import type {CSSProperties, ReactNode} from "react";

export type ActionButtonType =
    | 'preview'
    | 'export-excel'
    | 'export-pdf'
    | 'export-word'
    | 'create'
    | 'search'
    | 'refresh'
    | 'edit'
    | 'close'
    | 'save'
    | 'send'
    | 'approve'
    | 'reject'
    | 'statistics';

type ActionButtonVariant = 'solid' | 'outlined' | 'text';

type ActionButtonConfig = {
    label: string;
    icon: LucideIcon;
    backgroundColor: string;
    borderColor: string;
    textColor: string;
    ghostBackgroundColor: string;
    ghostTextColor: string;
};

type ActionButtonProps = {
    type: ActionButtonType;
    onClick?: () => void;
    label?: string;
    icon?: ReactNode;
    disabled?: boolean;
    loading?: boolean;
    htmlType?: ButtonHTMLType;
    className?: string;
    style?: CSSProperties;
    variant?: ActionButtonVariant;
};

const actionButtonConfig: Record<ActionButtonType, ActionButtonConfig> = {
    preview: {
        label: 'Xem trước',
        icon: Eye,
        backgroundColor: '#fff7f5',
        borderColor: '#f3d4d4',
        textColor: '#b91c1c',
        ghostBackgroundColor: '#fff1f0',
        ghostTextColor: '#cf1322',
    },
    'export-excel': {
        label: 'Xuất Excel',
        icon: FileSpreadsheet,
        backgroundColor: '#f6ffed',
        borderColor: '#d9f7be',
        textColor: '#389e0d',
        ghostBackgroundColor: '#f6ffed',
        ghostTextColor: '#237804',
    },
    'export-pdf': {
        label: 'Xuất PDF',
        icon: FileDown,
        backgroundColor: '#fff1f0',
        borderColor: '#ffccc7',
        textColor: '#cf1322',
        ghostBackgroundColor: '#fff1f0',
        ghostTextColor: '#a8071a',
    },
    'export-word': {
        label: 'Xuất Word',
        icon: FileText,
        backgroundColor: '#e8f3ff',
        borderColor: '#bae0ff',
        textColor: '#1677ff',
        ghostBackgroundColor: '#e8f3ff',
        ghostTextColor: '#0958d9',
    },
    create: {
        label: 'Thêm mới',
        icon: Plus,
        backgroundColor: '#dc2626',
        borderColor: '#dc2626',
        textColor: '#ffffff',
        ghostBackgroundColor: '#fff1f0',
        ghostTextColor: '#b91c1c',
    },
    search: {
        label: 'Tìm kiếm',
        icon: Search,
        backgroundColor: '#b91c1c',
        borderColor: '#b91c1c',
        textColor: '#ffffff',
        ghostBackgroundColor: '#fff1f0',
        ghostTextColor: '#b91c1c',
    },
    refresh: {
        label: 'Làm mới',
        icon: RotateCcw,
        backgroundColor: '#ffffff',
        borderColor: '#f3d4d4',
        textColor: '#b91c1c',
        ghostBackgroundColor: '#fff7f5',
        ghostTextColor: '#b91c1c',
    },
    edit: {
        label: 'Chỉnh sửa',
        icon: Pencil,
        backgroundColor: '#ffffff',
        borderColor: '#f3d4d4',
        textColor: '#b91c1c',
        ghostBackgroundColor: '#fff7f5',
        ghostTextColor: '#b91c1c',
    },
    close: {
        label: 'Đóng',
        icon: X,
        backgroundColor: '#ffffff',
        borderColor: '#d9d9d9',
        textColor: '#595959',
        ghostBackgroundColor: '#fafafa',
        ghostTextColor: '#434343',
    },
    save: {
        label: 'Lưu',
        icon: Save,
        backgroundColor: '#dc2626',
        borderColor: '#dc2626',
        textColor: '#ffffff',
        ghostBackgroundColor: '#fff1f0',
        ghostTextColor: '#b91c1c',
    },
    send: {
        label: 'Gửi đi',
        icon: Send,
        backgroundColor: '#1677ff',
        borderColor: '#1677ff',
        textColor: '#ffffff',
        ghostBackgroundColor: '#e8f3ff',
        ghostTextColor: '#0958d9',
    },
    approve: {
        label: 'Phê duyệt',
        icon: CheckCircle2,
        backgroundColor: '#389e0d',
        borderColor: '#389e0d',
        textColor: '#ffffff',
        ghostBackgroundColor: '#f6ffed',
        ghostTextColor: '#237804',
    },
    reject: {
        label: 'Từ chối',
        icon: ShieldX,
        backgroundColor: '#fff1f0',
        borderColor: '#ffccc7',
        textColor: '#cf1322',
        ghostBackgroundColor: '#fff1f0',
        ghostTextColor: '#a8071a',
    },
    statistics: {
        label: 'Thống kê',
        icon: BarChart3,
        backgroundColor: '#fff7e6',
        borderColor: '#ffe7ba',
        textColor: '#d48806',
        ghostBackgroundColor: '#fff7e6',
        ghostTextColor: '#ad6800',
    },
};

export default function ActionButton({
    type,
    onClick,
    label,
    icon,
    disabled = false,
    loading = false,
    htmlType = 'button',
    className,
    style,
    variant = 'solid',
}: ActionButtonProps) {
    const config = actionButtonConfig[type];
    const Icon = config.icon;
    const resolvedIcon = icon ?? <Icon size={16} strokeWidth={2.1}/>;

    const variantStyle: CSSProperties =
        variant === 'outlined'
            ? {
                backgroundColor: '#ffffff',
                borderColor: config.borderColor,
                color: config.textColor,
            }
            : variant === 'text'
                ? {
                    backgroundColor: 'transparent',
                    borderColor: 'transparent',
                    color: config.ghostTextColor,
                    boxShadow: 'none',
                }
                : {
                    backgroundColor: config.backgroundColor,
                    borderColor: config.borderColor,
                    color: config.textColor,
                };

    return (
        <Button
            htmlType={htmlType}
            onClick={onClick}
            disabled={disabled}
            loading={loading}
            icon={resolvedIcon}
            className={className}
            style={{
                height: 40,
                borderRadius: 10,
                fontWeight: 500,
                boxShadow: variant === 'solid' ? '0 8px 20px rgba(15, 23, 42, 0.06)' : undefined,
                ...variantStyle,
                ...style,
            }}
        >
            {label ?? config.label}
        </Button>
    );
}

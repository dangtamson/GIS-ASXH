'use client';

import {StockOutlined} from "@ant-design/icons";
import {
    Check,
    ClipboardList,
    Download,
    Eye,
    FileText,
    Globe,
    HandCoins,
    Inbox,
    Link2,
    MoreHorizontal,
    ShieldCheck,
    Pencil,
    Plus,
    Send,
    Trash2,
    Wand2,
    X,
    XCircle,
} from "lucide-react";
import type {ComponentType, CSSProperties, SVGProps} from "react";

type Props = {
    action: 'view' | 'edit' | 'delete' | 'check' | 'add' | 'close' | 'reject' | 'send' | 'public' | 'receive' | 'download' | 'magic' | 'link' | 'permission' | 'document' | 'report' | 'timeline' | 'supportTimeline' | 'more';
};

type ActionConfig = {
    icon: ComponentType<SVGProps<SVGSVGElement> & {size?: number | string; strokeWidth?: number | string}>;
    color: string;
    backgroundColor: string;
};

const baseStyle: CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: 10,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background-color 0.2s ease, color 0.2s ease',
};

const actionConfig: Record<Props['action'], ActionConfig> = {
    view: {
        icon: Eye,
        color: '#1677ff',
        backgroundColor: '#e8f3ff',
    },
    edit: {
        icon: Pencil,
        color: '#d48806',
        backgroundColor: '#fff7e6',
    },
    delete: {
        icon: Trash2,
        color: '#cf1322',
        backgroundColor: '#fff1f0',
    },
    check: {
        icon: Check,
        color: '#389e0d',
        backgroundColor: '#f6ffed',
    },
    add: {
        icon: Plus,
        color: '#08979c',
        backgroundColor: '#e6fffb',
    },
    close: {
        icon: X,
        color: '#595959',
        backgroundColor: '#f5f5f5',
    },
    reject: {
        icon: XCircle,
        color: '#c41d7f',
        backgroundColor: '#fff0f6',
    },
    send: {
        icon: Send,
        color: '#1677ff',
        backgroundColor: '#e8f3ff',
    },
    public: {
        icon: Globe,
        color: '#722ed1',
        backgroundColor: '#f9f0ff',
    },

    receive: {
        icon: Inbox,
        color: '#389e0d',
        backgroundColor: '#f6ffed',
    },
    download: {
        icon: Download,
        color: '#1677ff',
        backgroundColor: '#e8f3ff',
    },

    magic: {
        icon: Wand2,
        color: '#722ed1',
        backgroundColor: '#f9f0ff',
    },

    link: {
        icon: Link2,
        color: '#ffa304',
        backgroundColor: '#fff7e6',
    },
    permission: {
        icon: ShieldCheck,
        color: '#1677ff',
        backgroundColor: '#e8f3ff',
    },
    document: {
        icon: FileText,
        color: '#d46b08',
        backgroundColor: '#fff7e6',
    },
    report: {
        icon: ClipboardList,
        color: '#389e0d',
        backgroundColor: '#f6ffed',
    },
    timeline: {
        icon: MoreHorizontal,
        color: '#531dab',
        backgroundColor: '#f9f0ff',
    },
    supportTimeline: {
        icon: HandCoins,
        color: '#047857',
        backgroundColor: '#ecfdf5',
    },
    more: {
        icon: MoreHorizontal,
        color: '#475467',
        backgroundColor: '#f3f4f6',
    },
};

export default function ActionIcon({action}: Props) {
    const {icon: Icon, color, backgroundColor} = actionConfig[action];

    return (
        <span
            aria-hidden="true"
            style={{
                ...baseStyle,
                color,
                backgroundColor,
            }}
        >
            {action === "timeline" ? <StockOutlined style={{fontSize: 18}} /> : <Icon size={18} strokeWidth={2.2}/>}
        </span>
    );
}

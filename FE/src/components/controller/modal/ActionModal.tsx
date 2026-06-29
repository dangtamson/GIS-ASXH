'use client';

import {Modal, Space, Spin} from "antd";
import type {ReactNode} from "react";
import ActionButton from "../ActionButton";
import {X} from "lucide-react";

type ActionModalVariant = 'default' | 'danger';

type ActionModalProps = {
    open: boolean;
    title?: string;
    children: ReactNode;
    width?: number;
    okText?: string;
    cancelText?: string;
    loading?: boolean;
    spinning?: boolean;
    variant?: ActionModalVariant;
    actions?: ReactNode;
    onOk?: () => void;
    onCancel: () => void;
};

const paletteByVariant: Record<ActionModalVariant, {primaryColor: string}> = {
    default: {
        primaryColor: '#dc2626',
    },
    danger: {
        primaryColor: '#dc2626',
    },
};

export default function ActionModal({
    open,
    title = 'Thao tác',
    children,
    width = 720,
    okText = 'Lưu',
    cancelText = 'Đóng',
    loading = false,
    spinning = false,
    variant = 'default',
    actions,
    onOk,
    onCancel,
}: ActionModalProps) {
    const palette = paletteByVariant[variant];

    return (
        <>
        <Modal
            open={open}
            forceRender
            title={<span style={{color: '#ffffff'}}>{title}</span>}
            width={width}
            onCancel={onCancel}
            rootClassName="action-modal-root"
            modalRender={(node) => <Spin spinning={spinning}>{node}</Spin>}
            footer={
                actions || (
                    <Space>
                        <ActionButton type="close" onClick={onCancel} label={cancelText}></ActionButton>
                        <ActionButton type="save" onClick={onOk} label={okText} loading={loading}></ActionButton>
                    </Space>
                )
            }
            closeIcon={<X color="#ffffff" size={18} />}
            styles={{
                header: {
                    backgroundColor: palette.primaryColor,
                    marginBottom: 0,
                    padding: '9px 24px',
                    minHeight: 50,
                    display: 'flex',
                    alignItems: 'center',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.18)',
                    borderTopLeftRadius: 8,
                    borderTopRightRadius: 8,
                },
                body: {
                    padding: '20px 24px 8px',
                    fontSize: '14px',
                },
            }}
        >
            {children}
        </Modal>
            <style jsx global>{`
                .action-modal-root .ant-modal-container {
                    padding: 0;
                }
                .action-modal-root .ant-modal-footer {
                    padding: 10px 24px 20px;
                    margin-top: 0;
                }
                .action-modal-root .ant-modal-close {
                    top: 9px;
                    inset-inline-end: 16px;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
            `}</style>
        </>
    );
}

'use client';

import {Modal, Spin, Space} from "antd";
import {X} from "lucide-react";
import type {ReactNode} from "react";
import ActionButton from "../ActionButton";

type ViewModalProps = {
    open: boolean;
    title?: string;
    children: ReactNode;
    width?: number;
    spinning?: boolean;
    onCancel: () => void;
    footer?: ReactNode | null;
    actions?: ReactNode;
};

export default function ViewModal({
    open,
    title = 'Chi tiết',
    children,
    width = 720,
    spinning = false,
    onCancel,
    footer = null,
    actions,
}: ViewModalProps) {
    return (
        <>
            <Modal
                open={open}
                rootClassName="view-modal-root"
                title={<span style={{color: '#ffffff'}}>{title}</span>}
                width={width}
                onCancel={onCancel}
                closable
                closeIcon={<X color="#ffffff" size={18} />}
                footer={
                     (
                            <Space>
                                <ActionButton type="close" onClick={onCancel} label="Đóng"></ActionButton>
                            </Space>
                        )
                }
                modalRender={(node) => <Spin spinning={spinning}>{node}</Spin>}
                styles={{
                    header: {
                        backgroundColor: '#dc2626',
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
                .view-modal-root .ant-modal-container {
                    padding: 0;
                }
                .view-modal-root .ant-modal-footer {
                    padding: 10px 24px 20px;
                    margin-top: 0;
                }
                .view-modal-root .ant-modal-close {
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

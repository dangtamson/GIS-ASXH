'use client';

import {Modal, Space, Spin} from "antd";
import {Trash2, X} from "lucide-react";
import type {ReactNode} from "react";
import ActionButton from "../ActionButton";

type ConfirmModalVariant = 'default' | 'danger';

type ConfirmModalProps = {
    open: boolean;
    title?: string;
    content?: ReactNode;
    subject?: ReactNode;
    descriptionPrefix?: string;
    descriptionSuffix?: string;
    okText?: string;
    cancelText?: string;
    loading?: boolean;
    spinning?: boolean;
    variant?: ConfirmModalVariant;
    onOk: () => void;
    onCancel: () => void;
};

const paletteByVariant: Record<ConfirmModalVariant, {primaryColor: string}> = {
    default: {
        primaryColor: '#df8329',
    },
    danger: {
        primaryColor: '#dc2626',
    },
};

export default function ConfirmModal({
    open,
    title = 'Xác nhận',
    content,
    subject,
    descriptionPrefix = 'Bạn có chắc chắn muốn thực hiện thao tác với',
    descriptionSuffix = '!',
    okText = 'Xác nhận',
    cancelText = 'Đóng',
    loading = false,
    spinning = false,
    variant = 'default',
    onOk,
    onCancel,
}: ConfirmModalProps) {
    const palette = paletteByVariant[variant];

    return (
        <>
            <Modal
                open={open}
                rootClassName="confirm-modal-root"
                title={<span style={{color: '#ffffff'}}>{title}</span>}
                onCancel={onCancel}
                closable
                closeIcon={<X color="#ffffff" size={18} />}
                modalRender={(node) => <Spin spinning={spinning}>{node}</Spin>}
                footer={
                    <Space>
                        <ActionButton
                            type="close"
                            label={cancelText}
                            onClick={onCancel}
                        />
                         <ActionButton
                            type={'save'}
                            label={okText}
                            onClick={onOk}
                            loading={loading}
                            icon={variant === 'danger' ? <Trash2 size={18}/> : undefined}
                            style={{
                                background: palette.primaryColor,
                                borderColor: palette.primaryColor
                            }}
                        />
                    </Space>
                }
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
                {content || (
                    <span className={''}>
                        {descriptionPrefix}{' '}
                        {subject ? <span className={'font-semibold'}>{subject}</span> : null}
                        {descriptionSuffix}
                    </span>
                )}
            </Modal>
            <style jsx global>{`
                .confirm-modal-root .ant-modal-container {
                    padding: 0;
                }
                .confirm-modal-root .ant-modal-footer {
                    padding: 10px 24px 20px;
                    margin-top: 0;
                }
                .confirm-modal-root .ant-modal-close {
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

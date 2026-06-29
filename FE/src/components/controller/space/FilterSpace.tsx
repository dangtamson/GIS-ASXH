'use client';

import { Col, type ColProps, Row, type RowProps } from "antd";
import React, { Children, Fragment, isValidElement, type ReactElement, type ReactNode, useState } from "react";

type ResponsiveSpan = Pick<ColProps, 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'>;
type ActionPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

export type FilterSpaceProps = {
    children: ReactNode;
    actions?: ReactNode;
    actionsPosition?: ActionPosition;
    headerContent?: ReactNode;
    gutter?: RowProps['gutter'];
    className?: string;
    rowProps?: Omit<RowProps, 'gutter'>;
    itemProps?: ColProps;
    responsive?: ResponsiveSpan;
    actionsWrapperClassName?: string;
    defaultCollapsed?: boolean;
};

const defaultResponsive: ResponsiveSpan = {
    xs: 24,
    sm: 24,
    md: 12,
    lg: 8,
    xl: 6,
};

const isRenderableNode = (child: ReactNode): child is Exclude<ReactNode, null | undefined | boolean> => {
    return child !== null && child !== undefined && typeof child !== 'boolean';
};

const getActionAlignment = (position: ActionPosition): React.CSSProperties['justifyContent'] => {
    if (position.endsWith('left')) {
        return 'flex-start';
    }

    if (position.endsWith('center')) {
        return 'center';
    }

    return 'flex-end';
};

export default function FilterSpace({
    children,
    actions,
    actionsPosition = 'bottom-right',
    headerContent,
    gutter = [12, 12],
    className,
    rowProps,
    itemProps,
    responsive = defaultResponsive,
    actionsWrapperClassName,
    defaultCollapsed = true,
}: FilterSpaceProps) {
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
    const items = Children.toArray(children).filter(isRenderableNode);
    const renderActions = () => {
        if (!actions) {
            return null;
        }

        return (
            <Row gutter={gutter}>
                <Col span={24}>
                    <div
                        className={'m-4 ' + actionsWrapperClassName}
                        style={{
                            display: 'flex',
                            justifyContent: getActionAlignment(actionsPosition),
                            alignItems: 'center',
                            gap: 8,
                            flexWrap: 'wrap',
                        }}
                    >
                        {actions}
                    </div>
                </Col>
            </Row>
        );
    };

    return (
        <div className={'bg-white px-5 pt-3 pb-2 rounded-xl shadow-xs ' + className}>
            <div
                style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: isCollapsed ? 0 : 12,
                    minHeight: 36,
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                    }}
                >
                    <div
                        style={{
                            fontSize: 15,
                            fontWeight: 600,
                            color: '#1f2937',
                        }}
                    >
                        Bộ lọc
                    </div>
                </div>
                
                <button
                    type="button"
                    onClick={() => setIsCollapsed((prev) => !prev)}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid #d1d5db',
                        borderRadius: 999,
                        width: 32,
                        height: 32,
                        background: '#ffffff',
                        color: '#374151',
                        cursor: 'pointer',
                    }}
                    aria-label={isCollapsed ? 'Hiện bộ lọc' : 'Thu gọn bộ lọc'}
                    title={isCollapsed ? 'Hiện bộ lọc' : 'Thu gọn bộ lọc'}
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{
                            transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                        }}
                    >
                        <path
                            d="M6 15L12 9L18 15"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </button>
            </div>

            <div
                aria-hidden={isCollapsed}
                style={{
                    maxHeight: isCollapsed ? 0 : 1200,
                    opacity: isCollapsed ? 0 : 1,
                    overflow: 'hidden',
                    transform: isCollapsed ? 'translateY(-4px)' : 'translateY(0)',
                    transition: 'max-height 0.18s ease, opacity 0.14s ease, transform 0.14s ease',
                    pointerEvents: isCollapsed ? 'none' : 'auto',
                }}
            >
                {actionsPosition.startsWith('top') && renderActions()}

                <Row gutter={gutter} {...rowProps}>
                    {headerContent && (
                    <Col
                        span={24}
                    >
                        {headerContent}
                    </Col>
                    )}
                    {items.map((child, index) => {
                        if (isValidElement(child) && child.type === Fragment) {
                            const fragmentElement = child as ReactElement<{ children?: ReactNode }>;

                            return Children.toArray(fragmentElement.props.children)
                                .filter(isRenderableNode)
                                .map((nestedChild, nestedIndex) => (
                                    <Col
                                        key={`filter-space-${index}-${nestedIndex}`}
                                        {...responsive}
                                        {...itemProps}
                                    >
                                        {nestedChild}
                                    </Col>
                                ));
                        }

                        return (
                            <Col
                                key={`filter-space-${index}`}
                                {...responsive}
                                {...itemProps}
                            >
                                {child}
                            </Col>
                        );
                    })}
                </Row>

                {actionsPosition.startsWith('bottom') && renderActions()}
            </div>
        </div>
    );
}

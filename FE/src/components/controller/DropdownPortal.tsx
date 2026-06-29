'use client'

import { createPortal } from "react-dom";
import { ReactNode } from "react";

type Props = {
    open: boolean;
    top: number;
    left: number;
    width: number;
    children: ReactNode;
};

export default function DropdownPortal({
                                           open,
                                           top,
                                           left,
                                           width,
                                           children,
                                       }: Props) {

    if (typeof document === "undefined" || !open) return null;

    return createPortal(
        <div
            style={{
                position: "fixed",
                top,
                left,
                width,
                zIndex: 9999,
            }}
        >
            {children}
        </div>,
        document.body
    );
}

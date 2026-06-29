import type {ReactNode} from "react";

type TooltipProps = {
    content: string;
    children: ReactNode;
    className?: string;
};

export default function Tooltip({ content, children, className }: TooltipProps) {
    return (
        <span className={`relative inline-flex items-center ${className ?? ""}`}>
            <span className="group inline-flex items-center">
                {children}
                <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-max max-w-xs -translate-x-1/2 rounded-md bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                    {content}
                    <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-gray-900"></span>
                </span>
            </span>
        </span>
    );
}

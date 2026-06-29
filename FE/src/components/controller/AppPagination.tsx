'use client';

type PaginationToken = number | 'ellipsis-left' | 'ellipsis-right';

type AppPaginationProps = {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalRows?: number;
    rowsPerPage?: number;
    rowsPerPageOptions?: number[];
    onRowsPerPageChange?: (rowsPerPage: number) => void;
    showFirstLast?: boolean;
    align?: 'start' | 'center' | 'end';
    summaryLabel?: string;
    pageSizeLabel?: string;
    pageSizeSuffix?: string;
};

function buildPageTokens(currentPage: number, totalPages: number): PaginationToken[] {
    if (totalPages <= 5) {
        return Array.from({length: totalPages}, (_, index) => index + 1);
    }

    if (currentPage <= 3) {
        return [1, 2, 3, 4, 'ellipsis-right', totalPages];
    }

    if (currentPage >= totalPages - 2) {
        return [1, 'ellipsis-left', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, 'ellipsis-left', currentPage - 1, currentPage, currentPage + 1, 'ellipsis-right', totalPages];
}

function getAlignmentClass(align: AppPaginationProps['align']) {
    if (align === 'center') {
        return 'justify-center';
    }

    if (align === 'end') {
        return 'justify-end';
    }

    return 'justify-start';
}

export default function AppPagination({
    currentPage,
    totalPages,
    onPageChange,
    totalRows,
    rowsPerPage,
    rowsPerPageOptions = [5, 10, 20, 50],
    onRowsPerPageChange,
    showFirstLast = true,
    align = 'end',
    summaryLabel,
    pageSizeLabel = 'Hiển thị',
    pageSizeSuffix = 'dòng/trang',
}: AppPaginationProps) {
    const safeTotalPages = Math.max(1, totalPages || 1);
    const safeCurrentPage = Math.min(Math.max(currentPage || 1, 1), safeTotalPages);
    const hasRowsPerPageControl = typeof rowsPerPage === 'number' && typeof onRowsPerPageChange === 'function';
    const showMeta = totalRows !== undefined || hasRowsPerPageControl;
    const pageTokens = buildPageTokens(safeCurrentPage, safeTotalPages);
    const pagerAlignmentClass = getAlignmentClass(showMeta ? 'end' : align);

    const baseButtonClass =
        'inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45';
    const ghostButtonClass =
        `${baseButtonClass} border-gray-200 bg-white text-gray-700 hover:border-[#dc2626]/30 hover:text-[#dc2626]`;
    const activeButtonClass =
        `${baseButtonClass} border-[#dc2626] bg-[#dc2626] text-white shadow-sm`;

    return (
        <div className="flex flex-col gap-3 border-t border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
            {showMeta ? (
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        {totalRows !== undefined ? (
                            <span className="font-medium text-gray-700">
                                {summaryLabel ?? `Có ${totalRows} kết quả`}
                            </span>
                        ) : null}
                        {hasRowsPerPageControl ? (
                            <div className="flex flex-wrap items-center gap-2">
                                <span>{pageSizeLabel}</span>
                                <select
                                    value={rowsPerPage}
                                    onChange={(event) => onRowsPerPageChange(Number(event.target.value))}
                                    className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-[#dc2626]"
                                >
                                    {rowsPerPageOptions.map((value) => (
                                        <option key={value} value={value}>
                                            {value}
                                        </option>
                                    ))}
                                </select>
                                <span>{pageSizeSuffix}</span>
                            </div>
                        ) : null}
                    </div>
                    <div className={`flex flex-wrap items-center gap-2 ${pagerAlignmentClass}`}>
                        {showFirstLast ? (
                            <button
                                type="button"
                                onClick={() => onPageChange(1)}
                                disabled={safeCurrentPage === 1}
                                className={ghostButtonClass}
                            >
                                «
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={() => onPageChange(safeCurrentPage - 1)}
                            disabled={safeCurrentPage === 1}
                            className={ghostButtonClass}
                        >
                            ‹
                        </button>
                        <div className="flex flex-wrap items-center gap-2">
                            {pageTokens.map((token) =>
                                typeof token === 'number' ? (
                                    <button
                                        key={token}
                                        type="button"
                                        onClick={() => onPageChange(token)}
                                        className={safeCurrentPage === token ? activeButtonClass : ghostButtonClass}
                                    >
                                        {token}
                                    </button>
                                ) : (
                                    <span key={token} className="px-1 text-gray-400">
                                        ...
                                    </span>
                                )
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => onPageChange(safeCurrentPage + 1)}
                            disabled={safeCurrentPage === safeTotalPages}
                            className={ghostButtonClass}
                        >
                            ›
                        </button>
                        {showFirstLast ? (
                            <button
                                type="button"
                                onClick={() => onPageChange(safeTotalPages)}
                                disabled={safeCurrentPage === safeTotalPages}
                                className={ghostButtonClass}
                            >
                                »
                            </button>
                        ) : null}
                    </div>
                </div>
            ) : (
                <div className={`flex flex-wrap items-center gap-2 ${pagerAlignmentClass}`}>
                    {showFirstLast ? (
                        <button
                            type="button"
                            onClick={() => onPageChange(1)}
                            disabled={safeCurrentPage === 1}
                            className={ghostButtonClass}
                        >
                            «
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={() => onPageChange(safeCurrentPage - 1)}
                        disabled={safeCurrentPage === 1}
                        className={ghostButtonClass}
                    >
                        ‹
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                        {pageTokens.map((token) =>
                            typeof token === 'number' ? (
                                <button
                                    key={token}
                                    type="button"
                                    onClick={() => onPageChange(token)}
                                    className={safeCurrentPage === token ? activeButtonClass : ghostButtonClass}
                                >
                                    {token}
                                </button>
                            ) : (
                                <span key={token} className="px-1 text-gray-400">
                                    ...
                                </span>
                            )
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => onPageChange(safeCurrentPage + 1)}
                        disabled={safeCurrentPage === safeTotalPages}
                        className={ghostButtonClass}
                    >
                        ›
                    </button>
                    {showFirstLast ? (
                        <button
                            type="button"
                            onClick={() => onPageChange(safeTotalPages)}
                            disabled={safeCurrentPage === safeTotalPages}
                            className={ghostButtonClass}
                        >
                            »
                        </button>
                    ) : null}
                </div>
            )}
        </div>
    );
}

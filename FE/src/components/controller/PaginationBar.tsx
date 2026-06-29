'use client';

import AppPagination from "@/components/controller/AppPagination";

type PaginationBarProps = {
    totalRows: number;
    rowsPerPage: number;
    currentPage: number;
    totalPage: number;
    rowsPerPageOptions?: number[];
    onRowsPerPageChange: (rowsPerPage: number) => void;
    onPageChange: (page: number) => void;
};

export default function PaginationBar({
    totalRows,
    rowsPerPage,
    currentPage,
    totalPage,
    rowsPerPageOptions = [5, 10, 20, 50],
    onRowsPerPageChange,
    onPageChange
}: PaginationBarProps) {
    return (
        <AppPagination
            currentPage={currentPage}
            totalPages={totalPage}
            totalRows={totalRows}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={rowsPerPageOptions}
            onRowsPerPageChange={onRowsPerPageChange}
            onPageChange={onPageChange}
        />
    );
}

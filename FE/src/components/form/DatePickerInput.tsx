"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";

interface DatePickerInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
    id?: string;
    disabled?: boolean;
}

export default function DatePickerInput({
    value,
    onChange,
    placeholder = "Chọn ngày",
    label,
    id,
    disabled = false,
}: DatePickerInputProps) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const [isOpen, setIsOpen] = useState(false);
    const [currentDate, setCurrentDate] = useState<Date>(
        value ? new Date(value + "T00:00:00") : new Date()
    );
    const containerRef = useRef<HTMLDivElement>(null);

    // Format date to YYYY-MM-DD
    const formatDate = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    // Get days in month
    const getDaysInMonth = (date: Date): number => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    };

    // Get first day of month (0 = Sunday, 1 = Monday, etc.)
    const getFirstDayOfMonth = (date: Date): number => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };

    // Handle previous month
    const handlePrevMonth = () => {
        setCurrentDate(
            new Date(currentDate.getFullYear(), currentDate.getMonth() - 1)
        );
    };

    // Handle next month
    const handleNextMonth = () => {
        setCurrentDate(
            new Date(currentDate.getFullYear(), currentDate.getMonth() + 1)
        );
    };

    // Handle day click
    const handleDayClick = (day: number) => {
        const selectedDate = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            day
        );
        onChange(formatDate(selectedDate));
        setIsOpen(false);
    };

    // Handle year/month navigation
    const handleMonthYearClick = () => {
        // Toggle month/year picker (simple implementation - can be enhanced)
    };

    // Close picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => {
                document.removeEventListener("mousedown", handleClickOutside);
            };
        }
    }, [isOpen]);

    const selectedDate = useMemo(
        () => (value ? new Date(value + "T00:00:00") : null),
        [value]
    );

    const daysInMonth = getDaysInMonth(currentDate);
    const firstDayOfMonth = getFirstDayOfMonth(currentDate);
    const days = [];

    // Empty cells for days before month starts
    for (let i = 0; i < firstDayOfMonth; i++) {
        days.push(null);
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
        days.push(day);
    }

    const monthName = new Intl.DateTimeFormat("vi-VN", {
        month: "long",
    }).format(currentDate);

    const formattedDate = selectedDate
        ? selectedDate.toLocaleDateString("vi-VN")
        : "";

    return (
        <div className="relative" ref={containerRef}>
            {label && (
                <label htmlFor={inputId} className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                    {label}
                </label>
            )}

            <div className="relative">
                <button
                    type="button"
                    id={inputId}
                    disabled={disabled}
                    onClick={() => {
                        if (!isOpen && selectedDate) {
                            setCurrentDate(selectedDate);
                        }
                        setIsOpen(!isOpen);
                    }}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-left text-gray-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-sky-600 dark:focus:ring-sky-900/50 flex items-center justify-between"
                >
                    <span className={formattedDate ? "text-gray-700 dark:text-white" : "text-gray-400 dark:text-gray-500"}>
                        {formattedDate || placeholder}
                    </span>
                    <CalendarDays className="h-4 w-4 text-gray-400" />
                </button>

                {value && !disabled && (
                    <button
                        type="button"
                        onClick={() => onChange("")}
                        className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Calendar Popup */}
            {isOpen && !disabled && (
                <div className="absolute top-full left-0 z-50 mt-2 w-72 rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                    {/* Month/Year Header */}
                    <div className="mb-4 flex items-center justify-between">
                        <button
                            type="button"
                            onClick={handlePrevMonth}
                            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                            <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                        </button>

                        <button
                            type="button"
                            onClick={handleMonthYearClick}
                            className="text-sm font-semibold text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 px-3 py-1 rounded"
                        >
                            {monthName} {currentDate.getFullYear()}
                        </button>

                        <button
                            type="button"
                            onClick={handleNextMonth}
                            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                            <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                        </button>
                    </div>

                    {/* Weekday Headers */}
                    <div className="mb-2 grid grid-cols-7 gap-1 text-center">
                        {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((day) => (
                            <div
                                key={day}
                                className="text-xs font-semibold text-gray-500 dark:text-gray-400 p-2"
                            >
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar Days */}
                    <div className="grid grid-cols-7 gap-1">
                        {days.map((day, index) => (
                            <button
                                key={index}
                                type="button"
                                onClick={() => day && handleDayClick(day)}
                                disabled={!day}
                                className={`rounded p-2 text-sm font-medium transition ${!day
                                        ? "text-gray-200 dark:text-gray-700 cursor-default"
                                        : formatDate(
                                            new Date(
                                                currentDate.getFullYear(),
                                                currentDate.getMonth(),
                                                day
                                            )
                                        ) === value
                                            ? "bg-sky-500 text-white hover:bg-sky-600"
                                            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                                    }`}
                            >
                                {day}
                            </button>
                        ))}
                    </div>

                    {/* Quick Select Buttons */}
                    <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4 flex gap-2 justify-end">
                        <button
                            type="button"
                            onClick={() => {
                                const today = new Date();
                                onChange(formatDate(today));
                                setIsOpen(false);
                            }}
                            className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                            Hôm nay
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                const tomorrow = new Date();
                                tomorrow.setDate(tomorrow.getDate() + 1);
                                onChange(formatDate(tomorrow));
                                setIsOpen(false);
                            }}
                            className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                            Ngày mai
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

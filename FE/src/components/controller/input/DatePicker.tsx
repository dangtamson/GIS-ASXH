'use client';

import {DatePicker} from "antd";
import viVN from "antd/es/date-picker/locale/vi_VN";
import type { DatePickerProps } from "antd";
import dayjs from "dayjs";
import "dayjs/locale/vi";

dayjs.locale("vi");

type Props = {
    onChange?: (value: string) => void;
    value?: string;
    title?: string;
    placeholder?: string;
    bold?: boolean;
    hideTitle?: boolean;
    disabled?: boolean;
    disabledDate?: DatePickerProps["disabledDate"];
};

export default function CustomDatePicker({value, onChange, placeholder='Chọn ngày', title, bold = false, hideTitle = false, disabled = false, disabledDate}: Props) {
    return <label className={'w-full'}>
        {!hideTitle && title && <span style={{fontWeight: bold ? 600 : 400}} className={'block text-sm mb-1'}>
            {title}
        </span>}
        <DatePicker
            className={'no-disabled-style'}
            locale={viVN}
            disabled={disabled}
            style={{
                width: '100%',
                height: '40px',
            }}
            size={'middle'}
            format={'DD/MM/YYYY'}
            placeholder={placeholder}
            disabledDate={disabledDate}
            value={value ? dayjs(value, "YYYY-MM-DD") : null}
            onChange={(date) => {
                onChange?.(date ? dayjs(date).format("YYYY-MM-DD") : "");
            }}
        />
    </label>;
}

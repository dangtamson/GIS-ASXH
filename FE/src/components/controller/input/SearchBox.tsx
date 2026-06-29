'use client';

import { Input } from "antd";
import { Search } from "lucide-react";

type Props = {
    value: string;
    title?: string;
    bold?: boolean;
    hideTitle?: boolean;
    disabled?: boolean;
    onChange: (value: string) => void;
    onPressEnter?: () => void;
    placeholder?: string;
};

export default function SearchBox({ value, onChange, title, bold, hideTitle = false, disabled = false, onPressEnter, placeholder }: Props) {
    return <label className="block w-full">
        {!hideTitle && <span className={'block text-sm mb-1'} style={{fontWeight: bold ? 600 : 400}}>
            {title || 'Từ khóa tìm kiếm'}
        </span>}
        <Input
            className={'no-disabled-style'}
            disabled={disabled}
            placeholder={placeholder || 'Nhập từ khóa tìm kiếm'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onPressEnter={onPressEnter}
            suffix={
                <span style={{display: 'inline-flex', alignItems: 'center'}}>
                    <Search size={13} color={'#bfbfbf'} />
                </span>
            }
            styles={{
                input: {fontSize: 14, border: 0}
        }}
            style={{
                height:  '40px'
            }}
        />
    </label>;
}

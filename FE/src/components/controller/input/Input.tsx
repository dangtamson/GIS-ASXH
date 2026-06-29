'use client';

import React from 'react';
import { Input } from 'antd';
import { useEffect, useRef, useState } from 'react';

type BaseProps = {
    title?: string;
    placeholder?: string;
    bold?: boolean;
    hideTitle?: boolean;
    disabled?: boolean;
    required?: boolean;
    prefix?: React.ReactNode;
    suffix?: React.ReactNode;
    ellipsis?: boolean;
    debounceMs?: number;
};

type TextProps = BaseProps & {
    type?: 'text';
    value?: string;
    onChange?: (value: string) => void;
};

type EmailProps = BaseProps & {
    type: 'email';
    value?: string;
    onChange?: (value: string) => void;
};

type PhoneProps = BaseProps & {
    type: 'phone';
    value?: string;
    onChange?: (value: string) => void;
};

type NumberProps = BaseProps & {
    type: 'number';
    value?: number;
    onChange?: (value?: number) => void;
    min?: number;
    max?: number;
};

type TextAreaProps = BaseProps & {
    type: 'textarea';
    value?: string;
    onChange?: (value: string) => void;
};

type PasswordProps = BaseProps & {
    type: 'password';
    value?: string;
    onChange?: (value: string) => void;
};

type Props =
    | TextProps
    | EmailProps
    | PhoneProps
    | NumberProps
    | TextAreaProps
    | PasswordProps;

export default function CustomInput(props: Props) {
    const {
        title,
        placeholder,
        bold = false,
        hideTitle = false,
        disabled = false,
        required = false,
    } = props;

    const [error, setError] = useState<string | null>(null);
    const [isNumberFocused, setIsNumberFocused] = useState(false);
    const [numberStr, setNumberStr] = useState<string>(() => {
        if (props.type === 'number') {
            return props.value === undefined || props.value === null ? '' : String(props.value);
        }
        return '';
    });
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const prevNumberValueRef = React.useRef<number | undefined>(props.type === 'number' ? props.value : undefined);

    const validateEmail = (value: string) => {
        const trimmed = value.trim();

        if (!trimmed) {
            setError(null);
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmed)) {
            setError('Email không hợp lệ');
            return;
        }

        setError(null);
    };

    const validatePhone = (value: string) => {
        const trimmed = value.trim();

        if (!trimmed) {
            setError(null);
            return;
        }

        const phoneRegex = /^(0|\+84)[0-9]{9,10}$/;
        if (!phoneRegex.test(trimmed)) {
            setError('Số điện thoại không hợp lệ');
            return;
        }

        setError(null);
    };

    const validateNumber = (value?: number) => {
        if (value === undefined || value === null) {
            setError(null);
            return;
        }

        if (props.type === 'number') {
            if (props.min !== undefined && value < props.min) {
                setError(`Nhỏ nhất là ${props.min}`);
                return;
            }

            if (props.max !== undefined && value > props.max) {
                setError(`Lớn nhất là ${props.max}`);
                return;
            }
        }

        setError(null);
    };

    // debounce validation and onChange for number input
    useEffect(() => {
        if (props.type !== 'number') return;
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => {
            if (numberStr === '') {
                props.onChange?.(undefined);
                validateNumber(undefined);
                return;
            }

            if (!/^-?\d+$/.test(numberStr)) {
                setError('Số không hợp lệ');
                return;
            }

            const num = Number(numberStr);
            // Validate range before emitting change to parent
            if (props.min !== undefined && num < props.min) {
                setError(`Nhỏ nhất là ${props.min}`);
                return;
            }

            if (props.max !== undefined && num > props.max) {
                setError(`Lớn nhất là ${props.max}`);
                return;
            }

            // valid -> clear error and notify parent
            setError(null);
            prevNumberValueRef.current = num;
            props.onChange?.(num);
        }, props.debounceMs ?? 400);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [numberStr, props]);

    const handleNumberChange = (value: string) => {
        // allow empty
        if (value === '') {
            setNumberStr('');
            // do not enforce required validation here; only show '*' visually
            setError(null);
            return;
        }

        // allow typing partial number (debounced validation handles final check)
        if (!/^-?\d*$/.test(value)) return;

        setNumberStr(value);
        // clear error while typing for better UX
        setError(null);
    };

    const handleNumberFocus = () => {
        if (props.type !== 'number') {
            return;
        }

        setIsNumberFocused(true);
        setNumberStr(props.value === undefined || props.value === null ? '' : String(props.value));
    };

    const handleNumberBlur = () => {
        if (props.type !== 'number') {
            return;
        }

        setIsNumberFocused(false);
        setNumberStr(props.value === undefined || props.value === null ? '' : String(props.value));
    };

    const handleTextChange = (value: string) => {
        if (
            props.type === 'text' ||
            props.type === undefined ||
            props.type === 'password' ||
            props.type === 'email' ||
            props.type === 'phone' ||
            props.type === 'textarea'
        ) {
            props.onChange?.(value);

            if (props.type === 'email') {
                validateEmail(value);
            } else if (props.type === 'phone') {
                validatePhone(value);
            } else {
                // do not enforce required here for text/textarea/password; only visual '*' is shown
                setError(null);
            }
        }
    };

    const affixStyle: React.CSSProperties = {
        background: 'transparent',
        color: '#6b7280',
        fontWeight: 500,
        padding: '0 6px',
        borderRadius: 6,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 13,
        border: 'none'
    };

    const affixPrefix = props.prefix ? <span style={{ ...affixStyle, marginRight: 8 }}>{props.prefix}</span> : undefined;
    const affixSuffix = props.suffix ? <span style={{ ...affixStyle, marginLeft: 8 }}>{props.suffix}</span> : undefined;

    return (
        <label style={{ width: '100%' }}>
            {!hideTitle && title && (
                <span style={{ fontWeight: bold ? 600 : 400 }} className="block text-sm mb-1">
                    {required ? <span style={{ color: '#dc2626' }}>* </span> : null}
                    {title}
                </span>
            )}

            {props.type === 'textarea' ? (
                <Input.TextArea
                    className="no-disabled-style"
                    disabled={disabled}
                    status={error ? 'error' : ''}
                    value={props.value}
                    placeholder={placeholder}
                    autoSize={{ minRows: 3 }}
                    onChange={(e) => handleTextChange(e.target.value)}
                    style={props.ellipsis ? { overflow: 'hidden', textOverflow: 'ellipsis' } : undefined}
                />
            ) : props.type === 'number' ? (
                <Input
                    className="no-disabled-style"
                    disabled={disabled}
                    status={error ? 'error' : ''}
                    value={isNumberFocused ? numberStr : (props.value === undefined || props.value === null ? '' : String(props.value))}
                    style={{ height: '40px', ...(props.ellipsis ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : {}) }}
                    placeholder={placeholder}
                    onChange={(e) => handleNumberChange(e.target.value)}
                    onFocus={handleNumberFocus}
                    onBlur={handleNumberBlur}
                    prefix={affixPrefix}
                    suffix={affixSuffix}
                />
            ) : props.type === 'password' ? (
                <Input.Password
                    className="no-disabled-style"
                    disabled={disabled}
                    status={error ? 'error' : ''}
                    style={{ height: '40px' }}
                    value={props.value}
                    placeholder={placeholder}
                    onChange={(e) => handleTextChange(e.target.value)}
                    prefix={affixPrefix}
                    suffix={affixSuffix}
                />
            ) : (
                <Input
                    className="no-disabled-style"
                    disabled={disabled}
                    status={error ? 'error' : ''}
                    style={{ height: '40px', ...(props.ellipsis ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : {}) }}
                    value={props.value}
                    placeholder={placeholder}
                    type={props.type === 'email' ? 'email' : props.type === 'phone' ? 'tel' : 'text'}
                    onChange={(e) => handleTextChange(e.target.value)}
                    prefix={affixPrefix}
                    suffix={affixSuffix}
                />
            )}

            {error && (
                <div style={{ color: 'red', fontSize: 12, marginTop: 4 }}>
                    {error}
                </div>
            )}
        </label>
    );
}

'use client'

type SpinnerSize = 'small' | 'default' | 'large' | number;

const sizeMap = {
    small: 20,
    default: 32,
    large: 48,
};

export function AppSpinner({ size = 'default' }: { size?: SpinnerSize }) {
    const px = typeof size === 'number' ? size : sizeMap[size];

    return (
        <div
            className="red-spin"
            style={{
                width: px,
                height: px,
                borderWidth: px / 8,
            }}
        />
    );
}
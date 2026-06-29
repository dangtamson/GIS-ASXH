'use client';

type AppLoadingScreenProps = {
    fullscreen?: boolean;
};

export default function AppLoadingScreen({
    fullscreen = true,
}: AppLoadingScreenProps) {
    return (
        <div
            style={{
                position: fullscreen ? 'fixed' : 'relative',
                inset: fullscreen ? 0 : undefined,
                minHeight: fullscreen ? '100vh' : 240,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#ffffff',
                zIndex: fullscreen ? 9999 : 'auto',
            }}
        >
            <div
                style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    border: '4px solid rgba(220, 38, 38, 0.18)',
                    borderTopColor: '#dc2626',
                    animation: 'app-loading-spin 0.8s linear infinite',
                }}
            />
            <style jsx>{`
                @keyframes app-loading-spin {
                    from {
                        transform: rotate(0deg);
                    }
                    to {
                        transform: rotate(360deg);
                    }
                }
            `}</style>
        </div>
    );
}

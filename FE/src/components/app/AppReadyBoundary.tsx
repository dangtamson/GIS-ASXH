'use client';

import type {ReactNode} from 'react';
import {useEffect, useState} from 'react';
import AppLoadingScreen from './AppLoadingScreen';

type AppReadyBoundaryProps = {
    children: ReactNode;
};

export default function AppReadyBoundary({
    children,
}: AppReadyBoundaryProps) {
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const waitForAppReady = async () => {
            if (typeof document !== 'undefined' && 'fonts' in document) {
                try {
                    await document.fonts.ready;
                } catch {
                    // Ignore font readiness errors and continue rendering the app.
                }
            }

            if (isMounted) {
                setIsReady(true);
            }
        };

        void waitForAppReady();

        return () => {
            isMounted = false;
        };
    }, []);

    if (!isReady) {
        return <AppLoadingScreen />;
    }

    return <>{children}</>;
}

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface SessionTimeoutConfig {
    idleTimeoutMinutes?: number;
    maxSessionMinutes?: number;
    warningMinutes?: number;
}

/**
 * Hook to manage session timeout enforcement
 * - Logs out user after idle timeout
 * - Logs out user after max session time
 * - Optionally shows warning before timeout
 */
export function useSessionTimeout(config: SessionTimeoutConfig = {}) {
    const router = useRouter();
    const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const sessionTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const lastActivityRef = useRef<number>(0);

    const {
        idleTimeoutMinutes = 30,
        maxSessionMinutes = 480,
        warningMinutes = 5
    } = config;

    useEffect(() => {
        // Get timeout from sessionStorage if available
        const storedIdleTimeout = sessionStorage.getItem("sessionTimeoutMinutes");
        const storedMaxTimeout = sessionStorage.getItem("sessionMaxTimeoutMinutes");

        const idleTimeout = storedIdleTimeout ? parseInt(storedIdleTimeout, 10) : idleTimeoutMinutes;
        const maxTimeout = storedMaxTimeout ? parseInt(storedMaxTimeout, 10) : maxSessionMinutes;

        const handleUserActivity = () => {
            lastActivityRef.current = Date.now();

            // Clear existing idle timeout
            if (idleTimeoutRef.current !== undefined) {
                clearTimeout(idleTimeoutRef.current);
            }

            // Set new idle timeout
            idleTimeoutRef.current = setTimeout(() => {
                handleSessionTimeout("idle");
            }, idleTimeout * 60 * 1000);
        };

        const handleSessionTimeout = (reason: "idle" | "max-session") => {
            // Clear localStorage/sessionStorage
            localStorage.removeItem("auth_token");
            localStorage.removeItem("auth_user");
            sessionStorage.clear();

            // Redirect to login
            router.push("/signin?reason=" + reason);
        };

        // Set up event listeners for user activity
        const activityEvents = ["mousedown", "keydown", "scroll", "touchstart", "click"];

        activityEvents.forEach((event) => {
            document.addEventListener(event, handleUserActivity, true);
        });

        // Set initial idle timeout
        idleTimeoutRef.current = setTimeout(() => {
            handleSessionTimeout("idle");
        }, idleTimeout * 60 * 1000);

        // Set max session timeout
        if (maxTimeout > 0) {
            sessionTimeoutRef.current = setTimeout(() => {
                handleSessionTimeout("max-session");
            }, maxTimeout * 60 * 1000);
        }

        return () => {
            // Cleanup
            activityEvents.forEach((event) => {
                document.removeEventListener(event, handleUserActivity, true);
            });

            if (idleTimeoutRef.current !== undefined) {
                clearTimeout(idleTimeoutRef.current);
            }
            if (sessionTimeoutRef.current !== undefined) {
                clearTimeout(sessionTimeoutRef.current);
            }
        };
    }, [router, idleTimeoutMinutes, maxSessionMinutes, warningMinutes]);
}

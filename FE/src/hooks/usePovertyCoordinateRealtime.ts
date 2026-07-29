"use client";

import {
    buildPovertyCoordinateChannel,
    getPovertyRealtimeClient,
    parsePovertyCoordinateUpdate,
    POVERTY_COORDINATE_UPDATE_EVENT,
    type PovertyCoordinateUpdateEvent,
} from "@/lib/poverty-realtime";
import { useEffect } from "react";

export function usePovertyCoordinateRealtime(
    workspaceId: string | null,
    onUpdate: (event: PovertyCoordinateUpdateEvent) => void,
): void {
    useEffect(() => {
        if (!workspaceId) return;

        const client = getPovertyRealtimeClient();
        if (!client) {
            if (process.env.NODE_ENV !== "production") {
                console.warn("[poverty-realtime] Missing Supabase public environment variables");
            }
            return;
        }

        const channelName = buildPovertyCoordinateChannel(workspaceId);
        if (process.env.NODE_ENV !== "production") {
            console.info("[poverty-realtime] Subscribing", { channelName, workspaceId });
        }

        const channel = client
            .channel(channelName)
            .on("broadcast", { event: POVERTY_COORDINATE_UPDATE_EVENT }, (message) => {
                if (process.env.NODE_ENV !== "production") {
                    console.info("[poverty-realtime] Received broadcast", message);
                }
                const event = parsePovertyCoordinateUpdate(message.payload);
                if (event) onUpdate(event);
            });

        channel.subscribe((status, error) => {
            if (process.env.NODE_ENV !== "production") {
                console.info("[poverty-realtime] Subscription status", { channelName, status, error });
            }
        });

        return () => {
            if (process.env.NODE_ENV !== "production") {
                console.info("[poverty-realtime] Removing channel", { channelName });
            }
            void client.removeChannel(channel);
        };
    }, [onUpdate, workspaceId]);
}

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
        if (!client) return;

        const channel = client
            .channel(buildPovertyCoordinateChannel(workspaceId))
            .on("broadcast", { event: POVERTY_COORDINATE_UPDATE_EVENT }, (message) => {
                const event = parsePovertyCoordinateUpdate(message.payload);
                if (event) onUpdate(event);
            });

        channel.subscribe();

        return () => {
            void client.removeChannel(channel);
        };
    }, [onUpdate, workspaceId]);
}

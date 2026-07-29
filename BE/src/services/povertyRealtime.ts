import { logger } from "@/helpers/index.ts";
import { getSupabaseAdmin } from "@/services/supabase.ts";

export const POVERTY_COORDINATE_UPDATE_EVENT = "poverty_coordinate_updated" as const;

export type PovertyCoordinateUpdateEvent = {
  householdId: string;
  householdHeadName: string;
  actorName: string;
  updatedAt: string;
};

export const buildPovertyCoordinateChannel = (workspaceId: string): string =>
  `poverty-household-coordinate-updates:${workspaceId}`;

export const buildPovertyCoordinateEvent = (
  payload: PovertyCoordinateUpdateEvent
): {
  type: "broadcast";
  event: typeof POVERTY_COORDINATE_UPDATE_EVENT;
  payload: PovertyCoordinateUpdateEvent;
} => ({
  type: "broadcast" as const,
  event: POVERTY_COORDINATE_UPDATE_EVENT,
  payload
});

export async function broadcastPovertyCoordinateUpdate(
  workspaceId: string,
  payload: PovertyCoordinateUpdateEvent
): Promise<void> {
  let channel: ReturnType<ReturnType<typeof getSupabaseAdmin>["channel"]> | null = null;

  try {
    const client = getSupabaseAdmin();
    channel = client.channel(buildPovertyCoordinateChannel(workspaceId), {
      config: { broadcast: { ack: true } }
    });

    await new Promise<void>((resolve, reject) => {
      channel?.subscribe((status, error) => {
        if (status === "SUBSCRIBED") {
          resolve();
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || error) {
          reject(error ?? new Error(`Supabase Realtime channel status: ${status}`));
        }
      });
    });

    const status = await channel.send(buildPovertyCoordinateEvent(payload));
    if (status !== "ok") {
      throw new Error(`Supabase Realtime broadcast failed: ${status}`);
    }
  } catch (error) {
    logger.warn(
      { error, workspaceId, householdId: payload.householdId },
      "Unable to broadcast poverty coordinate update"
    );
  } finally {
    if (channel) {
      try {
        await getSupabaseAdmin().removeChannel(channel);
      } catch (error) {
        logger.warn(
          { error, workspaceId, householdId: payload.householdId },
          "Unable to remove poverty coordinate realtime channel"
        );
      }
    }
  }
}

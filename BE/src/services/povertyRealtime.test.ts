import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/supabase.ts", () => ({
  getSupabaseAdmin: vi.fn()
}));

import { getSupabaseAdmin } from "@/services/supabase.ts";
import {
  broadcastPovertyCoordinateUpdate,
  buildPovertyCoordinateChannel,
  buildPovertyCoordinateEvent
} from "./povertyRealtime.ts";

const payload = {
  householdId: "household-1",
  householdHeadName: "Trần Văn B",
  actorName: "Nguyễn Văn A",
  updatedAt: "2026-07-29T03:30:00.000Z"
};

describe("poverty realtime publisher", () => {
  it("builds a workspace-scoped channel and broadcast event", () => {
    expect(buildPovertyCoordinateChannel("workspace-1")).toBe("poverty-household-coordinate-updates:workspace-1");
    expect(buildPovertyCoordinateEvent(payload)).toEqual({
      type: "broadcast",
      event: "poverty_coordinate_updated",
      payload
    });
  });

  it("subscribes, sends, and removes the channel", async () => {
    const channel = {
      subscribe: vi.fn((callback: (status: string) => void) => callback("SUBSCRIBED")),
      send: vi.fn().mockResolvedValue("ok")
    };
    const client = {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn().mockResolvedValue("ok")
    };
    vi.mocked(getSupabaseAdmin).mockReturnValue(client as never);

    await broadcastPovertyCoordinateUpdate("workspace-1", payload);

    expect(channel.subscribe).toHaveBeenCalledOnce();
    expect(channel.send).toHaveBeenCalledWith({
      type: "broadcast",
      event: "poverty_coordinate_updated",
      payload
    });
    expect(client.removeChannel).toHaveBeenCalledWith(channel);
  });

  it("absorbs transport failures", async () => {
    const channel = {
      subscribe: vi.fn((callback: (status: string) => void) => callback("SUBSCRIBED")),
      send: vi.fn().mockResolvedValue("error")
    };
    const client = {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn().mockResolvedValue("ok")
    };
    vi.mocked(getSupabaseAdmin).mockReturnValue(client as never);

    await expect(broadcastPovertyCoordinateUpdate("workspace-1", payload)).resolves.toBeUndefined();
    expect(client.removeChannel).toHaveBeenCalledWith(channel);
  });
});

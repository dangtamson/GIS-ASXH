import { describe, expect, it } from "vitest";
import { createInFlightRequestCache } from "./inflight-request-cache.ts";

describe("createInFlightRequestCache", () => {
  it("shares one promise for concurrent calls with the same key", async () => {
    const cache = createInFlightRequestCache();
    let calls = 0;
    let resolveRequest!: (value: string) => void;
    const request = new Promise<string>((resolve) => {
      resolveRequest = resolve;
    });

    const first = cache.run("same-token", async () => {
      calls += 1;
      return request;
    });
    const second = cache.run("same-token", async () => {
      calls += 1;
      return "unexpected";
    });

    resolveRequest("verified");

    await expect(Promise.all([first, second])).resolves.toEqual(["verified", "verified"]);
    expect(calls).toBe(1);
  });
});

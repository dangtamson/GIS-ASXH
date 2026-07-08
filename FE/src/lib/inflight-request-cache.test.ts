import test from "node:test";
import assert from "node:assert/strict";
import { createInFlightRequestCache } from "./inflight-request-cache.ts";

test("createInFlightRequestCache reuses the same promise while a request is in flight", async () => {
    const cache = createInFlightRequestCache();
    let callCount = 0;

    const first = cache.run("wards:92", async () => {
        callCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return ["31150", "31117"];
    });

    const second = cache.run("wards:92", async () => {
        callCount += 1;
        return ["should-not-run"];
    });

    const [firstResult, secondResult] = await Promise.all([first, second]);

    assert.equal(callCount, 1);
    assert.deepEqual(firstResult, ["31150", "31117"]);
    assert.deepEqual(secondResult, ["31150", "31117"]);
});

test("createInFlightRequestCache allows a new request after the previous one settles", async () => {
    const cache = createInFlightRequestCache();
    let callCount = 0;

    const first = await cache.run("households:query-1", async () => {
        callCount += 1;
        return { total: 29 };
    });

    const second = await cache.run("households:query-1", async () => {
        callCount += 1;
        return { total: 30 };
    });

    assert.equal(callCount, 2);
    assert.deepEqual(first, { total: 29 });
    assert.deepEqual(second, { total: 30 });
});

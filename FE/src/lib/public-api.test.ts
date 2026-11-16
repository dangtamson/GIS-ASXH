import assert from "node:assert/strict";
import test from "node:test";
import { publicApiPost } from "./public-api.ts";

test("publicApiPost sends JSON without authenticated workspace headers", async () => {
    const originalFetch = globalThis.fetch;
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        capturedUrl = String(input);
        capturedInit = init;
        return new Response(JSON.stringify({ data: { receiptCode: "SA-receipt" } }), {
            status: 201,
            headers: { "content-type": "application/json" }
        });
    }) as typeof fetch;

    try {
        const response = await publicApiPost<{ receiptCode: string }>(
            "/public/social-assistance/opaque-slug/requests",
            { contactName: "Nguyen Van A" },
            { "Idempotency-Key": "opaque-key" }
        );
        const headers = new Headers(capturedInit?.headers);

        assert.deepEqual(response, { receiptCode: "SA-receipt" });
        assert.equal(capturedUrl, "/public/social-assistance/opaque-slug/requests");
        assert.equal(capturedInit?.method, "POST");
        assert.equal(headers.get("Idempotency-Key"), "opaque-key");
        assert.equal(headers.has("Authorization"), false);
        assert.equal(headers.has("x-workspace-id"), false);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
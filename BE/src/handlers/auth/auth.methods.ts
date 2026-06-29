import { logger } from "@/helpers/index.ts";
import { supabase } from "@/services/supabase.ts";
import { createHmac, timingSafeEqual } from "crypto";

const APP_TOKEN_SECRET = process.env.APP_JWT_SECRET || "local-dev-app-jwt-secret";

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function verifyAppToken(token: string): { sub: string } | null {
  try {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
    if (!encodedHeader || !encodedPayload || !encodedSignature) {
      return null;
    }

    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const computedSignature = createHmac("sha256", APP_TOKEN_SECRET)
      .update(signingInput)
      .digest("base64url");

    const signatureBuffer = Buffer.from(encodedSignature);
    const computedBuffer = Buffer.from(computedSignature);
    if (signatureBuffer.length !== computedBuffer.length || !timingSafeEqual(signatureBuffer, computedBuffer)) {
      return null;
    }

    const payloadText = base64UrlDecode(encodedPayload);
    const payload = JSON.parse(payloadText) as { sub?: string; exp?: number; iss?: string };

    if (payload.iss !== "app") {
      return null;
    }

    if (!payload.sub) {
      return null;
    }

    if (typeof payload.exp === "number" && Date.now() >= payload.exp * 1000) {
      return null;
    }

    return { sub: payload.sub };
  } catch {
    return null;
  }
}

/**
 * Verify JWT token using Supabase getClaims()
 *
 * This method automatically adapts based on your Supabase key system:
 * - With asymmetric keys: Verifies locally using Web Crypto API (fast, secure)
 * - With symmetric keys: Makes network call to Auth server (slower, but safe)
 */
export const verifyToken = async (
  token: string
): Promise<{
  sub: string;
} | null> => {
  const appToken = verifyAppToken(token);
  if (appToken) {
    return appToken;
  }

  try {
    const { data, error } = await supabase.auth.getClaims(token);

    if (error || !data) {
      logger.warn({ error }, "Token verification failed via getClaims()");
      return null;
    }

    const sub = data.claims.sub as string;

    if (!sub) {
      logger.warn("Token missing 'sub' claim");
      return null;
    }

    return { sub };
  } catch (err) {
    logger.error({ err }, "Token validation failed");
    return null;
  }
};

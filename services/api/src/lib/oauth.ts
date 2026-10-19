import { createPublicKey } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../env.js";

export type OAuthProviderName = "google" | "apple" | "facebook";

export interface OAuthIdentity {
  providerUserId: string;
  /** Only set when the provider vouches that the address is verified. */
  email?: string;
}

/**
 * Validates a provider access/id token server-side and returns the
 * provider's stable user id (+ email when available). Clerk is not used for
 * customer auth (plan §3), so this backend does the exchange itself.
 */
export async function verifyOAuthToken(
  provider: OAuthProviderName,
  providerToken: string,
): Promise<OAuthIdentity> {
  switch (provider) {
    case "google":
      return verifyGoogleToken(providerToken);
    case "facebook":
      return verifyFacebookToken(providerToken);
    case "apple":
      return verifyAppleToken(providerToken);
  }
}

async function verifyGoogleToken(idToken: string): Promise<OAuthIdentity> {
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );
  if (!res.ok) throw new Error("Invalid Google id_token");
  const payload = (await res.json()) as {
    sub: string;
    aud: string;
    email?: string;
    email_verified?: string | boolean;
  };
  // Reject tokens minted for some other app.
  if (!env.googleClientIds.includes(payload.aud)) throw new Error("Google token audience mismatch");
  const verified = payload.email_verified === true || payload.email_verified === "true";
  return { providerUserId: payload.sub, email: verified ? payload.email : undefined };
}

async function verifyFacebookToken(accessToken: string): Promise<OAuthIdentity> {
  const res = await fetch(
    `https://graph.facebook.com/me?fields=id,email&access_token=${encodeURIComponent(accessToken)}`,
  );
  if (!res.ok) throw new Error("Invalid Facebook access_token");
  const payload = (await res.json()) as { id: string; email?: string };
  return { providerUserId: payload.id, email: payload.email };
}

interface Jwk {
  kid: string;
  kty: string;
  [k: string]: unknown;
}

let appleKeys: { fetchedAt: number; keys: Jwk[] } | undefined;
const APPLE_KEYS_TTL_MS = 60 * 60 * 1000;

async function getAppleKey(kid: string): Promise<Jwk | undefined> {
  const fresh = appleKeys && Date.now() - appleKeys.fetchedAt < APPLE_KEYS_TTL_MS;
  if (fresh) {
    const hit = appleKeys!.keys.find((k) => k.kid === kid);
    if (hit) return hit;
  }
  // Cache miss or stale: refetch (also covers Apple rotating keys).
  const res = await fetch("https://appleid.apple.com/auth/keys");
  if (!res.ok) throw new Error("Could not fetch Apple signing keys");
  const { keys } = (await res.json()) as { keys: Jwk[] };
  appleKeys = { fetchedAt: Date.now(), keys };
  return keys.find((k) => k.kid === kid);
}

async function verifyAppleToken(identityToken: string): Promise<OAuthIdentity> {
  const decoded = jwt.decode(identityToken, { complete: true });
  const kid = decoded && typeof decoded === "object" ? decoded.header.kid : undefined;
  if (!kid) throw new Error("Malformed Apple identityToken");

  const jwk = await getAppleKey(kid);
  if (!jwk) throw new Error("Unknown Apple signing key");

  const [firstAudience, ...otherAudiences] = env.appleClientIds;
  if (!firstAudience) throw new Error("APPLE_OAUTH_CLIENT_ID is not configured");

  const publicKey = createPublicKey({ key: jwk as never, format: "jwk" });
  const payload = jwt.verify(identityToken, publicKey, {
    algorithms: ["RS256"],
    issuer: "https://appleid.apple.com",
    audience: [firstAudience, ...otherAudiences],
  }) as { sub: string; email?: string; email_verified?: string | boolean };

  const verified = payload.email_verified === true || payload.email_verified === "true";
  return { providerUserId: payload.sub, email: verified ? payload.email : undefined };
}

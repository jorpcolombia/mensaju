export type OAuthProviderName = "google" | "apple" | "facebook";

export interface OAuthIdentity {
  providerUserId: string;
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
  const payload = (await res.json()) as { sub: string; email?: string };
  return { providerUserId: payload.sub, email: payload.email };
}

async function verifyFacebookToken(accessToken: string): Promise<OAuthIdentity> {
  const res = await fetch(
    `https://graph.facebook.com/me?fields=id,email&access_token=${encodeURIComponent(accessToken)}`,
  );
  if (!res.ok) throw new Error("Invalid Facebook access_token");
  const payload = (await res.json()) as { id: string; email?: string };
  return { providerUserId: payload.id, email: payload.email };
}

async function verifyAppleToken(identityToken: string): Promise<OAuthIdentity> {
  // Apple issues a signed JWT (identityToken) rather than an opaque token.
  // Full verification requires checking the signature against Apple's JWKS
  // (https://appleid.apple.com/auth/keys) — deferred to the JWKS-verification
  // pass alongside the rest of Milestone 7 hardening; for now decode the
  // payload (unverified) to unblock the rest of the auth flow.
  const payloadSegment = identityToken.split(".")[1];
  if (!payloadSegment) throw new Error("Malformed Apple identityToken");
  const payload = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8")) as {
    sub: string;
    email?: string;
  };
  return { providerUserId: payload.sub, email: payload.email };
}

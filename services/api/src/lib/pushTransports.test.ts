import { generateKeyPairSync } from "node:crypto";
import jwt from "jsonwebtoken";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApnsTransport,
  FcmTransport,
  InvalidPushTokenError,
  buildApnsBody,
} from "./pushTransports.js";

const payload = { title: "Acme", body: "Hello", data: { conversationId: "c1" } };

describe("FcmTransport", () => {
  afterEach(() => vi.unstubAllGlobals());

  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const account = { client_email: "svc@p.iam", private_key: privateKey, project_id: "proj" };

  function stubFetch(sendResponse: { ok: boolean; status: number; text?: string }) {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        if (url.includes("oauth2.googleapis.com")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ access_token: "at", expires_in: 3600 }),
          };
        }
        return {
          ok: sendResponse.ok,
          status: sendResponse.status,
          text: async () => sendResponse.text ?? "",
        };
      }),
    );
    return calls;
  }

  it("authenticates once and posts a v1 message with the device token", async () => {
    const calls = stubFetch({ ok: true, status: 200 });
    const fcm = new FcmTransport(account);
    await fcm.send("device-1", payload);
    await fcm.send("device-2", payload);

    expect(calls.filter((c) => c.url.includes("oauth2")).length).toBe(1); // token cached
    const sends = calls.filter((c) => c.url.includes("messages:send"));
    expect(sends).toHaveLength(2);
    expect(sends[0]!.url).toContain("/projects/proj/");
    const body = JSON.parse(sends[0]!.init!.body as string);
    expect(body.message.token).toBe("device-1");
    expect(body.message.notification).toEqual({ title: "Acme", body: "Hello" });
    expect(body.message.data).toEqual({ conversationId: "c1" });
  });

  it("signs the OAuth assertion for the messaging scope", async () => {
    const calls = stubFetch({ ok: true, status: 200 });
    await new FcmTransport(account).send("d", payload);
    const form = calls[0]!.init!.body as URLSearchParams;
    const claims = jwt.decode(form.get("assertion")!) as { iss: string; scope: string };
    expect(claims.iss).toBe("svc@p.iam");
    expect(claims.scope).toContain("firebase.messaging");
  });

  it("flags unregistered tokens so they can be deleted", async () => {
    stubFetch({ ok: false, status: 404, text: '{"error":{"details":[{"errorCode":"UNREGISTERED"}]}}' });
    await expect(new FcmTransport(account).send("dead", payload)).rejects.toBeInstanceOf(
      InvalidPushTokenError,
    );
  });

  it("surfaces other failures as ordinary errors", async () => {
    stubFetch({ ok: false, status: 500, text: "boom" });
    const err = await new FcmTransport(account).send("d", payload).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(InvalidPushTokenError);
  });
});

describe("APNs", () => {
  it("builds an alert payload with custom data at the top level", () => {
    const body = JSON.parse(buildApnsBody(payload));
    expect(body.aps.alert).toEqual({ title: "Acme", body: "Hello" });
    expect(body.conversationId).toBe("c1");
  });

  it("signs provider tokens with ES256 using the team and key ids", () => {
    const { privateKey } = generateKeyPairSync("ec", {
      namedCurve: "P-256",
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const apns = new ApnsTransport({
      keyP8: privateKey,
      keyId: "KEYID123",
      teamId: "TEAM123",
      bundleId: "ai.example.app",
      production: false,
    });
    const token = (apns as unknown as { getProviderToken(): string }).getProviderToken();
    const decoded = jwt.decode(token, { complete: true })!;
    expect(decoded.header.alg).toBe("ES256");
    expect(decoded.header.kid).toBe("KEYID123");
    expect((decoded.payload as { iss: string }).iss).toBe("TEAM123");
  });
});

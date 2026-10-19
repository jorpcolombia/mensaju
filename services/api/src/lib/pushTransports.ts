import { connect } from "node:http2";
import jwt from "jsonwebtoken";
import { env } from "../env.js";
import type { PushPayload, PushTransport } from "./push.js";

/** Thrown when a push provider says the device token is permanently invalid; callers should delete it. */
export class InvalidPushTokenError extends Error {}

// ---- FCM (Android), HTTP v1 -------------------------------------------------

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

export class FcmTransport {
  private accessToken?: { value: string; expiresAt: number };

  constructor(private readonly account: ServiceAccount) {}

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 60_000) {
      return this.accessToken.value;
    }
    const now = Math.floor(Date.now() / 1000);
    const assertion = jwt.sign(
      {
        iss: this.account.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      },
      this.account.private_key,
      { algorithm: "RS256" },
    );
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    if (!res.ok) throw new Error(`FCM auth failed: ${res.status}`);
    const body = (await res.json()) as { access_token: string; expires_in: number };
    this.accessToken = {
      value: body.access_token,
      expiresAt: Date.now() + body.expires_in * 1000,
    };
    return body.access_token;
  }

  async send(token: string, payload: PushPayload): Promise<void> {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${this.account.project_id}/messages:send`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await this.getAccessToken()}`,
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: payload.title, body: payload.body },
            data: payload.data,
            android: { priority: "HIGH" },
          },
        }),
      },
    );
    if (res.ok) return;
    const text = await res.text();
    if (res.status === 404 || text.includes("UNREGISTERED")) throw new InvalidPushTokenError(text);
    throw new Error(`FCM send failed: ${res.status} ${text}`);
  }
}

// ---- APNs (iOS), HTTP/2 token auth --------------------------------------------

export interface ApnsConfig {
  keyP8: string;
  keyId: string;
  teamId: string;
  bundleId: string;
  production: boolean;
}

export function buildApnsBody(payload: PushPayload): string {
  return JSON.stringify({
    aps: { alert: { title: payload.title, body: payload.body }, sound: "default" },
    ...payload.data,
  });
}

export class ApnsTransport {
  private providerToken?: { value: string; issuedAt: number };

  constructor(private readonly config: ApnsConfig) {}

  // APNs wants the provider token refreshed between 20 and 60 minutes.
  private getProviderToken(): string {
    if (this.providerToken && Date.now() - this.providerToken.issuedAt < 40 * 60_000) {
      return this.providerToken.value;
    }
    const value = jwt.sign({ iss: this.config.teamId }, this.config.keyP8, {
      algorithm: "ES256",
      keyid: this.config.keyId,
    });
    this.providerToken = { value, issuedAt: Date.now() };
    return value;
  }

  send(token: string, payload: PushPayload): Promise<void> {
    const host = this.config.production
      ? "https://api.push.apple.com"
      : "https://api.sandbox.push.apple.com";
    return new Promise((resolve, reject) => {
      const client = connect(host);
      client.on("error", reject);
      const req = client.request({
        ":method": "POST",
        ":path": `/3/device/${token}`,
        authorization: `bearer ${this.getProviderToken()}`,
        "apns-topic": this.config.bundleId,
        "apns-push-type": "alert",
      });
      let status = 0;
      let body = "";
      req.on("response", (headers) => {
        status = Number(headers[":status"]);
      });
      req.on("data", (chunk: Buffer) => (body += chunk.toString()));
      req.on("end", () => {
        client.close();
        if (status === 200) return resolve();
        if (status === 410 || body.includes("BadDeviceToken") || body.includes("Unregistered")) {
          return reject(new InvalidPushTokenError(body));
        }
        reject(new Error(`APNs send failed: ${status} ${body}`));
      });
      req.on("error", reject);
      req.end(buildApnsBody(payload));
    });
  }
}

// ---- Wiring ---------------------------------------------------------------------

/** Builds a transport from env, or returns null (caller keeps the logging transport) when not configured. */
export function createPushTransportFromEnv(): PushTransport | null {
  const fcm = env.fcmServiceAccountJson
    ? new FcmTransport(JSON.parse(env.fcmServiceAccountJson) as ServiceAccount)
    : null;
  const apns =
    env.apnsKeyP8 && env.apnsKeyId && env.apnsTeamId && env.apnsBundleId
      ? new ApnsTransport({
          keyP8: env.apnsKeyP8.replace(/\\n/g, "\n"),
          keyId: env.apnsKeyId,
          teamId: env.apnsTeamId,
          bundleId: env.apnsBundleId,
          production: env.apnsProduction,
        })
      : null;
  if (!fcm && !apns) return null;

  return {
    async send(device, payload) {
      if (device.platform === "android") {
        if (fcm) await fcm.send(device.token, payload);
      } else if (apns) {
        await apns.send(device.token, payload);
      }
    },
  };
}

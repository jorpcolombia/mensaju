import { randomInt } from "node:crypto";
import { required } from "../../env.js";
import { redis } from "../redis.js";

const CODE_TTL_SECONDS = 5 * 60;

function otpKey(phoneE164: string): string {
  return `otp:whatsapp:${phoneE164}`;
}

/**
 * WhatsApp Cloud API integration (plan §3 — direct, not via a third-party
 * OTP service). The Cloud API only sends template messages; it has no
 * server-side "verify" concept, so we generate/store the code ourselves
 * (Redis, short TTL) and verify locally.
 */
export interface WhatsAppOtpProvider {
  sendCode(phoneE164: string): Promise<void>;
  verifyCode(phoneE164: string, code: string): Promise<boolean>;
}

class CloudApiWhatsAppOtpProvider implements WhatsAppOtpProvider {
  async sendCode(phoneE164: string): Promise<void> {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await redis.set(otpKey(phoneE164), code, "EX", CODE_TTL_SECONDS);

    const phoneNumberId = required("WHATSAPP_CLOUD_PHONE_NUMBER_ID");
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${required("WHATSAPP_CLOUD_API_TOKEN")}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phoneE164.replace("+", ""),
          type: "template",
          template: {
            // Template must be pre-approved in WhatsApp Business Manager
            // with a single body variable for the code.
            name: "otp_code",
            language: { code: "en_US" },
            components: [
              {
                type: "body",
                parameters: [{ type: "text", text: code }],
              },
            ],
          },
        }),
      },
    );
    if (!res.ok) {
      throw new Error(`WhatsApp OTP send failed: ${res.status} ${await res.text()}`);
    }
  }

  async verifyCode(phoneE164: string, code: string): Promise<boolean> {
    const key = otpKey(phoneE164);
    const stored = await redis.get(key);
    if (!stored || stored !== code) return false;
    await redis.del(key);
    return true;
  }
}

export const whatsAppOtpProvider: WhatsAppOtpProvider = new CloudApiWhatsAppOtpProvider();

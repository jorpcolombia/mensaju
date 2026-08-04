import { required } from "../../env.js";

/**
 * Wraps the in-house custom SMS HTTP API (plan §3 — not Twilio). Isolated
 * behind this interface so the concrete HTTP contract can change without
 * touching call sites.
 */
export interface SmsOtpProvider {
  sendCode(phoneE164: string): Promise<void>;
  verifyCode(phoneE164: string, code: string): Promise<boolean>;
}

class HttpSmsOtpProvider implements SmsOtpProvider {
  async sendCode(phoneE164: string): Promise<void> {
    const res = await fetch(`${required("CUSTOM_SMS_API_URL")}/otp/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${required("CUSTOM_SMS_API_KEY")}`,
      },
      body: JSON.stringify({ phone: phoneE164 }),
    });
    if (!res.ok) {
      throw new Error(`SMS OTP send failed: ${res.status} ${await res.text()}`);
    }
  }

  async verifyCode(phoneE164: string, code: string): Promise<boolean> {
    const res = await fetch(`${required("CUSTOM_SMS_API_URL")}/otp/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${required("CUSTOM_SMS_API_KEY")}`,
      },
      body: JSON.stringify({ phone: phoneE164, code }),
    });
    if (res.status === 401 || res.status === 400) return false;
    if (!res.ok) {
      throw new Error(`SMS OTP verify failed: ${res.status} ${await res.text()}`);
    }
    const body = (await res.json()) as { verified: boolean };
    return body.verified === true;
  }
}

export const smsOtpProvider: SmsOtpProvider = new HttpSmsOtpProvider();

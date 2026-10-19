"use client";

import type { RequestOtpRequest, VerifyOtpRequest, VerifyOtpResponse } from "@messages/shared-types";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "../../lib/api";
import { saveCustomerSession } from "../../lib/customerAuth";

export default function CustomerLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<RequestOtpRequest["channel"]>("sms");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode() {
    setBusy(true);
    setError(null);
    try {
      const body: RequestOtpRequest = { channel, phone };
      await apiFetch("/auth/otp/request", null, { method: "POST", body: JSON.stringify(body) });
      setCodeSent(true);
    } catch {
      setError("Could not send a code. Check the number and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setBusy(true);
    setError(null);
    try {
      const body: VerifyOtpRequest = { phone, code };
      const res = await apiFetch<VerifyOtpResponse>("/auth/otp/verify", null, {
        method: "POST",
        body: JSON.stringify(body),
      });
      saveCustomerSession({ token: res.token, customerId: res.customer.id });
      router.push("/c/conversations");
    } catch {
      setError("That code is invalid or has expired.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>Sign in</h1>
      {!codeSent ? (
        <>
          <input
            placeholder="Phone number, e.g. +15551234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as RequestOtpRequest["channel"])}
          >
            <option value="sms">Text message</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
          <button disabled={busy || !phone.trim()} onClick={() => void requestCode()}>
            Send code
          </button>
        </>
      ) : (
        <>
          <p>Enter the code we sent to {phone}.</p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button disabled={busy || !code.trim()} onClick={() => void verifyCode()}>
            Verify
          </button>
          <button onClick={() => setCodeSent(false)}>Use a different number</button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}

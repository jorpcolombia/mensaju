import type { IdentifierType } from "@messages/shared-types";
import { env } from "../env.js";
import { sendCustomerOutreachEmail } from "./email.js";

/**
 * Best-effort heads-up to a customer who has not signed in yet, so an
 * agent-initiated thread isn't silently invisible. Never throws: the message
 * itself is already stored and will be there when the customer signs in.
 *
 * Government-ID-only customers have no reachable channel; they see the
 * thread once they link/verify that ID after signing in.
 */
export async function notifyUnregisteredCustomer(params: {
  type: IdentifierType;
  value: string;
  organizationName: string;
}): Promise<void> {
  try {
    if (params.type === "email") {
      await sendCustomerOutreachEmail({ to: params.value, organizationName: params.organizationName });
    } else if (params.type === "phone") {
      if (!env.customSmsApiUrl || !env.customSmsApiKey) {
        console.log(`[sms] ${params.value}: ${params.organizationName} sent you a message`);
        return;
      }
      // Assumes the in-house SMS API exposes /sms/send alongside /otp/*; adjust to its real contract.
      const res = await fetch(`${env.customSmsApiUrl}/sms/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.customSmsApiKey}`,
        },
        body: JSON.stringify({
          phone: params.value,
          text: `${params.organizationName} sent you a message. Open the app and sign in with this number to reply.`,
        }),
      });
      if (!res.ok) console.error(`[sms] outreach notify failed: ${res.status}`);
    }
  } catch (err) {
    console.error("[notify] outreach notification failed", err);
  }
}

import { env } from "../env.js";

async function sendEmail(params: { to: string; subject: string; text: string }): Promise<void> {
  if (!env.resendApiKey || !env.emailFrom) {
    // No provider configured (local dev): surface the message in the logs instead.
    console.log(`[email] to=${params.to} subject="${params.subject}"\n${params.text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.resendApiKey}`,
    },
    body: JSON.stringify({
      from: env.emailFrom,
      to: [params.to],
      subject: params.subject,
      text: params.text,
    }),
  });
  if (!res.ok) {
    throw new Error(`Email send failed: ${res.status} ${await res.text()}`);
  }
}

/** Org/agent invites are sent by our own backend, not Clerk (plan §3). */
export async function sendAgentInviteEmail(params: {
  to: string;
  organizationName: string;
  inviteId: string;
}): Promise<void> {
  const link = `${env.webBaseUrl}/agents/accept?invite=${encodeURIComponent(params.inviteId)}`;
  await sendEmail({
    to: params.to,
    subject: `You've been invited to ${params.organizationName}`,
    text: `You've been invited to join ${params.organizationName}. Sign in or sign up, then accept the invite:\n\n${link}\n\nThis invite expires in 7 days.`,
  });
}

/** Tells a customer who has never signed in that an organization has messaged them. */
export async function sendCustomerOutreachEmail(params: {
  to: string;
  organizationName: string;
}): Promise<void> {
  await sendEmail({
    to: params.to,
    subject: `${params.organizationName} sent you a message`,
    text: `${params.organizationName} sent you a message. Open the app and sign in with this email address to read and reply.`,
  });
}

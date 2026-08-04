/**
 * Placeholder transactional email sender. Org/agent invites are sent by our
 * own backend, not Clerk (plan §3) — wire a real provider (SES, Postmark,
 * etc.) here before going live; for now this just logs.
 */
export async function sendAgentInviteEmail(params: {
  to: string;
  organizationName: string;
  inviteId: string;
}): Promise<void> {
  console.log(
    `[email] Invite ${params.to} to join ${params.organizationName} — inviteId=${params.inviteId}`,
  );
}

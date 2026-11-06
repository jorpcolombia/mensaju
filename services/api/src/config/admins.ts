/**
 * Clerk user ids that have admin access (organization approval panel and `/api/admin/*`).
 *
 * Add the id of each admin (Clerk dashboard → Users → copy "User ID", e.g. `user_2abc…`).
 * Anyone not listed gets 403, regardless of what they hold in Clerk. `ADMIN_CLERK_USER_IDS`
 * (comma-separated) is merged in as an optional extra without a code change.
 */
export const ADMIN_CLERK_USER_IDS: readonly string[] = [
  // "user_xxxxxxxxxxxxxxxxxxxxxxxxxxx",
];

const fromEnv = (process.env.ADMIN_CLERK_USER_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function isAdminUserId(clerkUserId: string | undefined): boolean {
  if (!clerkUserId) return false;
  return ADMIN_CLERK_USER_IDS.includes(clerkUserId) || fromEnv.includes(clerkUserId);
}

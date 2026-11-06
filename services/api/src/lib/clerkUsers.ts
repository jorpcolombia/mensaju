import { createClerkClient } from "@clerk/backend";
import { required } from "../env.js";

/** Lower-cased, *verified* email addresses of a Clerk user. */
export async function getVerifiedEmails(clerkUserId: string): Promise<string[]> {
  const clerk = createClerkClient({ secretKey: required("CLERK_SECRET_KEY") });
  const user = await clerk.users.getUser(clerkUserId);
  return user.emailAddresses
    .filter((e) => e.verification?.status === "verified")
    .map((e) => e.emailAddress.toLowerCase());
}

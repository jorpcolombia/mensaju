import { clerkMiddleware } from "@clerk/nextjs/server";

// Uses the messages-admin Clerk app's keys — fully separate from apps/web,
// so admin sessions never share cookies/session storage with org/agent
// sessions. See plan §3 (Isolation).
export default clerkMiddleware();

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};

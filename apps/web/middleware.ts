import { clerkMiddleware } from "@clerk/nextjs/server";

// Uses the messages-org Clerk app's keys (CLERK_SECRET_KEY /
// NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in this app's env) — a fully separate
// Clerk application from apps/admin. See plan §3 (Isolation).
export default clerkMiddleware();

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};

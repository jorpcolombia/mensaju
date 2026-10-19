import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { APP_NAME } from "@messages/shared-types";
import Link from "next/link";

export default function AdminHomePage() {
  return (
    <main>
      <h1>{APP_NAME} Admin</h1>
      <SignedOut>
        <SignInButton />
      </SignedOut>
      <SignedIn>
        <UserButton />
        <p>
          <Link href="/organizations">Review organizations (pending queue)</Link>
        </p>
      </SignedIn>
    </main>
  );
}

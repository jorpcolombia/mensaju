import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { APP_NAME } from "@messages/shared-types";

export default function HomePage() {
  return (
    <main>
      <h1>{APP_NAME} — Org Console</h1>
      <SignedOut>
        <SignInButton />
      </SignedOut>
      <SignedIn>
        <UserButton />
        {/* Conversation list lands here (plan §11 milestone 3) */}
      </SignedIn>
    </main>
  );
}

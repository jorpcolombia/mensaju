import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { APP_NAME } from "@messages/shared-types";

export default function AdminHomePage() {
  return (
    <main>
      <h1>{APP_NAME} Admin</h1>
      <SignedOut>
        <SignInButton />
      </SignedOut>
      <SignedIn>
        <UserButton />
        {/* Pending-organization queue lands here (plan §11 milestone 4) */}
      </SignedIn>
    </main>
  );
}

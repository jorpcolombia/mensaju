import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { APP_NAME } from "@messages/shared-types";
import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>{APP_NAME} — Org Console</h1>
      <SignedOut>
        <SignInButton />
        <p>
          Are you a customer? <Link href="/c">Sign in to your messages</Link>
        </p>
      </SignedOut>
      <SignedIn>
        <UserButton />
        <nav>
          <ul>
            <li>
              <Link href="/conversations">Conversations</Link>
            </li>
            <li>
              <Link href="/organization">Organization profile</Link>
            </li>
            <li>
              <Link href="/agents/invite">Invite an agent</Link>
            </li>
          </ul>
        </nav>
      </SignedIn>
    </main>
  );
}

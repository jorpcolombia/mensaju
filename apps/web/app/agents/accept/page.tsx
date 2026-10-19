"use client";

import { SignedIn, SignedOut, SignInButton, useAuth } from "@clerk/nextjs";
import type { AcceptAgentInviteResponse } from "@messages/shared-types";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { apiFetch } from "../../../lib/api";

function AcceptInvite() {
  const { getToken } = useAuth();
  const router = useRouter();
  const inviteId = useSearchParams().get("invite");
  const [status, setStatus] = useState<string | null>(null);

  async function accept() {
    if (!inviteId) return;
    setStatus("Accepting…");
    try {
      const token = await getToken();
      await apiFetch<AcceptAgentInviteResponse>("/agents/accept-invite", token, {
        method: "POST",
        body: JSON.stringify({ inviteId }),
      });
      router.push("/conversations");
    } catch {
      setStatus("This invite is invalid, expired, or you already belong to an organization.");
    }
  }

  if (!inviteId) return <p>Missing invite link.</p>;

  return (
    <>
      <SignedOut>
        <p>Sign in or create an account to accept your invite.</p>
        <SignInButton />
      </SignedOut>
      <SignedIn>
        <button onClick={() => void accept()}>Accept invite</button>
      </SignedIn>
      {status && <p>{status}</p>}
    </>
  );
}

export default function AcceptInvitePage() {
  return (
    <main>
      <h1>Join your organization</h1>
      <Suspense>
        <AcceptInvite />
      </Suspense>
    </main>
  );
}

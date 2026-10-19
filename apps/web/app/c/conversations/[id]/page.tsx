"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Thread } from "../../../../components/Thread";
import { useCustomerSession } from "../../../../lib/customerAuth";

export default function CustomerThreadPage() {
  const { id: conversationId } = useParams<{ id: string }>();
  const router = useRouter();
  const { session, ready, getToken } = useCustomerSession();

  useEffect(() => {
    if (ready && !session) router.replace("/c");
  }, [ready, session, router]);

  if (!ready || !session) return <main>Loading…</main>;

  return (
    <main>
      <p>
        <Link href="/c/conversations">← All conversations</Link>
      </p>
      <h1>Conversation</h1>
      <Thread conversationId={conversationId} getToken={getToken} viewer="customer" />
    </main>
  );
}

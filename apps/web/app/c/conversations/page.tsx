"use client";

import type {
  Conversation,
  ListConversationsResponse,
  ListOrganizationDirectoryResponse,
  OrganizationDirectoryEntry,
  StartConversationResponse,
} from "@messages/shared-types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { createAblyClient, type AblyRealtimeInstance } from "../../../lib/ably";
import { useCustomerSession } from "../../../lib/customerAuth";

export default function CustomerConversationsPage() {
  const router = useRouter();
  const { session, ready, getToken, signOut } = useCustomerSession();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [directory, setDirectory] = useState<OrganizationDirectoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const ablyRef = useRef<AblyRealtimeInstance | null>(null);

  async function refresh() {
    const token = await getToken();
    const page = await apiFetch<ListConversationsResponse>("/conversations", token);
    setConversations(page.conversations);
  }

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      router.replace("/c");
      return;
    }
    void (async () => {
      try {
        await refresh();
        const token = await getToken();
        const dir = await apiFetch<ListOrganizationDirectoryResponse>(
          "/organizations/directory",
          token,
        );
        setDirectory(dir.organizations);
      } catch {
        // An expired or revoked session lands here; send the customer back to sign in.
        signOut();
        router.replace("/c");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, session?.customerId]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    void createAblyClient(getToken).then((ably) => {
      if (cancelled) {
        ably.close();
        return;
      }
      ablyRef.current = ably;
      const channel = ably.channels.get(`customer:${session.customerId}:notifications`);
      // A brand-new thread (e.g. an organization messaging first) needs a fresh token
      // so this client may subscribe to its channel.
      channel.subscribe("conversation.created", () => {
        void ably.auth.authorize().catch(() => {});
        void refresh();
      });
      channel.subscribe("conversation.updated", () => {
        void refresh();
      });
    });
    return () => {
      cancelled = true;
      ablyRef.current?.close();
      ablyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.customerId]);

  async function startConversation(organizationId: string) {
    setError(null);
    try {
      const token = await getToken();
      const { conversation } = await apiFetch<StartConversationResponse>("/conversations", token, {
        method: "POST",
        body: JSON.stringify({ organizationId }),
      });
      router.push(`/c/conversations/${conversation.id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const orgNames = new Map(directory.map((o) => [o.id, o.name]));

  if (!ready || !session) return <main>Loading…</main>;

  return (
    <main>
      <h1>Your conversations</h1>
      <button
        onClick={() => {
          signOut();
          router.replace("/c");
        }}
      >
        Sign out
      </button>

      <ul>
        {conversations.map((c) => (
          <li key={c.id}>
            <Link href={`/c/conversations/${c.id}`}>
              <strong>{orgNames.get(c.organizationId) ?? "Organization"}</strong>:{" "}
              {c.lastMessagePreview ?? "(no messages yet)"}
            </Link>
            {c.unreadCount ? <strong> ({c.unreadCount} new)</strong> : null}
          </li>
        ))}
      </ul>
      {conversations.length === 0 && <p>No conversations yet.</p>}

      <h2>Message an organization</h2>
      <ul>
        {directory.map((o) => (
          <li key={o.id}>
            {o.name}
            {o.description ? ` — ${o.description}` : ""}{" "}
            <button onClick={() => void startConversation(o.id)}>Message</button>
          </li>
        ))}
      </ul>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}

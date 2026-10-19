"use client";

import { useAuth } from "@clerk/nextjs";
import type {
  Agent,
  Conversation,
  IdentifierType,
  ListConversationsResponse,
  SendMessageResponse,
} from "@messages/shared-types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../../lib/api";
import { createAblyClient, type AblyRealtimeInstance } from "../../lib/ably";

export default function ConversationsPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const ablyRef = useRef<AblyRealtimeInstance | null>(null);

  const [idType, setIdType] = useState<IdentifierType>("phone");
  const [idValue, setIdValue] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const token = await getToken();
    const page = await apiFetch<ListConversationsResponse>("/conversations", token);
    setConversations(page.conversations);
    setNextCursor(page.nextCursor);
  }

  async function loadMore() {
    if (!nextCursor) return;
    const token = await getToken();
    const page = await apiFetch<ListConversationsResponse>(
      `/conversations?before=${encodeURIComponent(nextCursor)}`,
      token,
    );
    setConversations((prev) => [...prev, ...page.conversations]);
    setNextCursor(page.nextCursor);
  }

  useEffect(() => {
    void (async () => {
      const token = await getToken();
      const { agent } = await apiFetch<{ agent: Agent }>("/agents/me", token);
      setAgent(agent);
      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!agent?.organizationId) return;
    let cancelled = false;
    void createAblyClient(getToken).then((ably) => {
      if (cancelled) {
        ably.close();
        return;
      }
      ablyRef.current = ably;
      const channel = ably.channels.get(`org:${agent.organizationId}:notifications`);
      // New threads need a fresh token so the client may subscribe to their channel.
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
  }, [agent?.organizationId]);

  async function startConversation() {
    setError(null);
    try {
      const token = await getToken();
      const { message } = await apiFetch<SendMessageResponse>("/messages", token, {
        method: "POST",
        body: JSON.stringify({ customer: { type: idType, value: idValue }, text }),
      });
      router.push(`/conversations/${message.conversationId}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main>
      <h1>Conversations</h1>

      <section>
        <h2>Message a customer</h2>
        <select value={idType} onChange={(e) => setIdType(e.target.value as IdentifierType)}>
          <option value="phone">Phone</option>
          <option value="email">Email</option>
          <option value="govId">ID number</option>
        </select>
        <input
          placeholder={idType === "email" ? "customer@example.com" : idType === "phone" ? "+15551234567" : "ID number"}
          value={idValue}
          onChange={(e) => setIdValue(e.target.value)}
        />
        <input placeholder="message" value={text} onChange={(e) => setText(e.target.value)} />
        <button
          disabled={!idValue.trim() || !text.trim()}
          onClick={() => void startConversation()}
        >
          Send
        </button>
        {error && <p role="alert">{error}</p>}
      </section>

      <ul>
        {conversations.map((c) => (
          <li key={c.id}>
            <Link href={`/conversations/${c.id}`}>
              {c.lastMessagePreview ?? "(no messages yet)"}
            </Link>
            {c.unreadCount ? <strong> ({c.unreadCount} unread)</strong> : null}
          </li>
        ))}
      </ul>
      {nextCursor && <button onClick={() => void loadMore()}>Load more</button>}
    </main>
  );
}

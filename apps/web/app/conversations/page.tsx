"use client";

import { useAuth } from "@clerk/nextjs";
import type { Agent, Conversation } from "@messages/shared-types";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../../lib/api";
import { createAblyClient, type AblyRealtimeInstance } from "../../lib/ably";

export default function ConversationsPage() {
  const { getToken } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [agent, setAgent] = useState<Agent | null>(null);
  const ablyRef = useRef<AblyRealtimeInstance | null>(null);

  async function refresh() {
    const token = await getToken();
    const { conversations } = await apiFetch<{ conversations: Conversation[] }>(
      "/conversations",
      token,
    );
    setConversations(conversations);
  }

  useEffect(() => {
    (async () => {
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

  return (
    <main>
      <h1>Conversations</h1>
      <ul>
        {conversations.map((c) => (
          <li key={c.id}>
            <Link href={`/conversations/${c.id}`}>
              {c.lastMessagePreview ?? "(no messages yet)"}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

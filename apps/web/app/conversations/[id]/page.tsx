"use client";

import { useAuth } from "@clerk/nextjs";
import type { Message } from "@messages/shared-types";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { createAblyClient, type AblyRealtimeInstance } from "../../../lib/ably";

export default function ConversationThreadPage() {
  const { id: conversationId } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const ablyRef = useRef<AblyRealtimeInstance | null>(null);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const { messages } = await apiFetch<{ messages: Message[] }>(
        `/conversations/${conversationId}/messages`,
        token,
      );
      setMessages(messages);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    let cancelled = false;
    void createAblyClient(getToken).then((ably) => {
      if (cancelled) {
        ably.close();
        return;
      }
      ablyRef.current = ably;
      const channel = ably.channels.get(`conversation:${conversationId}`);

      channel.subscribe("message.new", (msg) => {
        const incoming = msg.data as Message;
        setMessages((prev) => [...prev, incoming]);
        if (incoming.senderType === "customer") {
          void (async () => {
            const token = await getToken();
            await apiFetch(`/messages/${incoming.id}/status`, token, {
              method: "POST",
              body: JSON.stringify({ status: "delivered" }),
            }).catch(() => {});
          })();
        }
      });
      channel.subscribe("message.status", (msg) => {
        const updated = msg.data as Message;
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      });
    });

    return () => {
      cancelled = true;
      ablyRef.current?.close();
      ablyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  async function sendMessage() {
    if (!draft.trim()) return;
    const token = await getToken();
    await apiFetch("/messages", token, {
      method: "POST",
      body: JSON.stringify({ conversationId, text: draft }),
    });
    setDraft("");
  }

  return (
    <main>
      <h1>Conversation</h1>
      <ul>
        {messages.map((m) => (
          <li key={m.id}>
            <strong>{m.senderType}</strong>: {m.text} <em>({m.status})</em>
          </li>
        ))}
      </ul>
      <input value={draft} onChange={(e) => setDraft(e.target.value)} />
      <button onClick={() => void sendMessage()}>Send</button>
    </main>
  );
}

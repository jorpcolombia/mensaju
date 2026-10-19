"use client";

import type { Attachment, ListMessagesResponse, Message } from "@messages/shared-types";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api";
import { createAblyClient, type AblyRealtimeInstance } from "../lib/ably";
import { uploadAttachment } from "../lib/upload";

function AttachmentView({ attachment }: { attachment: Attachment }) {
  if (!attachment.url) return <em>[{attachment.type}]</em>;
  if (attachment.type === "image") {
    return <img src={attachment.url} alt="" style={{ maxWidth: 240, display: "block" }} />;
  }
  if (attachment.type === "video") {
    return <video src={attachment.url} controls style={{ maxWidth: 320, display: "block" }} />;
  }
  return <audio src={attachment.url} controls style={{ display: "block" }} />;
}

/**
 * One conversation thread, shared by the org console (agent session) and the
 * customer app (customer JWT). `getToken` supplies whichever credential applies and
 * `viewer` decides which side's messages show delivery status.
 */
export function Thread({
  conversationId,
  getToken,
  viewer,
}: {
  conversationId: string;
  getToken: () => Promise<string | null>;
  viewer: "agent" | "customer";
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [olderCursor, setOlderCursor] = useState<string | undefined>();
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const ablyRef = useRef<AblyRealtimeInstance | null>(null);

  const markRead = useCallback(async () => {
    const token = await getToken();
    await apiFetch(`/conversations/${conversationId}/read`, token, { method: "POST" }).catch(
      () => {},
    );
  }, [conversationId, getToken]);

  const reloadLatest = useCallback(async () => {
    const token = await getToken();
    const page = await apiFetch<ListMessagesResponse>(
      `/conversations/${conversationId}/messages`,
      token,
    );
    setMessages(page.messages);
    setOlderCursor(page.nextCursor);
  }, [conversationId, getToken]);

  useEffect(() => {
    void (async () => {
      try {
        await reloadLatest();
        await markRead();
      } catch (err) {
        setError((err as Error).message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  async function loadOlder() {
    if (!olderCursor) return;
    const token = await getToken();
    const page = await apiFetch<ListMessagesResponse>(
      `/conversations/${conversationId}/messages?before=${olderCursor}`,
      token,
    );
    setMessages((prev) => [...page.messages, ...prev]);
    setOlderCursor(page.nextCursor);
  }

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
        setMessages((prev) =>
          prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming],
        );
        if (incoming.senderType !== viewer) {
          // The thread is open, so the message counts as delivered and read.
          void markRead();
        }
        // Realtime payloads carry no download URLs; refetch to get them.
        if (incoming.attachments.length) void reloadLatest();
      });
      channel.subscribe("message.status", (msg) => {
        const updated = msg.data as Message;
        setMessages((prev) =>
          prev.map((m) => (m.id === updated.id ? { ...updated, attachments: m.attachments } : m)),
        );
      });
      channel.subscribe("messages.read", (msg) => {
        const { messageIds, readAt } = msg.data as { messageIds: string[]; readAt: string };
        setMessages((prev) =>
          prev.map((m) => (messageIds.includes(m.id) ? { ...m, status: "read", readAt } : m)),
        );
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
    if (sending || (!draft.trim() && files.length === 0)) return;
    setSending(true);
    setError(null);
    try {
      const token = await getToken();
      const attachments = await Promise.all(
        files.map((f) => uploadAttachment(f, conversationId, token)),
      );
      await apiFetch("/messages", token, {
        method: "POST",
        body: JSON.stringify({
          conversationId,
          text: draft.trim() || undefined,
          attachments: attachments.length ? attachments : undefined,
        }),
      });
      setDraft("");
      setFiles([]);
      await reloadLatest();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      {olderCursor && <button onClick={() => void loadOlder()}>Load older messages</button>}
      <ul>
        {messages.map((m) => (
          <li key={m.id}>
            <strong>{m.senderType === viewer ? "you" : m.senderType}</strong>: {m.text}{" "}
            {m.senderType === viewer && <em>({m.status})</em>}
            {m.attachments.map((a) => (
              <AttachmentView key={a.s3Key} attachment={a} />
            ))}
          </li>
        ))}
      </ul>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void sendMessage()}
      />
      <input
        type="file"
        multiple
        accept="image/*,video/*,audio/*"
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
      />
      <button disabled={sending} onClick={() => void sendMessage()}>
        {sending ? "Sending…" : "Send"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

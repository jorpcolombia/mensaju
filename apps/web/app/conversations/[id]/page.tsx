"use client";

import { useAuth } from "@clerk/nextjs";
import { useParams } from "next/navigation";
import { Thread } from "../../../components/Thread";

export default function ConversationThreadPage() {
  const { id: conversationId } = useParams<{ id: string }>();
  const { getToken } = useAuth();

  return (
    <main>
      <h1>Conversation</h1>
      <Thread conversationId={conversationId} getToken={() => getToken()} viewer="agent" />
    </main>
  );
}

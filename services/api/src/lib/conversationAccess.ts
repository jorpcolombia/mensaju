import type { Request } from "express";
import { Conversation } from "@messages/db";

/** Loads a conversation and verifies the requester (agent or customer) is a party to it. */
export async function loadAuthorizedConversation(req: Request, conversationId: string) {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) return { conversation: null, forbidden: false } as const;

  if (req.agent) {
    if (String(conversation.organizationId) !== String(req.agent.organizationId)) {
      return { conversation: null, forbidden: true } as const;
    }
  } else if (req.customerId) {
    if (String(conversation.customerId) !== req.customerId) {
      return { conversation: null, forbidden: true } as const;
    }
  } else {
    return { conversation: null, forbidden: true } as const;
  }

  return { conversation, forbidden: false } as const;
}

import type { HydratedDocument } from "mongoose";
import type { ConversationDoc, MessageDoc } from "@messages/db";
import { Organization, Customer } from "@messages/db";
import {
  conversationChannelName,
  customerNotificationsChannelName,
  orgNotificationsChannelName,
  publish,
} from "./ably.js";
import { toMessageDto } from "./dto.js";
import { pushToCustomer, pushToOrganization } from "./push.js";

/** Publishes a freshly stored message to realtime channels and fires push notifications. Best-effort. */
export async function fanOutNewMessage(
  conversation: HydratedDocument<ConversationDoc>,
  message: HydratedDocument<MessageDoc>,
  opts: { conversationCreated: boolean },
): Promise<void> {
  const conversationId = String(conversation._id);
  const dto = toMessageDto(message);
  const event = opts.conversationCreated ? "conversation.created" : "conversation.updated";

  await Promise.allSettled([
    publish(conversationChannelName(conversationId), "message.new", dto),
    publish(orgNotificationsChannelName(String(conversation.organizationId)), event, { conversationId }),
    publish(customerNotificationsChannelName(String(conversation.customerId)), event, {
      conversationId,
    }),
  ]);

  const preview = message.text?.slice(0, 140) ?? "Sent an attachment";
  if (message.senderType === "agent") {
    const org = await Organization.findById(conversation.organizationId).select("name");
    await pushToCustomer(conversation.customerId, {
      title: org?.name ?? "New message",
      body: preview,
      data: { conversationId },
    }).catch(() => {});
  } else {
    const customer = await Customer.findById(conversation.customerId).select("displayName");
    await pushToOrganization(conversation.organizationId, {
      title: customer?.displayName ?? "New customer message",
      body: preview,
      data: { conversationId },
    }).catch(() => {});
  }
}

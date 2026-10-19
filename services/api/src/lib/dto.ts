import type { Types } from "mongoose";
import type {
  AgentDoc,
  ApprovalAuditLogDoc,
  ConversationDoc,
  CustomerDoc,
  MessageDoc,
  OrganizationDoc,
} from "@messages/db";
import type {
  Agent,
  ApprovalAuditLogEntry,
  Conversation,
  Customer,
  Message,
  Organization,
} from "@messages/shared-types";

type WithId<T> = T & { _id: Types.ObjectId };

function id(value: Types.ObjectId): string {
  return value.toString();
}

export function toOrganizationDto(doc: WithId<OrganizationDoc>): Organization {
  return {
    id: id(doc._id),
    name: doc.name,
    description: doc.description,
    websiteUrl: doc.websiteUrl,
    approvalStatus: doc.approvalStatus,
    approvedAt: doc.approvedAt?.toISOString(),
    approvedBy: doc.approvedBy ? id(doc.approvedBy as unknown as Types.ObjectId) : undefined,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toAgentDto(doc: WithId<AgentDoc>): Agent {
  return {
    id: id(doc._id),
    clerkUserId: doc.clerkUserId,
    organizationId: doc.organizationId ? id(doc.organizationId as unknown as Types.ObjectId) : "",
    role: doc.role,
    displayName: doc.displayName,
    createdAt: doc.createdAt.toISOString(),
  };
}

export function toCustomerDto(doc: WithId<CustomerDoc>): Customer {
  return {
    id: id(doc._id),
    identifiers: [],
    displayName: doc.displayName,
    authProviders: doc.authProviders.map((p) => ({
      provider: p.provider,
      providerUserId: p.providerUserId,
      linkedAt: p.linkedAt.toISOString(),
    })),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toConversationDto(doc: WithId<ConversationDoc>): Conversation {
  return {
    id: id(doc._id),
    organizationId: id(doc.organizationId as unknown as Types.ObjectId),
    customerId: id(doc.customerId as unknown as Types.ObjectId),
    lastMessageAt: doc.lastMessageAt?.toISOString(),
    lastMessagePreview: doc.lastMessagePreview,
    createdAt: doc.createdAt.toISOString(),
  };
}

export function toMessageDto(doc: WithId<MessageDoc>): Message {
  return {
    id: id(doc._id),
    conversationId: id(doc.conversationId as unknown as Types.ObjectId),
    organizationId: id(doc.organizationId as unknown as Types.ObjectId),
    senderType: doc.senderType,
    senderId: id(doc.senderId as unknown as Types.ObjectId),
    text: doc.text,
    attachments: doc.attachments,
    status: doc.status,
    deliveredAt: doc.deliveredAt?.toISOString(),
    readAt: doc.readAt?.toISOString(),
    createdAt: doc.createdAt.toISOString(),
  };
}

export function toAuditLogDto(doc: WithId<ApprovalAuditLogDoc>): ApprovalAuditLogEntry {
  return {
    id: id(doc._id),
    organizationId: id(doc.organizationId as unknown as Types.ObjectId),
    adminId: id(doc.adminId as unknown as Types.ObjectId),
    action: doc.action,
    previousStatus: doc.previousStatus,
    newStatus: doc.newStatus,
    note: doc.note,
    createdAt: doc.createdAt.toISOString(),
  };
}

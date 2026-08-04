export type ObjectIdString = string;

export type ApprovalStatus = "pending" | "approved" | "rejected" | "suspended";

export interface Organization {
  id: ObjectIdString;
  name: string;
  approvalStatus: ApprovalStatus;
  approvedAt?: string;
  approvedBy?: ObjectIdString;
  createdAt: string;
  updatedAt: string;
}

export type AgentRole = "owner" | "admin" | "member";

export interface Agent {
  id: ObjectIdString;
  clerkUserId: string;
  organizationId: ObjectIdString;
  role: AgentRole;
  displayName: string;
  createdAt: string;
}

export type IdentifierType = "phone" | "email" | "govId";

export interface CustomerIdentifier {
  type: IdentifierType;
  value: string;
  verifiedAt?: string;
}

export type CustomerAuthProviderName =
  | "sms_otp"
  | "whatsapp_otp"
  | "google"
  | "apple"
  | "facebook";

export interface CustomerAuthProvider {
  provider: CustomerAuthProviderName;
  providerUserId: string;
  linkedAt: string;
}

export interface Customer {
  id: ObjectIdString;
  identifiers: CustomerIdentifier[];
  displayName?: string;
  authProviders: CustomerAuthProvider[];
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: ObjectIdString;
  organizationId: ObjectIdString;
  customerId: ObjectIdString;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  createdAt: string;
}

export type AttachmentType = "image" | "video" | "audio";

export interface Attachment {
  type: AttachmentType;
  s3Key: string;
  mimeType: string;
  sizeBytes: number;
  durationMs?: number;
  width?: number;
  height?: number;
}

export type MessageSenderType = "agent" | "customer";
export type MessageStatus = "sent" | "delivered" | "read";

export interface Message {
  id: ObjectIdString;
  conversationId: ObjectIdString;
  organizationId: ObjectIdString;
  senderType: MessageSenderType;
  senderId: ObjectIdString;
  text?: string;
  attachments: Attachment[];
  status: MessageStatus;
  deliveredAt?: string;
  readAt?: string;
  createdAt: string;
}

export interface Admin {
  id: ObjectIdString;
  clerkUserId: string;
  displayName: string;
  createdAt: string;
}

export type ApprovalAction = "approve" | "reject" | "suspend" | "reinstate";

export interface ApprovalAuditLogEntry {
  id: ObjectIdString;
  organizationId: ObjectIdString;
  adminId: ObjectIdString;
  action: ApprovalAction;
  previousStatus: ApprovalStatus;
  newStatus: ApprovalStatus;
  note?: string;
  createdAt: string;
}

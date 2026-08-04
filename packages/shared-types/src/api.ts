import type {
  Agent,
  AgentRole,
  Attachment,
  Conversation,
  Customer,
  CustomerAuthProviderName,
  IdentifierType,
  Message,
  Organization,
} from "./models.js";

// ---- Org/agent-scoped ----

export interface CreateOrganizationRequest {
  name: string;
}
export interface CreateOrganizationResponse {
  organization: Organization;
  agent: Agent;
}

export interface InviteAgentRequest {
  email: string;
  role: AgentRole;
}
export interface InviteAgentResponse {
  inviteId: string;
}

export interface AcceptAgentInviteRequest {
  inviteId: string;
}
export interface AcceptAgentInviteResponse {
  agent: Agent;
}

export interface ListConversationsResponse {
  conversations: Conversation[];
}

export interface ListMessagesResponse {
  messages: Message[];
  nextCursor?: string;
}

export interface SendMessageRequest {
  conversationId?: string;
  organizationId?: string; // when a customer starts a new conversation
  text?: string;
  attachments?: Attachment[];
}
export interface SendMessageResponse {
  message: Message;
}

export interface UpdateMessageStatusRequest {
  status: "delivered" | "read";
}

export interface PresignAttachmentRequest {
  mimeType: string;
  sizeBytes: number;
  type: Attachment["type"];
  conversationId: string;
}
export interface PresignAttachmentResponse {
  uploadUrl: string;
  s3Key: string;
  expiresAt: string;
}

export interface AblyTokenResponse {
  keyName: string;
  clientId: string;
  ttl: number;
  capability: string;
  timestamp: number;
  nonce: string;
  mac: string;
}

export interface ResolveCustomerRequest {
  type: IdentifierType;
  value: string;
}
export interface ResolveCustomerResponse {
  customer: Customer;
}

// ---- Customer-scoped ----

export interface RequestOtpRequest {
  channel: "sms" | "whatsapp";
  phone: string;
}

export interface VerifyOtpRequest {
  phone: string;
  code: string;
}
export interface VerifyOtpResponse {
  token: string;
  customer: Customer;
}

export interface OAuthCallbackRequest {
  provider: Extract<CustomerAuthProviderName, "google" | "apple" | "facebook">;
  providerToken: string;
}
export interface OAuthCallbackResponse {
  token: string;
  customer: Customer;
}

export interface LinkIdentifierRequest {
  type: IdentifierType;
  value: string;
}

export interface OrganizationDirectoryEntry {
  id: string;
  name: string;
}
export interface ListOrganizationDirectoryResponse {
  organizations: OrganizationDirectoryEntry[];
}

export interface StartConversationRequest {
  organizationId: string;
}
export interface StartConversationResponse {
  conversation: Conversation;
}

// ---- Admin-scoped ----

export interface ListPendingOrganizationsResponse {
  organizations: Organization[];
}

export interface OrganizationApprovalActionRequest {
  note?: string;
}

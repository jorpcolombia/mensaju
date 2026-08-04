import { Schema, model, Types } from "mongoose";

export interface ConversationDoc {
  organizationId: Types.ObjectId;
  customerId: Types.ObjectId;
  lastMessageAt?: Date;
  lastMessagePreview?: string;
  createdAt: Date;
}

const conversationSchema = new Schema<ConversationDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    lastMessageAt: { type: Date },
    lastMessagePreview: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// One thread per organization-customer pair.
conversationSchema.index({ organizationId: 1, customerId: 1 }, { unique: true });

// Serves the agent-side "list this org's conversations" query, sorted by
// recency (GET /conversations with req.agent).
conversationSchema.index({ organizationId: 1, lastMessageAt: -1 });

// Serves the customer-side "list my conversations across all orgs" query,
// sorted by recency (GET /conversations with req.customerId).
conversationSchema.index({ customerId: 1, lastMessageAt: -1 });

export const Conversation = model<ConversationDoc>("Conversation", conversationSchema);

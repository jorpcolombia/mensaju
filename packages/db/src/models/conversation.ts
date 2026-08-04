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

export const Conversation = model<ConversationDoc>("Conversation", conversationSchema);

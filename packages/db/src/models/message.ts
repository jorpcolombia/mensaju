import { Schema, model, Types } from "mongoose";

export type AttachmentType = "image" | "video" | "audio";
export type MessageSenderType = "agent" | "customer";
export type MessageStatus = "sent" | "delivered" | "read";

export interface AttachmentDoc {
  type: AttachmentType;
  s3Key: string;
  mimeType: string;
  sizeBytes: number;
  durationMs?: number;
  width?: number;
  height?: number;
}

export interface MessageDoc {
  conversationId: Types.ObjectId;
  // Denormalized from the conversation's org, for cheap rate-limit queries.
  organizationId: Types.ObjectId;
  senderType: MessageSenderType;
  senderId: Types.ObjectId;
  text?: string;
  attachments: AttachmentDoc[];
  status: MessageStatus;
  deliveredAt?: Date;
  readAt?: Date;
  createdAt: Date;
}

const attachmentSchema = new Schema<AttachmentDoc>(
  {
    type: { type: String, enum: ["image", "video", "audio"], required: true },
    s3Key: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    durationMs: { type: Number },
    width: { type: Number },
    height: { type: Number },
  },
  { _id: false },
);

const messageSchema = new Schema<MessageDoc>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    senderType: { type: String, enum: ["agent", "customer"], required: true },
    senderId: { type: Schema.Types.ObjectId, required: true },
    text: { type: String },
    attachments: { type: [attachmentSchema], default: [] },
    status: { type: String, enum: ["sent", "delivered", "read"], default: "sent" },
    deliveredAt: { type: Date },
    readAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

export const Message = model<MessageDoc>("Message", messageSchema);

import { Schema, model, Types } from "mongoose";

export type AgentRole = "owner" | "admin" | "member";

export interface AgentDoc {
  clerkUserId: string;
  organizationId?: Types.ObjectId;
  role: AgentRole;
  displayName: string;
  createdAt: Date;
}

const agentSchema = new Schema<AgentDoc>(
  {
    clerkUserId: { type: String, required: true, unique: true },
    // Optional: unset until the agent claims/creates an org or accepts an invite
    // (Clerk webhook creates a bare shell doc before organizationId is known).
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    role: { type: String, enum: ["owner", "admin", "member"], default: "member" },
    displayName: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

agentSchema.index({ organizationId: 1 });

export const Agent = model<AgentDoc>("Agent", agentSchema);

import { Schema, model, Types } from "mongoose";
import type { ApprovalStatus } from "./organization.js";

export type ApprovalAction = "approve" | "reject" | "suspend" | "reinstate";

export interface ApprovalAuditLogDoc {
  organizationId: Types.ObjectId;
  adminId: Types.ObjectId;
  action: ApprovalAction;
  previousStatus: ApprovalStatus;
  newStatus: ApprovalStatus;
  note?: string;
  createdAt: Date;
}

const approvalAuditLogSchema = new Schema<ApprovalAuditLogDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    adminId: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    action: { type: String, enum: ["approve", "reject", "suspend", "reinstate"], required: true },
    previousStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended"],
      required: true,
    },
    newStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended"],
      required: true,
    },
    note: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

approvalAuditLogSchema.index({ organizationId: 1, createdAt: -1 });

export const ApprovalAuditLog = model<ApprovalAuditLogDoc>(
  "ApprovalAuditLog",
  approvalAuditLogSchema,
);

import { Schema, model, Types } from "mongoose";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "suspended";

export interface OrganizationDoc {
  name: string;
  description?: string;
  websiteUrl?: string;
  approvalStatus: ApprovalStatus;
  approvedAt?: Date;
  approvedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<OrganizationDoc>(
  {
    name: { type: String, required: true },
    description: { type: String, maxlength: 1000 },
    websiteUrl: { type: String, maxlength: 2048 },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended"],
      default: "pending",
      required: true,
    },
    approvedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true },
);

organizationSchema.index({ approvalStatus: 1 });

export const Organization = model<OrganizationDoc>("Organization", organizationSchema);

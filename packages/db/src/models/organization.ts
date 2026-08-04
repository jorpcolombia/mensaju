import { Schema, model, Types } from "mongoose";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "suspended";

export interface OrganizationDoc {
  name: string;
  approvalStatus: ApprovalStatus;
  approvedAt?: Date;
  approvedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<OrganizationDoc>(
  {
    name: { type: String, required: true },
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

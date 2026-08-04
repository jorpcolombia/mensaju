import { Schema, model } from "mongoose";

export interface AdminDoc {
  clerkUserId: string;
  displayName: string;
  createdAt: Date;
}

const adminSchema = new Schema<AdminDoc>(
  {
    clerkUserId: { type: String, required: true, unique: true },
    displayName: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const Admin = model<AdminDoc>("Admin", adminSchema);

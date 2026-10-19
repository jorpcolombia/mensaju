import { Schema, model, Types } from "mongoose";

export type DeviceOwnerType = "agent" | "customer";
export type DevicePlatform = "ios" | "android";

export interface DeviceDoc {
  ownerType: DeviceOwnerType;
  ownerId: Types.ObjectId;
  // Set for agent devices so a new message can fan out to the whole org.
  organizationId?: Types.ObjectId;
  platform: DevicePlatform;
  token: string;
  createdAt: Date;
}

const deviceSchema = new Schema<DeviceDoc>(
  {
    ownerType: { type: String, enum: ["agent", "customer"], required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    platform: { type: String, enum: ["ios", "android"], required: true },
    token: { type: String, required: true, unique: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

deviceSchema.index({ ownerType: 1, ownerId: 1 });
deviceSchema.index({ organizationId: 1 });

export const Device = model<DeviceDoc>("Device", deviceSchema);

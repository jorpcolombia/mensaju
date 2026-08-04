import { Schema, model } from "mongoose";

export type CustomerAuthProviderName =
  | "sms_otp"
  | "whatsapp_otp"
  | "google"
  | "apple"
  | "facebook";

export interface CustomerAuthProvider {
  provider: CustomerAuthProviderName;
  providerUserId: string;
  linkedAt: Date;
}

export interface CustomerDoc {
  displayName?: string;
  authProviders: CustomerAuthProvider[];
  createdAt: Date;
  updatedAt: Date;
}

const authProviderSchema = new Schema<CustomerAuthProvider>(
  {
    provider: {
      type: String,
      enum: ["sms_otp", "whatsapp_otp", "google", "apple", "facebook"],
      required: true,
    },
    providerUserId: { type: String, required: true },
    linkedAt: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false },
);

const customerSchema = new Schema<CustomerDoc>(
  {
    displayName: { type: String },
    authProviders: { type: [authProviderSchema], default: [] },
  },
  { timestamps: true },
);

export const Customer = model<CustomerDoc>("Customer", customerSchema);

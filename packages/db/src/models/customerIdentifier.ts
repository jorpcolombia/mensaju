import { Schema, model, Types } from "mongoose";

export type IdentifierType = "phone" | "email" | "govId";

export interface CustomerIdentifierDoc {
  type: IdentifierType;
  // Normalized value: E.164 for phone, lowercased/trimmed for email and govId.
  value: string;
  customerId: Types.ObjectId;
}

const customerIdentifierSchema = new Schema<CustomerIdentifierDoc>({
  type: { type: String, enum: ["phone", "email", "govId"], required: true },
  value: { type: String, required: true },
  customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
});

// Canonical resolution table: this is the source of truth for "does this
// identifier already belong to a customer" — find-or-create against it.
customerIdentifierSchema.index({ type: 1, value: 1 }, { unique: true });

export const CustomerIdentifier = model<CustomerIdentifierDoc>(
  "CustomerIdentifier",
  customerIdentifierSchema,
);

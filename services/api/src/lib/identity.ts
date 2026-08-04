import { Customer, CustomerIdentifier } from "@messages/db";
import type { IdentifierType } from "@messages/shared-types";

export function normalizeIdentifier(type: IdentifierType, rawValue: string): string {
  const trimmed = rawValue.trim();
  if (type === "email") return trimmed.toLowerCase();
  if (type === "phone") return normalizePhoneE164(trimmed);
  return trimmed;
}

function normalizePhoneE164(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
}

/**
 * Find-or-create against the canonical `customer_identifiers` lookup table
 * (plan §2). Never silently merges: if the identifier is new, a fresh
 * `customers` doc is created for it.
 */
export async function resolveOrCreateCustomer(type: IdentifierType, rawValue: string) {
  const value = normalizeIdentifier(type, rawValue);

  const existing = await CustomerIdentifier.findOne({ type, value });
  if (existing) {
    const customer = await Customer.findById(existing.customerId);
    if (!customer) {
      throw new Error(`Dangling customer_identifiers row for ${type}:${value}`);
    }
    return customer;
  }

  const customer = await Customer.create({ authProviders: [] });
  await CustomerIdentifier.create({ type, value, customerId: customer._id });
  return customer;
}

/** Read-only lookup — does not create. Used by agent-initiated resolve flow. */
export async function findCustomerByIdentifier(type: IdentifierType, rawValue: string) {
  const value = normalizeIdentifier(type, rawValue);
  const identifier = await CustomerIdentifier.findOne({ type, value });
  if (!identifier) return null;
  return Customer.findById(identifier.customerId);
}

/**
 * Links a new identifier to an already-authenticated customer. Throws if the
 * identifier is already claimed by a *different* customer — merge conflicts
 * require an explicit re-verification step, never a silent overwrite
 * (confirmed, plan §2 / §11).
 */
export async function linkIdentifierToCustomer(
  customerId: string,
  type: IdentifierType,
  rawValue: string,
) {
  const value = normalizeIdentifier(type, rawValue);
  const existing = await CustomerIdentifier.findOne({ type, value });
  if (existing && String(existing.customerId) !== customerId) {
    throw new IdentifierConflictError(type, value);
  }
  if (existing) return; // already linked to this same customer
  await CustomerIdentifier.create({ type, value, customerId });
}

export class IdentifierConflictError extends Error {
  constructor(
    public readonly type: IdentifierType,
    public readonly value: string,
  ) {
    super(`Identifier ${type}:${value} is already linked to a different customer`);
    this.name = "IdentifierConflictError";
  }
}

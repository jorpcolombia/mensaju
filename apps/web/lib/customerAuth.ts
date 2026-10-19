"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "messages.customerSession";

export interface CustomerSession {
  token: string;
  customerId: string;
}

function read(): CustomerSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CustomerSession) : null;
  } catch {
    return null;
  }
}

export function saveCustomerSession(session: CustomerSession): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage can be unavailable (private mode); the session just won't persist.
  }
}

export function clearCustomerSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Customers are not Clerk users (plan §3); they hold a backend-issued JWT from the
 * OTP/OAuth flow. `ready` flips once localStorage has been read, so pages can avoid
 * redirecting to login before the stored session is known.
 */
export function useCustomerSession() {
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSession(read());
    setReady(true);
  }, []);

  const getToken = useCallback(async () => read()?.token ?? null, []);

  const signOut = useCallback(() => {
    clearCustomerSession();
    setSession(null);
  }, []);

  return { session, ready, getToken, signOut };
}

import { API_BASE_URL } from "./api";

// Ably's browser UMD bundle isn't webpack/SWC-friendly under Next.js's
// client-component build (a known upstream parse issue in recent ably-js
// releases), so we load it from Ably's CDN at runtime instead of bundling
// the npm package — this is also Ably's own documented approach for plain
// browser usage.
const ABLY_CDN_URL = "https://cdn.ably.com/lib/ably.min-2.js";

declare global {
  interface Window {
    Ably?: {
      Realtime: new (options: unknown) => AblyRealtimeInstance;
    };
  }
}

export interface AblyRealtimeInstance {
  channels: {
    get(name: string): {
      subscribe(event: string, callback: (message: { data: unknown }) => void): void;
    };
  };
  close(): void;
}

let sdkPromise: Promise<void> | null = null;

function loadAblySdk(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Ably SDK can only load in the browser"));
  }
  if (window.Ably) return Promise.resolve();
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = ABLY_CDN_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Ably SDK"));
      document.head.appendChild(script);
    });
  }
  return sdkPromise;
}

/**
 * Creates an Ably Realtime client that authenticates via our backend's
 * POST /ably/token (plan §4) instead of holding an API key client-side.
 */
export async function createAblyClient(
  getClerkToken: () => Promise<string | null>,
): Promise<AblyRealtimeInstance> {
  await loadAblySdk();
  return new window.Ably!.Realtime({
    authCallback: async (_params: unknown, callback: (err: unknown, token: unknown) => void) => {
      try {
        const token = await getClerkToken();
        const res = await fetch(`${API_BASE_URL}/ably/token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!res.ok) throw new Error(`Ably token request failed: ${res.status}`);
        const tokenRequest = await res.json();
        callback(null, tokenRequest);
      } catch (err) {
        callback((err as Error).message, null);
      }
    },
  });
}

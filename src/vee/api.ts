/**
 * Browser-side client for the Vee backend.
 *
 * The backend lives at /api on the same domain when deployed on Vercel.
 * Set VITE_VEE_API_BASE if the site is hosted elsewhere (e.g. GitHub Pages).
 */

export type Role = "user" | "assistant";
export type Tier = "fast" | "smart";
export type RoutingMode = "auto" | Tier;

export interface Message {
  id: string;
  role: Role;
  content: string;
  /** Which model tier answered (assistant messages only). */
  tier?: Tier;
  /** Set when the reply failed part-way. */
  error?: string;
}

const API_BASE = (import.meta.env.VITE_VEE_API_BASE as string | undefined)?.replace(/\/$/, "") ?? "";
const ACCESS_KEY = "vee.accessCode";

export function getAccessCode(): string {
  try {
    return localStorage.getItem(ACCESS_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setAccessCode(code: string) {
  try {
    localStorage.setItem(ACCESS_KEY, code);
  } catch {
    /* private mode etc. */
  }
}

export class AccessCodeRequired extends Error {
  constructor() {
    super("Access code required");
    this.name = "AccessCodeRequired";
  }
}

export interface StreamCallbacks {
  onMeta?: (info: { tier: Tier; model: string }) => void;
  onText?: (text: string) => void;
  onDone?: (info: { stopReason: string | null }) => void;
}

/**
 * Sends the conversation and streams the reply back. Resolves when the
 * stream ends. Throws AccessCodeRequired on a 401 so the UI can ask for it.
 */
export async function streamChat(
  messages: Pick<Message, "role" | "content">[],
  mode: RoutingMode,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-vee-access": getAccessCode() },
    body: JSON.stringify({ messages: messages.map(({ role, content }) => ({ role, content })), mode }),
    signal,
  });

  if (res.status === 401) throw new AccessCodeRequired();
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.message) message = data.message;
    } catch {
      /* not JSON */
    }
    throw new Error(message);
  }
  if (!res.body) throw new Error("No response body");

  // Parse Server-Sent Events by hand: small, and avoids a dependency.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handle = (eventName: string, raw: string) => {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    switch (eventName) {
      case "meta":
        callbacks.onMeta?.({ tier: data.tier as Tier, model: String(data.model) });
        break;
      case "text":
        callbacks.onText?.(String(data.text ?? ""));
        break;
      case "done":
        callbacks.onDone?.({ stopReason: (data.stopReason as string | null) ?? null });
        break;
      case "error":
        throw new Error(String(data.message ?? "Unknown error"));
    }
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Events are separated by a blank line.
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      let eventName = "message";
      let data = "";
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (data) handle(eventName, data);
    }
  }
}

export async function fetchHealth(): Promise<{ ok: boolean; mock: boolean; accessCodeRequired: boolean } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

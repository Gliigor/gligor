import "server-only";
import { withSystem } from "./db";
import { ingestInbound, type InboundEmail } from "./services/tickets";
import { attachmentPath, saveAttachment } from "./storage";

/** Gemeenschappelijk eindpunt voor alle inbound-providers. */
export async function handleInbound(mail: InboundEmail) {
  return withSystem((q) =>
    ingestInbound(q, mail, { save: (p, bytes, type) => saveAttachment(q, p, bytes, type), path: attachmentPath }),
  );
}

/** Headers uit een object of lijst opzoeken, ongeacht hoofdletters. */
export function headerValue(headers: Record<string, string> | { Name: string; Value: string }[] | null | undefined, name: string): string | null {
  if (!headers) return null;
  const n = name.toLowerCase();
  if (Array.isArray(headers)) return headers.find((h) => h.Name.toLowerCase() === n)?.Value ?? null;
  const key = Object.keys(headers).find((k) => k.toLowerCase() === n);
  return key ? headers[key] : null;
}

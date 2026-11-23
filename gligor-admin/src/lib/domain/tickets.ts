import { addWorkingDays, amsDate, endOfAmsDay } from "./dates";
import { PACKAGES, type PackageKey } from "../config";

export interface ParsedAddress {
  name: string;
  email: string;
}

/** "Marieke de Vries <marieke@x.nl>" → { name, email } (e-mail in kleine letters). */
export function parseAddress(raw: string): ParsedAddress {
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim(), email: m[2].trim().toLowerCase() };
  return { name: "", email: raw.trim().toLowerCase() };
}

/** Ticketnummer uit een onderwerp zoals "Re: Vraag [T-1042]". */
export function extractTicketNumber(subject: string): number | null {
  const m = subject.match(/\[T-(\d{3,})\]/i);
  return m ? Number(m[1]) : null;
}

/** "Vraag" → "Re: Vraag [T-1042]" (zonder dubbele Re: of tags). */
export function replySubject(subject: string, number: number): string {
  const base = subject.replace(/\s*\[T-\d+\]/gi, "").replace(/^\s*((re|aw|antw|fw|fwd)\s*:\s*)+/i, "").trim() || "Je vraag";
  return `Re: ${base} [T-${number}]`;
}

/** Alle Message-ID's uit In-Reply-To en References. */
export function referencedIds(inReplyTo?: string | null, references?: string | null): string[] {
  const raw = `${inReplyTo ?? ""} ${references ?? ""}`;
  return Array.from(new Set(raw.match(/<[^<>\s]+>/g) ?? []));
}

export interface InboundForMatching {
  from: string;
  subject: string;
  inReplyTo?: string | null;
  references?: string | null;
}

export interface MatchContext {
  /** Message-ID → ticket-id, voor alle bekende berichten. */
  ticketByMessageId: Map<string, string>;
  /** Ticketnummer → ticket (met de klant waar het bij hoort). */
  ticketByNumber: Map<number, { id: string; clientEmail: string | null }>;
  /** E-mailadres (kleine letters) → klant-id. */
  clientByEmail: Map<string, string>;
}

export type MatchResult =
  | { kind: "existing-ticket"; ticketId: string; via: "headers" | "onderwerp" }
  | { kind: "new-ticket"; clientId: string }
  | { kind: "new-lead"; sender: ParsedAddress };

/**
 * Bepaalt bij welk ticket een binnenkomende e-mail hoort:
 * 1. via de headers (antwoord op een bekend bericht),
 * 2. via het ticketnummer in het onderwerp (alleen als de afzender bij dat ticket hoort),
 * 3. anders een nieuw ticket bij de klant met dit e-mailadres,
 * 4. onbekende afzender: nieuwe lead.
 */
export function matchInbound(msg: InboundForMatching, ctx: MatchContext): MatchResult {
  const sender = parseAddress(msg.from);
  for (const id of referencedIds(msg.inReplyTo, msg.references)) {
    const ticketId = ctx.ticketByMessageId.get(id);
    if (ticketId) return { kind: "existing-ticket", ticketId, via: "headers" };
  }
  const number = extractTicketNumber(msg.subject);
  if (number !== null) {
    const t = ctx.ticketByNumber.get(number);
    if (t && (!t.clientEmail || t.clientEmail.toLowerCase() === sender.email)) {
      return { kind: "existing-ticket", ticketId: t.id, via: "onderwerp" };
    }
  }
  const clientId = ctx.clientByEmail.get(sender.email);
  if (clientId) return { kind: "new-ticket", clientId };
  return { kind: "new-lead", sender };
}

const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "hotmail.nl", "outlook.com", "outlook.nl", "live.nl", "live.com",
  "icloud.com", "me.com", "yahoo.com", "yahoo.nl", "kpnmail.nl", "ziggo.nl", "planet.nl", "home.nl", "xs4all.nl",
  "proton.me", "protonmail.com", "hetnet.nl", "casema.nl", "upcmail.nl", "telfort.nl",
]);

/** Gegevens voor een nieuwe lead uit een onbekende afzender. */
export function leadFromSender(sender: ParsedAddress): { company: string; owner_name: string; email: string } {
  const domain = sender.email.split("@")[1] ?? "";
  const local = sender.email.split("@")[0] ?? sender.email;
  let company = sender.name || local;
  if (domain && !FREE_MAIL.has(domain)) {
    const base = domain.replace(/\.(nl|com|eu|be|net|org|info|biz)$/i, "").split(".").pop() ?? domain;
    company = base.charAt(0).toUpperCase() + base.slice(1);
  }
  return { company, owner_name: sender.name, email: sender.email };
}

export type DeadlineState = "op_tijd" | "bijna" | "te_laat";

/** Uiterste antwoordtijd: einde van de n-de werkdag na ontvangst (Basis 2, Plus 1). */
export function responseDeadline(awaitingSince: string, pkg: PackageKey | null): Date {
  const days = PACKAGES[pkg ?? "basis"].responseWorkingDays;
  return endOfAmsDay(addWorkingDays(amsDate(awaitingSince), days));
}

/** Te laat na de deadline, "bijna" in de laatste 24 uur ervoor. */
export function deadlineState(deadline: Date, now: Date): DeadlineState {
  const left = deadline.getTime() - now.getTime();
  if (left < 0) return "te_laat";
  if (left < 24 * 3600 * 1000) return "bijna";
  return "op_tijd";
}

/** Platte tekst van een antwoord zonder het geciteerde deel eronder. */
export function stripQuoted(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const cut = lines.findIndex(
    (l) =>
      /^>/.test(l) ||
      /^(Op|On) .+(schreef|wrote).*:$/i.test(l.trim()) ||
      /^-{2,}\s*(Oorspronkelijk|Original) (bericht|message)/i.test(l.trim()) ||
      /^(Van|From):\s/.test(l.trim()),
  );
  return (cut > 0 ? lines.slice(0, cut) : lines).join("\n").trim();
}

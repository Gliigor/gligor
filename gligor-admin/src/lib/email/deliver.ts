import { randomUUID } from "node:crypto";
import { Resend } from "resend";
import { emailFrom, fromAddress, isDemo } from "../env";
import { textToHtml } from "../domain/templates";

export interface OutgoingMail {
  /** Ander afzenderadres dan EMAIL_FROM, bijv. gligor@gligor.ai voor persoonlijke mails. */
  from?: string | null;
  html?: string | null;
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string | null;
  references?: string[];
}

export interface Delivered {
  providerId: string;
  messageId: string;
}

let resend: Resend | null = null;
function client(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY ontbreekt. Zie README.md, stap 4.");
  resend ??= new Resend(key);
  return resend;
}

export function resendClient(): Resend {
  return client();
}

/** De naam uit EMAIL_FROM ("Gligor van Gligor.ai"), voor andere afzenderadressen. */
function senderName(): string {
  const m = emailFrom().match(/^\s*"?([^"<]+?)"?\s*</);
  return m ? m[1] : "Gligor";
}

/** Nieuwe Message-ID op ons eigen domein, zodat antwoorden aan het juiste ticket gekoppeld worden. */
export function newMessageId(): string {
  const domain = fromAddress().split("@")[1] ?? "gligor.ai";
  return `<${randomUUID()}@${domain}>`;
}

/**
 * Verstuurt één e-mail via Resend vanaf EMAIL_FROM. In de demo-modus wordt er
 * niets verstuurd: de mail krijgt alleen de status "verzonden".
 */
export async function deliver(mail: OutgoingMail): Promise<Delivered> {
  const messageId = newMessageId();
  if (isDemo()) return { providerId: `demo-${randomUUID()}`, messageId };

  const headers: Record<string, string> = { "Message-ID": messageId };
  if (mail.inReplyTo) headers["In-Reply-To"] = mail.inReplyTo;
  if (mail.references?.length) headers["References"] = mail.references.join(" ");

  const from = mail.from ? `${senderName()} <${mail.from}>` : emailFrom();
  const { data, error } = await client().emails.send({
    from,
    to: [mail.to],
    replyTo: mail.from ?? fromAddress(),
    subject: mail.subject,
    text: mail.text,
    html: mail.html ?? textToHtml(mail.text),
    headers,
  });
  if (error || !data) throw new Error(`Versturen mislukt: ${error?.message ?? "onbekende fout"}`);
  return { providerId: data.id, messageId };
}

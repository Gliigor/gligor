import type { Query } from "../db/driver";
import type { ClientRow, EmailRow, TicketMessageRow, TicketRow } from "../types";
import type { TicketStatus } from "../config";
import { fromAddress } from "../env";
import { leadFromSender, matchInbound, parseAddress, referencedIds, replySubject, extractTicketNumber, type MatchContext } from "../domain/tickets";
import { sendEmail } from "./emails";

export interface InboundAttachment {
  filename: string;
  contentType: string;
  size: number;
  /** Haalt de inhoud pas op als we hem echt opslaan. */
  load: () => Promise<Uint8Array>;
}

/** Een binnenkomende e-mail, los van welke provider hem aanlevert. */
export interface InboundEmail {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string | null;
  messageId: string | null;
  inReplyTo: string | null;
  references: string | null;
  receivedAt: string;
  attachments: InboundAttachment[];
}

export type SaveAttachment = (path: string, bytes: Uint8Array, contentType: string) => Promise<void>;
export type AttachmentPath = (ticketId: string, messageId: string, filename: string) => string;

async function matchContext(q: Query, mail: InboundEmail): Promise<MatchContext> {
  const ids = referencedIds(mail.inReplyTo, mail.references);
  const sender = parseAddress(mail.from).email;
  const number = extractTicketNumber(mail.subject);
  const [byMsg, byNumber, byEmail] = await Promise.all([
    ids.length
      ? q<{ message_id: string; ticket_id: string }>(
          "select message_id, ticket_id from ticket_messages where message_id = any($1::text[])",
          [`{${ids.map((i) => `"${i.replace(/"/g, "")}"`).join(",")}}`],
        )
      : Promise.resolve([]),
    number !== null
      ? q<{ id: string; number: number; email: string | null }>(
          "select t.id, t.number, c.email from tickets t left join clients c on c.id = t.client_id where t.number = $1",
          [number],
        )
      : Promise.resolve([]),
    q<{ id: string }>("select id from clients where lower(email) = $1", [sender]),
  ]);
  return {
    ticketByMessageId: new Map(byMsg.map((r) => [r.message_id, r.ticket_id])),
    ticketByNumber: new Map(byNumber.map((r) => [r.number, { id: r.id, clientEmail: r.email }])),
    clientByEmail: new Map(byEmail.map((r) => [sender, r.id])),
  };
}

/**
 * Verwerkt een binnenkomende e-mail tot ticket: koppelt aan een bestaand ticket,
 * een bekende klant, of maakt een nieuwe lead. Dubbele aflevering (zelfde
 * Message-ID) wordt genegeerd.
 */
export async function ingestInbound(
  q: Query,
  mail: InboundEmail,
  storage: { save: SaveAttachment; path: AttachmentPath },
): Promise<{ ticketId: string; created: "ticket" | "lead" | null; duplicate: boolean }> {
  if (mail.messageId) {
    const [dup] = await q<{ ticket_id: string }>("select ticket_id from ticket_messages where message_id = $1", [mail.messageId]);
    if (dup) return { ticketId: dup.ticket_id, created: null, duplicate: true };
  }
  const match = matchInbound(mail, await matchContext(q, mail));
  let ticket: TicketRow;
  let created: "ticket" | "lead" | null = null;

  if (match.kind === "existing-ticket") {
    [ticket] = await q<TicketRow>(
      `update tickets set status = case when status in ('opgelost', 'wacht_op_klant') then 'open'::ticket_status else status end,
              awaiting_since = coalesce(awaiting_since, $2::timestamptz)
       where id = $1 returning *`,
      [match.ticketId, mail.receivedAt],
    );
  } else {
    let clientId: string;
    if (match.kind === "new-ticket") {
      clientId = match.clientId;
    } else {
      const lead = leadFromSender(match.sender);
      const [c] = await q<ClientRow>(
        `insert into clients (company, owner_name, email, stage, notes) values ($1, $2, $3, 'lead', 'Aangemaakt uit een binnenkomende e-mail.')
         returning *`,
        [lead.company, lead.owner_name, lead.email],
      );
      await q("insert into client_stage_history (client_id, from_stage, to_stage) values ($1, null, 'lead')", [c.id]);
      clientId = c.id;
      created = "lead";
    }
    [ticket] = await q<TicketRow>(
      "insert into tickets (client_id, subject, status, awaiting_since, created_at) values ($1, $2, 'nieuw', $3, $3) returning *",
      [clientId, mail.subject.trim() || "(geen onderwerp)", mail.receivedAt],
    );
    created ??= "ticket";
  }

  const [msg] = await q<TicketMessageRow>(
    `insert into ticket_messages (ticket_id, direction, from_email, to_email, subject, body_text, body_html, message_id,
                                  in_reply_to, references_header, created_at)
     values ($1, 'in', $2, $3, $4, $5, $6, $7, $8, $9, $10) returning *`,
    [
      ticket.id,
      mail.from,
      mail.to,
      mail.subject,
      mail.text,
      mail.html,
      mail.messageId,
      mail.inReplyTo,
      mail.references,
      mail.receivedAt,
    ],
  );

  // Een bijlage die niet opgeslagen kan worden mag het ticket niet tegenhouden.
  const failed: string[] = [];
  for (const a of mail.attachments) {
    const path = storage.path(ticket.id, msg.id, a.filename);
    try {
      await storage.save(path, await a.load(), a.contentType);
    } catch (err) {
      console.error("[inbound] bijlage niet opgeslagen:", a.filename, err);
      failed.push(a.filename);
      continue;
    }
    await q(
      "insert into ticket_attachments (message_id, filename, content_type, size_bytes, storage_path) values ($1, $2, $3, $4, $5)",
      [msg.id, a.filename, a.contentType, a.size, path],
    );
  }
  if (failed.length) {
    await q("update ticket_messages set body_text = body_text || $2 where id = $1", [
      msg.id,
      `\n\n[Bijlage niet opgeslagen: ${failed.join(", ")}. Bekijk de originele mail in Resend.]`,
    ]);
  }

  if (ticket.client_id) {
    await q(
      `insert into log_entries (client_id, type, summary, source, ticket_id, occurred_at) values ($1, 'email', $2, 'email_in', $3, $4)`,
      [ticket.client_id, `E-mail ontvangen: ${mail.subject || "(geen onderwerp)"}`, ticket.id, mail.receivedAt],
    );
  }
  return { ticketId: ticket.id, created, duplicate: false };
}

/** Antwoord vanuit het ticket; blijft in dezelfde e-mailthread bij de klant. */
export async function replyToTicket(q: Query, ticketId: string, body: string, statusAfter: TicketStatus): Promise<void> {
  const [ticket] = await q<TicketRow & { client_email: string | null }>(
    "select t.*, c.email as client_email from tickets t left join clients c on c.id = t.client_id where t.id = $1",
    [ticketId],
  );
  if (!ticket) throw new Error("Ticket niet gevonden.");
  const messages = await q<TicketMessageRow>("select * from ticket_messages where ticket_id = $1 order by created_at", [ticketId]);
  const lastIn = [...messages].reverse().find((m) => m.direction === "in");
  const to = lastIn ? parseAddress(lastIn.from_email).email : ticket.client_email;
  if (!to) throw new Error("Geen e-mailadres om naar te antwoorden.");
  const references = messages.map((m) => m.message_id).filter((x): x is string => Boolean(x));

  const [email] = await q<EmailRow>(
    `insert into emails (client_id, ticket_id, kind, to_email, subject, body, status) values ($1, $2, 'ticket', $3, $4, $5, 'concept') returning *`,
    [ticket.client_id, ticketId, to, replySubject(ticket.subject, ticket.number), body],
  );
  const sent = await sendEmail(q, email.id, { inReplyTo: lastIn?.message_id ?? null, references });
  await q(
    `insert into ticket_messages (ticket_id, direction, from_email, to_email, subject, body_text, message_id, in_reply_to, references_header, email_id)
     values ($1, 'uit', $2, $3, $4, $5, $6, $7, $8, $9)`,
    [ticketId, fromAddress(), to, sent.subject, body, sent.message_id, lastIn?.message_id ?? null, references.join(" ") || null, sent.id],
  );
  await q(
    `update tickets set status = $2::ticket_status, awaiting_since = null, first_response_at = coalesce(first_response_at, now()) where id = $1`,
    [ticketId, statusAfter],
  );
}

export async function setTicketStatus(q: Query, ticketId: string, status: TicketStatus): Promise<void> {
  await q(
    `update tickets set status = $2::ticket_status,
       awaiting_since = case when $2::ticket_status in ('opgelost', 'wacht_op_klant') then null else awaiting_since end
     where id = $1`,
    [ticketId, status],
  );
}

export async function linkTicketToClient(q: Query, ticketId: string, clientId: string): Promise<void> {
  await q("update tickets set client_id = $2 where id = $1", [ticketId, clientId]);
}

import type { Query } from "../db/driver";
import type { ClientRow, EmailRow, TemplateRow } from "../types";
import { clientVariables, renderTemplate } from "../domain/templates";
import { amsDate, amsTime } from "../domain/dates";
import { deliver } from "../email/deliver";

export async function getTemplate(q: Query, key: string): Promise<TemplateRow | null> {
  const [t] = await q<TemplateRow>("select * from email_templates where key = $1", [key]);
  return t ?? null;
}

/**
 * Maakt een e-mail uit een sjabloon. Ligt de datum in de toekomst, dan krijgt
 * hij status "gepland"; de dagelijkse job zet hem op die dag klaar (of verstuurt
 * hem direct als het sjabloon op automatisch staat). Bestaat de automation_key
 * al, dan gebeurt er niets.
 */
export async function createTemplateEmail(
  q: Query,
  opts: {
    client: ClientRow;
    templateKey: string;
    scheduledFor: string; // YYYY-MM-DD
    today: string;
    automationKey?: string | null;
    kind?: EmailRow["kind"];
    paymentId?: string | null;
    extraVars?: Record<string, string>;
  },
): Promise<EmailRow | null> {
  const tpl = await getTemplate(q, opts.templateKey);
  if (!tpl || !opts.client.email) return null;
  const vars = { ...clientVariables(opts.client), ...opts.extraVars };
  const status = opts.scheduledFor > opts.today ? "gepland" : "concept";
  const [row] = await q<EmailRow>(
    `insert into emails (client_id, template_key, kind, to_email, subject, body, status, scheduled_for, automation_key, payment_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     on conflict (automation_key) do nothing
     returning *`,
    [
      opts.client.id,
      tpl.key,
      opts.kind ?? "sjabloon",
      opts.client.email,
      renderTemplate(tpl.subject, vars),
      renderTemplate(tpl.body, vars),
      status,
      amsTime(opts.scheduledFor, 8).toISOString(),
      opts.automationKey ?? null,
      opts.paymentId ?? null,
    ],
  );
  return row ?? null;
}

/**
 * Verstuurt een concept of geplande e-mail. Legt hem vast in het logboek van de
 * klant (en in de ticketgeschiedenis bij een ticketantwoord).
 */
export async function sendEmail(
  q: Query,
  emailId: string,
  thread?: { inReplyTo: string | null; references: string[] },
): Promise<EmailRow> {
  const [email] = await q<EmailRow>("select * from emails where id = $1 for update", [emailId]);
  if (!email) throw new Error("E-mail niet gevonden.");
  if (email.status === "verzonden") return email;
  try {
    const sent = await deliver({ to: email.to_email, subject: email.subject, text: email.body, ...thread });
    const [updated] = await q<EmailRow>(
      `update emails set status = 'verzonden', sent_at = now(), message_id = $2, provider_id = $3, error = null
       where id = $1 returning *`,
      [emailId, sent.messageId, sent.providerId],
    );
    if (updated.client_id && updated.kind !== "digest") {
      await q(
        `insert into log_entries (client_id, type, summary, source, email_id, ticket_id)
         values ($1, 'email', $2, 'email_uit', $3, $4)`,
        [updated.client_id, `E-mail verstuurd: ${updated.subject}`, updated.id, updated.ticket_id],
      );
    }
    return updated;
  } catch (err) {
    await q("update emails set status = 'mislukt', error = $2 where id = $1", [emailId, String((err as Error).message)]);
    throw err;
  }
}

/**
 * Geplande e-mails waarvan de dag is aangebroken: automatische sjablonen gaan
 * meteen de deur uit, de rest wordt een concept voor de Vandaag-lijst.
 */
export async function processDueEmails(q: Query, now: Date): Promise<{ sent: number; drafted: number; failed: number }> {
  const due = await q<EmailRow & { auto_send: boolean | null }>(
    `select e.*, t.auto_send from emails e left join email_templates t on t.key = e.template_key
     where e.status = 'gepland' and e.scheduled_for <= $1`,
    [now.toISOString()],
  );
  let sent = 0;
  let drafted = 0;
  let failed = 0;
  for (const e of due) {
    if (e.auto_send) {
      try {
        await sendEmail(q, e.id);
        sent++;
      } catch {
        failed++;
      }
    } else {
      await q("update emails set status = 'concept' where id = $1", [e.id]);
      drafted++;
    }
  }
  return { sent, drafted, failed };
}

/** Losse e-mail aan een klant (vanuit het klantscherm). */
export async function createLooseEmail(q: Query, client: ClientRow, subject: string, body: string): Promise<EmailRow> {
  if (!client.email) throw new Error("Deze klant heeft geen e-mailadres.");
  const [row] = await q<EmailRow>(
    `insert into emails (client_id, kind, to_email, subject, body, status) values ($1, 'los', $2, $3, $4, 'concept') returning *`,
    [client.id, client.email, subject, body],
  );
  return row;
}

/** Nieuwsbrief naar alle actieve klanten; komt in ieders logboek. */
export async function sendNewsletter(q: Query, subject: string, body: string): Promise<number> {
  const clients = await q<ClientRow>(
    `select * from clients where stage in ('inrichting','training','checkin','doorlopend') and coalesce(email, '') <> ''`,
  );
  let count = 0;
  for (const c of clients) {
    const vars = clientVariables(c);
    const [row] = await q<EmailRow>(
      `insert into emails (client_id, kind, to_email, subject, body, status) values ($1, 'nieuwsbrief', $2, $3, $4, 'concept') returning *`,
      [c.id, c.email, renderTemplate(subject, vars), renderTemplate(body, vars)],
    );
    await sendEmail(q, row.id);
    count++;
  }
  await q("insert into newsletters (subject, body, recipients) values ($1, $2, $3)", [subject, body, count]);
  return count;
}

export function todayFor(now: Date): string {
  return amsDate(now);
}

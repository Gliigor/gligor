/** Logboek, taken, betalingen en snoozes. */
import type { Query } from "../db/driver";
import type { ClientRow, EmailRow, LogEntryRow, PaymentRow, TaskRow } from "../types";
import type { LogType } from "../config";
import { TEMPLATE_KEYS } from "../config";
import { addDays } from "../domain/dates";
import { paymentDescription } from "../domain/payments";
import { formatDateLong, formatEuro } from "../format";
import { createTemplateEmail, sendEmail } from "./emails";

export interface LogInput {
  client_id: string;
  type: LogType;
  occurred_at?: string | null;
  summary: string;
  agreed_actions?: string;
  follow_up_date?: string | null;
}

export async function addLogEntry(q: Query, input: LogInput): Promise<LogEntryRow> {
  const [row] = await q<LogEntryRow>(
    `insert into log_entries (client_id, type, occurred_at, summary, agreed_actions, follow_up_date)
     values ($1, $2, coalesce($3::timestamptz, now()), $4, $5, $6) returning *`,
    [
      input.client_id,
      input.type,
      input.occurred_at || null,
      input.summary.trim(),
      (input.agreed_actions ?? "").trim(),
      input.follow_up_date || null,
    ],
  );
  return row;
}

/** Elke regel uit "afgesproken acties" wordt een taak (één klik). */
export async function actionsToTasks(q: Query, logEntryId: string, today: string): Promise<number> {
  const [entry] = await q<LogEntryRow>("select * from log_entries where id = $1", [logEntryId]);
  if (!entry) throw new Error("Logboekregel niet gevonden.");
  const lines = entry.agreed_actions
    .split("\n")
    .map((l) => l.replace(/^\s*[-*•\d.)]+\s*/, "").trim())
    .filter(Boolean);
  let n = 0;
  for (const [i, line] of lines.entries()) {
    const rows = await q(
      `insert into tasks (client_id, title, due_date, source, log_entry_id, automation_key)
       values ($1, $2, $3, 'logboek', $4, $5) on conflict (automation_key) do nothing returning id`,
      [entry.client_id, line, entry.follow_up_date ?? addDays(today, 2), entry.id, `log:${entry.id}:${i}`],
    );
    n += rows.length;
  }
  // De opvolging zit nu in de taken; niet ook nog los in Vandaag tonen.
  if (n > 0) await q("update log_entries set follow_up_done = true where id = $1", [entry.id]);
  return n;
}

export async function completeFollowUp(q: Query, logEntryId: string): Promise<void> {
  await q("update log_entries set follow_up_done = true where id = $1", [logEntryId]);
}

export async function createTask(q: Query, input: { client_id: string | null; title: string; due_date: string | null }): Promise<TaskRow> {
  const [t] = await q<TaskRow>(
    "insert into tasks (client_id, title, due_date) values ($1, $2, $3) returning *",
    [input.client_id, input.title.trim(), input.due_date || null],
  );
  return t;
}

export async function setTaskDone(q: Query, taskId: string, done: boolean): Promise<void> {
  await q(
    `update tasks set status = $2::task_status, completed_at = case when $2::task_status = 'klaar' then now() else null end where id = $1`,
    [taskId, done ? "klaar" : "open"],
  );
  if (done) {
    const [t] = await q<TaskRow>("select * from tasks where id = $1", [taskId]);
    if (t?.client_id && t.source !== "systeem") {
      await q(
        "insert into log_entries (client_id, type, summary, source) values ($1, 'notitie', $2, 'systeem')",
        [t.client_id, `Taak afgerond: ${t.title}`],
      );
    }
  }
}

export async function snooze(q: Query, itemKey: string, until: string): Promise<void> {
  await q(
    "insert into snoozes (item_key, until) values ($1, $2) on conflict (item_key) do update set until = excluded.until",
    [itemKey, until],
  );
}

// ---------------------------------------------------------------------------
// Betalingen. Zowel de knoppen in het dashboard als (later) de Stripe-webhook
// gaan via deze functies, zodat de UI niet hoeft te veranderen.
// ---------------------------------------------------------------------------

export async function markPaid(q: Query, paymentId: string, paidAt: string, source: "handmatig" | "stripe" = "handmatig"): Promise<void> {
  await q("update payments set paid_at = $2, source = $3 where id = $1", [paymentId, paidAt, source]);
}

export async function markUnpaid(q: Query, paymentId: string): Promise<void> {
  await q("update payments set paid_at = null, source = 'handmatig' where id = $1", [paymentId]);
}

/** Voor de Stripe-koppeling later: betaling op basis van het externe factuur-id. */
export async function markPaidByExternalId(q: Query, provider: string, externalId: string, paidAt: string): Promise<boolean> {
  const rows = await q(
    "update payments set paid_at = $3, source = 'stripe' where external_provider = $1 and external_id = $2 returning id",
    [provider, externalId, paidAt],
  );
  return rows.length > 0;
}

/** Zet een vriendelijke herinnering klaar als concept (bestaat hij al, dan die). */
export async function reminderDraft(q: Query, paymentId: string, today: string): Promise<EmailRow | null> {
  const [existing] = await q<EmailRow>(
    "select * from emails where payment_id = $1 and kind = 'herinnering' and status = 'concept' order by created_at desc limit 1",
    [paymentId],
  );
  if (existing) return existing;
  const [p] = await q<PaymentRow>("select * from payments where id = $1", [paymentId]);
  if (!p) throw new Error("Betaling niet gevonden.");
  const [client] = await q<ClientRow>("select * from clients where id = $1", [p.client_id]);
  return createTemplateEmail(q, {
    client,
    templateKey: TEMPLATE_KEYS.betaalherinnering,
    scheduledFor: today,
    today,
    kind: "herinnering",
    paymentId: p.id,
    extraVars: {
      bedrag: formatEuro(p.amount),
      omschrijving: paymentDescription(p),
      vervaldatum: formatDateLong(p.due_date),
    },
  });
}

export async function sendReminder(q: Query, paymentId: string, today: string): Promise<void> {
  const draft = await reminderDraft(q, paymentId, today);
  if (!draft) throw new Error("Geen e-mailadres bekend voor deze klant.");
  await sendEmail(q, draft.id);
}

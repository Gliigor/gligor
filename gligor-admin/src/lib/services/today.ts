import type { Query } from "../db/driver";
import type { ClientRow, PaymentRow, TaskRow, TicketRow, LogEntryRow } from "../types";
import { addDays, amsDate } from "../domain/dates";
import { buildToday, summarize, type TodayItem, type TodaySummary } from "../domain/today";
import { ACTIVE_STAGES } from "../config";
import { ensureQuarterly, syncPayments } from "./clients";
import { processDueEmails } from "./emails";

export async function loadToday(q: Query, now: Date): Promise<{ items: TodayItem[]; summary: TodaySummary; today: string }> {
  const today = amsDate(now);
  const [clients, tickets, payments, tasks, followUps, drafts, snoozes] = await Promise.all([
    q<ClientRow>("select * from clients"),
    q<TicketRow>("select * from tickets where status <> 'opgelost'"),
    q<PaymentRow>("select * from payments where paid_at is null and not cancelled"),
    q<TaskRow>("select * from tasks where status = 'open' and due_date <= $1", [addDays(today, 7)]),
    q<LogEntryRow>("select * from log_entries where follow_up_date <= $1 and not follow_up_done", [today]),
    q<{ id: string; client_id: string | null; subject: string; to_email: string; name: string | null; created_at: string }>(
      `select e.id, e.client_id, e.subject, e.to_email, t.name, e.created_at
       from emails e left join email_templates t on t.key = e.template_key where e.status = 'concept'`,
    ),
    q<{ item_key: string; until: string }>("select item_key, until from snoozes where until > $1", [today]),
  ]);

  const contactClients = clients.map((c) => ({
    clientId: c.id,
    company: c.company,
    ownerName: c.owner_name,
    email: c.email,
    phone: c.phone,
    channel: c.preferred_channel,
    stage: c.stage,
    package: c.package,
    lastContactAt: c.last_contact_at,
    createdAt: c.created_at,
  }));
  const paymentsIn = payments.map((p) => ({
    id: p.id,
    clientId: p.client_id,
    kind: p.kind,
    periodStart: p.period_start,
    dueDate: p.due_date,
    amount: p.amount,
    paidAt: p.paid_at,
    cancelled: p.cancelled,
  }));
  const ticketsIn = tickets.map((t) => ({
    id: t.id,
    number: t.number,
    subject: t.subject,
    status: t.status,
    awaitingSince: t.awaiting_since,
    clientId: t.client_id,
  }));

  const items = buildToday({
    today,
    now,
    clients: contactClients,
    tickets: ticketsIn,
    payments: paymentsIn,
    tasks: tasks.map((t) => ({ id: t.id, clientId: t.client_id, title: t.title, dueDate: t.due_date, source: t.source })),
    followUps: followUps.map((f) => ({
      id: f.id,
      clientId: f.client_id,
      summary: f.summary,
      agreedActions: f.agreed_actions,
      followUpDate: f.follow_up_date!,
    })),
    drafts: drafts.map((d) => ({
      id: d.id,
      clientId: d.client_id,
      subject: d.subject,
      toEmail: d.to_email,
      templateName: d.name,
      createdAt: d.created_at,
    })),
    snoozes: new Map(snoozes.map((s) => [s.item_key, s.until])),
  });

  const summary = summarize({
    today,
    tickets: ticketsIn,
    payments: paymentsIn,
    clients: clients.map((c) => ({ stage: c.stage, monthlyFee: c.monthly_fee })),
  });
  return { items, summary, today };
}

/**
 * De dagelijkse job (07:00 Amsterdam): betalingen aanvullen, kwartaalmomenten
 * klaarzetten en geplande e-mails verwerken. Daarna wordt de digest gemaakt.
 */
export async function runDaily(q: Query, now: Date) {
  const today = amsDate(now);
  const clients = await q<ClientRow>("select * from clients where stage <> 'lead'");
  let payments = 0;
  for (const c of clients) {
    payments += await syncPayments(q, c, today);
    if (ACTIVE_STAGES.includes(c.stage)) await ensureQuarterly(q, c, today);
  }
  await q("delete from snoozes where until <= $1", [today]);
  const emails = await processDueEmails(q, now);
  return { today, paymentsCreated: payments, ...emails };
}

/**
 * Vangnet: is de dagelijkse job vandaag nog niet gedraaid (bijv. omdat de cron
 * niet liep, of in de demo-modus), dan doen we het bij het openen van het dashboard.
 */
export async function ensureDailyRun(q: Query, now: Date): Promise<void> {
  const today = amsDate(now);
  const [row] = await q<{ value: string }>("select value #>> '{}' as value from settings where key = 'last_daily_run'");
  if (row?.value === today) return;
  await runDaily(q, now);
  await q(
    `insert into settings (key, value) values ('last_daily_run', to_jsonb($1::text))
     on conflict (key) do update set value = excluded.value`,
    [today],
  );
}

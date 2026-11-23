import type { Query } from "../db/driver";
import { pgArray } from "../db/driver";
import type { ClientRow, EmailRow, LogEntryRow, PaymentRow, TaskRow, TicketRow } from "../types";
import { PACKAGES, STAGE_LABEL, START_FEE, type Channel, type PackageKey, type SetupType, type Stage } from "../config";
import { addDays } from "../domain/dates";
import { expectedPayments, paymentStatus } from "../domain/payments";
import { planStageChange, quarterlyEmail, quarterlyTask, nextQuarterlyMoment } from "../domain/lifecycle";
import { createTemplateEmail, getTemplate, sendEmail } from "./emails";

export interface ClientInput {
  company: string;
  sector?: string | null;
  city?: string | null;
  owner_name?: string;
  email?: string | null;
  phone?: string | null;
  preferred_channel?: Channel;
  package?: PackageKey;
  monthly_fee?: number | null;
  start_fee?: number | null;
  start_date?: string | null;
  setup_type?: SetupType | null;
  users_count?: number;
  notes?: string;
  tags?: string[];
}

export async function getClient(q: Query, id: string): Promise<ClientRow | null> {
  const [c] = await q<ClientRow>("select * from clients where id = $1", [id]);
  return c ?? null;
}

export async function createClient(q: Query, input: ClientInput, stage: Stage, today: string): Promise<ClientRow> {
  const pkg = input.package ?? "basis";
  const [c] = await q<ClientRow>(
    `insert into clients (company, sector, city, owner_name, email, phone, preferred_channel, package, monthly_fee,
                          start_fee, start_date, setup_type, users_count, notes, tags, stage)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::text[], 'lead')
     returning *`,
    [
      input.company,
      input.sector ?? null,
      input.city ?? null,
      input.owner_name ?? "",
      input.email?.trim().toLowerCase() || null,
      input.phone ?? null,
      input.preferred_channel ?? "email",
      pkg,
      input.monthly_fee ?? PACKAGES[pkg].monthlyFee,
      input.start_fee ?? START_FEE,
      input.start_date ?? null,
      input.setup_type ?? null,
      input.users_count ?? 1,
      input.notes ?? "",
      pgArray(input.tags ?? []),
    ],
  );
  await q("insert into client_stage_history (client_id, from_stage, to_stage) values ($1, null, 'lead')", [c.id]);
  if (stage !== "lead") return moveStage(q, c.id, stage, today);
  return c;
}

export async function updateClient(q: Query, id: string, input: ClientInput, today: string): Promise<ClientRow> {
  const before = await getClient(q, id);
  if (!before) throw new Error("Klant niet gevonden.");
  const pkg = input.package ?? before.package;
  const [c] = await q<ClientRow>(
    `update clients set company = $2, sector = $3, city = $4, owner_name = $5, email = $6, phone = $7,
       preferred_channel = $8, package = $9, monthly_fee = $10, start_fee = $11, start_date = $12,
       setup_type = $13, users_count = $14, notes = $15, tags = $16::text[]
     where id = $1 returning *`,
    [
      id,
      input.company,
      input.sector ?? null,
      input.city ?? null,
      input.owner_name ?? "",
      input.email?.trim().toLowerCase() || null,
      input.phone ?? null,
      input.preferred_channel ?? before.preferred_channel,
      pkg,
      input.monthly_fee ?? (pkg !== before.package ? PACKAGES[pkg].monthlyFee : before.monthly_fee),
      input.start_fee ?? before.start_fee,
      input.start_date ?? null,
      input.setup_type ?? null,
      input.users_count ?? before.users_count,
      input.notes ?? before.notes,
      pgArray(input.tags ?? before.tags),
    ],
  );
  await syncPayments(q, c, today);
  return c;
}

/**
 * Zet een klant in een nieuwe fase: legt de datum vast en voert de automatische
 * stappen uit (taken, e-mailconcepten, betalingen). Idempotent per fase.
 */
export async function moveStage(q: Query, clientId: string, to: Stage, today: string): Promise<ClientRow> {
  const client = await getClient(q, clientId);
  if (!client) throw new Error("Klant niet gevonden.");
  if (client.stage === to) return client;

  const plan = planStageChange(client, to, today);
  const [updated] = await q<ClientRow>(
    `update clients set stage = $2::client_stage, stage_changed_at = now(),
       start_date = coalesce(start_date, $3::date),
       end_date = case when $2::client_stage = 'opgezegd' then $4::date else null end
     where id = $1 returning *`,
    [clientId, to, plan.startDate ?? null, plan.endDate ?? null],
  );
  await q("insert into client_stage_history (client_id, from_stage, to_stage) values ($1, $2::client_stage, $3::client_stage)", [clientId, client.stage, to]);

  for (const t of plan.tasks) {
    await q(
      `insert into tasks (client_id, title, due_date, source, automation_key) values ($1, $2, $3, 'levenscyclus', $4)
       on conflict (automation_key) do nothing`,
      [clientId, t.title, t.due, t.key],
    );
  }
  for (const e of plan.emails) {
    const row = await createTemplateEmail(q, {
      client: updated,
      templateKey: e.template,
      scheduledFor: e.scheduledFor,
      today,
      automationKey: e.key,
    });
    if (row && row.status === "concept") {
      const tpl = await getTemplate(q, e.template);
      if (tpl?.auto_send) await sendEmail(q, row.id).catch(() => undefined);
    }
  }
  if (plan.cancelFuture && plan.endDate) {
    await q(
      `update payments set cancelled = true where client_id = $1 and paid_at is null and period_start >= $2`,
      [clientId, plan.endDate],
    );
    await q(`update emails set status = 'geannuleerd' where client_id = $1 and status in ('concept', 'gepland')`, [clientId]);
    await q(
      `update tasks set status = 'klaar', completed_at = now()
       where client_id = $1 and status = 'open' and source = 'levenscyclus' and due_date > $2`,
      [clientId, today],
    );
  }
  await q(
    `insert into log_entries (client_id, type, summary, source) values ($1, 'notitie', $2, 'systeem')`,
    [clientId, `Fase gewijzigd: ${STAGE_LABEL[client.stage]} → ${STAGE_LABEL[to]}`],
  );
  await syncPayments(q, updated, today);
  return updated;
}

/** Maakt ontbrekende verwachte betalingen aan (tot 31 dagen vooruit). */
export async function syncPayments(q: Query, client: ClientRow, today: string): Promise<number> {
  let created = 0;
  for (const p of expectedPayments(client, addDays(today, 31))) {
    const rows = await q(
      `insert into payments (client_id, kind, period_start, due_date, amount) values ($1, $2, $3, $4, $5)
       on conflict (client_id, kind, period_start) do nothing returning id`,
      [client.id, p.kind, p.period_start, p.due_date, p.amount],
    );
    created += rows.length;
  }
  return created;
}

/** Plus-klanten in "Doorlopend": zorg dat het eerstvolgende kwartaalmoment klaarstaat. */
export async function ensureQuarterly(q: Query, client: ClientRow, today: string): Promise<void> {
  if (client.package !== "plus" || client.stage !== "doorlopend" || !client.start_date) return;
  const date = nextQuarterlyMoment(client.start_date, today);
  const t = quarterlyTask(client.id, date);
  await q(
    `insert into tasks (client_id, title, due_date, source, automation_key) values ($1, $2, $3, 'levenscyclus', $4)
     on conflict (automation_key) do nothing`,
    [client.id, t.title, t.due, t.key],
  );
  const e = quarterlyEmail(client.id, date);
  await createTemplateEmail(q, { client, templateKey: e.template, scheduledFor: e.scheduledFor, today, automationKey: e.key });
}

export interface ClientListRow extends ClientRow {
  overdue_payments: number;
  open_tickets: number;
  open_tasks_due: number;
}

export async function listClients(q: Query, today: string): Promise<ClientListRow[]> {
  return q<ClientListRow>(
    `select c.*,
       (select count(*)::int from payments p where p.client_id = c.id and p.paid_at is null and not p.cancelled and p.due_date < $1) as overdue_payments,
       (select count(*)::int from tickets t where t.client_id = c.id and t.status <> 'opgelost') as open_tickets,
       (select count(*)::int from tasks k where k.client_id = c.id and k.status = 'open' and k.due_date <= $1) as open_tasks_due
     from clients c order by lower(c.company)`,
    [today],
  );
}

/** Alles van één klant, voor de detailpagina én de AVG-export. */
export async function clientBundle(q: Query, id: string) {
  const client = await getClient(q, id);
  if (!client) return null;
  const [history, log, tasks, tickets, payments, emails] = await Promise.all([
    q<{ from_stage: Stage | null; to_stage: Stage; changed_at: string }>(
      "select from_stage, to_stage, changed_at from client_stage_history where client_id = $1 order by changed_at, to_stage",
      [id],
    ),
    q<LogEntryRow>("select * from log_entries where client_id = $1 order by occurred_at desc, created_at desc", [id]),
    q<TaskRow>("select * from tasks where client_id = $1 order by status, due_date nulls last, created_at", [id]),
    q<TicketRow>("select * from tickets where client_id = $1 order by created_at desc", [id]),
    q<PaymentRow>("select * from payments where client_id = $1 order by period_start, kind desc", [id]),
    q<EmailRow>("select * from emails where client_id = $1 order by created_at desc", [id]),
  ]);
  return { client, history, log, tasks, tickets, payments, emails };
}

export async function exportClient(q: Query, id: string) {
  const bundle = await clientBundle(q, id);
  if (!bundle) return null;
  const messages = await q(
    `select m.*, (select json_agg(json_build_object('filename', a.filename, 'content_type', a.content_type, 'size_bytes', a.size_bytes))
                  from ticket_attachments a where a.message_id = m.id) as attachments
     from ticket_messages m join tickets t on t.id = m.ticket_id where t.client_id = $1 order by m.created_at`,
    [id],
  );
  return { exported_at: new Date().toISOString(), ...bundle, ticket_messages: messages };
}

/** AVG: verwijdert de klant met alles erbij; geeft de bijlagepaden terug om uit de opslag te wissen. */
export async function forgetClient(q: Query, id: string): Promise<string[]> {
  const paths = await q<{ storage_path: string }>(
    `select a.storage_path from ticket_attachments a join ticket_messages m on m.id = a.message_id
     join tickets t on t.id = m.ticket_id where t.client_id = $1`,
    [id],
  );
  await q("select forget_client($1)", [id]);
  return paths.map((p) => p.storage_path);
}

export function needsAttention(c: ClientListRow): boolean {
  return c.overdue_payments > 0 || c.open_tasks_due > 0 || c.open_tickets > 0;
}

export { paymentStatus };

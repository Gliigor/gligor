/** Leads van de website en Cal.com, intakelinks en het intakeformulier. */
import type { Query } from "../db/driver";
import type { ClientRow, EmailRow, IntakeLinkRow, TaskRow } from "../types";
import { INTAKE_LINK_DAYS, TEMPLATE_KEYS, type LeadSource } from "../config";
import { addWorkingDays, amsDate } from "../domain/dates";
import {
  fullName,
  hashToken,
  intakeBirthday,
  intakeLinkState,
  leadCompany,
  newIntakeToken,
  splitName,
  type CalBooking,
  type IntakeData,
  type LeadForm,
} from "../domain/leads";
import { formatDate, formatDateTime } from "../format";
import { createClient, moveStage, syncPayments, updateClient } from "./clients";
import { createTemplateEmail, sendEmail } from "./emails";
import { runMilestones } from "./loyalty";

/** Bestaande klant op e-mailadres, of een nieuwe lead. */
async function findOrCreateLead(
  q: Query,
  input: { name: string; email: string; company: string; phone?: string | null; source: LeadSource },
  today: string,
): Promise<{ client: ClientRow; created: boolean }> {
  const [existing] = await q<ClientRow>("select * from clients where lower(email) = $1", [input.email.toLowerCase()]);
  if (existing) return { client: existing, created: false };
  const { first, last } = splitName(input.name);
  const client = await createClient(
    q,
    {
      company: input.company,
      first_name: first,
      last_name: last,
      email: input.email,
      phone: input.phone ?? null,
      lead_source: input.source,
      notes: "",
    },
    "lead",
    today,
  );
  return { client, created: true };
}

// ---------------------------------------------------------------------------
// Rate limit voor publieke formulieren
// ---------------------------------------------------------------------------

/** true = binnen de limiet (en de poging is meegeteld). */
export async function allowFormHit(q: Query, bucket: string, ipHash: string, max: number, windowMinutes: number): Promise<boolean> {
  const [{ n }] = await q<{ n: number }>(
    `select count(*)::int as n from form_hits
     where bucket = $1 and ip_hash = $2 and created_at > now() - make_interval(mins => $3)`,
    [bucket, ipHash, windowMinutes],
  );
  if (n >= max) return false;
  await q("insert into form_hits (bucket, ip_hash) values ($1, $2)", [bucket, ipHash]);
  return true;
}

// ---------------------------------------------------------------------------
// Contactformulier op gligor.ai
// ---------------------------------------------------------------------------

export async function createWebsiteLead(q: Query, form: LeadForm, now: Date): Promise<{ clientId: string; created: boolean }> {
  const today = amsDate(now);
  const { client, created } = await findOrCreateLead(
    q,
    { name: form.naam, email: form.email, company: leadCompany(form), source: "website" },
    today,
  );
  await q(
    `insert into log_entries (client_id, type, summary, source, occurred_at) values ($1, 'email', $2, 'email_in', $3)`,
    [client.id, `Contactformulier website: ${form.bericht}`, now.toISOString()],
  );
  await q(
    `insert into tasks (client_id, title, due_date, source, details) values ($1, $2, $3, 'lead', $4)`,
    [
      client.id,
      `Reageren op ${form.naam} (website)`,
      today,
      `Reageren binnen 1 werkdag (uiterlijk ${formatDate(addWorkingDays(today, 1))}). Vraag: ${form.bericht.slice(0, 300)}`,
    ],
  );
  return { clientId: client.id, created };
}

// ---------------------------------------------------------------------------
// Cal.com
// ---------------------------------------------------------------------------

const calKey = (uid: string) => `cal:${uid}`;

/**
 * Nieuwe of verplaatste boeking: lead aanmaken of bijwerken, fase "Kennismaking",
 * en de afspraak als taak op de dag zelf (zo staat hij in Vandaag). Geannuleerd:
 * taak afsluiten en een notitie in het logboek.
 */
export async function handleCalBooking(q: Query, b: CalBooking): Promise<{ clientId: string | null; action: string }> {
  const today = amsDate(new Date());
  if (b.event === "cancelled") {
    const [task] = await q<TaskRow>(
      "update tasks set status = 'klaar', completed_at = now() where automation_key = $1 returning *",
      [calKey(b.uid)],
    );
    if (task?.client_id) {
      await q("insert into log_entries (client_id, type, summary, source) values ($1, 'notitie', $2, 'systeem')", [
        task.client_id,
        `Kennismaking geannuleerd via Cal.com (${formatDateTime(b.startTime)}).`,
      ]);
    }
    return { clientId: task?.client_id ?? null, action: "geannuleerd" };
  }

  const { client, created } = await findOrCreateLead(
    q,
    { name: b.name || b.email, email: b.email, company: leadCompany({ naam: b.name || b.email, email: b.email }), phone: b.phone, source: "cal" },
    today,
  );
  if (!created && b.phone && !client.phone) await q("update clients set phone = $2 where id = $1", [client.id, b.phone]);
  if (client.stage === "lead") await moveStage(q, client.id, "kennismaking", today);

  if (b.previousUid) {
    await q("update tasks set status = 'klaar', completed_at = now() where automation_key = $1", [calKey(b.previousUid)]);
  }
  const meetingDay = amsDate(new Date(b.startTime));
  const time = new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" }).format(new Date(b.startTime));
  await q(
    `insert into tasks (client_id, title, due_date, source, automation_key, details)
     values ($1, $2, $3, 'lead', $4, $5)
     on conflict (automation_key) do update set due_date = excluded.due_date, title = excluded.title, details = excluded.details, status = 'open'`,
    [
      client.id,
      `Kennismaking met ${b.name || client.company} om ${time}`,
      meetingDay,
      calKey(b.uid),
      b.notes ? `Opmerking bij de boeking: ${b.notes}` : `Geboekt via Cal.com: ${b.title}`,
    ],
  );
  await q("insert into log_entries (client_id, type, summary, source) values ($1, 'notitie', $2, 'systeem')", [
    client.id,
    `${b.event === "rescheduled" ? "Kennismaking verplaatst" : "Kennismaking geboekt"} via Cal.com: ${formatDateTime(b.startTime)}${b.notes ? `. Opmerking: ${b.notes}` : ""}`,
  ]);
  return { clientId: client.id, action: b.event === "rescheduled" ? "verplaatst" : "geboekt" };
}

// ---------------------------------------------------------------------------
// Intake: formulier in het dashboard, of via een eenmalige link
// ---------------------------------------------------------------------------

/**
 * Slaat het intakeformulier op: maakt de klant aan (of zet een lead om), zet hem
 * in fase "Intake" (welkomstmail als concept), zet de pijnpunten in het logboek,
 * maakt de verwachte betalingen en de mijlpaal- en verjaardagsherinneringen aan.
 */
export async function saveIntake(
  q: Query,
  data: IntakeData & { start_date?: string | null; referred_by?: string | null },
  opts: { clientId?: string | null; intakeLinkId?: string | null },
  today: string,
): Promise<ClientRow> {
  const bday = intakeBirthday(data);
  const input = {
    company: data.company,
    first_name: data.first_name,
    last_name: data.last_name,
    owner_name: fullName(data.first_name, data.last_name),
    email: data.email || null,
    phone: data.phone || null,
    address: data.address,
    sector: data.sector || null,
    package: data.package,
    users_count: data.users_count,
    setup_type: (data.setup_type || null) as ClientRow["setup_type"],
    birthday_day: bday.day,
    birthday_month: bday.month,
    birthday_consent: bday.consent,
    start_date: data.start_date || null,
    referred_by: data.referred_by === undefined ? undefined : data.referred_by || null,
  };

  let client: ClientRow;
  if (opts.clientId) {
    const [before] = await q<ClientRow>("select * from clients where id = $1", [opts.clientId]);
    if (!before) throw new Error("Klant niet gevonden.");
    client = await updateClient(q, before.id, { ...input, monthly_fee: before.package === data.package ? before.monthly_fee : null }, today);
  } else {
    client = await createClient(q, { ...input, lead_source: opts.intakeLinkId ? "intakelink" : "handmatig" }, "lead", today);
  }
  if (["lead", "kennismaking"].includes(client.stage)) client = await moveStage(q, client.id, "intake", today);

  if (data.pain_points.trim()) {
    await q(
      "insert into log_entries (client_id, type, summary) values ($1, 'gesprek', $2)",
      [client.id, `Intake: waar gaat de tijd naartoe?\n${data.pain_points.trim()}`],
    );
  }
  await syncPayments(q, client, today);
  await runMilestones(q, client, today);

  if (opts.intakeLinkId) {
    await q("update intake_links set reviewed_at = now(), client_id = $2 where id = $1", [opts.intakeLinkId, client.id]);
    await q("update tasks set status = 'klaar', completed_at = now() where automation_key = $1", [`intake:${opts.intakeLinkId}`]);
  }
  return client;
}

/** Maakt een eenmalige intakelink (7 dagen geldig) en mailt hem naar de klant. */
export async function sendIntakeLink(q: Query, clientId: string, baseUrl: string, today: string): Promise<EmailRow> {
  const [client] = await q<ClientRow>("select * from clients where id = $1", [clientId]);
  if (!client) throw new Error("Klant niet gevonden.");
  if (!client.email) throw new Error("Vul eerst een e-mailadres in bij deze klant.");
  const { token, hash } = newIntakeToken();
  const expires = new Date(Date.now() + INTAKE_LINK_DAYS * 86_400_000);
  const [link] = await q<IntakeLinkRow>(
    "insert into intake_links (token_hash, client_id, email, expires_at) values ($1, $2, $3, $4) returning *",
    [hash, client.id, client.email, expires.toISOString()],
  );
  const email = await createTemplateEmail(q, {
    client,
    templateKey: TEMPLATE_KEYS.intakelink,
    scheduledFor: today,
    today,
    kind: "intakelink",
    automationKey: `intakelink:${link.id}`,
    extraVars: { link: `${baseUrl}/intake/${token}` },
  });
  if (!email) throw new Error("Sjabloon 'intakelink' ontbreekt.");
  return sendEmail(q, email.id);
}

export async function findIntakeLink(q: Query, token: string): Promise<(IntakeLinkRow & { prefill: Partial<ClientRow> | null }) | null> {
  const [link] = await q<IntakeLinkRow>("select * from intake_links where token_hash = $1", [hashToken(token)]);
  if (!link) return null;
  const [c] = link.client_id ? await q<ClientRow>("select * from clients where id = $1", [link.client_id]) : [];
  return {
    ...link,
    // Alleen wat de klant zelf al gaf; geen notities of interne velden.
    prefill: c
      ? { company: c.company, first_name: c.first_name, last_name: c.last_name, email: c.email, phone: c.phone, address: c.address, sector: c.sector, package: c.package }
      : null,
  };
}

/** De klant vult het formulier in: opslaan ter controle en een taak in Vandaag. */
export async function submitIntakeLink(q: Query, token: string, data: IntakeData, now: Date): Promise<void> {
  const [link] = await q<IntakeLinkRow>("select * from intake_links where token_hash = $1 for update", [hashToken(token)]);
  if (!link) throw new Error("Deze link bestaat niet.");
  const state = intakeLinkState(link, now);
  if (state === "gebruikt") throw new Error("Dit formulier is al ingevuld. Dank je wel!");
  if (state === "verlopen") throw new Error("Deze link is verlopen. Vraag Gligor om een nieuwe.");
  await q("update intake_links set submitted_at = $2, data = $3::jsonb where id = $1", [link.id, now.toISOString(), JSON.stringify(data)]);
  await q(
    `insert into tasks (client_id, title, due_date, source, automation_key, href, details)
     values ($1, $2, $3, 'lead', $4, $5, $6) on conflict (automation_key) do nothing`,
    [
      link.client_id,
      `Intakeformulier nakijken: ${data.company}`,
      amsDate(now),
      `intake:${link.id}`,
      `/klanten/nieuw?intake=${link.id}`,
      `Ingevuld door ${fullName(data.first_name, data.last_name)}. Controleer en sla op om de klant in fase Intake te zetten.`,
    ],
  );
}

/** Ingevulde, nog niet verwerkte intake (voor het vooraf ingevulde formulier). */
export async function intakeSubmission(q: Query, linkId: string): Promise<IntakeLinkRow | null> {
  const [link] = await q<IntakeLinkRow>("select * from intake_links where id = $1 and submitted_at is not null", [linkId]);
  return link ?? null;
}


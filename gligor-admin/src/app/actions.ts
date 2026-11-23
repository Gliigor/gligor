"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { asAdmin } from "@/lib/auth";
import { isDemo } from "@/lib/env";
import { addDays, amsDate } from "@/lib/domain/dates";
import { STAGES, type Stage, type TicketStatus } from "@/lib/config";
import { createClient, forgetClient, moveStage, updateClient, type ClientInput } from "@/lib/services/clients";
import { actionsToTasks, addLogEntry, completeFollowUp, createTask, markPaid, markUnpaid, reminderDraft, sendReminder, setTaskDone, snooze } from "@/lib/services/work";
import { createLooseEmail, createTemplateEmail, sendEmail, sendNewsletter } from "@/lib/services/emails";
import { firstName } from "@/lib/domain/templates";
import { linkTicketToClient, replyToTicket, setTicketStatus } from "@/lib/services/tickets";
import { runDaily } from "@/lib/services/today";
import { removeAttachments } from "@/lib/storage";
import type { ClientRow, EmailRow } from "@/lib/types";

export type ActionState = { ok?: boolean; error?: string; message?: string } | null;

const today = () => amsDate(new Date());
const refresh = () => revalidatePath("/", "layout");
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const optStr = (fd: FormData, k: string) => str(fd, k) || null;
const fail = (err: unknown): ActionState => ({ error: err instanceof Error ? err.message : String(err) });

const STAGE_KEYS = STAGES.map((s) => s.key) as [Stage, ...Stage[]];

// ---------------------------------------------------------------------------
// Logboek en notities
// ---------------------------------------------------------------------------

const noteSchema = z.object({
  client_id: z.uuid({ message: "Kies eerst een klant." }),
  type: z.enum(["gesprek", "telefoon", "email", "bezoek", "notitie"]),
  summary: z.string().min(1, "Schrijf kort wat er besproken is."),
  agreed_actions: z.string().optional(),
  follow_up_date: z.string().optional(),
  occurred_at: z.string().optional(),
});

export async function addNoteAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = noteSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    await asAdmin(async (q) => {
      const entry = await addLogEntry(q, {
        client_id: parsed.data.client_id,
        type: parsed.data.type,
        summary: parsed.data.summary,
        agreed_actions: parsed.data.agreed_actions,
        follow_up_date: parsed.data.follow_up_date || null,
        occurred_at: parsed.data.occurred_at ? new Date(parsed.data.occurred_at).toISOString() : null,
      });
      if (fd.get("make_tasks") && entry.agreed_actions) await actionsToTasks(q, entry.id, today());
    });
  } catch (err) {
    return fail(err);
  }
  refresh();
  return { ok: true };
}

export async function actionsToTasksAction(fd: FormData) {
  await asAdmin((q) => actionsToTasks(q, str(fd, "log_entry_id"), today()));
  refresh();
}

export async function completeFollowUpAction(fd: FormData) {
  await asAdmin((q) => completeFollowUp(q, str(fd, "log_entry_id")));
  refresh();
}

// ---------------------------------------------------------------------------
// Klanten
// ---------------------------------------------------------------------------

const clientSchema = z.object({
  company: z.string().min(1, "Bedrijfsnaam is verplicht."),
  sector: z.string().optional(),
  city: z.string().optional(),
  owner_name: z.string().optional(),
  email: z.union([z.literal(""), z.email({ message: "Dit e-mailadres klopt niet." })]).optional(),
  phone: z.string().optional(),
  preferred_channel: z.enum(["email", "telefoon", "whatsapp"]),
  package: z.enum(["basis", "plus"]),
  monthly_fee: z.string().optional(),
  start_fee: z.string().optional(),
  start_date: z.string().optional(),
  setup_type: z.enum(["", "microsoft365", "claude"]).optional(),
  users_count: z.string().optional(),
  notes: z.string().optional(),
  tags: z.string().optional(),
});

function toClientInput(fd: FormData): ClientInput | { error: string } {
  const parsed = clientSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Controleer het formulier." };
  const d = parsed.data;
  const num = (v?: string) => (v && v.trim() !== "" ? Number(v.replace(",", ".")) : null);
  return {
    company: d.company.trim(),
    sector: d.sector?.trim() || null,
    city: d.city?.trim() || null,
    owner_name: d.owner_name?.trim() ?? "",
    email: d.email?.trim() || null,
    phone: d.phone?.trim() || null,
    preferred_channel: d.preferred_channel,
    package: d.package,
    monthly_fee: num(d.monthly_fee),
    start_fee: num(d.start_fee),
    start_date: d.start_date || null,
    setup_type: (d.setup_type || null) as ClientInput["setup_type"],
    users_count: Math.max(0, Math.round(num(d.users_count) ?? 1)),
    notes: d.notes ?? "",
    tags: (d.tags ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  };
}

export async function createClientAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const input = toClientInput(fd);
  if ("error" in input) return { error: input.error };
  const stage = z.enum(STAGE_KEYS).catch("lead").parse(str(fd, "stage"));
  let id: string;
  try {
    id = await asAdmin(async (q) => (await createClient(q, input, stage, today())).id);
  } catch (err) {
    return fail(err);
  }
  refresh();
  redirect(`/klanten/${id}`);
}

export async function updateClientAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const input = toClientInput(fd);
  if ("error" in input) return { error: input.error };
  try {
    await asAdmin((q) => updateClient(q, str(fd, "id"), input, today()));
  } catch (err) {
    return fail(err);
  }
  refresh();
  return { ok: true, message: "Opgeslagen" };
}

export async function moveStageAction(clientId: string, stage: Stage): Promise<ActionState> {
  if (!STAGE_KEYS.includes(stage)) return { error: "Onbekende fase." };
  try {
    await asAdmin((q) => moveStage(q, clientId, stage, today()));
  } catch (err) {
    return fail(err);
  }
  refresh();
  return { ok: true };
}

export async function moveStageFormAction(fd: FormData) {
  await moveStageAction(str(fd, "client_id"), str(fd, "stage") as Stage);
}

export async function forgetClientAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  try {
    const paths = await asAdmin(async (q) => {
      const [c] = await q<ClientRow>("select * from clients where id = $1", [id]);
      if (!c) throw new Error("Klant niet gevonden.");
      if (str(fd, "confirm") !== c.company) throw new Error("Typ de bedrijfsnaam precies over om te bevestigen.");
      return forgetClient(q, id);
    });
    await removeAttachments(paths);
  } catch (err) {
    return fail(err);
  }
  refresh();
  redirect("/klanten?melding=verwijderd");
}

// ---------------------------------------------------------------------------
// Taken
// ---------------------------------------------------------------------------

export async function createTaskAction(fd: FormData) {
  const title = str(fd, "title");
  if (!title) return;
  await asAdmin((q) => createTask(q, { client_id: optStr(fd, "client_id"), title, due_date: optStr(fd, "due_date") }));
  refresh();
}

export async function toggleTaskAction(fd: FormData) {
  await asAdmin((q) => setTaskDone(q, str(fd, "task_id"), str(fd, "done") === "1"));
  refresh();
}

// ---------------------------------------------------------------------------
// Vandaag: snooze
// ---------------------------------------------------------------------------

export async function snoozeAction(fd: FormData) {
  const when = str(fd, "when");
  const until = when === "week" ? addDays(today(), 7) : addDays(today(), 1);
  await asAdmin((q) => snooze(q, str(fd, "key"), until));
  refresh();
}

// ---------------------------------------------------------------------------
// E-mails
// ---------------------------------------------------------------------------

export async function sendEmailAction(fd: FormData) {
  await asAdmin((q) => sendEmail(q, str(fd, "email_id")));
  refresh();
}

export async function saveEmailAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "email_id");
  const send = str(fd, "intent") === "send";
  try {
    await asAdmin(async (q) => {
      const [e] = await q<EmailRow>("select * from emails where id = $1", [id]);
      if (!e) throw new Error("E-mail niet gevonden.");
      if (e.status === "verzonden") throw new Error("Deze e-mail is al verstuurd.");
      await q("update emails set to_email = $2, subject = $3, body = $4, status = case when status = 'gepland' and $5 then 'gepland'::email_status else 'concept'::email_status end where id = $1", [
        id,
        str(fd, "to_email"),
        str(fd, "subject"),
        String(fd.get("body") ?? ""),
        !send,
      ]);
      if (send) await sendEmail(q, id);
    });
  } catch (err) {
    return fail(err);
  }
  refresh();
  if (send) redirect(str(fd, "return_to") || "/vandaag");
  return { ok: true, message: "Opgeslagen" };
}

export async function discardEmailAction(fd: FormData) {
  await asAdmin((q) => q("update emails set status = 'geannuleerd' where id = $1 and status <> 'verzonden'", [str(fd, "email_id")]));
  refresh();
  const back = str(fd, "return_to");
  if (back) redirect(back);
}

/** Nieuw concept voor een klant, leeg of vanuit een sjabloon; opent de editor. */
export async function composeEmailAction(fd: FormData) {
  const clientId = str(fd, "client_id");
  const templateKey = str(fd, "template_key");
  const id = await asAdmin(async (q) => {
    const [c] = await q<ClientRow>("select * from clients where id = $1", [clientId]);
    if (!c) throw new Error("Klant niet gevonden.");
    if (templateKey) {
      const row = await createTemplateEmail(q, { client: c, templateKey, scheduledFor: today(), today: today(), kind: "sjabloon" });
      if (!row) throw new Error("Deze klant heeft geen e-mailadres.");
      return row.id;
    }
    return (await createLooseEmail(q, c, "", `Hoi ${firstName(c.owner_name) || ""},\n\n\n\nGroet,\nGligor`)).id;
  });
  refresh();
  redirect(`/emails/${id}?terug=/klanten/${clientId}`);
}

export async function sendNewsletterAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const subject = str(fd, "subject");
  const body = String(fd.get("body") ?? "").trim();
  if (!subject || !body) return { error: "Onderwerp en tekst zijn verplicht." };
  if (str(fd, "confirm") !== "ja") return { error: "Vink aan dat je de nieuwsbrief echt naar alle klanten wilt sturen." };
  try {
    const n = await asAdmin((q) => sendNewsletter(q, subject, body));
    refresh();
    return { ok: true, message: `Verstuurd naar ${n} ${n === 1 ? "klant" : "klanten"}.` };
  } catch (err) {
    return fail(err);
  }
}

export async function saveTemplateAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await asAdmin((q) =>
      q("update email_templates set name = $2, subject = $3, body = $4, auto_send = $5 where key = $1", [
        str(fd, "key"),
        str(fd, "name"),
        str(fd, "subject"),
        String(fd.get("body") ?? ""),
        fd.get("auto_send") === "on",
      ]),
    );
  } catch (err) {
    return fail(err);
  }
  refresh();
  return { ok: true, message: "Opgeslagen" };
}

export async function toggleAutoSendAction(fd: FormData) {
  await asAdmin((q) => q("update email_templates set auto_send = not auto_send where key = $1", [str(fd, "key")]));
  refresh();
}

// ---------------------------------------------------------------------------
// Betalingen
// ---------------------------------------------------------------------------

export async function markPaidAction(fd: FormData) {
  await asAdmin((q) => markPaid(q, str(fd, "payment_id"), optStr(fd, "paid_at") ?? today()));
  refresh();
}

export async function markUnpaidAction(fd: FormData) {
  await asAdmin((q) => markUnpaid(q, str(fd, "payment_id")));
  refresh();
}

export async function sendReminderAction(fd: FormData) {
  await asAdmin((q) => sendReminder(q, str(fd, "payment_id"), today()));
  refresh();
}

export async function editReminderAction(fd: FormData) {
  const email = await asAdmin((q) => reminderDraft(q, str(fd, "payment_id"), today()));
  if (!email) throw new Error("Geen e-mailadres bekend voor deze klant.");
  redirect(`/emails/${email.id}?terug=${encodeURIComponent(str(fd, "return_to") || "/betalingen")}`);
}

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

export async function replyTicketAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const body = String(fd.get("body") ?? "").trim();
  if (!body) return { error: "Schrijf eerst een antwoord." };
  const status = z.enum(["open", "wacht_op_klant", "opgelost"]).catch("wacht_op_klant").parse(str(fd, "status_after")) as TicketStatus;
  try {
    await asAdmin((q) => replyToTicket(q, str(fd, "ticket_id"), body, status));
  } catch (err) {
    return fail(err);
  }
  refresh();
  return { ok: true, message: "Antwoord verstuurd" };
}

export async function ticketStatusAction(fd: FormData) {
  const status = z.enum(["nieuw", "open", "wacht_op_klant", "opgelost"]).parse(str(fd, "status"));
  await asAdmin((q) => setTicketStatus(q, str(fd, "ticket_id"), status));
  refresh();
}

export async function linkTicketAction(fd: FormData) {
  await asAdmin((q) => linkTicketToClient(q, str(fd, "ticket_id"), str(fd, "client_id")));
  refresh();
}

// ---------------------------------------------------------------------------
// Instellingen
// ---------------------------------------------------------------------------

export async function setThemeAction(fd: FormData) {
  const theme = str(fd, "theme") === "light" ? "light" : "dark";
  (await cookies()).set("theme", theme, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  refresh();
}

export async function runDailyNowAction(_prev: ActionState): Promise<ActionState> {
  try {
    const r = await asAdmin((q) => runDaily(q, new Date()));
    refresh();
    return {
      ok: true,
      message: `Klaar: ${r.paymentsCreated} betalingen aangevuld, ${r.drafted} concepten klaargezet, ${r.sent} automatisch verstuurd${r.failed ? `, ${r.failed} mislukt` : ""}.`,
    };
  } catch (err) {
    return fail(err);
  }
}

export async function signOutAction() {
  if (!isDemo()) {
    const { createSupabaseServer } = await import("@/lib/supabase/server");
    await (await createSupabaseServer()).auth.signOut();
  }
  redirect("/login");
}

import { addDays, diffDays } from "./dates";
import { daysOverdue, paymentDescription, paymentStatus, type PaymentKind } from "./payments";
import { deadlineState, responseDeadline } from "./tickets";
import { ACTIVE_STAGES, NO_CONTACT_DAYS, type Channel, type PackageKey, type Stage } from "../config";
import { formatEuro, relativeDays } from "../format";

export type TodayCategory = 1 | 2 | 3 | 4 | 5 | 6;

export const CATEGORY_LABEL: Record<TodayCategory, string> = {
  1: "Tickets met een deadline",
  2: "Te late betalingen",
  3: "Opvolgen vandaag",
  4: "Concepten om na te kijken",
  5: "Levenscyclus deze week",
  6: "Even bijpraten?",
};

export interface ContactInfo {
  clientId: string;
  company: string;
  ownerName: string;
  email: string | null;
  phone: string | null;
  channel: Channel;
}

export type TodayAction =
  | { type: "open"; href: string; label?: string }
  | { type: "external"; href: string; label: string }
  | { type: "copy"; text: string; label: string }
  | { type: "send-email"; emailId: string }
  | { type: "edit-email"; emailId: string }
  | { type: "complete-task"; taskId: string }
  | { type: "complete-followup"; logEntryId: string }
  | { type: "mark-paid"; paymentId: string }
  | { type: "send-reminder"; paymentId: string }
  | { type: "contact" }
  | { type: "note" };

export interface TodayItem {
  key: string;
  category: TodayCategory;
  title: string;
  detail: string;
  /** Extra regel, bijv. het adres voor een kaartje of de cadeau-ideeën. */
  note?: string;
  /** Hoger = urgenter; sorteert binnen een categorie. */
  urgency: number;
  tone: "danger" | "warning" | "neutral" | "accent";
  badge: string;
  contact: ContactInfo | null;
  actions: TodayAction[];
}

export interface TodayInput {
  today: string;
  now: Date;
  clients: (ContactInfo & { stage: Stage; package: PackageKey; lastContactAt: string | null; createdAt: string })[];
  tickets: { id: string; number: number; subject: string; status: string; awaitingSince: string | null; clientId: string | null }[];
  payments: { id: string; clientId: string; kind: PaymentKind; periodStart: string; dueDate: string; amount: number; paidAt: string | null; cancelled: boolean }[];
  tasks: { id: string; clientId: string | null; title: string; dueDate: string | null; source: string; details?: string; href?: string | null }[];
  followUps: { id: string; clientId: string; summary: string; agreedActions: string; followUpDate: string }[];
  drafts: { id: string; clientId: string | null; subject: string; toEmail: string; templateName: string | null; createdAt: string }[];
  /** item_key → snooze tot (exclusief) deze datum. */
  snoozes: Map<string, string>;
}

/** Knoppen bij een taak: een link (bijv. Greetz of het intakeformulier) en het adres kopiëren. */
function taskExtras(t: TodayInput["tasks"][number]): TodayAction[] {
  const out: TodayAction[] = [];
  if (t.href?.startsWith("/")) out.push({ type: "open", href: t.href, label: "Openen" });
  else if (t.href) out.push({ type: "external", href: t.href, label: new URL(t.href).hostname.replace(/^www\./, "") });
  const address = t.details?.match(/^Adres: (.+)$/)?.[1];
  if (address && !address.startsWith("Nog geen adres")) out.push({ type: "copy", text: address, label: "Adres kopiëren" });
  return out;
}

/** De lijst voor vandaag, gesorteerd: eerst op categorie (1–6), dan op urgentie. */
export function buildToday(input: TodayInput): TodayItem[] {
  const { today, now } = input;
  const byId = new Map(input.clients.map((c) => [c.clientId, c]));
  const items: TodayItem[] = [];
  const snoozed = (key: string) => {
    const until = input.snoozes.get(key);
    return until !== undefined && until > today;
  };
  const push = (item: TodayItem) => {
    if (!snoozed(item.key)) items.push(item);
  };

  // 1. Tickets voorbij of vlak voor hun antwoordtermijn.
  for (const t of input.tickets) {
    if (!t.awaitingSince || t.status === "opgelost" || t.status === "wacht_op_klant") continue;
    const client = t.clientId ? byId.get(t.clientId) : undefined;
    const deadline = responseDeadline(t.awaitingSince, client?.package ?? null);
    const state = deadlineState(deadline, now);
    if (state === "op_tijd") continue;
    const hoursLeft = Math.round((deadline.getTime() - now.getTime()) / 3_600_000);
    push({
      key: `ticket:${t.id}`,
      category: 1,
      title: `T-${t.number} · ${t.subject}`,
      detail: client ? client.company : "Onbekende afzender",
      urgency: -hoursLeft,
      tone: state === "te_laat" ? "danger" : "warning",
      badge: state === "te_laat" ? `${Math.max(1, -hoursLeft)} u te laat` : `nog ${Math.max(0, hoursLeft)} u`,
      contact: client ?? null,
      actions: [{ type: "open", href: `/tickets/${t.id}`, label: "Beantwoorden" }],
    });
  }

  // 2. Te late betalingen.
  for (const p of input.payments) {
    const pl = { due_date: p.dueDate, paid_at: p.paidAt, cancelled: p.cancelled };
    if (paymentStatus(pl, today) !== "te_laat") continue;
    const client = byId.get(p.clientId);
    const late = daysOverdue(pl, today);
    push({
      key: `payment:${p.id}`,
      category: 2,
      title: `${formatEuro(p.amount)} · ${paymentDescription({ kind: p.kind, period_start: p.periodStart })}`,
      detail: client?.company ?? "",
      urgency: late,
      tone: "danger",
      badge: `${late} ${late === 1 ? "dag" : "dagen"} te laat`,
      contact: client ?? null,
      actions: [
        { type: "send-reminder", paymentId: p.id },
        { type: "mark-paid", paymentId: p.id },
        { type: "contact" },
      ],
    });
  }

  // 3. Opvolgen: taken en afspraken uit het logboek die vandaag (of eerder) moesten.
  for (const t of input.tasks) {
    if (!t.dueDate || t.dueDate > today) continue;
    const client = t.clientId ? byId.get(t.clientId) : undefined;
    const late = diffDays(t.dueDate, today);
    push({
      key: `task:${t.id}`,
      category: 3,
      title: t.title,
      detail: client?.company ?? "Algemeen",
      note: t.details || undefined,
      urgency: late,
      tone: late > 0 ? "warning" : "accent",
      badge: late > 0 ? relativeDays(-late) : "vandaag",
      contact: client ?? null,
      actions: [...taskExtras(t), { type: "complete-task", taskId: t.id }, ...(client ? [{ type: "contact" } as const] : [])],
    });
  }
  for (const f of input.followUps) {
    if (f.followUpDate > today) continue;
    const client = byId.get(f.clientId);
    const late = diffDays(f.followUpDate, today);
    push({
      key: `followup:${f.id}`,
      category: 3,
      title: f.agreedActions.split("\n")[0]?.trim() || `Opvolgen: ${f.summary}`,
      detail: `${client?.company ?? ""} · uit logboek`,
      urgency: late,
      tone: late > 0 ? "warning" : "accent",
      badge: late > 0 ? relativeDays(-late) : "vandaag",
      contact: client ?? null,
      actions: [{ type: "complete-followup", logEntryId: f.id }, { type: "contact" }],
    });
  }

  // 4. Concepten die op een klik wachten.
  for (const d of input.drafts) {
    const client = d.clientId ? byId.get(d.clientId) : undefined;
    push({
      key: `email:${d.id}`,
      category: 4,
      title: d.subject,
      detail: `${client?.company ?? d.toEmail}${d.templateName ? ` · ${d.templateName}` : ""}`,
      urgency: diffDays(d.createdAt.slice(0, 10), today),
      tone: "neutral",
      badge: "concept",
      contact: client ?? null,
      actions: [{ type: "send-email", emailId: d.id }, { type: "edit-email", emailId: d.id }],
    });
  }

  // 5. Levenscyclusmomenten in de komende 7 dagen.
  const weekEnd = addDays(today, 7);
  for (const t of input.tasks) {
    if (!["levenscyclus", "mijlpaal"].includes(t.source) || !t.dueDate || t.dueDate <= today || t.dueDate > weekEnd) continue;
    const client = t.clientId ? byId.get(t.clientId) : undefined;
    const days = diffDays(today, t.dueDate);
    push({
      key: `upcoming:${t.id}`,
      category: 5,
      title: t.title,
      detail: client?.company ?? "",
      urgency: -days,
      tone: "neutral",
      badge: relativeDays(days),
      contact: client ?? null,
      actions: client ? [{ type: "open", href: `/klanten/${client.clientId}`, label: "Klant" }] : [],
    });
  }

  // 6. Actieve klanten zonder contact in de laatste 30 dagen.
  for (const c of input.clients) {
    if (!ACTIVE_STAGES.includes(c.stage)) continue;
    const last = (c.lastContactAt ?? c.createdAt).slice(0, 10);
    const days = diffDays(last, today);
    if (days < NO_CONTACT_DAYS) continue;
    push({
      key: `contact:${c.clientId}`,
      category: 6,
      title: c.company,
      detail: c.lastContactAt ? `Laatste contact ${days} dagen geleden` : "Nog geen contact vastgelegd",
      urgency: days,
      tone: "neutral",
      badge: `${days} d`,
      contact: c,
      actions: [{ type: "contact" }, { type: "note" }],
    });
  }

  return items.sort((a, b) => a.category - b.category || b.urgency - a.urgency);
}

export interface TodaySummary {
  activeClients: number;
  mrr: number;
  openTickets: number;
  overduePayments: number;
  overdueAmount: number;
}

export function summarize(input: Pick<TodayInput, "today" | "tickets" | "payments"> & {
  clients: { stage: Stage; monthlyFee: number }[];
}): TodaySummary {
  const active = input.clients.filter((c) => ACTIVE_STAGES.includes(c.stage));
  const overdue = input.payments.filter(
    (p) => paymentStatus({ due_date: p.dueDate, paid_at: p.paidAt, cancelled: p.cancelled }, input.today) === "te_laat",
  );
  return {
    activeClients: active.length,
    mrr: active.reduce((s, c) => s + c.monthlyFee, 0),
    openTickets: input.tickets.filter((t) => t.status !== "opgelost").length,
    overduePayments: overdue.length,
    overdueAmount: overdue.reduce((s, p) => s + p.amount, 0),
  };
}

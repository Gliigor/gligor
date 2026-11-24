/** Mijlpalen, verjaardagen, referrals, tegoeden en het cadeaulogboek. */
import type { Query } from "../db/driver";
import type { ClientRow, GiftRow, PaymentRow } from "../types";
import { ACTIVE_STAGES, GIFT_TYPE_LABEL, TEMPLATE_KEYS, type GiftType } from "../config";
import {
  clientFirstName,
  parseMilestoneSettings,
  planMilestones,
  REFERRAL_CREDIT_REASON,
  referralKeys,
  referralStatus,
  type MilestoneSettings,
  type ReferralStatus,
} from "../domain/milestones";
import { formatEuro } from "../format";
import { createTemplateEmail } from "./emails";

export async function getMilestoneSettings(q: Query): Promise<MilestoneSettings> {
  const [row] = await q<{ value: unknown }>("select value from settings where key = 'mijlpalen'");
  return parseMilestoneSettings(row?.value);
}

export async function saveMilestoneSettings(q: Query, input: Partial<MilestoneSettings>): Promise<MilestoneSettings> {
  const merged = parseMilestoneSettings({ ...(await getMilestoneSettings(q)), ...input });
  await q(
    `insert into settings (key, value) values ('mijlpalen', $1::jsonb)
     on conflict (key) do update set value = excluded.value`,
    [JSON.stringify(merged)],
  );
  return merged;
}

/** Betaalde maandbedragen, zonder het startbedrag en zonder gratis maanden. */
export async function paidMonths(q: Query, clientId: string): Promise<number> {
  const [r] = await q<{ n: number }>(
    "select count(*)::int as n from payments where client_id = $1 and kind = 'maand' and paid_at is not null and credit_reason is null",
    [clientId],
  );
  return r?.n ?? 0;
}

/** Adresregel voor een kaartje: het kaartadres, anders het bedrijfsadres. */
export function cardAddress(c: Pick<ClientRow, "owner_name" | "company" | "card_address" | "address">): string {
  const addr = (c.card_address || c.address).trim();
  return addr ? `${c.owner_name || c.company}, ${addr.replace(/\n+/g, ", ")}` : "Nog geen adres bekend: vraag het even na.";
}

/** Zet de taken en concepten voor de mijlpalen van één klant klaar (idempotent). */
export async function runMilestones(q: Query, client: ClientRow, today: string, settings?: MilestoneSettings): Promise<number> {
  const s = settings ?? (await getMilestoneSettings(q));
  const plan = planMilestones(client, { today, paidMonths: await paidMonths(q, client.id), settings: s });
  let created = 0;
  for (const t of plan.tasks) {
    const details =
      t.kind === "verjaardag-kaart"
        ? `Adres: ${cardAddress(client)}`
        : t.kind === "cadeau"
          ? client.gift_ideas.trim()
            ? `Cadeau-ideeën: ${client.gift_ideas.trim()}`
            : "Nog geen cadeau-ideeën genoteerd bij de klant."
          : "";
    const href = t.kind === "verjaardag-kaart" ? "https://www.greetz.nl" : null;
    const rows = await q(
      `insert into tasks (client_id, title, due_date, source, automation_key, details, href)
       values ($1, $2, $3, 'mijlpaal', $4, $5, $6) on conflict (automation_key) do nothing returning id`,
      [client.id, t.title, t.due, t.key, details, href],
    );
    created += rows.length;
  }
  for (const e of plan.emails) {
    const row = await createTemplateEmail(q, {
      client,
      templateKey: e.template,
      scheduledFor: e.scheduledFor,
      today,
      automationKey: e.key,
      kind: "mijlpaal",
      extraVars: e.vars,
    });
    if (row) created++;
  }
  return created;
}

// ---------------------------------------------------------------------------
// Referrals en tegoeden
// ---------------------------------------------------------------------------

/** Legt een tegoed vast (één keer per sleutel) en verrekent het meteen als dat kan. */
export async function addCredit(q: Query, clientId: string, reason: string, key: string, today: string): Promise<void> {
  await q(
    "insert into payment_credits (client_id, reason, automation_key) values ($1, $2, $3) on conflict (automation_key) do nothing",
    [clientId, reason, key],
  );
  await applyCredits(q, clientId, today);
}

/**
 * Openstaande tegoeden verrekenen met de eerstvolgende onbetaalde maandbetaling:
 * die wordt €0 en krijgt de reden ("Gratis maand — referral") als omschrijving.
 */
export async function applyCredits(q: Query, clientId: string, today: string): Promise<number> {
  const credits = await q<{ id: string; reason: string }>(
    "select id, reason from payment_credits where client_id = $1 and applied_payment_id is null order by created_at",
    [clientId],
  );
  let applied = 0;
  for (const c of credits) {
    const [p] = await q<PaymentRow>(
      `select * from payments where client_id = $1 and kind = 'maand' and paid_at is null and not cancelled
         and credit_reason is null order by period_start limit 1`,
      [clientId],
    );
    if (!p) break;
    await q(
      "update payments set amount = 0, credit_reason = $2, paid_at = $3, source = 'tegoed' where id = $1",
      [p.id, c.reason, today < p.period_start ? p.period_start : today],
    );
    await q("update payment_credits set applied_payment_id = $2, applied_at = $3 where id = $1", [c.id, p.id, today]);
    applied++;
  }
  return applied;
}

/**
 * Controleert of een aangebrachte klant nu "geslaagd" is. Zo ja: gratis maand voor
 * beide, een concept-bedankmail aan de aanbrenger, en bij 5 geslaagde referrals
 * een taak om persoonlijk te bedanken.
 */
export async function checkReferral(q: Query, client: ClientRow, today: string, settings?: MilestoneSettings): Promise<boolean> {
  if (!client.referred_by || client.referral_succeeded_at) return false;
  const s = settings ?? (await getMilestoneSettings(q));
  if (referralStatus(client, await paidMonths(q, client.id), s) !== "geslaagd") return false;

  const [referrer] = await q<ClientRow>("select * from clients where id = $1", [client.referred_by]);
  if (!referrer) return false;
  await q("update clients set referral_succeeded_at = $2 where id = $1", [client.id, today]);
  const keys = referralKeys(client.id, referrer.id);
  await addCredit(q, client.id, REFERRAL_CREDIT_REASON, keys.creditNew, today);
  if (referrer.stage !== "opgezegd") await addCredit(q, referrer.id, REFERRAL_CREDIT_REASON, keys.creditReferrer, today);
  await createTemplateEmail(q, {
    client: referrer,
    templateKey: TEMPLATE_KEYS.referralBedankt,
    scheduledFor: today,
    today,
    automationKey: keys.email,
    kind: "mijlpaal",
    extraVars: { aangebracht_bedrijf: client.company },
  });
  await q(
    "insert into log_entries (client_id, type, summary, source) values ($1, 'notitie', $2, 'systeem')",
    [referrer.id, `Referral geslaagd: ${client.company}. Beide krijgen een gratis maand.`],
  );

  const [{ n }] = await q<{ n: number }>(
    "select count(*)::int as n from clients where referred_by = $1 and referral_succeeded_at is not null",
    [referrer.id],
  );
  if (s.referralDinnerAt > 0 && n >= s.referralDinnerAt) {
    await q(
      `insert into tasks (client_id, title, due_date, source, automation_key, details)
       values ($1, $2, $3, 'mijlpaal', $4, $5) on conflict (automation_key) do nothing`,
      [
        referrer.id,
        "Persoonlijk bedanken: diner of groter cadeau",
        today,
        keys.dinner,
        `${clientFirstName(referrer) || referrer.company} heeft al ${n} klanten aangebracht.`,
      ],
    );
  }
  return true;
}

export interface ReferralSummary {
  referrals: { id: string; company: string; stage: ClientRow["stage"]; status: ReferralStatus; value: number }[];
  pending: number;
  succeeded: number;
  /** Wat de aangebrachte klanten tot nu toe betaald hebben. */
  value: number;
}

export async function referralSummary(q: Query, referrerId: string): Promise<ReferralSummary> {
  const s = await getMilestoneSettings(q);
  const rows = await q<ClientRow & { paid_months: number; paid_total: number }>(
    `select c.*,
       (select count(*)::int from payments p where p.client_id = c.id and p.kind = 'maand' and p.paid_at is not null and p.credit_reason is null) as paid_months,
       (select coalesce(sum(p.amount), 0) from payments p where p.client_id = c.id and p.paid_at is not null) as paid_total
     from clients c where c.referred_by = $1 order by c.created_at`,
    [referrerId],
  );
  const referrals = rows.map((r) => ({
    id: r.id,
    company: r.company,
    stage: r.stage,
    status: referralStatus(r, r.paid_months, s),
    value: Number(r.paid_total),
  }));
  return {
    referrals,
    pending: referrals.filter((r) => r.status === "lopend").length,
    succeeded: referrals.filter((r) => r.status === "geslaagd").length,
    value: referrals.reduce((sum, r) => sum + r.value, 0),
  };
}

/** Voor de tegel "Top ambassadeurs". */
export async function topAmbassadors(q: Query, limit = 5): Promise<{ id: string; company: string; succeeded: number; pending: number }[]> {
  return q(
    `select r.id, r.company,
       count(*) filter (where c.referral_succeeded_at is not null)::int as succeeded,
       count(*) filter (where c.referral_succeeded_at is null and c.stage <> 'opgezegd')::int as pending
     from clients c join clients r on r.id = c.referred_by
     group by r.id, r.company
     order by succeeded desc, pending desc, r.company
     limit $1`,
    [limit],
  );
}

// ---------------------------------------------------------------------------
// Cadeaus, kaarten en diners
// ---------------------------------------------------------------------------

export async function logGift(
  q: Query,
  input: { client_id: string; given_on: string; type: GiftType; description: string; amount: number },
): Promise<GiftRow> {
  const [client] = await q<ClientRow>("select * from clients where id = $1", [input.client_id]);
  if (!client) throw new Error("Klant niet gevonden.");
  const summary = `${GIFT_TYPE_LABEL[input.type]} gegeven${input.description ? `: ${input.description}` : ""} (${formatEuro(input.amount)})`;
  const [entry] = await q<{ id: string }>(
    "insert into log_entries (client_id, type, summary, occurred_at) values ($1, 'notitie', $2, ($3 || 'T12:00:00Z')::timestamptz) returning id",
    [client.id, summary, input.given_on],
  );
  const [gift] = await q<GiftRow>(
    `insert into gifts (client_id, client_label, given_on, type, description, amount, log_entry_id)
     values ($1, $2, $3, $4, $5, $6, $7) returning *`,
    [client.id, client.company, input.given_on, input.type, input.description.trim(), input.amount, entry.id],
  );
  return gift;
}

export async function listGifts(q: Query, year?: number): Promise<GiftRow[]> {
  if (year) {
    return q<GiftRow>(
      "select * from gifts where given_on >= $1 and given_on < $2 order by given_on desc, created_at desc",
      [`${year}-01-01`, `${year + 1}-01-01`],
    );
  }
  return q<GiftRow>("select * from gifts order by given_on desc, created_at desc");
}

/** CSV voor de boekhouder (puntkomma's en komma als decimaalteken, zoals Excel in NL verwacht). */
export function giftsCsv(gifts: GiftRow[]): string {
  const cell = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = ["Datum;Klant;Soort;Omschrijving;Bedrag"];
  for (const g of [...gifts].sort((a, b) => a.given_on.localeCompare(b.given_on))) {
    lines.push(
      [g.given_on, cell(g.client_label), GIFT_TYPE_LABEL[g.type], cell(g.description), Number(g.amount).toFixed(2).replace(".", ",")].join(";"),
    );
  }
  return lines.join("\r\n") + "\r\n";
}

/** Alles voor de dagelijkse job: mijlpalen, referrals en tegoeden. */
export async function runLoyalty(q: Query, today: string): Promise<{ milestones: number; referrals: number }> {
  const s = await getMilestoneSettings(q);
  const clients = await q<ClientRow>("select * from clients where stage <> 'lead'");
  let milestones = 0;
  let referrals = 0;
  for (const c of clients) {
    if (ACTIVE_STAGES.includes(c.stage)) milestones += await runMilestones(q, c, today, s);
    if (await checkReferral(q, c, today, s)) referrals++;
    await applyCredits(q, c.id, today);
  }
  return { milestones, referrals };
}

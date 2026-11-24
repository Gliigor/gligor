/**
 * Mijlpalen, verjaardagen en referrals. Alles hier maakt alleen taken en
 * e-mailconcepten aan (ter controle), nooit automatische cadeaus of verzending.
 */
import { addDays, addMonths, diffDays } from "./dates";
import { ACTIVE_STAGES, TEMPLATE_KEYS, type Stage } from "../config";

export interface MilestoneSettings {
  /** Bedankmail zodra zoveel maandbetalingen betaald zijn (startbedrag telt niet mee). */
  thanksAfterPayments: number;
  /** Zoveel weken vóór het eerste jubileum: taak "Cadeau regelen". */
  giftWeeksBefore: number;
  /** Zoveel dagen vóór een jubileum: herinnering + concept-bedankmail. */
  anniversaryReminderDays: number;
  /** Zoveel dagen vóór een verjaardag: taak "Kaart sturen". */
  birthdayCardDaysBefore: number;
  /** Een aangebrachte klant is "geslaagd" na zoveel betaalde maanden. */
  referralMonths: number;
  /** Bij zoveel geslaagde referrals: persoonlijk bedanken. */
  referralDinnerAt: number;
}

export const DEFAULT_MILESTONES: MilestoneSettings = {
  thanksAfterPayments: 3,
  giftWeeksBefore: 4,
  anniversaryReminderDays: 7,
  birthdayCardDaysBefore: 7,
  referralMonths: 2,
  referralDinnerAt: 5,
};

/** Instellingen uit de database, met standaardwaarden voor ontbrekende of foute velden. */
export function parseMilestoneSettings(raw: unknown): MilestoneSettings {
  const out = { ...DEFAULT_MILESTONES };
  if (raw && typeof raw === "object") {
    for (const key of Object.keys(out) as (keyof MilestoneSettings)[]) {
      const v = Number((raw as Record<string, unknown>)[key]);
      if (Number.isFinite(v) && v >= 0 && v <= 400) out[key] = Math.round(v);
    }
  }
  return out;
}

export interface MilestoneClient {
  id: string;
  stage: Stage;
  start_date: string | null;
  first_name: string;
  owner_name: string;
  birthday_day: number | null;
  birthday_month: number | null;
  birthday_consent: boolean;
}

export interface MilestoneTask {
  key: string;
  title: string;
  due: string;
  /** "verjaardag-kaart" en "cadeau" krijgen in de service het adres of de cadeau-ideeën als toelichting. */
  kind: "cadeau" | "jubileum" | "verjaardag-kaart" | "referrals";
}

export interface MilestoneEmail {
  key: string;
  template: string;
  scheduledFor: string;
  vars?: Record<string, string>;
}

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Datum van de verjaardag in een bepaald jaar; 29 februari valt in gewone jaren op 28 februari. */
export function birthdayInYear(day: number, month: number, year: number): string {
  const d = month === 2 && day === 29 && !isLeap(year) ? 28 : day;
  return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Eerstvolgende verjaardag op of na `today`. */
export function nextBirthday(day: number, month: number, today: string): string {
  const year = Number(today.slice(0, 4));
  const thisYear = birthdayInYear(day, month, year);
  return thisYear >= today ? thisYear : birthdayInYear(day, month, year + 1);
}

/** Eerstvolgend jubileum (1, 2, … jaar klant) op of na `today`. */
export function nextAnniversary(startDate: string, today: string): { years: number; date: string } {
  let years = 1;
  while (addMonths(startDate, 12 * years) < today) years++;
  return { years, date: addMonths(startDate, 12 * years) };
}

/** Hele maanden sinds de start (voor {{maanden_klant}}). */
export function monthsAsClient(startDate: string | null, today: string): number {
  if (!startDate || startDate > today) return 0;
  let m = 0;
  while (addMonths(startDate, m + 1) <= today) m++;
  return m;
}

export function clientFirstName(c: { first_name: string; owner_name: string }): string {
  return c.first_name.trim() || c.owner_name.trim().split(/\s+/)[0] || "";
}

/** Hoe ver vooruit taken en concepten al worden klaargezet (en zichtbaar zijn bij de klant). */
const HORIZON_DAYS = 42;

/**
 * Wat er voor deze klant klaargezet moet worden. Elke taak en e-mail heeft een
 * vaste sleutel (met het jaar erin), zodat de dagelijkse job niets dubbel maakt.
 */
export function planMilestones(
  client: MilestoneClient,
  ctx: { today: string; paidMonths: number; settings: MilestoneSettings },
): { tasks: MilestoneTask[]; emails: MilestoneEmail[] } {
  const { today, settings: s } = ctx;
  const tasks: MilestoneTask[] = [];
  const emails: MilestoneEmail[] = [];
  if (!ACTIVE_STAGES.includes(client.stage)) return { tasks, emails };
  const name = clientFirstName(client) || "de klant";
  const horizon = addDays(today, HORIZON_DAYS);
  const notBefore = (d: string) => (d < today ? today : d);
  const k = (part: string) => `${client.id}:mijlpaal:${part}`;

  // Bedankmail op het moment dat de n-de maandbetaling binnen is. Een klant die al
  // ver voorbij dat punt is (bijv. later ingevoerd), krijgt hem niet alsnog.
  if (s.thanksAfterPayments > 0 && ctx.paidMonths >= s.thanksAfterPayments && ctx.paidMonths <= s.thanksAfterPayments + 1) {
    emails.push({ key: k("bedankt"), template: TEMPLATE_KEYS.bedankt3, scheduledFor: today });
  }

  if (client.start_date && client.start_date <= today) {
    const { years, date } = nextAnniversary(client.start_date, today);
    const reminder = addDays(date, -s.anniversaryReminderDays);
    if (years === 1) {
      const gift = addDays(date, -7 * s.giftWeeksBefore);
      if (gift <= horizon) tasks.push({ key: k("jaar1:cadeau"), title: `Cadeau regelen voor ${name} (1 jaar klant)`, due: notBefore(gift), kind: "cadeau" });
      if (reminder <= horizon) {
        tasks.push({ key: k("jaar1:geven"), title: `Kaart en cadeau voor ${name}: 1 jaar klant`, due: notBefore(reminder), kind: "jubileum" });
        emails.push({ key: k("jaar1:mail"), template: TEMPLATE_KEYS.jubileum, scheduledFor: notBefore(reminder) });
      }
    } else if (reminder <= horizon) {
      tasks.push({ key: k(`jaar${years}:kaart`), title: `Kaart sturen naar ${name}: ${years} jaar klant`, due: notBefore(reminder), kind: "jubileum" });
      emails.push({
        key: k(`jaar${years}:mail`),
        template: TEMPLATE_KEYS.jubileumJaarlijks,
        scheduledFor: notBefore(reminder),
        vars: { jaren: String(years) },
      });
    }
  }

  // Verjaardag: alleen met toestemming.
  if (client.birthday_consent && client.birthday_day && client.birthday_month) {
    const bday = nextBirthday(client.birthday_day, client.birthday_month, today);
    const year = bday.slice(0, 4);
    const card = addDays(bday, -s.birthdayCardDaysBefore);
    if (card <= horizon) {
      tasks.push({ key: k(`verjaardag:${year}:kaart`), title: `Kaart sturen naar ${name} (jarig ${dayMonth(bday)})`, due: notBefore(card), kind: "verjaardag-kaart" });
    }
    if (bday <= horizon) emails.push({ key: k(`verjaardag:${year}:mail`), template: TEMPLATE_KEYS.verjaardag, scheduledFor: bday });
  }

  return { tasks, emails };
}

const DM = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", timeZone: "UTC" });
export function dayMonth(date: string): string {
  return DM.format(new Date(`${date}T00:00:00Z`));
}

/** Komende mijlpalen voor de klantpagina (berekend, niets opgeslagen). */
export function upcomingMilestones(
  client: MilestoneClient,
  ctx: { today: string; paidMonths: number; settings: MilestoneSettings },
): { date: string | null; label: string; inDays: number | null }[] {
  const { today, settings: s } = ctx;
  const out: { date: string | null; label: string }[] = [];
  if (client.start_date && ACTIVE_STAGES.includes(client.stage)) {
    if (ctx.paidMonths < s.thanksAfterPayments) {
      const left = s.thanksAfterPayments - ctx.paidMonths;
      // Verwacht moment; ligt dat al achter ons (een betaling is laat), dan "bij de volgende betaling".
      const expected = addMonths(client.start_date, s.thanksAfterPayments - 1);
      out.push({
        date: expected >= today ? expected : null,
        label: `Bedankmail na ${s.thanksAfterPayments} betalingen (nog ${left} te gaan)`,
      });
    }
    const start = client.start_date > today ? client.start_date : today;
    const a = nextAnniversary(client.start_date, start);
    out.push({ date: a.date, label: a.years === 1 ? "1 jaar klant: kaart, cadeau en bedankmail" : `${a.years} jaar klant: kaart en bedankmail` });
  }
  if (client.birthday_consent && client.birthday_day && client.birthday_month) {
    out.push({ date: nextBirthday(client.birthday_day, client.birthday_month, today), label: "Verjaardag: kaart en felicitatie" });
  }
  return out
    .map((m) => ({ ...m, inDays: m.date ? diffDays(today, m.date) : null }))
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
}

// ---------------------------------------------------------------------------
// Referrals (één niveau)
// ---------------------------------------------------------------------------

export type ReferralStatus = "lopend" | "geslaagd" | "vervallen";

/** Geslaagd: de aangebrachte klant heeft `referralMonths` maanden betaald en is niet opgezegd. */
export function referralStatus(
  referred: { stage: Stage; referral_succeeded_at: string | null },
  paidMonths: number,
  settings: MilestoneSettings,
): ReferralStatus {
  if (referred.referral_succeeded_at) return "geslaagd";
  if (referred.stage === "opgezegd") return "vervallen";
  return paidMonths >= settings.referralMonths ? "geslaagd" : "lopend";
}

export const REFERRAL_CREDIT_REASON = "Gratis maand — referral";

/** Datum-onafhankelijke sleutels zodat een referral maar één keer beloond wordt. */
export function referralKeys(referredId: string, referrerId: string) {
  return {
    creditNew: `referral:${referredId}:nieuwe-klant`,
    creditReferrer: `referral:${referredId}:aanbrenger`,
    email: `referral:${referredId}:bedankmail`,
    dinner: `${referrerId}:mijlpaal:referrals-diner`,
  };
}

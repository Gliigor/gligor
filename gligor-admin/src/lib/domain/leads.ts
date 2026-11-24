/** Websiteleads, Cal.com-boekingen en intakelinks: alles wat zonder database te testen is. */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export function fullName(first: string, last: string): string {
  return [first.trim(), last.trim()].filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Contactformulier op gligor.ai
// ---------------------------------------------------------------------------

/** Naam van het verborgen veld: mensen zien het niet, spambots vullen het in. */
export const HONEYPOT_FIELD = "website";

const leadSchema = z.object({
  naam: z.string().trim().min(1, "Vul je naam in.").max(120),
  email: z.email({ message: "Vul een geldig e-mailadres in." }).max(200),
  bedrijf: z.string().trim().max(160).optional().default(""),
  bericht: z.string().trim().min(1, "Waar kan ik je mee helpen?").max(4000),
});

export type LeadForm = z.infer<typeof leadSchema>;

export type LeadParse = { kind: "ok"; data: LeadForm } | { kind: "spam" } | { kind: "invalid"; error: string };

export function parseLeadForm(raw: Record<string, unknown>): LeadParse {
  const trap = raw[HONEYPOT_FIELD];
  if (typeof trap === "string" && trap.trim() !== "") return { kind: "spam" };
  const parsed = leadSchema.safeParse({
    naam: raw.naam,
    email: typeof raw.email === "string" ? raw.email.trim().toLowerCase() : raw.email,
    bedrijf: raw.bedrijf ?? "",
    bericht: raw.bericht,
  });
  if (!parsed.success) return { kind: "invalid", error: parsed.error.issues[0]?.message ?? "Controleer het formulier." };
  return { kind: "ok", data: parsed.data };
}

/** Bedrijfsnaam voor een lead zonder ingevulde bedrijfsnaam. */
export function leadCompany(form: { naam: string; bedrijf?: string; email: string }): string {
  if (form.bedrijf?.trim()) return form.bedrijf.trim();
  const domain = form.email.split("@")[1] ?? "";
  const free = /^(gmail|hotmail|outlook|live|icloud|yahoo|ziggo|kpnmail|kpnplanet|xs4all|planet|home|casema|msn|me)\./i;
  if (domain && !free.test(domain)) {
    const name = domain.split(".")[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return form.naam.trim();
}

/** Alleen een hash van het IP-adres bewaren (met een geheim), nooit het adres zelf. */
export function hashIp(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(ip).digest("hex").slice(0, 32);
}

// ---------------------------------------------------------------------------
// Cal.com webhook
// ---------------------------------------------------------------------------

/** Cal.com ondertekent de body met HMAC-SHA256 (hex) in de header X-Cal-Signature-256. */
export function verifyCalSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.trim().replace(/^sha256=/, ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface CalBooking {
  event: "created" | "rescheduled" | "cancelled";
  uid: string;
  /** Uid van de oorspronkelijke boeking bij een verplaatsing. */
  previousUid: string | null;
  startTime: string;
  title: string;
  name: string;
  email: string;
  phone: string | null;
  notes: string;
}

const calSchema = z.object({
  triggerEvent: z.string(),
  payload: z.object({
    uid: z.string().min(1),
    title: z.string().optional().default("Kennismaking"),
    startTime: z.string().min(1),
    rescheduleUid: z.string().nullish(),
    fromReschedule: z.string().nullish(),
    attendees: z.array(z.object({ name: z.string().optional().default(""), email: z.string(), phoneNumber: z.string().nullish() })).min(1),
    responses: z.record(z.string(), z.unknown()).optional(),
    additionalNotes: z.string().nullish(),
    description: z.string().nullish(),
  }),
});

const CAL_EVENTS: Record<string, CalBooking["event"]> = {
  BOOKING_CREATED: "created",
  BOOKING_RESCHEDULED: "rescheduled",
  BOOKING_CANCELLED: "cancelled",
};

/** Haalt de boeking uit een Cal.com-webhook; null voor events die we niet gebruiken. */
export function parseCalEvent(json: unknown): CalBooking | null {
  const parsed = calSchema.safeParse(json);
  if (!parsed.success) return null;
  const event = CAL_EVENTS[parsed.data.triggerEvent];
  if (!event) return null;
  const p = parsed.data.payload;
  const attendee = p.attendees[0];
  const responseValue = (key: string) => {
    const v = p.responses?.[key];
    if (typeof v === "string") return v;
    if (v && typeof v === "object" && "value" in v && typeof (v as { value: unknown }).value === "string") return (v as { value: string }).value;
    return "";
  };
  return {
    event,
    uid: p.uid,
    previousUid: p.rescheduleUid ?? p.fromReschedule ?? null,
    startTime: new Date(p.startTime).toISOString(),
    title: p.title,
    name: attendee.name.trim() || responseValue("name"),
    email: attendee.email.trim().toLowerCase(),
    phone: attendee.phoneNumber ?? (responseValue("attendeePhoneNumber") || null),
    notes: (p.additionalNotes ?? responseValue("notes") ?? p.description ?? "").trim(),
  };
}

// ---------------------------------------------------------------------------
// Intakelinks
// ---------------------------------------------------------------------------

export function newIntakeToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type IntakeLinkState = "geldig" | "verlopen" | "gebruikt";

export function intakeLinkState(link: { expires_at: string; submitted_at: string | null }, now: Date): IntakeLinkState {
  if (link.submitted_at) return "gebruikt";
  return new Date(link.expires_at).getTime() <= now.getTime() ? "verlopen" : "geldig";
}

/** Velden van het intakeformulier (gedeeld door het dashboard en de publieke link). */
export const intakeSchema = z.object({
  first_name: z.string().trim().min(1, "Vul de voornaam in.").max(80),
  last_name: z.string().trim().max(120).optional().default(""),
  company: z.string().trim().min(1, "Vul de bedrijfsnaam in.").max(160),
  email: z.union([z.literal(""), z.email({ message: "Dit e-mailadres klopt niet." })]).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  address: z.string().trim().max(300).optional().default(""),
  sector: z.string().trim().max(80).optional().default(""),
  package: z.enum(["basis", "plus"]).catch("basis"),
  users_count: z.coerce.number().int().min(0).max(500).catch(1),
  setup_type: z.enum(["", "microsoft365", "claude"]).catch(""),
  birthday_day: z.coerce.number().int().min(0).max(31).catch(0),
  birthday_month: z.coerce.number().int().min(0).max(12).catch(0),
  birthday_consent: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  pain_points: z.string().trim().max(4000).optional().default(""),
});

export type IntakeData = z.infer<typeof intakeSchema>;

/** Verjaardag alleen bewaren als die compleet is en er toestemming is. */
export function intakeBirthday(d: Pick<IntakeData, "birthday_day" | "birthday_month" | "birthday_consent">): {
  day: number | null;
  month: number | null;
  consent: boolean;
} {
  const valid = d.birthday_day >= 1 && d.birthday_month >= 1 && d.birthday_consent;
  if (!valid) return { day: null, month: null, consent: false };
  const max = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][d.birthday_month - 1];
  if (d.birthday_day > max) return { day: null, month: null, consent: false };
  return { day: d.birthday_day, month: d.birthday_month, consent: true };
}

/**
 * Datums rekenen we als 'YYYY-MM-DD'-strings in de tijdzone Europe/Amsterdam.
 * Tijdstippen zijn ISO-strings of Date-objecten (UTC).
 */

export const TZ = "Europe/Amsterdam";

const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const parts = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** De datum in Amsterdam op dit moment (of op het gegeven tijdstip). */
export function amsDate(at: Date | string = new Date()): string {
  return ymd.format(typeof at === "string" ? new Date(at) : at);
}

/** Het uur (0–23) in Amsterdam. */
export function amsHour(at: Date = new Date()): number {
  const p = parts.formatToParts(at);
  return Number(p.find((x) => x.type === "hour")?.value);
}

function toUtcDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtcDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = toUtcDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtcDate(d);
}

/** Aantal dagen van a naar b (b − a). */
export function diffDays(a: string, b: string): number {
  return Math.round((toUtcDate(b).getTime() - toUtcDate(a).getTime()) / 86_400_000);
}

/**
 * Zelfde dag van de maand, n maanden later. Bestaat die dag niet (31 → februari),
 * dan de laatste dag van die maand.
 */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return fromUtcDate(target);
}

/** 0 = zondag … 6 = zaterdag */
export function weekday(date: string): number {
  return toUtcDate(date).getUTCDay();
}

/** Paaszondag (anonieme Gregoriaanse berekening). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const holidayCache = new Map<number, Set<string>>();

/** Nederlandse feestdagen waarop niet gewerkt wordt. */
export function dutchHolidays(year: number): Set<string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const easter = easterSunday(year);
  const kingsDay = weekday(`${year}-04-27`) === 0 ? `${year}-04-26` : `${year}-04-27`;
  const days = new Set([
    `${year}-01-01`, // Nieuwjaarsdag
    addDays(easter, 1), // Tweede paasdag
    kingsDay, // Koningsdag
    addDays(easter, 39), // Hemelvaartsdag
    addDays(easter, 50), // Tweede pinksterdag
    `${year}-12-25`,
    `${year}-12-26`,
  ]);
  if (year % 5 === 0) days.add(`${year}-05-05`); // Bevrijdingsdag (lustrumjaren)
  holidayCache.set(year, days);
  return days;
}

export function isWorkingDay(date: string): boolean {
  const wd = weekday(date);
  if (wd === 0 || wd === 6) return false;
  return !dutchHolidays(Number(date.slice(0, 4))).has(date);
}

/** De n-de werkdag ná de gegeven datum (de datum zelf telt niet mee). */
export function addWorkingDays(date: string, n: number): string {
  let d = date;
  let left = n;
  while (left > 0) {
    d = addDays(d, 1);
    if (isWorkingDay(d)) left--;
  }
  return d;
}

/** Offset van Amsterdam t.o.v. UTC (in ms) op dat moment. */
function amsOffsetMs(at: Date): number {
  const p = Object.fromEntries(parts.formatToParts(at).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Het tijdstip waarop de dag in Amsterdam eindigt (23:59:59.999). */
export function endOfAmsDay(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 23, 59, 59, 999);
  return new Date(guess - amsOffsetMs(new Date(guess)));
}

/** Een tijdstip in Amsterdam (bijv. 07:00) als UTC-moment. */
export function amsTime(date: string, hour: number, minute = 0): Date {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  return new Date(guess - amsOffsetMs(new Date(guess)));
}

export function isoDateOrNull(v: unknown): string | null {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

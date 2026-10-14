// Dutch number/date formatting. Everything user-facing goes through here so
// the whole app (and the PDF) formats amounts and dates the same way.

const TIME_ZONE = "Europe/Amsterdam";

const euro2 = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const euro0 = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const number0 = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 0 });
const number2 = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 2 });
const percent1 = new Intl.NumberFormat("nl-NL", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** € 1.250.000,00 (or € 1.250.000 with `whole: true`). */
export function formatEuro(value: number | null | undefined, opts: { whole?: boolean } = {}): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  // Avoid "€ -0" for values that round to zero.
  const threshold = opts.whole ? 0.5 : 0.005;
  return (opts.whole ? euro0 : euro2).format(Math.abs(value) < threshold ? 0 : value);
}

/** Compact axis label: € 1,3 mln / € 250k. */
export function formatEuroCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `€ ${number2.format(Math.round(value / 100_000) / 10)} mln`;
  if (abs >= 1_000) return `€ ${number0.format(Math.round(value / 1_000))}k`;
  return `€ ${number0.format(value)}`;
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return (decimals === 0 ? number0 : number2).format(value);
}

/** 0.245 -> 24,5% */
export function formatPercent(fraction: number | null | undefined): string {
  if (fraction === null || fraction === undefined || Number.isNaN(fraction)) return "—";
  return percent1.format(fraction);
}

function parts(date: Date | string, options: Intl.DateTimeFormatOptions) {
  const d = typeof date === "string" ? new Date(date) : date;
  const map: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("nl-NL", { timeZone: TIME_ZONE, ...options }).formatToParts(d)) {
    map[p.type] = p.value;
  }
  return map;
}

/** 12-10-2026 */
export function formatDate(date: Date | string): string {
  const p = parts(date, { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${p.day}-${p.month}-${p.year}`;
}

/** 12-10-2026, 14:35 */
export function formatDateTime(date: Date | string): string {
  const p = parts(date, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return `${p.day}-${p.month}-${p.year}, ${p.hour}:${p.minute}`;
}

/** "okt. 2026" style month label for charts. */
export function formatMonth(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("nl-NL", { timeZone: TIME_ZONE, month: "short", year: "numeric" }).format(d);
}

/**
 * Parses Dutch-formatted user input into a number.
 * "1.250.000" -> 1250000, "1250000,50" -> 1250000.5, "€ 12.000,-" -> 12000.
 * Returns null for empty input and NaN for garbage.
 */
export function parseDutchNumber(input: string): number | null {
  const cleaned = input.replace(/€|\s|,-$/g, "").trim();
  if (cleaned === "") return null;
  let normalized = cleaned;
  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(normalized)) {
    // Only thousands separators, e.g. 1.250.000
    normalized = normalized.replace(/\./g, "");
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function fullName(c: { first_name: string; last_name: string }): string {
  return `${c.first_name} ${c.last_name}`.trim();
}

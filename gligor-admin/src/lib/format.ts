const euro0 = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const euro2 = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const dateShort = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dateLong = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const dateTime = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Amsterdam",
});

/** € 1.234 (hele euro's) of € 1.234,50 als er centen zijn. */
export function formatEuro(n: number): string {
  return Number.isInteger(n) ? euro0.format(n) : euro2.format(n);
}

/** 'YYYY-MM-DD' → 23 nov. 2026 */
export function formatDate(d: string | null | undefined): string {
  if (!d) return "–";
  return dateShort.format(new Date(`${d.slice(0, 10)}T00:00:00Z`));
}

/** 'YYYY-MM-DD' → 23 november 2026 */
export function formatDateLong(d: string): string {
  return dateLong.format(new Date(`${d.slice(0, 10)}T00:00:00Z`));
}

/** ISO-tijdstip → 23 nov. 14:05 (Amsterdamse tijd) */
export function formatDateTime(ts: string | Date | null | undefined): string {
  if (!ts) return "–";
  return dateTime.format(typeof ts === "string" ? new Date(ts) : ts);
}

/** "over 3 dagen", "gisteren", "5 dagen geleden" */
export function relativeDays(days: number): string {
  if (days === 0) return "vandaag";
  if (days === 1) return "morgen";
  if (days === -1) return "gisteren";
  return days > 0 ? `over ${days} dagen` : `${-days} dagen geleden`;
}

export function ticketRef(n: number): string {
  return `T-${n}`;
}

/** Telefoonnummer → link voor bellen (tel:) en WhatsApp (wa.me). */
export function phoneLinks(phone: string | null | undefined): { tel: string; whatsapp: string } | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  if (!digits) return null;
  const intl = digits.startsWith("+") ? digits.slice(1) : digits.startsWith("00") ? digits.slice(2) : digits.startsWith("0") ? `31${digits.slice(1)}` : digits;
  return { tel: `tel:+${intl}`, whatsapp: `https://wa.me/${intl}` };
}

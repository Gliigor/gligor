import { addDays, addMonths, diffDays } from "./dates";
import { PAYMENT_DUE_SOON_DAYS, PAYMENT_TERM_DAYS, type Stage } from "../config";

export type PaymentKind = "startbedrag" | "maand";
export type PaymentStatus = "betaald" | "te_laat" | "openstaand" | "op_tijd" | "geannuleerd";

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  betaald: "Betaald",
  te_laat: "Te laat",
  openstaand: "Openstaand",
  op_tijd: "Op tijd",
  geannuleerd: "Vervallen",
};

export interface PaymentLike {
  due_date: string;
  paid_at: string | null;
  cancelled: boolean;
}

/**
 * - Betaald: er is een betaaldatum.
 * - Te laat: onbetaald en de vervaldatum is voorbij.
 * - Openstaand: onbetaald en binnen PAYMENT_DUE_SOON_DAYS dagen te betalen.
 * - Op tijd: onbetaald, maar de vervaldatum ligt nog verder weg.
 */
export function paymentStatus(p: PaymentLike, today: string): PaymentStatus {
  if (p.paid_at) return "betaald";
  if (p.cancelled) return "geannuleerd";
  const daysLeft = diffDays(today, p.due_date);
  if (daysLeft < 0) return "te_laat";
  if (daysLeft <= PAYMENT_DUE_SOON_DAYS) return "openstaand";
  return "op_tijd";
}

/** Dagen te laat (0 als niet te laat). */
export function daysOverdue(p: PaymentLike, today: string): number {
  if (p.paid_at || p.cancelled) return 0;
  return Math.max(0, diffDays(p.due_date, today));
}

export interface BillableClient {
  stage: Stage;
  start_date: string | null;
  end_date: string | null;
  monthly_fee: number;
  start_fee: number;
}

export interface ExpectedPayment {
  kind: PaymentKind;
  period_start: string;
  due_date: string;
  amount: number;
}

/**
 * Alle verwachte betalingen vanaf de startdatum tot en met `until`:
 * het startbedrag plus elke maand het maandbedrag (vooraf, op dezelfde dag van
 * de maand als de startdatum). Na opzegging (end_date) geen nieuwe maanden meer.
 */
export function expectedPayments(client: BillableClient, until: string): ExpectedPayment[] {
  if (!client.start_date) return [];
  // Leads nog niet; vanaf de intake (met startdatum) wel, zodat het startbedrag direct klaarstaat.
  if (["lead", "kennismaking"].includes(client.stage)) return [];
  const out: ExpectedPayment[] = [];
  const start = client.start_date;

  if (client.start_fee > 0 && start <= until) {
    out.push({ kind: "startbedrag", period_start: start, due_date: addDays(start, PAYMENT_TERM_DAYS), amount: client.start_fee });
  }
  if (client.monthly_fee > 0) {
    for (let i = 0; i < 600; i++) {
      const periodStart = addMonths(start, i);
      if (periodStart > until) break;
      if (client.end_date && periodStart >= client.end_date) break;
      out.push({
        kind: "maand",
        period_start: periodStart,
        due_date: addDays(periodStart, PAYMENT_TERM_DAYS),
        amount: client.monthly_fee,
      });
    }
  }
  return out;
}

const monthFmt = new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric", timeZone: "UTC" });

/** Bijv. "Startbedrag" of "Maandbedrag november 2026". */
export function paymentDescription(p: { kind: PaymentKind; period_start: string }): string {
  if (p.kind === "startbedrag") return "Startbedrag (inrichting en starttraining)";
  return `Maandbedrag ${monthFmt.format(new Date(`${p.period_start}T00:00:00Z`))}`;
}

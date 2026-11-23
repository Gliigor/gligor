import { CATEGORY_LABEL, type TodayItem, type TodaySummary } from "./domain/today";
import { formatEuro, formatDateLong } from "./format";

/** De korte ochtendmail met de Vandaag-lijst. */
export function digestText(items: TodayItem[], summary: TodaySummary, today: string, dashboardUrl: string): { subject: string; text: string } {
  const lines: string[] = [];
  lines.push(`Goedemorgen Gligor,`);
  lines.push("");
  lines.push(
    `${summary.activeClients} actieve klanten · MRR ${formatEuro(summary.mrr)} · ${summary.openTickets} open tickets · ${summary.overduePayments} te late betalingen`,
  );
  lines.push("");
  if (items.length === 0) {
    lines.push("Niets dringends vandaag. Mooi zo!");
  } else {
    let current = 0;
    for (const item of items) {
      if (item.category !== current) {
        current = item.category;
        lines.push("");
        lines.push(`${CATEGORY_LABEL[item.category]}`);
      }
      lines.push(`- ${item.title} (${item.detail}) · ${item.badge}`);
    }
  }
  lines.push("");
  lines.push(`Open het dashboard: ${dashboardUrl}/vandaag`);
  return {
    subject: `Vandaag (${formatDateLong(today)}): ${items.length} ${items.length === 1 ? "punt" : "punten"}`,
    text: lines.join("\n"),
  };
}

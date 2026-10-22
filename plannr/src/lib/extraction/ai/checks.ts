// Arithmetic checks on what the AI reader transcribed. Our own code adds the
// items up and compares them with the totals printed in the document; the
// model never calculates. A failed check makes the reader read the document
// again with a stronger model, and is shown to the planner if it remains.

import type { IbAangifteExtraction, JaarrekeningExtraction } from "./schema";

type Amount = { value: number | null } | undefined;

const v = (a: Amount) => (a && typeof a.value === "number" && Number.isFinite(a.value) ? a.value : null);
const euro = (n: number) => `€ ${Math.round(n).toLocaleString("nl-NL")}`;

/** Rounding in the document is fine; anything beyond €10 or 0,1% is not. */
function differs(sum: number, total: number): boolean {
  return Math.abs(sum - total) > Math.max(10, Math.abs(total) * 0.001);
}

function plausibleYear(year: number | null, max: number): boolean {
  return year === null || (Number.isInteger(year) && year >= 1900 && year <= max);
}

export function checkIbAangifte(x: IbAangifteExtraction, now = new Date()): string[] {
  const issues: string[] = [];
  const thisYear = now.getFullYear();

  if (x.taxYear !== null && !plausibleYear(x.taxYear, thisYear)) issues.push(`Het belastingjaar (${x.taxYear}) lijkt niet te kloppen.`);
  if (!plausibleYear(v(x.taxpayer.birthYear), thisYear)) issues.push("Het geboortejaar van de aangever lijkt niet te kloppen.");
  if (x.partner.present && !plausibleYear(v(x.partner.birthYear), thisYear)) issues.push("Het geboortejaar van de partner lijkt niet te kloppen.");

  const printed = x.box3TotalsPrinted ?? [];
  const printedAssets = printed.map((t) => v(t.assets)).filter((n): n is number => n !== null);
  if (printedAssets.length > 0) {
    const items = x.box3Items.filter((i) => i.category !== "debt").reduce((s, i) => s + (v(i.value) ?? 0), 0);
    const total = printedAssets.reduce((s, n) => s + n, 0);
    if (differs(items, total)) issues.push(`De box 3-bezittingen tellen op tot ${euro(items)}, maar het document noemt in totaal ${euro(total)}.`);
  }
  const printedDebts = printed.map((t) => v(t.debts)).filter((n): n is number => n !== null);
  if (printedDebts.length > 0) {
    const items = x.box3Items.filter((i) => i.category === "debt").reduce((s, i) => s + (v(i.value) ?? 0), 0);
    const total = printedDebts.reduce((s, n) => s + n, 0);
    if (differs(items, total)) issues.push(`De box 3-schulden tellen op tot ${euro(items)}, maar het document noemt in totaal ${euro(total)}.`);
  }

  const mortgageTotal = v(x.mortgageTotalPrinted);
  if (mortgageTotal !== null && x.mortgageParts.length > 0) {
    const parts = x.mortgageParts.reduce((s, p) => s + (v(p.balance) ?? 0), 0);
    if (differs(parts, mortgageTotal)) {
      issues.push(`De leningdelen tellen op tot ${euro(parts)}, maar de eigenwoningschuld is volgens het document ${euro(mortgageTotal)}.`);
    }
  }
  return issues;
}

export function checkJaarrekening(x: JaarrekeningExtraction, now = new Date()): string[] {
  const issues: string[] = [];
  if (x.financialYear !== null && !plausibleYear(x.financialYear, now.getFullYear())) {
    issues.push(`Het boekjaar (${x.financialYear}) lijkt niet te kloppen.`);
  }

  const activa = v(x.balanceTotalAssets);
  const passiva = v(x.balanceTotalLiabilities);
  if (activa !== null && passiva !== null && differs(activa, passiva)) {
    issues.push(`Het balanstotaal klopt niet: activa ${euro(activa)}, passiva ${euro(passiva)}.`);
  }
  const total = activa ?? passiva;
  if (total !== null) {
    const cash = v(x.cash);
    const equity = v(x.equity);
    if (cash !== null && cash > total + 10) issues.push(`De liquide middelen (${euro(cash)}) zijn hoger dan het balanstotaal (${euro(total)}).`);
    if (equity !== null && equity > total + 10) issues.push(`Het eigen vermogen (${euro(equity)}) is hoger dan het balanstotaal (${euro(total)}).`);
  }

  const before = v(x.resultBeforeTax);
  const tax = v(x.taxOnResult);
  const net = v(x.netResult);
  if (before !== null && tax !== null && net !== null && differs(before - tax, net)) {
    issues.push(`Resultaat voor belasting (${euro(before)}) min belasting (${euro(tax)}) is niet gelijk aan het resultaat na belasting (${euro(net)}).`);
  }
  return issues;
}

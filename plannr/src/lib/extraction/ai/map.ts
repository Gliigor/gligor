// Maps the AI reader's answer onto Plannr's fields. Pure and deterministic:
// derived values (such as an interest rate from interest paid) are computed
// here, never by the model.

import { formatEuro, formatNumber, formatPercent } from "@/lib/format";
import type { ExtractedData } from "../types";
import type { IbAangifteExtraction, JaarrekeningExtraction } from "./schema";

type Amount = { value: number | null; page: number | null };
type Owner = IbAangifteExtraction["home"]["owner"];

const OWNER: Record<Owner, "client" | "partner" | "joint" | null> = {
  taxpayer: "client",
  partner: "partner",
  joint: "joint",
  unknown: null,
};

const BOX3_TYPE = {
  bank_savings: "spaargeld",
  investments: "beleggingen",
  other_assets: "beleggingen",
  real_estate: "overig_vastgoed_nl",
  debt: "schulden_box3",
} as const;

const REPAYMENT = { annuity: "annuitair", linear: "lineair", interest_only: "aflossingsvrij", unknown: null } as const;

const isNum = (a: Amount | null | undefined): a is { value: number; page: number | null } =>
  a !== null && a !== undefined && typeof a.value === "number" && Number.isFinite(a.value);
const money = (n: number) => Math.round(Math.abs(n));
const signedMoney = (n: number) => Math.round(n);
const validYear = (n: number | null) => (n !== null && Number.isInteger(n) && n >= 1900 && n <= 2100 ? n : null);
const page = (p: number | null) => (p !== null && Number.isInteger(p) && p > 0 ? p : null);
const text = (s: string | null | undefined, max = 120) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

function emptyResult(documentType: ExtractedData["documentType"], year: number | null): ExtractedData {
  return { documentType, year, method: "ai", prive: {}, partner: {}, assets: [], notes: [], sources: [] };
}

export function mapIbAangifte(x: IbAangifteExtraction): ExtractedData {
  const out = emptyResult("ib_aangifte", validYear(x.taxYear));
  const src = (label: string, value: string, p: number | null) => out.sources.push({ label, value, page: page(p) });

  // Taxpayer
  const birth = validYear(x.taxpayer.birthYear.value);
  if (birth) {
    out.prive.geboortejaar = birth;
    src("Geboortejaar cliënt", String(birth), x.taxpayer.birthYear.page);
  }
  const tpWage = sumWages(x.taxpayer.employments, false);
  if (tpWage) {
    out.prive.bruto_inkomen = tpWage.total;
    for (const e of tpWage.items) src(`Loon cliënt: ${e.label}`, formatEuro(e.value, { whole: true }), e.page);
  }

  // Partner
  if (x.partner.present) {
    const name = text(x.partner.firstName, 60);
    if (name) {
      out.partner.naam = name;
      src("Voornaam partner", name, null);
    }
    if (x.partner.relationship === "married_or_registered") out.partner.relatie = "gehuwd";
    else if (x.partner.relationship === "cohabiting") out.partner.relatie = "samenwonend_fiscaal";
    if (out.partner.relatie) src("Relatie", out.partner.relatie === "gehuwd" ? "Gehuwd / geregistreerd" : "Samenwonend, fiscaal partner", null);
    const pBirth = validYear(x.partner.birthYear.value);
    if (pBirth) {
      out.partner.geboortejaar = pBirth;
      src("Geboortejaar partner", String(pBirth), x.partner.birthYear.page);
    }
    const pWage = sumWages(x.partner.employments, false);
    if (pWage) {
      out.partner.bruto_inkomen = pWage.total;
      for (const e of pWage.items) src(`Loon partner: ${e.label}`, formatEuro(e.value, { whole: true }), e.page);
    }
  }

  // Eigen woning and mortgage parts
  if (x.home.present && isNum(x.home.wozValue)) {
    const metadata: Record<string, string> = {};
    const o = OWNER[x.home.owner];
    if (o) metadata.eigenaar = o;
    out.assets.push({ type: "eigen_woning", label: "Eigen woning", value: money(x.home.wozValue.value), metadata });
    src("WOZ-waarde eigen woning", formatEuro(money(x.home.wozValue.value), { whole: true }), x.home.wozValue.page);
  }
  x.mortgageParts.forEach((m, i) => {
    if (!isNum(m.balance)) return;
    const balance = money(m.balance.value);
    const label = text(m.description) || `Leningdeel ${i + 1}`;
    const metadata: Record<string, number | string> = {};
    let rate: number | null = null;
    if (isNum(m.interestRatePercent) && m.interestRatePercent.value > 0 && m.interestRatePercent.value < 20) {
      rate = Math.round(m.interestRatePercent.value * 100) / 100;
    } else if (isNum(m.interestPaid) && balance > 0) {
      // Derived: interest paid over the year divided by the year-end balance.
      // Indicative only (the balance may have changed during the year).
      const derived = Math.round((money(m.interestPaid.value) / balance) * 10_000) / 100;
      if (derived > 0 && derived < 20) {
        rate = derived;
        out.notes.push(`Rente van "${label}" is afgeleid uit de betaalde rente (${formatEuro(money(m.interestPaid.value), { whole: true })}); controleer het percentage.`);
      }
    }
    if (rate !== null) metadata.rente = rate;
    const repayment = REPAYMENT[m.repaymentType];
    if (repayment) metadata.aflosvorm = repayment;
    out.assets.push({ type: "hypotheek", label, value: balance, metadata });
    src(`Hypotheek: ${label}`, formatEuro(balance, { whole: true }), m.balance.page);
    if (rate !== null) src(`Rente: ${label}`, `${formatNumber(rate, 2)}%`, m.interestRatePercent.page ?? m.interestPaid.page);
  });

  // Box 3
  for (const item of x.box3Items) {
    if (!isNum(item.value)) continue;
    const type = BOX3_TYPE[item.category];
    const label = text(item.description) || (item.category === "other_assets" ? "Overige bezittingen" : "");
    const metadata: Record<string, string> = {};
    const o = OWNER[item.owner];
    if (o) metadata.eigenaar = o;
    out.assets.push({ type, label, value: money(item.value.value), metadata });
    src(`Box 3: ${label || type}`, formatEuro(money(item.value.value), { whole: true }), item.value.page);
  }

  // Box 2: one BV row in v1. Take the first company; mention any others.
  const [bv, ...otherBvs] = x.substantialInterests;
  const holder = bv ? OWNER[bv.holder] : null;
  const salary = sumWages(holder === "partner" ? x.partner.employments : x.taxpayer.employments, true);
  if (bv || salary) {
    const metadata: Record<string, number | string> = {};
    if (bv) {
      const name = text(bv.companyName);
      if (name) metadata.bv_naam = name;
      if (holder === "client" || holder === "partner") metadata.eigenaar = holder;
      if (isNum(bv.sharePercentage) && bv.sharePercentage.value > 0 && bv.sharePercentage.value <= 100) {
        metadata.aandelen_percentage = bv.sharePercentage.value;
        src(`Aandelenbezit ${name || "BV"}`, formatPercent(bv.sharePercentage.value / 100), bv.sharePercentage.page);
      }
      if (isNum(bv.dividendReceived)) {
        metadata.dividenduitkering = money(bv.dividendReceived.value);
        src(`Dividend ${name || "BV"}`, formatEuro(metadata.dividenduitkering, { whole: true }), bv.dividendReceived.page);
      }
    }
    if (salary) {
      metadata.salaris_dga = salary.total;
      for (const e of salary.items) src(`Salaris uit eigen BV: ${e.label}`, formatEuro(e.value, { whole: true }), e.page);
    }
    out.assets.push({ type: "bv_aandelen", metadata });
  }
  if (otherBvs.length > 0) {
    out.notes.push(
      `Er ${otherBvs.length === 1 ? "staat nog een BV" : `staan nog ${otherBvs.length} BV's`} in de aangifte (${otherBvs
        .map((b) => text(b.companyName) || "naam onbekend")
        .join(", ")}). Alleen de eerste is overgenomen.`,
    );
  }

  out.notes.push(...cleanNotes(x.notes));
  return out;
}

export function mapJaarrekening(x: JaarrekeningExtraction): ExtractedData {
  const out = emptyResult("jaarrekening", validYear(x.financialYear));
  const metadata: Record<string, number | string> = {};
  const name = text(x.companyName);
  if (name) metadata.bv_naam = name;

  const fields: [key: string, label: string, a: Amount, signed: boolean][] = [
    ["eigen_vermogen", "Eigen vermogen", x.equity, true],
    ["liquide_middelen", "Liquide middelen", x.cash, false],
    ["resultaat_na_belasting", "Resultaat na belasting", x.netResult, true],
    ["odv_waarde", "Pensioen in eigen beheer / ODV", x.pensionObligation, false],
    ["dividenduitkering", "Dividend", x.dividendPaid, false],
    ["salaris_dga", "Salaris DGA", x.directorSalary, false],
  ];
  for (const [key, label, a, signed] of fields) {
    if (!isNum(a)) continue;
    const v = signed ? signedMoney(a.value) : money(a.value);
    metadata[key] = v;
    out.sources.push({ label, value: formatEuro(v, { whole: true }), page: page(a.page) });
  }
  if (isNum(x.directorCurrentAccount) && x.directorCurrentAccount.value !== 0) {
    const v = signedMoney(x.directorCurrentAccount.value);
    out.sources.push({ label: "Rekening-courant DGA", value: formatEuro(v, { whole: true }), page: page(x.directorCurrentAccount.page) });
    out.notes.push(
      v > 0
        ? `De BV heeft een vordering van ${formatEuro(v, { whole: true })} op de DGA (rekening-courant). Let op de excessief-lenenregeling.`
        : `De BV heeft een schuld van ${formatEuro(-v, { whole: true })} aan de DGA (rekening-courant).`,
    );
  }
  if (Object.keys(metadata).length > 0) out.assets.push({ type: "bv_aandelen", metadata });
  out.notes.push(...cleanNotes(x.notes));
  return out;
}

type Employment = IbAangifteExtraction["taxpayer"]["employments"][number];

/** Adds up wages per payer, either from the person's own BV or from everyone else. */
function sumWages(list: Employment[], ownCompany: boolean) {
  const items = list
    .filter((e) => e.isOwnCompany === ownCompany && isNum(e.grossWage))
    .map((e) => ({ label: text(e.payer, 60) || "werkgever", value: money(e.grossWage.value!), page: page(e.grossWage.page) }));
  if (items.length === 0) return null;
  return { total: items.reduce((sum, e) => sum + e.value, 0), items };
}

function cleanNotes(notes: string[]): string[] {
  return notes
    .map((n) => text(n, 300))
    .filter(Boolean)
    .slice(0, 8);
}


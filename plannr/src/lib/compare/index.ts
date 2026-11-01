// "Keuzes vergelijken": deterministic what-if comparisons. Each comparison
// turns the plan's engine input into a few variants, and every variant is
// calculated with calculatePlan() — so the comparisons keep working when the
// engine is replaced by a licensed rekenkern.

import { ASSUMPTIONS } from "@/lib/engine/assumptions";
import { progressiveTax } from "@/lib/engine/tax-math";
import type { PlanInput, PlanResult } from "@/lib/engine/types";
import { formatEuro } from "@/lib/format";

export type ComparisonKind = "pensioen_financiering" | "aflossen" | "salaris_dividend" | "schenken";

/** `bv`: the choice is only about a BV, so it is left out for clients without one. */
export const COMPARISONS: { kind: ComparisonKind; label: string; question: string; bv?: boolean }[] = [
  { kind: "pensioen_financiering", label: "Na pensioen: box 3 of BV", question: "Waaruit betaalt u uw uitgaven na het stoppen met werken het voordeligst?", bv: true },
  { kind: "aflossen", label: "Aflossen of beleggen", question: "Spaargeld gebruiken om de hypotheek af te lossen, of laten staan?" },
  { kind: "salaris_dividend", label: "Salaris of dividend", question: "Welke verhouding tussen salaris en dividend uit de BV levert netto het meest op?", bv: true },
  { kind: "schenken", label: "Schenken aan kinderen", question: "Wat doet schenken met uw vermogen en de belasting?" },
];

export interface ComparisonParams {
  /** aflossen: amount to repay from savings. */
  repayAmount?: number;
  /** salaris_dividend: proposed DGA salary. */
  salary?: number;
  /** schenken: number of years to give the yearly tax-free amount. */
  giftYears?: number;
}

export interface Variant {
  key: string;
  label: string;
  input: PlanInput;
}

export interface VariantOutcome {
  key: string;
  label: string;
  endWealth: number;
  endWealthReal: number;
  /** End wealth minus the box 2 tax still due on the BV when it is paid out. */
  endWealthAfterLatent: number;
  taxesPaid: number;
  netIncomeNow: number;
  taxNow: number;
  giftsGiven: number;
  fundedFromBox3: number;
  fundedFromBv: number;
  depletedYear: number | null;
  /** Neutral scenario, for the chart. */
  points: { year: number; value: number }[];
}

export interface ComparisonOutcome {
  kind: ComparisonKind;
  available: boolean;
  /** Why the comparison is not available for this plan. */
  reason?: string;
  params: ComparisonParams;
  variants: VariantOutcome[];
  /** Which metrics to show, in order. */
  metrics: (keyof Omit<VariantOutcome, "key" | "label" | "points">)[];
  conclusion: string;
  endYear: number;
}

const clone = <T,>(x: T): T => structuredClone(x);
const savingsOf = (input: PlanInput) =>
  input.prive.box3.filter((i) => i.category === "savings").reduce((x, i) => x + i.value, 0);

/** Default parameters derived from the plan itself. */
export function defaultParams(kind: ComparisonKind, input: PlanInput): ComparisonParams {
  switch (kind) {
    case "aflossen": {
      const buffer = (input.prive.yearlyExpenses / 12) * ASSUMPTIONS.insights.bufferMonths;
      const mortgage = input.prive.eigenWoning?.mortgages.reduce((x, m) => x + m.amount, 0) ?? 0;
      const amount = Math.max(0, Math.min(savingsOf(input) - buffer, mortgage));
      return { repayAmount: Math.round(amount / 1000) * 1000 };
    }
    case "salaris_dividend":
      return { salary: ASSUMPTIONS.insights.gebruikelijkLoon };
    case "schenken":
      return { giftYears: 10 };
    default:
      return {};
  }
}

/** Returns the variants to calculate, or a reason why the comparison does not apply. */
export function buildVariants(
  kind: ComparisonKind,
  input: PlanInput,
  params: ComparisonParams,
): { variants: Variant[] } | { reason: string } {
  const s = input.scope;
  switch (kind) {
    case "pensioen_financiering": {
      const hasBv = (s.balans || s.bv) && input.zakelijk.companies.length > 0;
      if (!hasBv) return { reason: "Deze vergelijking vraagt om een BV met liquide middelen (vink BV en Balans BV aan in stap 1)." };
      if (!input.household.client.birthYear || !input.household.client.retirementAge) {
        return { reason: "Vul eerst het geboortejaar en de gewenste pensioenleeftijd in bij Privé." };
      }
      return {
        variants: [
          { key: "box3_first", label: "Eerst box 3", input: { ...clone(input), strategy: { retirementFunding: "box3_first" } } },
          { key: "mix", label: "Half om half", input: { ...clone(input), strategy: { retirementFunding: "mix" } } },
          { key: "bv_first", label: "Eerst de BV", input: { ...clone(input), strategy: { retirementFunding: "bv_first" } } },
        ],
      };
    }
    case "aflossen": {
      const woning = input.prive.eigenWoning;
      const mortgage = woning?.mortgages.reduce((x, m) => x + m.amount, 0) ?? 0;
      const savings = savingsOf(input);
      if (!s.eigenWoning || !woning || mortgage <= 0) return { reason: "Er is geen hypotheek ingevuld." };
      if (!s.box3 || savings <= 0) return { reason: "Er is geen spaargeld ingevuld." };
      const amount = Math.max(0, Math.min(params.repayAmount ?? 0, mortgage, savings));
      const repaid = clone(input);
      // Take the amount from the savings accounts pro rata ...
      for (const item of repaid.prive.box3) {
        if (item.category === "savings") item.value -= (item.value / savings) * amount;
      }
      // ... and repay the most expensive loan parts first.
      let left = amount;
      let interestSaved = 0;
      const parts = [...repaid.prive.eigenWoning!.mortgages].sort((x, y) => y.interestRate - x.interestRate);
      for (const part of parts) {
        const pay = Math.min(left, part.amount);
        part.amount -= pay;
        interestSaved += pay * (part.interestRate / 100);
        left -= pay;
      }
      repaid.prive.eigenWoning!.mortgages = parts;
      // Household expenses include the mortgage payments, so they drop by the interest saved.
      repaid.prive.yearlyExpenses = Math.max(0, repaid.prive.yearlyExpenses - interestSaved);
      return {
        variants: [
          { key: "huidig", label: "Niet aflossen", input: clone(input) },
          { key: "aflossen", label: `${formatEuro(amount, { whole: true })} aflossen`, input: repaid },
        ],
      };
    }
    case "salaris_dividend": {
      const company = input.zakelijk.companies[0];
      if (!s.bv || !company) return { reason: "Deze vergelijking vraagt om een BV met DGA-salaris (vink BV aan in stap 1)." };
      const proposed = Math.max(0, params.salary ?? company.dgaSalary);
      const delta = company.dgaSalary - proposed;
      const alt = clone(input);
      const c = alt.zakelijk.companies[0];
      c.dgaSalary = proposed;
      // Less salary means more BV profit; after corporate tax it is paid out as extra dividend.
      // c.dividend is the BV's total payout; the shareholder receives their percentage of it.
      c.dividend = Math.max(0, c.dividend + delta * (1 - ASSUMPTIONS.insights.vpb.lowRate));
      const scope = { ...alt.scope, dividend: true };
      return {
        variants: [
          { key: "huidig", label: `Salaris ${formatEuro(company.dgaSalary, { whole: true })}`, input: clone(input) },
          { key: "voorstel", label: `Salaris ${formatEuro(proposed, { whole: true })}`, input: { ...alt, scope } },
        ],
      };
    }
    case "schenken": {
      if (!s.kinderen || input.household.children.length === 0) {
        return { reason: "Voeg eerst kinderen toe (vink Kinderen & schenkingen aan in stap 1)." };
      }
      const years = Math.min(30, Math.max(1, Math.round(params.giftYears ?? 10)));
      const none = clone(input);
      none.household.gifts = [];
      const max = clone(input);
      max.household.gifts = input.household.children.map((child) => ({
        childName: child.name,
        childBirthYear: child.birthYear,
        kind: "jaarlijks" as const,
        amount: ASSUMPTIONS.schenking.vrijstellingKind,
        startYear: input.referenceYear + 1,
        years,
      }));
      const variants: Variant[] = [{ key: "geen", label: "Niet schenken", input: none }];
      if (input.household.gifts.length > 0) variants.push({ key: "plan", label: "Huidig schenkplan", input: clone(input) });
      variants.push({ key: "max", label: `Jaarlijks vrijgesteld, ${years} jaar`, input: max });
      return { variants };
    }
  }
}

export function toOutcome(v: Variant, r: PlanResult): VariantOutcome {
  const last = r.projection.points[r.projection.points.length - 1];
  const people = r.household.fiscalPartners ? 2 : 1;
  const latentBox2 = progressiveTax(Math.max(0, r.projection.summary.endBvValue) / people, ASSUMPTIONS.box2.brackets) * people;
  return {
    key: v.key,
    label: v.label,
    endWealth: last?.neutraal ?? 0,
    endWealthReal: last?.neutraalReeel ?? 0,
    endWealthAfterLatent: (last?.neutraal ?? 0) - latentBox2,
    taxesPaid: r.projection.summary.taxesPaid,
    netIncomeNow: r.income.net,
    taxNow: r.taxes.total,
    giftsGiven: r.projection.summary.giftsGiven,
    fundedFromBox3: r.projection.summary.fundedFromBox3,
    fundedFromBv: r.projection.summary.fundedFromBv,
    depletedYear: r.projection.summary.depletedYear,
    points: r.projection.points.map((p) => ({ year: p.year, value: p.neutraal })),
  };
}

const METRICS: Record<ComparisonKind, ComparisonOutcome["metrics"]> = {
  pensioen_financiering: ["endWealth", "endWealthReal", "endWealthAfterLatent", "taxesPaid", "fundedFromBox3", "fundedFromBv", "depletedYear"],
  aflossen: ["netIncomeNow", "taxNow", "endWealth", "endWealthReal", "taxesPaid"],
  salaris_dividend: ["netIncomeNow", "taxNow", "endWealth", "taxesPaid"],
  schenken: ["giftsGiven", "taxesPaid", "endWealth", "endWealthReal"],
};

export const METRIC_LABELS: Record<ComparisonOutcome["metrics"][number], { label: string; better: "high" | "low" | "none" }> = {
  endWealth: { label: "Vermogen aan het eind (neutraal)", better: "high" },
  endWealthReal: { label: "Idem, in koopkracht van nu", better: "high" },
  endWealthAfterLatent: { label: "Vermogen na latente box 2-belasting op de BV", better: "high" },
  taxesPaid: { label: "Belasting over de hele periode", better: "low" },
  netIncomeNow: { label: "Netto inkomen dit jaar", better: "high" },
  taxNow: { label: "Belasting dit jaar", better: "low" },
  giftsGiven: { label: "Geschonken aan kinderen", better: "none" },
  fundedFromBox3: { label: "Opgenomen uit box 3", better: "none" },
  fundedFromBv: { label: "Uitgekeerd uit de BV (bruto)", better: "none" },
  depletedYear: { label: "Vrij vermogen op in", better: "none" },
};

export function summarize(kind: ComparisonKind, params: ComparisonParams, variants: VariantOutcome[]): ComparisonOutcome {
  const endYear = variants[0]?.points.at(-1)?.year ?? 0;
  const base = variants[0];
  const euro = (n: number) => formatEuro(Math.abs(n), { whole: true });
  let conclusion = "";

  if (kind === "pensioen_financiering") {
    // Judge on wealth after the box 2 tax that is only postponed by leaving money in the BV.
    const ranked = [...variants].sort((x, y) => y.endWealthAfterLatent - x.endWealthAfterLatent);
    const top = ranked[0];
    const worst = ranked[ranked.length - 1];
    const diff = top.endWealthAfterLatent - worst.endWealthAfterLatent;
    const why =
      top.key === "box3_first"
        ? " Geld in de BV groeit door zonder box 3-heffing en wordt pas belast bij uitkering; door eerst box 3 aan te spreken wordt die belasting uitgesteld en kan het rendement erover doorlopen."
        : top.key === "bv_first"
          ? " Uitkeren uit de BV in het lage box 2-tarief is hier voordeliger dan box 3-vermogen laten staan."
          : "";
    conclusion =
      Math.abs(diff) < 1_000
        ? `De volgorde maakt weinig uit: ook na de nog te betalen box 2-belasting op de BV is het verschil in ${endYear} kleiner dan € 1.000.`
        : `"${top.label}" laat in ${endYear}, ook na de nog te betalen box 2-belasting op de BV, ${euro(diff)} meer vermogen over dan "${worst.label}".${why}`;
  } else if (kind === "aflossen") {
    const alt = variants[1];
    const diff = alt.endWealth - base.endWealth;
    conclusion = `Aflossen levert in ${endYear} ${euro(diff)} ${diff >= 0 ? "meer" : "minder"} vermogen op. Het verschil ontstaat doordat u minder hypotheekrente betaalt (minus de lagere renteaftrek) en minder box 3-heffing, tegenover het rendement dat het spaargeld anders had gemaakt.`;
  } else if (kind === "salaris_dividend") {
    const alt = variants[1];
    const diff = alt.netIncomeNow - base.netIncomeNow;
    conclusion = `Met ${alt.label.toLowerCase()} is het netto inkomen dit jaar ${euro(diff)} ${diff >= 0 ? "hoger" : "lager"} (het verschil wordt via de BV als dividend uitgekeerd). Let op: een lager salaris betekent ook minder pensioenopbouw en kan de hypotheekruimte en verzekeringen raken.`;
  } else {
    const none = variants.find((v) => v.key === "geen")!;
    const max = variants.find((v) => v.key === "max")!;
    const box3Saved = none.taxesPaid - max.taxesPaid;
    const taxPart =
      Math.abs(box3Saved) < 1_000
        ? "de belasting over de hele periode blijft vrijwel gelijk"
        : box3Saved > 0
          ? `u betaalt over de hele periode ${euro(box3Saved)} minder belasting`
          : `u betaalt over de hele periode ${euro(box3Saved)} meer belasting, omdat later eerder dividend uit de BV nodig is`;
    conclusion = `Jaarlijks belastingvrij schenken brengt ${euro(max.giftsGiven)} bij uw kinderen zonder schenkbelasting. Uw eigen vermogen is in ${endYear} ${euro(none.endWealth - max.endWealth)} lager; ${taxPart}. De latere nalatenschap, en daarmee de erfbelasting, wordt kleiner.`;
  }

  return { kind, available: true, params, variants, metrics: METRICS[kind], conclusion, endYear };
}

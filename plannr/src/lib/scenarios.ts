// Side-by-side comparison of plans (a base plan and its scenarios). Every plan
// is calculated with calculatePlan(); this file only picks the figures to show.

import { ASSUMPTIONS } from "@/lib/engine/assumptions";
import type { PlanInput, PlanResult } from "@/lib/engine/types";

export const MAX_COMPARE = 3;

export interface ScenarioColumn {
  planId: string;
  title: string;
  isScenario: boolean;
  /** Assumptions that differ between plans are worth showing. */
  assumptions: {
    retirementAge: number | null;
    partnerRetirementAge: number | null;
    expenses: number;
    retiredPct: number;
    laterPct: number;
    investmentsReturn: number;
    items: number;
  };
  metrics: {
    wealthNow: number;
    netIncomeNow: number;
    spendingNow: number;
    /** Average yearly spending after the client's retirement, in today's money. */
    spendingRetiredReal: number | null;
    wealthAtRetirement: number | null;
    wealthEnd: number;
    wealthEndReal: number;
    taxesPaid: number;
    depletedYear: number | null;
  };
  points: { year: number; neutraal: number; spending: number; netIncome: number }[];
}

export function toColumn(plan: { id: string; title: string; scenario_van?: string | null }, input: PlanInput, result: PlanResult): ScenarioColumn {
  const pts = result.projection.points;
  const ref = result.referenceYear;
  const retYear = result.retirement.retirementYear;
  const retired = retYear !== null ? pts.filter((p) => p.year >= retYear) : [];
  const real = (p: (typeof pts)[number]) => p.spending / Math.pow(1 + ASSUMPTIONS.inflation, p.year - ref);
  const last = pts[pts.length - 1];
  return {
    planId: plan.id,
    title: plan.title,
    isScenario: Boolean(plan.scenario_van),
    assumptions: {
      retirementAge: input.household.client.retirementAge,
      partnerRetirementAge: input.household.partner?.retirementAge ?? null,
      expenses: input.prive.yearlyExpenses,
      retiredPct: input.spendingPattern?.retiredPct ?? 1,
      laterPct: input.spendingPattern?.laterPct ?? 1,
      investmentsReturn: result.projection.returns.investments,
      items: input.prive.cashItems.length,
    },
    metrics: {
      wealthNow: result.wealth.total,
      netIncomeNow: result.income.net,
      spendingNow: result.income.expenses,
      spendingRetiredReal: retired.length > 0 ? retired.reduce((x, p) => x + real(p), 0) / retired.length : null,
      wealthAtRetirement: retYear !== null ? (pts.find((p) => p.year === retYear)?.neutraal ?? null) : null,
      wealthEnd: last?.neutraal ?? 0,
      wealthEndReal: last?.neutraalReeel ?? 0,
      taxesPaid: result.projection.summary.taxesPaid,
      depletedYear: result.projection.summary.depletedYear,
    },
    points: pts.map((p) => ({ year: p.year, neutraal: p.neutraal, spending: p.spending, netIncome: p.netIncome })),
  };
}

export type MetricKey = keyof ScenarioColumn["metrics"];

export const SCENARIO_METRICS: { key: MetricKey; label: string; better: "high" | "low" | "none"; kind: "euro" | "year" }[] = [
  { key: "wealthNow", label: "Vermogen vandaag", better: "none", kind: "euro" },
  { key: "netIncomeNow", label: "Netto inkomen dit jaar", better: "high", kind: "euro" },
  { key: "spendingNow", label: "Uitgaven dit jaar", better: "none", kind: "euro" },
  { key: "spendingRetiredReal", label: "Gemiddelde uitgaven na pensioen (koopkracht van nu)", better: "none", kind: "euro" },
  { key: "wealthAtRetirement", label: "Vermogen bij pensioen", better: "high", kind: "euro" },
  { key: "wealthEnd", label: "Vermogen aan het eind (neutraal)", better: "high", kind: "euro" },
  { key: "wealthEndReal", label: "Idem, in koopkracht van nu", better: "high", kind: "euro" },
  { key: "taxesPaid", label: "Belasting over de hele periode", better: "none", kind: "euro" },
  { key: "depletedYear", label: "Vrij vermogen op in", better: "none", kind: "year" },
];

/** Index of the best column for a metric, or -1 when there is no meaningful winner. */
export function bestColumn(columns: ScenarioColumn[], key: MetricKey): number {
  const metric = SCENARIO_METRICS.find((m) => m.key === key);
  if (!metric || metric.better === "none" || columns.length < 2) return -1;
  const values = columns.map((c) => c.metrics[key] ?? 0);
  const target = metric.better === "high" ? Math.max(...values) : Math.min(...values);
  if (values.every((v) => Math.abs(v - target) < 1)) return -1;
  return values.indexOf(target);
}

"use server";

import { requireMember } from "@/lib/auth";
import { calculatePlan } from "@/lib/engine";
import { buildVariants, defaultParams, summarize, toOutcome, type ComparisonKind, type ComparisonOutcome, type ComparisonParams } from "@/lib/compare";
import { loadPlan } from "@/lib/plan/load";
import { toEngineInput } from "@/lib/plan/to-engine-input";

const KINDS: ComparisonKind[] = ["pensioen_financiering", "aflossen", "salaris_dividend", "schenken"];

/** Runs one comparison for a plan. Every variant is calculated with calculatePlan(). */
export async function compareChoices(planId: string, kind: ComparisonKind, rawParams: ComparisonParams | null): Promise<ComparisonOutcome> {
  const member = await requireMember();
  if (!KINDS.includes(kind)) throw new Error("Onbekende vergelijking");
  const bundle = await loadPlan(planId);
  if (!bundle) throw new Error("Plan niet gevonden");

  const input = toEngineInput({
    config: bundle.config,
    inputs: bundle.inputs,
    assets: bundle.assets,
    referenceYear: new Date().getFullYear(),
    clientName: bundle.client.first_name,
    firmReturns: member.firm.rendement_standaard,
  });
  const defaults = defaultParams(kind, input);
  const params: ComparisonParams = {
    repayAmount: finite(rawParams?.repayAmount) ?? defaults.repayAmount,
    salary: finite(rawParams?.salary) ?? defaults.salary,
    giftYears: finite(rawParams?.giftYears) ?? defaults.giftYears,
  };

  const built = buildVariants(kind, input, params);
  if ("reason" in built) {
    return { kind, available: false, reason: built.reason, params, variants: [], metrics: [], conclusion: "", endYear: 0 };
  }
  const outcomes = [];
  for (const v of built.variants) outcomes.push(toOutcome(v, await calculatePlan(v.input)));
  return summarize(kind, params, outcomes);
}

function finite(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 1e10 ? v : undefined;
}

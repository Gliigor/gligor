// Collects everything a report needs for one plan. Takes a Supabase client so
// it works with the user's session (API routes, RLS applies) and in the seed
// script. All numbers go through calculatePlan().

import type { SupabaseClient } from "@supabase/supabase-js";
import { calculatePlan } from "@/lib/engine";
import { deriveInsights } from "@/lib/insights";
import { toHouseStyle, type HouseStyle } from "@/lib/house-style/types";
import type { ReportSectionKey } from "@/lib/plan/definitions";
import { toEngineInput } from "@/lib/plan/to-engine-input";
import { normalizeAsset, parsePlanConfig, parsePlanInputs, type ClientRow, type PlanRow, type ReturnPercents } from "@/lib/plan/types";
import { fullName } from "@/lib/format";
import { MAX_COMPARE, toColumn, type ScenarioColumn } from "@/lib/scenarios";
import { toReportLogo } from "@/lib/pdf/render";
import type { ReportData, ReportLogo } from "@/lib/pdf/report";

export interface ReportBundle {
  plan: PlanRow;
  data: ReportData;
  style: HouseStyle;
  logo: ReportLogo | null;
}

export async function loadLogo(supabase: SupabaseClient, logoPath: string | null): Promise<ReportLogo | null> {
  if (!logoPath) return null;
  const { data } = await supabase.storage.from("logos").download(logoPath);
  return data ? toReportLogo(await data.arrayBuffer()) : null;
}

export async function buildReport(
  supabase: SupabaseClient,
  planId: string,
  opts: { sections?: ReportSectionKey[]; plannerName?: string | null; now?: Date } = {},
): Promise<ReportBundle | null> {
  const { data: plan } = await supabase.from("plans").select("*").eq("id", planId).maybeSingle<PlanRow>();
  if (!plan) return null;

  const [{ data: client }, { data: assets }, { data: firm }, { data: hs }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", plan.client_id).single<ClientRow>(),
    supabase.from("assets").select("*").eq("plan_id", planId),
    // select("*"): optional columns (e.g. rendement_standaard) may not exist before a migration.
    supabase.from("firms").select("*").eq("id", plan.firm_id).single(),
    supabase.from("house_styles").select("*").eq("firm_id", plan.firm_id).eq("is_active", true).maybeSingle(),
  ]);
  if (!client || !firm) return null;

  const config = parsePlanConfig(plan.config);
  const now = opts.now ?? new Date();
  const engineInput = toEngineInput({
    config,
    inputs: parsePlanInputs(plan.inputs),
    assets: (assets ?? []).map((a) => normalizeAsset(a)),
    referenceYear: now.getFullYear(),
    clientName: client.first_name,
    firmReturns: (firm as { rendement_standaard?: ReturnPercents | null }).rendement_standaard,
  });
  const result = await calculatePlan(engineInput);

  // Scenario comparison: this plan's family (base plan and its scenarios), at most MAX_COMPARE.
  const firmReturns = (firm as { rendement_standaard?: ReturnPercents | null }).rendement_standaard;
  const root = (plan as { scenario_van?: string | null }).scenario_van ?? plan.id;
  const { data: family } = await supabase.from("plans").select("*").eq("client_id", plan.client_id).order("created_at");
  const members = ((family ?? []) as (PlanRow & { scenario_van?: string | null })[])
    .filter((p) => p.id === root || p.scenario_van === root)
    .slice(0, MAX_COMPARE);
  const scenarios: ScenarioColumn[] = [];
  if (members.length > 1) {
    for (const p of members) {
      if (p.id === plan.id) {
        scenarios.push(toColumn(p, engineInput, result));
        continue;
      }
      const { data: rows } = await supabase.from("assets").select("*").eq("plan_id", p.id);
      const input = toEngineInput({
        config: parsePlanConfig(p.config),
        inputs: parsePlanInputs(p.inputs),
        assets: (rows ?? []).map((a) => normalizeAsset(a)),
        referenceYear: now.getFullYear(),
        clientName: client.first_name,
        firmReturns,
      });
      scenarios.push(toColumn(p, input, await calculatePlan(input)));
    }
  }
  const hidden = new Set(config.hiddenInsights);
  const insights = deriveInsights(engineInput, result).filter((i) => !hidden.has(i.id));
  const style = toHouseStyle(hs);

  return {
    plan,
    style,
    logo: await loadLogo(supabase, style.logoPath),
    data: {
      firmName: firm.name,
      clientName:
        result.household.persons.length > 1
          ? `${fullName(client)} en ${result.household.persons[1].name}`
          : fullName(client),
      companyName: client.company_name,
      planTitle: plan.title,
      plannerName: opts.plannerName ?? null,
      generatedAt: now,
      result,
      // A family section only makes sense with a partner or children.
      sections: (opts.sections ?? config.reportSections).filter(
        (k) =>
          (k !== "schenkingen" || result.household.persons.length > 1 || result.gifts !== null) &&
          (k !== "scenarios" || scenarios.length > 1),
      ),
      insights,
      items: engineInput.prive.cashItems,
      scenarios,
    },
  };
}

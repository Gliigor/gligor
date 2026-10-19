// Collects everything a report needs for one plan. Takes a Supabase client so
// it works with the user's session (API routes, RLS applies) and in the seed
// script. All numbers go through calculatePlan().

import type { SupabaseClient } from "@supabase/supabase-js";
import { calculatePlan } from "@/lib/engine";
import { deriveInsights } from "@/lib/insights";
import { toHouseStyle, type HouseStyle } from "@/lib/house-style/types";
import type { ReportSectionKey } from "@/lib/plan/definitions";
import { toEngineInput } from "@/lib/plan/to-engine-input";
import { normalizeAsset, parsePlanConfig, parsePlanInputs, type ClientRow, type PlanRow } from "@/lib/plan/types";
import { fullName } from "@/lib/format";
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
    supabase.from("firms").select("name").eq("id", plan.firm_id).single(),
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
  });
  const result = await calculatePlan(engineInput);
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
        (k) => k !== "schenkingen" || result.household.persons.length > 1 || result.gifts !== null,
      ),
      insights,
      items: engineInput.prive.cashItems,
    },
  };
}

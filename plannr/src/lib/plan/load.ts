import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeAsset,
  parsePlanConfig,
  parsePlanInputs,
  type AssetRow,
  type ClientRow,
  type DocumentRow,
  type PlanConfig,
  type PlanInputs,
  type PlanRow,
} from "./types";
import { clientHasCompany, configForClient } from "./status";

export interface PlanBundle {
  plan: PlanRow;
  client: ClientRow;
  config: PlanConfig;
  inputs: PlanInputs;
  assets: AssetRow[];
  documents: DocumentRow[];
  exports: { id: string; created_at: string; sections_included: unknown }[];
}

/** Everything a plan screen needs, loaded once per request (layout + page share it). RLS applies. */
export const loadPlan = cache(async (planId: string): Promise<PlanBundle | null> => {
  const supabase = await createClient();
  const { data: plan } = await supabase.from("plans").select("*").eq("id", planId).maybeSingle<PlanRow>();
  if (!plan) return null;

  const [client, assets, documents, exports] = await Promise.all([
    supabase.from("clients").select("*").eq("id", plan.client_id).single<ClientRow>(),
    supabase.from("assets").select("*").eq("plan_id", planId).order("sort_order").order("created_at"),
    supabase.from("documents").select("*").eq("plan_id", planId).order("uploaded_at", { ascending: false }),
    supabase.from("exports").select("id, created_at, sections_included").eq("plan_id", planId).order("created_at", { ascending: false }),
  ]);
  if (!client.data) return null;

  return {
    plan,
    client: client.data,
    // Without a company the zakelijk sections are off everywhere.
    config: configForClient(parsePlanConfig(plan.config), clientHasCompany(client.data)),
    inputs: parsePlanInputs(plan.inputs),
    assets: (assets.data ?? []).map((a) => normalizeAsset(a as Record<string, unknown>)),
    documents: (documents.data ?? []) as DocumentRow[],
    exports: exports.data ?? [],
  };
});

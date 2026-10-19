"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ASSET_TYPES, getAssetType, isStepKey, REPORT_SECTION_KEYS } from "@/lib/plan/definitions";
import { isAssetTypeRelevant } from "@/lib/plan/status";
import { sanitizeAssetPatch, sanitizeKeyList, sanitizePlanInputs } from "@/lib/plan/sanitize";
import {
  DEFAULT_PLAN_CONFIG,
  normalizeAsset,
  parsePlanConfig,
  type AssetRow,
  type PlanConfig,
  type PlanStatus,
} from "@/lib/plan/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

function revalidatePlan() {
  revalidatePath("/clienten/[clientId]/plannen/[planId]", "layout");
}

/** Every save moves a fresh plan from "concept" to "in bewerking". */
async function markInProgress(supabase: Supabase, planId: string) {
  await supabase.from("plans").update({ status: "in_bewerking" }).eq("id", planId).eq("status", "concept");
}

/**
 * Single-instance rows that the control steps always show (eigen woning, BV,
 * one savings account) are created as soon as their section is enabled.
 */
async function ensureRequiredRows(supabase: Supabase, firmId: string, planId: string, config: PlanConfig) {
  const { data: existing } = await supabase.from("assets").select("type").eq("plan_id", planId);
  const have = new Set((existing ?? []).map((a) => a.type as string));
  const rows = ASSET_TYPES.filter((t) => t.requiredRow && isAssetTypeRelevant(t, config) && !have.has(t.type)).map(
    (t) => ({
      firm_id: firmId,
      plan_id: planId,
      side: t.side,
      type: t.type,
      tax_box: t.taxBox,
      label: "",
      value: null,
      metadata: {},
    }),
  );
  if (rows.length > 0) await supabase.from("assets").insert(rows);
}

export async function createPlanAction(clientId: string, _prev: { error?: string }, formData: FormData) {
  const member = await requireMember();
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  if (!title) return { error: "Geef het plan een titel." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plans")
    .insert({
      firm_id: member.firm.id,
      client_id: clientId,
      title,
      config: DEFAULT_PLAN_CONFIG,
      inputs: { prive: {}, partner: {}, kinderen: [], schenkingen: [], posten: [], fromDocument: [] },
      created_by: member.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Het plan kon niet worden aangemaakt." };
  await ensureRequiredRows(supabase, member.firm.id, data.id, DEFAULT_PLAN_CONFIG);
  redirect(`/clienten/${clientId}/plannen/${data.id}/configuratie`);
}

export async function updatePlanMeta(planId: string, patch: { title?: string; status?: PlanStatus }) {
  await requireMember();
  const update: Record<string, unknown> = {};
  if (typeof patch.title === "string" && patch.title.trim()) update.title = patch.title.trim().slice(0, 200);
  if (patch.status && ["concept", "in_bewerking", "afgerond"].includes(patch.status)) update.status = patch.status;
  if (Object.keys(update).length === 0) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("plans").update(update).eq("id", planId);
  revalidatePlan();
  return { ok: !error };
}

export async function deletePlanAction(planId: string, clientId: string) {
  await requireMember();
  const supabase = await createClient();
  const { data: docs } = await supabase.from("documents").select("file_path").eq("plan_id", planId);
  const paths = (docs ?? []).map((d) => d.file_path as string);
  if (paths.length > 0) await supabase.storage.from("documents").remove(paths);
  const { data: exps } = await supabase.from("exports").select("pdf_path").eq("plan_id", planId);
  const pdfPaths = (exps ?? []).map((e) => e.pdf_path as string);
  if (pdfPaths.length > 0) await supabase.storage.from("exports").remove(pdfPaths);
  await supabase.from("plans").delete().eq("id", planId);
  revalidatePath(`/clienten/${clientId}`);
  redirect(`/clienten/${clientId}`);
}

export async function updatePlanConfig(planId: string, raw: unknown) {
  const member = await requireMember();
  const supabase = await createClient();
  const { data: plan } = await supabase.from("plans").select("config").eq("id", planId).single();
  if (!plan) return { ok: false };
  const current = parsePlanConfig(plan.config);
  const incoming = parsePlanConfig(raw);
  // visitedSteps and hiddenInsights are changed by their own actions.
  const config: PlanConfig = { ...incoming, visitedSteps: current.visitedSteps, hiddenInsights: current.hiddenInsights };
  const { error } = await supabase.from("plans").update({ config }).eq("id", planId);
  if (error) return { ok: false };
  await ensureRequiredRows(supabase, member.firm.id, planId, config);
  await markInProgress(supabase, planId);
  revalidatePlan();
  return { ok: true };
}

export async function updateReportSections(planId: string, sections: unknown) {
  await requireMember();
  const supabase = await createClient();
  const { data: plan } = await supabase.from("plans").select("config").eq("id", planId).single();
  if (!plan) return { ok: false };
  const config = parsePlanConfig(plan.config);
  config.reportSections = sanitizeKeyList(sections, [...REPORT_SECTION_KEYS]) as PlanConfig["reportSections"];
  const { error } = await supabase.from("plans").update({ config }).eq("id", planId);
  revalidatePlan();
  return { ok: !error };
}

export async function updateHiddenInsights(planId: string, hidden: unknown) {
  await requireMember();
  const supabase = await createClient();
  const { data: plan } = await supabase.from("plans").select("config").eq("id", planId).single();
  if (!plan) return { ok: false };
  const config = parsePlanConfig({ ...(plan.config as object), hiddenInsights: hidden });
  const { error } = await supabase.from("plans").update({ config }).eq("id", planId);
  revalidatePlan();
  return { ok: !error };
}

export async function markStepVisited(planId: string, step: string) {
  await requireMember();
  if (!isStepKey(step)) return;
  const supabase = await createClient();
  const { data: plan } = await supabase.from("plans").select("config, current_step").eq("id", planId).single();
  if (!plan) return;
  const config = parsePlanConfig(plan.config);
  if (config.visitedSteps.includes(step) && plan.current_step === step) return;
  if (!config.visitedSteps.includes(step)) config.visitedSteps.push(step);
  await supabase.from("plans").update({ config, current_step: step }).eq("id", planId);
  revalidatePlan();
}

export async function updatePlanInputs(planId: string, raw: unknown) {
  await requireMember();
  const supabase = await createClient();
  const inputs = sanitizePlanInputs(raw);
  const { error } = await supabase.from("plans").update({ inputs }).eq("id", planId);
  if (error) return { ok: false };
  await markInProgress(supabase, planId);
  revalidatePlan();
  return { ok: true };
}

export async function addAsset(planId: string, type: string): Promise<{ ok: boolean; asset?: AssetRow }> {
  const member = await requireMember();
  const def = getAssetType(type);
  if (!def) return { ok: false };
  const supabase = await createClient();
  const { count } = await supabase.from("assets").select("id", { count: "exact", head: true }).eq("plan_id", planId).eq("type", type);
  if (!def.multiple && (count ?? 0) > 0) return { ok: false };
  const { data, error } = await supabase
    .from("assets")
    .insert({
      firm_id: member.firm.id,
      plan_id: planId,
      side: def.side,
      type: def.type,
      tax_box: def.taxBox,
      label: "",
      value: null,
      metadata: def.defaults ?? {},
      sort_order: (count ?? 0) + 1,
    })
    .select("*")
    .single();
  if (error || !data) return { ok: false };
  await markInProgress(supabase, planId);
  revalidatePlan();
  return { ok: true, asset: normalizeAsset(data) };
}

export async function updateAsset(assetId: string, patch: { label?: unknown; value?: unknown; metadata?: unknown }) {
  await requireMember();
  const supabase = await createClient();
  const { data: row } = await supabase.from("assets").select("type, plan_id").eq("id", assetId).single();
  if (!row) return { ok: false };
  const clean = sanitizeAssetPatch(row.type, patch);
  const { error } = await supabase
    .from("assets")
    .update({ ...clean, source: clean.metadata._fromDocument?.length ? "document" : "handmatig" })
    .eq("id", assetId);
  if (error) return { ok: false };
  await markInProgress(supabase, row.plan_id);
  revalidatePlan();
  return { ok: true, value: clean.value };
}

export async function deleteAsset(assetId: string) {
  await requireMember();
  const supabase = await createClient();
  const { error } = await supabase.from("assets").delete().eq("id", assetId);
  revalidatePlan();
  return { ok: !error };
}

export async function goToStep(clientId: string, planId: string, step: string) {
  redirect(`/clienten/${clientId}/plannen/${planId}/${isStepKey(step) ? step : "configuratie"}`);
}

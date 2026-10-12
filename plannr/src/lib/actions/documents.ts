"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { extractDocument } from "@/lib/extraction/extract-document";
import { planExtractionChanges } from "@/lib/extraction/apply";
import { getAssetType } from "@/lib/plan/definitions";
import { loadPlan } from "@/lib/plan/load";
import { sanitizeAssetPatch } from "@/lib/plan/sanitize";
import type { DocumentType } from "@/lib/plan/types";

export interface RegisterResult {
  ok: boolean;
  error?: string;
  appliedCount?: number;
  notes?: string[];
}

/**
 * Called after the browser has uploaded a file to the private "documents"
 * bucket. Records it, runs extraction, and pre-fills the plan.
 */
export async function registerDocument(
  planId: string,
  input: { type: DocumentType; path: string; fileName: string },
): Promise<RegisterResult> {
  const member = await requireMember();
  if (input.type !== "ib_aangifte" && input.type !== "jaarrekening") return { ok: false, error: "Onbekend documenttype." };
  if (!input.path.startsWith(`${member.firm.id}/${planId}/`)) return { ok: false, error: "Ongeldig bestandspad." };

  const bundle = await loadPlan(planId);
  if (!bundle) return { ok: false, error: "Plan niet gevonden." };
  const supabase = await createClient();

  const fileName = input.fileName.slice(0, 200);
  const { data: doc, error: insertError } = await supabase
    .from("documents")
    .insert({
      firm_id: member.firm.id,
      plan_id: planId,
      type: input.type,
      file_path: input.path,
      file_name: fileName,
      uploaded_by: member.userId,
    })
    .select("id")
    .single();
  if (insertError || !doc) return { ok: false, error: "Het document kon niet worden opgeslagen." };

  try {
    const { data: blob, error: downloadError } = await supabase.storage.from("documents").download(input.path);
    if (downloadError || !blob) throw new Error("download");
    const extracted = await extractDocument(new File([blob], fileName, { type: blob.type }), input.type);
    const changes = planExtractionChanges(extracted, bundle.config, bundle.inputs, bundle.assets);

    if (changes.inputs) await supabase.from("plans").update({ inputs: changes.inputs }).eq("id", planId);
    for (const u of changes.updates) {
      const type = bundle.assets.find((a) => a.id === u.id)!.type;
      await supabase
        .from("assets")
        .update({ ...sanitizeAssetPatch(type, u), source: "document" })
        .eq("id", u.id);
    }
    if (changes.inserts.length > 0) {
      await supabase.from("assets").insert(
        changes.inserts.map((i, idx) => {
          const def = getAssetType(i.type)!;
          return {
            firm_id: member.firm.id,
            plan_id: planId,
            side: def.side,
            type: def.type,
            tax_box: def.taxBox,
            ...sanitizeAssetPatch(i.type, i),
            source: "document",
            sort_order: 100 + idx,
          };
        }),
      );
    }
    await supabase
      .from("documents")
      .update({ extraction_status: "verwerkt", extracted_data: extracted, year: extracted.year })
      .eq("id", doc.id);
    await supabase.from("plans").update({ status: "in_bewerking" }).eq("id", planId).eq("status", "concept");

    revalidatePath("/clienten/[clientId]/plannen/[planId]", "layout");
    return { ok: true, appliedCount: changes.appliedCount, notes: extracted.notes };
  } catch {
    await supabase.from("documents").update({ extraction_status: "mislukt" }).eq("id", doc.id);
    revalidatePath("/clienten/[clientId]/plannen/[planId]", "layout");
    return { ok: false, error: "Het document is opgeslagen, maar kon niet worden uitgelezen. Vul de gegevens handmatig in." };
  }
}

export async function deleteDocument(documentId: string) {
  await requireMember();
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("file_path").eq("id", documentId).single();
  if (!doc) return { ok: false };
  await supabase.storage.from("documents").remove([doc.file_path]);
  const { error } = await supabase.from("documents").delete().eq("id", documentId);
  revalidatePath("/clienten/[clientId]/plannen/[planId]", "layout");
  return { ok: !error };
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember, requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface FormState {
  error?: string;
}

function text(formData: FormData, key: string, max = 200): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export async function createClientAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await requireMember();
  const firstName = text(formData, "first_name", 100);
  const lastName = text(formData, "last_name", 100);
  const companyName = text(formData, "company_name");
  if (!firstName || !lastName) return { error: "Vul een voornaam en achternaam in." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      firm_id: member.firm.id,
      first_name: firstName,
      last_name: lastName,
      company_name: companyName || null,
      created_by: member.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "De cliënt kon niet worden opgeslagen." };
  revalidatePath("/clienten");
  redirect(`/clienten/${data.id}`);
}

export async function updateClientAction(clientId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireMember();
  const firstName = text(formData, "first_name", 100);
  const lastName = text(formData, "last_name", 100);
  const companyName = text(formData, "company_name");
  if (!firstName || !lastName) return { error: "Vul een voornaam en achternaam in." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({ first_name: firstName, last_name: lastName, company_name: companyName || null })
    .eq("id", clientId);
  if (error) return { error: "Wijzigen is niet gelukt." };
  revalidatePath(`/clienten/${clientId}`);
  return {};
}

export async function deleteClientAction(clientId: string) {
  await requireOwner();
  const supabase = await createClient();
  // Files in storage are removed first; database rows cascade.
  const { data: plans } = await supabase.from("plans").select("id").eq("client_id", clientId);
  const planIds = (plans ?? []).map((p) => p.id as string);
  if (planIds.length > 0) {
    const { data: docs } = await supabase.from("documents").select("file_path").in("plan_id", planIds);
    const docPaths = (docs ?? []).map((d) => d.file_path as string);
    if (docPaths.length > 0) await supabase.storage.from("documents").remove(docPaths);
    const { data: exps } = await supabase.from("exports").select("pdf_path").in("plan_id", planIds);
    const pdfPaths = (exps ?? []).map((e) => e.pdf_path as string);
    if (pdfPaths.length > 0) await supabase.storage.from("exports").remove(pdfPaths);
  }
  const { error } = await supabase.from("clients").delete().eq("id", clientId);
  if (error) throw new Error("Verwijderen is niet gelukt.");
  revalidatePath("/clienten");
  redirect("/clienten?melding=client-verwijderd");
}

// --- Notes ------------------------------------------------------------------

export async function addNoteAction(clientId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const member = await requireMember();
  const content = text(formData, "content", 10000);
  if (!content) return { error: "Schrijf eerst een notitie." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("client_notes")
    .insert({ firm_id: member.firm.id, client_id: clientId, author_id: member.userId, content });
  if (error) return { error: "De notitie kon niet worden opgeslagen." };
  revalidatePath(`/clienten/${clientId}`);
  return {};
}

export async function updateNoteAction(noteId: string, clientId: string, content: string): Promise<FormState> {
  await requireMember();
  const trimmed = content.trim().slice(0, 10000);
  if (!trimmed) return { error: "Een notitie mag niet leeg zijn." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("client_notes").update({ content: trimmed }).eq("id", noteId).select("id");
  if (error || !data?.length) return { error: "Je kunt alleen je eigen notities wijzigen." };
  revalidatePath(`/clienten/${clientId}`);
  return {};
}

export async function deleteNoteAction(noteId: string, clientId: string): Promise<FormState> {
  await requireMember();
  const supabase = await createClient();
  const { data, error } = await supabase.from("client_notes").delete().eq("id", noteId).select("id");
  if (error || !data?.length) return { error: "Je kunt alleen je eigen notities verwijderen." };
  revalidatePath(`/clienten/${clientId}`);
  return {};
}

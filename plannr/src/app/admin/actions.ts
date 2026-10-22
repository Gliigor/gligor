"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function adminSignIn(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Onjuist e-mailadres of wachtwoord." };
  const { data: isAdmin } = await supabase.rpc("is_super_admin");
  if (isAdmin !== true) {
    await supabase.auth.signOut();
    return { error: "Dit account heeft geen toegang tot het beheer." };
  }
  redirect("/admin");
}

export async function adminSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/inloggen");
}

/** Three extra AI design attempts for a firm. The database checks the caller is a super admin. */
export async function addDesignAttemptsAction(firmId: string) {
  const supabase = await createClient();
  await supabase.rpc("admin_add_design_attempts", { p_firm_id: firmId, p_count: 3 });
  revalidatePath("/admin");
}

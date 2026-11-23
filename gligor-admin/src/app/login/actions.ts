"use server";

import { adminEmail, siteUrl } from "@/lib/env";
import { createSupabaseServer } from "@/lib/supabase/server";

export type LoginState = { sent?: boolean; error?: string } | null;

/**
 * Stuurt een inloglink, maar alleen naar ADMIN_EMAIL. Voor elk ander adres
 * tonen we dezelfde melding, zodat niet te achterhalen is welk adres werkt.
 */
export async function sendMagicLink(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) return { error: "Vul een geldig e-mailadres in." };
  if (email === adminEmail()) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      // Geen nieuwe accounts: de beheerder wordt eenmalig aangemaakt in Supabase (zie README).
      options: { emailRedirectTo: `${siteUrl()}/auth/callback`, shouldCreateUser: false },
    });
    if (error) return { error: `Versturen lukte niet: ${error.message}` };
  }
  return { sent: true };
}

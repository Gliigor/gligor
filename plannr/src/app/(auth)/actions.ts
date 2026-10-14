"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath, siteUrl } from "@/lib/site-url";

export interface AuthState {
  error?: string;
  message?: string;
}

function text(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = text(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Vul je e-mailadres en wachtwoord in." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Bevestig eerst je e-mailadres via de link in je mailbox." };
    }
    return { error: "Onjuist e-mailadres of wachtwoord." };
  }
  await supabase.rpc("record_login");
  redirect(safeNextPath(formData.get("next")));
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const name = text(formData, "name");
  const email = text(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const firmName = text(formData, "firm_name");
  const invited = formData.get("invited") === "1";

  if (!name || !email) return { error: "Vul je naam en e-mailadres in." };
  if (password.length < 8) return { error: "Kies een wachtwoord van minimaal 8 tekens." };
  if (!invited && !firmName) return { error: "Vul de naam van je kantoor in." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // firm_name is ignored by the database when a pending invitation exists for this e-mail.
      data: invited ? { name } : { name, firm_name: firmName },
      emailRedirectTo: `${await siteUrl()}/auth/confirm?next=/clienten`,
    },
  });
  if (error) {
    if (error.code === "user_already_exists") return { error: "Er bestaat al een account met dit e-mailadres." };
    if (error.code === "weak_password") return { error: "Dit wachtwoord is te zwak. Kies een sterker wachtwoord." };
    return { error: "Registreren is niet gelukt. Probeer het later opnieuw." };
  }
  if (data.session) {
    await supabase.rpc("record_login");
    redirect("/clienten");
  }
  return { message: "Bijna klaar! We hebben je een e-mail gestuurd. Klik op de link om je account te bevestigen." };
}

export async function setPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const name = text(formData, "name");
  if (password.length < 8) return { error: "Kies een wachtwoord van minimaal 8 tekens." };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { error: "Je sessie is verlopen. Open de link uit de e-mail opnieuw." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Wachtwoord instellen is niet gelukt. Probeer een ander wachtwoord." };
  if (name) await supabase.from("users").update({ name }).eq("id", claims.claims.sub);
  await supabase.rpc("record_login");
  redirect("/clienten");
}

/** "Opnieuw controleren" on /geen-kantoor: accepts an invitation that arrived after login. */
export async function recheckMembership() {
  const supabase = await createClient();
  await supabase.rpc("record_login");
  redirect("/clienten");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/inloggen");
}

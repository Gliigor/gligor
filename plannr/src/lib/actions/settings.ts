"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/site-url";
import { isFontName } from "@/lib/house-style/fonts";
import { generateHouseStyleFromWebsite, type StyleSuggestion } from "@/lib/house-style/generate-from-website";
import { isHexColor, isLayoutVariant } from "@/lib/house-style/types";
import { getAiReaderStatus } from "@/lib/extraction/ai/config";

// Every action here starts with requireOwner(): owner-only rules are enforced
// on the server (and again by RLS in the database), not just hidden in the UI.

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
  link?: string;
}

export async function updateFirmAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const member = await requireOwner();
  const name = String(formData.get("name") ?? "").trim().slice(0, 200);
  if (!name) return { ok: false, error: "Vul de naam van het kantoor in." };
  const supabase = await createClient();
  const { error } = await supabase.from("firms").update({ name }).eq("id", member.firm.id);
  if (error) return { ok: false, error: "Opslaan is niet gelukt." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Opgeslagen." };
}

export async function invitePlannerAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const member = await requireOwner();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Vul een geldig e-mailadres in." };

  const supabase = await createClient();
  const { data: existing } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
  if (existing) return { ok: false, error: "Deze persoon werkt al bij jouw kantoor." };

  const { data: pending } = await supabase.from("invitations").select("id").eq("email", email).is("accepted_at", null).maybeSingle();
  if (!pending) {
    // An old, accepted invitation for this address (person left the firm) is replaced.
    await supabase.from("invitations").delete().eq("email", email);
    const { error } = await supabase.from("invitations").insert({ firm_id: member.firm.id, email, invited_by: member.userId });
    if (error) return { ok: false, error: "De uitnodiging kon niet worden opgeslagen." };
  }

  const base = await siteUrl();
  const signupLink = `${base}/registreren?uitnodiging=${encodeURIComponent(email)}`;
  revalidatePath("/instellingen");

  const admin = createAdminClient();
  if (admin) {
    const { error: mailError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${base}/auth/confirm?next=/wachtwoord-instellen`,
    });
    if (!mailError) return { ok: true, message: `Uitnodiging verstuurd naar ${email}.` };
    if (mailError.code === "email_exists") {
      return {
        ok: true,
        message:
          "Er bestaat al een Plannr-account met dit e-mailadres. Hoort deze persoon nog niet bij een kantoor, dan wordt hij of zij bij de volgende keer inloggen aan jouw kantoor gekoppeld.",
      };
    }
  }
  return {
    ok: true,
    message: "Uitnodiging klaargezet. Stuur je collega deze link; na registreren hoort hij of zij automatisch bij je kantoor:",
    link: signupLink,
  };
}

export async function revokeInvitationAction(invitationId: string): Promise<ActionResult> {
  await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase.from("invitations").delete().eq("id", invitationId).is("accepted_at", null);
  revalidatePath("/instellingen");
  return { ok: !error };
}

// --- House style -------------------------------------------------------------------

export async function saveHouseStyleAction(input: {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontHeading: string;
  fontBody: string;
  layoutVariant: string;
}): Promise<ActionResult> {
  const member = await requireOwner();
  if (![input.primaryColor, input.secondaryColor, input.accentColor].every(isHexColor)) {
    return { ok: false, error: "Ongeldige kleur." };
  }
  if (!isFontName(input.fontHeading) || !isFontName(input.fontBody)) return { ok: false, error: "Kies een lettertype uit de lijst." };
  if (!isLayoutVariant(input.layoutVariant)) return { ok: false, error: "Kies een lay-out." };

  const supabase = await createClient();
  const row = {
    primary_color: input.primaryColor.toUpperCase(),
    secondary_color: input.secondaryColor.toUpperCase(),
    accent_color: input.accentColor.toUpperCase(),
    font_heading: input.fontHeading,
    font_body: input.fontBody,
    layout_variant: input.layoutVariant,
  };
  const { data: existing } = await supabase.from("house_styles").select("id").eq("is_active", true).maybeSingle();
  const { error } = existing
    ? await supabase.from("house_styles").update(row).eq("id", existing.id)
    : await supabase.from("house_styles").insert({ ...row, firm_id: member.firm.id });
  if (error) return { ok: false, error: "Opslaan is niet gelukt." };
  revalidatePath("/instellingen/huisstijl");
  return { ok: true, message: "Huisstijl opgeslagen. Alle nieuwe exports van je kantoor gebruiken deze stijl." };
}

/** Called after the browser uploaded a logo to logos/<firm_id>/... */
export async function setLogoAction(path: string | null): Promise<ActionResult> {
  const member = await requireOwner();
  if (path !== null && !path.startsWith(`${member.firm.id}/`)) return { ok: false, error: "Ongeldig pad." };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("house_styles").select("id, logo_path").eq("is_active", true).maybeSingle();
  if (!existing) return { ok: false, error: "Geen huisstijl gevonden." };
  const { error } = await supabase.from("house_styles").update({ logo_path: path }).eq("id", existing.id);
  if (error) return { ok: false, error: "Opslaan is niet gelukt." };
  if (existing.logo_path && existing.logo_path !== path) await supabase.storage.from("logos").remove([existing.logo_path]);
  revalidatePath("/instellingen/huisstijl");
  return { ok: true };
}

export async function suggestFromWebsiteAction(website: string): Promise<ActionResult & { suggestion?: StyleSuggestion }> {
  const member = await requireOwner();
  const trimmed = website.trim().slice(0, 300);
  if (!trimmed) return { ok: false, error: "Vul het adres van je website in." };
  try {
    const suggestion = await generateHouseStyleFromWebsite(trimmed);
    const supabase = await createClient();
    await supabase.from("firms").update({ website_url: trimmed }).eq("id", member.firm.id);
    return { ok: true, suggestion };
  } catch (e) {
    const message = e instanceof Error && /adres|website|toegestaan/.test(e.message) ? e.message : "De website kon niet worden geanalyseerd.";
    return { ok: false, error: message };
  }
}

export async function setAiReaderAction(enabled: boolean): Promise<ActionResult> {
  const member = await requireOwner();
  if (enabled && !getAiReaderStatus().configured) {
    return { ok: false, error: "De AI-lezer is op deze server nog niet ingesteld." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("firms")
    .update({ ai_extraction_enabled: enabled, ai_extraction_changed_at: new Date().toISOString() })
    .eq("id", member.firm.id);
  if (error) return { ok: false, error: "Opslaan is niet gelukt." };
  revalidatePath("/", "layout");
  return { ok: true, message: enabled ? "Automatisch uitlezen staat aan." : "Automatisch uitlezen staat uit." };
}

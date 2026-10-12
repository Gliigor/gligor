import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/site-url";

/**
 * Landing URL for links in Supabase e-mails (sign-up confirmation, invitations).
 * Supports both the PKCE `code` flow and the `token_hash` template flow.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"));

  const supabase = await createClient();
  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }

  if (!ok) return NextResponse.redirect(new URL("/inloggen?melding=link-ongeldig", origin));
  await supabase.rpc("record_login");
  const target = type === "invite" || type === "recovery" ? "/wachtwoord-instellen" : next;
  return NextResponse.redirect(new URL(target, origin));
}

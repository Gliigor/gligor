import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase/server";
import { adminEmail } from "@/lib/env";
import { withSystem } from "@/lib/db";

/**
 * Hier komt de inloglink op uit. Alleen ADMIN_EMAIL komt erdoor. De eerste
 * keer wordt dit account vastgelegd als de enige beheerder; daarna kan geen
 * ander account (ook niet met hetzelfde adres) die plek innemen.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const to = (path: string) => NextResponse.redirect(new URL(path, url.origin));
  const supabase = await createSupabaseServer();

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") ?? "email") as EmailOtpType;
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("geen code") };
  if (error) return to("/login?fout=link");

  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  const email = String(data?.claims?.email ?? "").toLowerCase();
  if (!sub || email !== adminEmail()) {
    await supabase.auth.signOut();
    return to("/login?fout=geen-toegang");
  }

  const allowed = await withSystem(async (q) => {
    const [existing] = await q<{ user_id: string }>("select user_id from admins");
    if (!existing) {
      await q("insert into admins (user_id, email) values ($1, $2)", [sub, email]);
      return true;
    }
    return existing.user_id === sub;
  });
  if (!allowed) {
    await supabase.auth.signOut();
    return to("/login?fout=geen-toegang");
  }
  return to("/login/2fa");
}

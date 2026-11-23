import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { adminEmail, isDemo } from "./env";
import { withUser, type Claims, type Query } from "./db";
import { createSupabaseServer } from "./supabase/server";
import { DEMO_ADMIN_ID } from "./seed";

export interface AdminSession {
  claims: Claims;
  email: string;
  demo: boolean;
}

type SessionState =
  | { state: "ok"; session: AdminSession }
  | { state: "anon" }
  | { state: "needs-mfa"; email: string }
  | { state: "forbidden"; email: string };

/** Bepaalt per verzoek (gecachet) wie er is ingelogd en of dat de beheerder met 2FA is. */
export const getSessionState = cache(async (): Promise<SessionState> => {
  if (isDemo()) {
    const email = adminEmail();
    return {
      state: "ok",
      session: { claims: { sub: DEMO_ADMIN_ID, email, aal: "aal2", role: "authenticated" }, email, demo: true },
    };
  }
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as Claims | undefined;
  if (!claims?.sub) return { state: "anon" };
  const email = String(claims.email ?? "").toLowerCase();
  if (email !== adminEmail()) return { state: "forbidden", email };
  if (claims.aal !== "aal2") return { state: "needs-mfa", email };
  // De database bevestigt zelf dat dit de geregistreerde beheerder is (RLS op admins).
  const rows = await withUser(claims, (q) => q("select 1 from admins where user_id = $1", [claims.sub]));
  if (rows.length === 0) return { state: "forbidden", email };
  return { state: "ok", session: { claims, email, demo: false } };
});

/** Voor elke pagina en actie in het dashboard. Stuurt anders door naar login of 2FA. */
export async function requireAdmin(): Promise<AdminSession> {
  const s = await getSessionState();
  if (s.state === "ok") return s.session;
  if (s.state === "needs-mfa") redirect("/login/2fa");
  if (s.state === "forbidden") redirect("/login?fout=geen-toegang");
  redirect("/login");
}

/** Voert databasewerk uit als de ingelogde beheerder (Row Level Security actief). */
export async function asAdmin<T>(fn: (q: Query, session: AdminSession) => Promise<T>): Promise<T> {
  const session = await requireAdmin();
  return withUser(session.claims, (q) => fn(q, session));
}

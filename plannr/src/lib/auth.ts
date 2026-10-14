import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { FirmRow, UserRow } from "@/lib/plan/types";

export interface Member {
  userId: string;
  profile: UserRow;
  firm: FirmRow;
  isOwner: boolean;
}

/** The verified auth user id for this request (null when logged out). Cached per request. */
export const getAuthUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
});

/** The logged-in firm member, or null (logged out / not linked to a firm). Cached per request. */
export const getMember = cache(async (): Promise<Member | null> => {
  const userId = await getAuthUserId();
  if (!userId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("*, firm:firms(*)")
    .eq("id", userId)
    .maybeSingle();
  if (!data || !data.firm) return null;
  const { firm, ...profile } = data as UserRow & { firm: FirmRow };
  return { userId, profile, firm, isOwner: profile.role === "owner" };
});

/** For pages and actions inside the planner app. */
export async function requireMember(): Promise<Member> {
  const userId = await getAuthUserId();
  if (!userId) redirect("/inloggen");
  const member = await getMember();
  if (!member) redirect("/geen-kantoor");
  return member;
}

/** Owner-only pages and actions. RLS enforces the same rule in the database. */
export async function requireOwner(): Promise<Member> {
  const member = await requireMember();
  if (!member.isOwner) redirect("/clienten?melding=alleen-eigenaar");
  return member;
}

export const isSuperAdmin = cache(async (): Promise<boolean> => {
  const userId = await getAuthUserId();
  if (!userId) return false;
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_super_admin");
  return data === true;
});

import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

/**
 * Service-role client that BYPASSES Row Level Security. Only used for sending
 * invitation e-mails (Supabase Auth admin API). Optional: when
 * SUPABASE_SECRET_KEY is not set, invitations still work via a sign-up link.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) return null;
  return createClient(supabaseUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

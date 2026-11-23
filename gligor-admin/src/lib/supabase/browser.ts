import { createBrowserClient } from "@supabase/ssr";

/** Supabase Auth in de browser (alleen gebruikt voor de 2FA-stap). */
export function createSupabaseBrowser() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}

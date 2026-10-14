// Central place for Supabase configuration. Throws a readable error when the
// app is started without the environment variables from README.md.

export function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL ontbreekt. Zie README.md, stap 3.");
  return url;
}

export function supabasePublishableKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ontbreekt. Zie README.md, stap 3.");
  return key;
}

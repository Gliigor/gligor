/**
 * Omgevingsvariabelen op één plek. Zie README.md voor de uitleg per variabele.
 */

/**
 * Demo-modus: geen login, een lokale database (PGlite) met 3 verzonnen klanten,
 * en e-mails worden niet echt verstuurd. Staat aan met DEMO_MODE=true, of
 * automatisch tijdens `next dev` als er nog geen DATABASE_URL is.
 * Nooit aanzetten op de echte, publieke omgeving.
 */
export function isDemo(): boolean {
  if (process.env.DEMO_MODE === "true") return true;
  if (process.env.DEMO_MODE === "false") return false;
  return !process.env.DATABASE_URL && process.env.NODE_ENV !== "production";
}

export function adminEmail(): string {
  const v = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (v) return v;
  if (isDemo()) return "gligor@voorbeeld.example";
  throw new Error("ADMIN_EMAIL ontbreekt. Zie README.md.");
}

/** Afzender voor alle uitgaande mail, bijv. "Gligor van Gligor.ai <hello@gligor.ai>". */
export function emailFrom(): string {
  return process.env.EMAIL_FROM ?? "Gligor van Gligor.ai <hello@gligor.ai>";
}

/** Alleen het adres uit EMAIL_FROM. */
export function fromAddress(): string {
  const m = emailFrom().match(/<([^>]+)>/);
  return (m ? m[1] : emailFrom()).trim().toLowerCase();
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "http://localhost:3100").replace(
    /^(?!https?:\/\/)/,
    "https://",
  ).replace(/\/$/, "");
}

export function demoDataDir(): string {
  return process.env.DEMO_DATA_DIR ?? ".demo-data";
}

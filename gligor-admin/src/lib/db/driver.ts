/**
 * Eén kleine interface voor de database, met twee uitvoeringen:
 * - postgres.js tegen Supabase (productie)
 * - PGlite, Postgres in WebAssembly (demo-modus en tests)
 * Beide voeren exact dezelfde SQL uit, inclusief Row Level Security.
 */

export type Query = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;

/** JWT-claims van de ingelogde gebruiker (minimaal sub en aal). */
export type Claims = Record<string, unknown> & { sub: string };

export interface Driver {
  /**
   * Draait `fn` in één transactie. Met claims gebeurt dat als rol
   * "authenticated" met die claims (RLS actief); zonder claims als
   * database-eigenaar (voor webhooks en de dagelijkse job).
   */
  transaction<T>(claims: Claims | null, fn: (q: Query) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** Postgres-tijdstempel → ISO-string in UTC. */
export function parseTimestamp(v: string): string {
  let s = v.trim().replace(" ", "T");
  if (/[+-]\d\d$/.test(s)) s += ":00";
  else if (!/(Z|[+-]\d\d:\d\d)$/.test(s)) s += "Z";
  return new Date(s).toISOString();
}

/** JS-array → Postgres-arrayliteral, voor parameters als $1::text[]. */
export function pgArray(values: string[]): string {
  return `{${values.map((v) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")}}`;
}

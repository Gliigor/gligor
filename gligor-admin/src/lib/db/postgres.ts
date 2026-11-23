import postgres from "postgres";
import { parseTimestamp, type Claims, type Driver, type Query } from "./driver";

/**
 * Productie: rechtstreekse verbinding met de Supabase-database (Supavisor,
 * transaction mode, poort 6543). Elke gebruikersactie draait in een transactie
 * als rol "authenticated" met de geverifieerde JWT-claims, dus RLS geldt.
 */
export function createPostgresDriver(url: string): Driver {
  const sql = postgres(url, {
    prepare: false, // vereist voor de transaction-pooler van Supabase
    max: 3,
    idle_timeout: 20,
    connection: { TimeZone: "UTC" },
    types: {
      dateOnly: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x },
      timestamp: {
        to: 1184,
        from: [1114, 1184],
        serialize: (x: string | Date) => (x instanceof Date ? x.toISOString() : x),
        parse: (x: string) => parseTimestamp(x),
      },
      numeric: { to: 1700, from: [1700], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
      int8: { to: 20, from: [20], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
    },
  });

  return {
    async transaction<T>(claims: Claims | null, fn: (q: Query) => Promise<T>): Promise<T> {
      return sql.begin(async (tx) => {
        if (claims) {
          await tx.unsafe("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
          await tx.unsafe("set local role authenticated");
        }
        const q: Query = async <R,>(text: string, params: unknown[] = []) =>
          (await tx.unsafe(text, params as never[])) as unknown as R[];
        return fn(q);
      }) as Promise<T>;
    },
    async close() {
      await sql.end();
    },
  };
}

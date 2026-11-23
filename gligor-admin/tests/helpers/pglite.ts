import { createPgliteDriver } from "../../src/lib/db/pglite";
import type { Claims, Query } from "../../src/lib/db/driver";

export const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
export const ADMIN_CLAIMS: Claims = { sub: ADMIN_ID, email: "gligor@voorbeeld.example", aal: "aal2", role: "authenticated" };

/** Verse in-memory database met alle migraties en één beheerder. */
export async function createTestDb() {
  const { driver } = await createPgliteDriver();
  await driver.transaction(null, (q) =>
    q("insert into admins (user_id, email) values ($1, 'gligor@voorbeeld.example')", [ADMIN_ID]),
  );
  return {
    driver,
    raw: <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
      driver.transaction(null, (q) => q<T>(sql, params)),
    as: <T,>(claims: object, fn: (q: Query) => Promise<T>) => driver.transaction(claims as Claims, fn),
    close: () => driver.close(),
  };
}

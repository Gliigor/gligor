import "server-only";
import path from "node:path";
import type { Claims, Driver, Query } from "./driver";
import { demoDataDir, isDemo } from "../env";

export type { Query, Claims } from "./driver";
export { pgArray } from "./driver";

declare global {
  var __gligorDb: Promise<Driver> | undefined;
}

async function init(): Promise<Driver> {
  if (isDemo()) {
    const { createPgliteDriver } = await import("./pglite");
    const { seedDemo, DEMO_ADMIN_ID } = await import("../seed");
    const { driver, fresh } = await createPgliteDriver({ dataDir: path.join(demoDataDir(), "db") });
    if (fresh) {
      await driver.transaction(null, async (q) => {
        await q("insert into admins (user_id, email) values ($1, 'gligor@voorbeeld.example') on conflict do nothing", [DEMO_ADMIN_ID]);
        await seedDemo(q, new Date());
      });
    }
    return driver;
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ontbreekt. Zie README.md, stap 2.");
  const { createPostgresDriver } = await import("./postgres");
  return createPostgresDriver(url);
}

/** Eén verbinding per serverproces (ook bij hot reload in development). */
export function getDriver(): Promise<Driver> {
  globalThis.__gligorDb ??= init().catch((err) => {
    globalThis.__gligorDb = undefined;
    throw err;
  });
  return globalThis.__gligorDb;
}

/** Als de ingelogde beheerder: Row Level Security is actief. */
export async function withUser<T>(claims: Claims, fn: (q: Query) => Promise<T>): Promise<T> {
  return (await getDriver()).transaction(claims, fn);
}

/** Als het systeem (webhooks, dagelijkse job): geen RLS. Alleen gebruiken na eigen controle. */
export async function withSystem<T>(fn: (q: Query) => Promise<T>): Promise<T> {
  return (await getDriver()).transaction(null, fn);
}

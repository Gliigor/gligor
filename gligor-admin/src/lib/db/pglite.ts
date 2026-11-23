import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { parseTimestamp, type Claims, type Driver, type Query } from "./driver";

const parsers = {
  20: (v: string) => Number(v), // int8
  1082: (v: string) => v, // date → 'YYYY-MM-DD'
  1114: (v: string) => parseTimestamp(v),
  1184: (v: string) => parseTimestamp(v),
  1700: (v: string) => Number(v), // numeric
};

function migrationsDir(root: string) {
  return path.join(root, "supabase", "migrations");
}

/**
 * PGlite met alle migraties. `dataDir` = map op schijf (blijft bewaard),
 * zonder dataDir draait alles in het geheugen.
 */
export async function createPgliteDriver(opts: { dataDir?: string; root?: string } = {}): Promise<{
  driver: Driver;
  fresh: boolean;
}> {
  const root = opts.root ?? process.cwd();
  const fresh = !opts.dataDir || !fs.existsSync(path.join(opts.dataDir, "PG_VERSION"));
  if (opts.dataDir) fs.mkdirSync(opts.dataDir, { recursive: true });
  const db = new PGlite({ dataDir: opts.dataDir, parsers });
  await db.exec("set timezone to 'UTC'");

  await db.exec(fs.readFileSync(path.join(root, "supabase", "local", "auth-stub.sql"), "utf8"));
  await db.exec("create table if not exists _migrations (name text primary key, applied_at timestamptz default now())");
  const done = new Set((await db.query<{ name: string }>("select name from _migrations")).rows.map((r) => r.name));
  for (const file of fs.readdirSync(migrationsDir(root)).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(file)) continue;
    await db.exec(fs.readFileSync(path.join(migrationsDir(root), file), "utf8"));
    await db.query("insert into _migrations (name) values ($1)", [file]);
  }

  // PGlite verwerkt één ding tegelijk; een eenvoudige wachtrij voorkomt botsende transacties.
  let queue: Promise<unknown> = Promise.resolve();

  const driver: Driver = {
    transaction<T>(claims: Claims | null, fn: (q: Query) => Promise<T>): Promise<T> {
      const run = () =>
        db.transaction(async (tx) => {
          if (claims) {
            await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
            await tx.exec("set local role authenticated");
          }
          const q: Query = async <R,>(sql: string, params: unknown[] = []) =>
            (await tx.query<R>(sql, params)).rows;
          return fn(q);
        });
      const result = queue.then(run, run);
      queue = result.catch(() => undefined);
      return result;
    },
    async close() {
      await db.close();
    },
  };
  return { driver, fresh };
}

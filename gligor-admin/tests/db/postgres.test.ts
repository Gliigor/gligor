/**
 * Optioneel: dezelfde services via het productie-stuurprogramma (postgres.js)
 * tegen een echte Postgres. Draait alleen met TEST_DATABASE_URL, bijv.
 *   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/gligor_test npm test
 * De database moet leeg zijn; de test zet zelf het schema neer.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createPostgresDriver } from "../../src/lib/db/postgres";
import { seedDemo } from "../../src/lib/seed";
import { loadToday } from "../../src/lib/services/today";
import { ADMIN_CLAIMS, ADMIN_ID } from "../helpers/pglite";

const url = process.env.TEST_DATABASE_URL;
process.env.DEMO_MODE = "true"; // geen echte e-mail

test("postgres.js: migraties, RLS, typen en demodata", { skip: !url && "TEST_DATABASE_URL niet gezet" }, async () => {
  const driver = createPostgresDriver(url!);
  const root = process.cwd();
  await driver.transaction(null, async (q) => {
    await q("drop schema if exists public cascade");
    await q("create schema public");
    await q("drop schema if exists auth cascade");
  });
  const files = [
    path.join(root, "supabase/local/auth-stub.sql"),
    ...fs
      .readdirSync(path.join(root, "supabase/migrations"))
      .sort()
      .map((f) => path.join(root, "supabase/migrations", f)),
  ];
  for (const f of files) await driver.transaction(null, (q) => q(fs.readFileSync(f, "utf8")));
  await driver.transaction(null, (q) => q("insert into admins (user_id, email) values ($1, 'x@voorbeeld.example')", [ADMIN_ID]));

  const now = new Date();
  await driver.transaction(ADMIN_CLAIMS, (q) => seedDemo(q, now));
  const [row] = await driver.transaction(ADMIN_CLAIMS, (q) =>
    q<{ start_date: string; monthly_fee: number; created_at: string }>("select start_date, monthly_fee, created_at from clients where start_date is not null limit 1"),
  );
  assert.match(row.start_date, /^\d{4}-\d{2}-\d{2}$/, "datum als string");
  assert.equal(typeof row.monthly_fee, "number", "numeric als getal");
  assert.match(row.created_at, /^\d{4}-\d{2}-\d{2}T.*Z$/, "tijdstip als ISO-string");

  const { items, summary } = await driver.transaction(ADMIN_CLAIMS, (q) => loadToday(q, now));
  assert.equal(summary.activeClients, 2);
  assert.ok(items.length >= 6);

  const hidden = await driver.transaction({ sub: ADMIN_ID, aal: "aal1" }, (q) => q("select * from clients"));
  assert.equal(hidden.length, 0, "zonder 2FA geen gegevens");
  await driver.close();
});

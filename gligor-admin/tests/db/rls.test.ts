/**
 * Draait alle migraties op PGlite (echte Postgres in WebAssembly, geen Docker
 * nodig) en controleert de Row Level Security.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb, ADMIN_ID } from "../helpers/pglite";

const OTHER_ID = "22222222-2222-4222-8222-222222222222";

test("RLS: alleen de beheerder met 2FA (aal2) ziet en wijzigt gegevens", async () => {
  const db = await createTestDb();
  await db.raw("insert into clients (company, email) values ('Testbedrijf', 'test@voorbeeld.example')");

  const count = (claims: object) =>
    db.as(claims, async (q) => (await q<{ n: number }>("select count(*)::int as n from clients"))[0].n);

  assert.equal(await count({ sub: ADMIN_ID, aal: "aal2" }), 1, "beheerder met 2FA ziet de klant");
  assert.equal(await count({ sub: ADMIN_ID, aal: "aal1" }), 0, "zonder tweede factor: niets");
  assert.equal(await count({ sub: OTHER_ID, aal: "aal2" }), 0, "andere gebruiker: niets");

  await assert.rejects(
    db.as({ sub: OTHER_ID, aal: "aal2" }, (q) => q("insert into clients (company) values ('Indringer')")),
    /row-level security/,
  );
  await db.close();
});

test("RLS: auditlog is alleen-lezen en legt wijzigingen vast", async () => {
  const db = await createTestDb();
  const admin = { sub: ADMIN_ID, aal: "aal2" };
  const [client] = await db.as(admin, (q) =>
    q<{ id: string }>("insert into clients (company) values ('Audit BV') returning id"),
  );
  await db.as(admin, (q) => q("update clients set city = 'Utrecht' where id = $1", [client.id]));

  const rows = await db.as(admin, (q) =>
    q<{ action: string; actor: string }>("select action, actor from audit_log where client_id = $1 order by id", [client.id]),
  );
  assert.deepEqual(rows.map((r) => r.action), ["insert", "update"]);
  assert.equal(rows[0].actor, ADMIN_ID);

  await assert.rejects(db.as(admin, (q) => q("delete from audit_log")), /permission denied/);
  await db.close();
});

test("AVG: forget_client verwijdert alle gegevens en anonimiseert het auditlog", async () => {
  const db = await createTestDb();
  const admin = { sub: ADMIN_ID, aal: "aal2" };
  const [client] = await db.as(admin, (q) =>
    q<{ id: string }>("insert into clients (company, email) values ('Weg BV', 'weg@voorbeeld.example') returning id"),
  );
  await db.as(admin, (q) =>
    q("insert into log_entries (client_id, summary) values ($1, 'Gesprek over privacy')", [client.id]),
  );
  await db.as(admin, (q) => q("select forget_client($1)", [client.id]));

  const left = await db.raw<{ n: number }>(
    "select (select count(*) from clients where id = $1) + (select count(*) from log_entries where client_id = $1) as n",
    [client.id],
  );
  assert.equal(Number(left[0].n), 0);
  const audit = await db.raw<{ pii: number }>(
    "select count(*)::int as pii from audit_log where client_id = $1 and (old_data is not null or new_data is not null)",
    [client.id],
  );
  assert.equal(audit[0].pii, 0, "geen persoonsgegevens meer in het auditlog");

  // Een niet-beheerder mag dit niet.
  await assert.rejects(
    db.as({ sub: OTHER_ID, aal: "aal2" }, (q) => q("select forget_client($1)", [client.id])),
    /geen toegang/,
  );
  await db.close();
});

test("Logboek werkt het laatste contactmoment bij", async () => {
  const db = await createTestDb();
  const [client] = await db.raw<{ id: string }>("insert into clients (company) values ('Contact BV') returning id");
  await db.raw("insert into log_entries (client_id, summary, occurred_at) values ($1, 'Bellen', '2026-11-01T10:00:00Z')", [
    client.id,
  ]);
  const [row] = await db.raw<{ last_contact_at: string }>("select last_contact_at from clients where id = $1", [client.id]);
  assert.equal(row.last_contact_at, "2026-11-01T10:00:00.000Z");
  await db.close();
});

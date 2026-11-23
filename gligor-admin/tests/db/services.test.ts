/**
 * Integratietests: services tegen een echte (PGlite) database, als de beheerder
 * met RLS actief, net als in de app.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb, ADMIN_CLAIMS } from "../helpers/pglite";
import { seedDemo } from "../../src/lib/seed";
import { loadToday, runDaily } from "../../src/lib/services/today";
import { createClient, moveStage, getClient } from "../../src/lib/services/clients";
import { ingestInbound, replyToTicket, type InboundEmail } from "../../src/lib/services/tickets";
import { actionsToTasks, addLogEntry, markPaid } from "../../src/lib/services/work";
import { amsDate } from "../../src/lib/domain/dates";

process.env.DEMO_MODE = "true"; // e-mail wordt niet echt verstuurd

const now = new Date();
const today = amsDate(now);

test("demodata: 3 klanten en een gevulde Vandaag-lijst", async () => {
  const db = await createTestDb();
  await db.as(ADMIN_CLAIMS, (q) => seedDemo(q, now));
  const { items, summary } = await db.as(ADMIN_CLAIMS, (q) => loadToday(q, now));
  const stages = await db.as(ADMIN_CLAIMS, (q) => q<{ stage: string }>("select stage from clients order by stage"));
  assert.deepEqual(stages.map((s) => s.stage).sort(), ["checkin", "doorlopend", "kennismaking"]);

  const categories = new Set(items.map((i) => i.category));
  for (const c of [1, 2, 3, 4, 5, 6]) assert.ok(categories.has(c as 1), `categorie ${c} heeft minstens één item`);
  assert.equal(summary.activeClients, 2);
  assert.equal(summary.mrr, 300);
  assert.equal(summary.overduePayments, 1);
  assert.equal(summary.openTickets, 2);
  await db.close();
});

test("fase verschuiven is idempotent en maakt betalingen", async () => {
  const db = await createTestDb();
  await db.as(ADMIN_CLAIMS, async (q) => {
    const c = await createClient(q, { company: "Fase BV", owner_name: "Jan Test", email: "jan@fase.example", package: "plus" }, "lead", today);
    await moveStage(q, c.id, "inrichting", today);
    await moveStage(q, c.id, "intake", today);
    await moveStage(q, c.id, "inrichting", today);
    const tasks = await q<{ n: number }>("select count(*)::int as n from tasks where client_id = $1 and automation_key like '%:inrichting:%'", [c.id]);
    assert.equal(tasks[0].n, 2, "inrichtingstaken maar één keer");
    const pays = await q<{ kind: string; amount: number }>("select kind, amount from payments where client_id = $1 order by kind::text", [c.id]);
    assert.deepEqual(pays.filter((p) => p.kind === "startbedrag").map((p) => p.amount), [250]);
    assert.ok(pays.some((p) => p.kind === "maand" && p.amount === 200), "maandbedrag van het Plus-pakket");
    const fresh = await getClient(q, c.id);
    assert.equal(fresh?.start_date, today);
    const history = await q("select * from client_stage_history where client_id = $1", [c.id]);
    assert.equal(history.length, 4, "elke wissel met datum vastgelegd");
  });
  await db.close();
});

test("opzeggen laat toekomstige betalingen en concepten vervallen", async () => {
  const db = await createTestDb();
  await db.as(ADMIN_CLAIMS, async (q) => {
    const c = await createClient(q, { company: "Stop BV", email: "stop@x.example", start_date: today }, "lead", today);
    await moveStage(q, c.id, "inrichting", today);
    await moveStage(q, c.id, "opgezegd", today);
    const open = await q<{ n: number }>("select count(*)::int as n from payments where client_id = $1 and period_start >= $2 and not cancelled and paid_at is null", [c.id, today]);
    assert.equal(open[0].n, 0);
    const drafts = await q<{ n: number }>("select count(*)::int as n from emails where client_id = $1 and status in ('concept','gepland')", [c.id]);
    assert.equal(drafts[0].n, 0);
  });
  await db.close();
});

const mail = (over: Partial<InboundEmail>): InboundEmail => ({
  from: "Onbekend <nieuw@prospect.example>",
  to: "hello@gligor.ai",
  subject: "Interesse in AI-hulp",
  text: "Hallo, ik wil graag meer weten.",
  html: null,
  messageId: `<${Math.random()}@prospect.example>`,
  inReplyTo: null,
  references: null,
  receivedAt: now.toISOString(),
  attachments: [],
  ...over,
});
const storage = { save: async () => undefined, path: (t: string, m: string, f: string) => `${t}/${m}/${f}` };

test("inkomende e-mail: onbekend → lead, antwoord blijft in dezelfde thread", async () => {
  const db = await createTestDb();
  await db.as(ADMIN_CLAIMS, async (q) => {
    const first = await ingestInbound(q, mail({}), storage);
    assert.equal(first.created, "lead");
    const [lead] = await q<{ stage: string; email: string }>("select stage, email from clients");
    assert.deepEqual(lead, { stage: "lead", email: "nieuw@prospect.example" });

    await replyToTicket(q, first.ticketId, "Leuk! Zullen we bellen?", "wacht_op_klant");
    const [out] = await q<{ message_id: string; subject: string }>("select message_id, subject from ticket_messages where direction = 'uit'");
    assert.match(out.subject, /^Re: Interesse in AI-hulp \[T-\d+\]$/);

    // Klant antwoordt op ons bericht: zelfde ticket, weer open met deadline.
    const second = await ingestInbound(q, mail({ subject: out.subject, inReplyTo: out.message_id }), storage);
    assert.equal(second.ticketId, first.ticketId);
    assert.equal(second.created, null);
    const [t] = await q<{ status: string; awaiting_since: string | null }>("select status, awaiting_since from tickets");
    assert.equal(t.status, "open");
    assert.ok(t.awaiting_since);

    // Dubbele aflevering van hetzelfde bericht wordt genegeerd.
    const dupId = "<dubbel@prospect.example>";
    await ingestInbound(q, mail({ messageId: dupId, from: "nieuw@prospect.example", subject: "Nog iets" }), storage);
    const dup = await ingestInbound(q, mail({ messageId: dupId, from: "nieuw@prospect.example", subject: "Nog iets" }), storage);
    assert.equal(dup.duplicate, true);

    // Alles staat in het logboek van de lead.
    const log = await q<{ source: string }>("select source from log_entries where source in ('email_in','email_uit') order by occurred_at");
    assert.deepEqual(log.map((l) => l.source).sort(), ["email_in", "email_in", "email_in", "email_uit"]);
  });
  await db.close();
});

test("logboek: afgesproken acties worden taken; dagelijkse job zet geplande mails klaar", async () => {
  const db = await createTestDb();
  await db.as(ADMIN_CLAIMS, async (q) => {
    const c = await createClient(q, { company: "Log BV", email: "log@x.example" }, "lead", today);
    const entry = await addLogEntry(q, {
      client_id: c.id,
      type: "gesprek",
      summary: "Intake",
      agreed_actions: "- Offertesjabloon maken\n- Licenties checken",
      follow_up_date: today,
    });
    assert.equal(await actionsToTasks(q, entry.id, today), 2);
    assert.equal(await actionsToTasks(q, entry.id, today), 0, "niet dubbel");

    await q(
      "insert into emails (client_id, template_key, to_email, subject, body, status, scheduled_for) values ($1, 'checkin_2w', 'log@x.example', 'x', 'y', 'gepland', now() - interval '1 hour')",
      [c.id],
    );
    const result = await runDaily(q, now);
    assert.equal(result.drafted, 1);

    const [p] = await q<{ id: string }>(
      "insert into payments (client_id, kind, period_start, due_date, amount) values ($1, 'maand', $2, $2, 100) returning id",
      [c.id, today],
    );
    await markPaid(q, p.id, today);
    const audit = await q<{ n: number }>("select count(*)::int as n from audit_log where table_name = 'payments' and action = 'update'");
    assert.equal(audit[0].n, 1, "betaling markeren staat in het auditlog");
  });
  await db.close();
});

/** Intake, leads, Cal.com, mijlpalen, referrals en cadeaus tegen PGlite (met RLS, als de beheerder). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb, ADMIN_CLAIMS } from "../helpers/pglite";
import { createClient, moveStage } from "../../src/lib/services/clients";
import { markPaid } from "../../src/lib/services/work";
import { createWebsiteLead, handleCalBooking, saveIntake, sendIntakeLink, submitIntakeLink, findIntakeLink, allowFormHit } from "../../src/lib/services/leads";
import { giftsCsv, listGifts, logGift, referralSummary, topAmbassadors } from "../../src/lib/services/loyalty";
import { intakeSchema } from "../../src/lib/domain/leads";
import { addDays, addMonths, amsDate } from "../../src/lib/domain/dates";
import type { PaymentRow } from "../../src/lib/types";

process.env.DEMO_MODE = "true";
const today = amsDate(new Date());

test("intakeformulier: klant in fase Intake, logboek, welkomstconcept, betalingen en verjaardag", async () => {
  const db = await createTestDb();
  await db.as(ADMIN_CLAIMS, async (q) => {
    const data = intakeSchema.parse({
      first_name: "Sanne",
      last_name: "Bakker",
      company: "Kapsalon Testlaan",
      email: "sanne@testlaan.example",
      address: "Testlaan 1, 8000 AA Zwolle",
      package: "basis",
      users_count: "3",
      setup_type: "claude",
      birthday_day: "2",
      birthday_month: amsDate(new Date(Date.now() + 5 * 86_400_000)).slice(5, 7),
      birthday_consent: "on",
      pain_points: "Veel WhatsApp-vragen over prijzen",
    });
    data.birthday_day = Number(addDays(today, 5).slice(8, 10));
    const c = await saveIntake(q, { ...data, start_date: today }, {}, today);
    assert.equal(c.stage, "intake");
    assert.equal(c.owner_name, "Sanne Bakker");
    assert.equal(c.birthday_consent, true);
    const [log] = await q<{ summary: string }>("select summary from log_entries where client_id = $1 and type = 'gesprek'", [c.id]);
    assert.match(log.summary, /WhatsApp-vragen/);
    const drafts = await q<{ template_key: string }>("select template_key from emails where client_id = $1 and status = 'concept'", [c.id]);
    assert.ok(drafts.some((d) => d.template_key === "welkom"));
    const pays = await q<PaymentRow>("select * from payments where client_id = $1", [c.id]);
    assert.ok(pays.some((p) => p.kind === "startbedrag"));
    assert.ok(pays.some((p) => p.kind === "maand"));
    // Intake is (nog) geen actieve fase; na inrichting komt de verjaardagskaart.
    await moveStage(q, c.id, "inrichting", today);
    const tasks = await q<{ title: string; details: string; href: string }>("select title, details, href from tasks where client_id = $1 and source = 'mijlpaal'", [c.id]);
    const card = tasks.find((t) => t.title.startsWith("Kaart sturen naar Sanne"));
    assert.ok(card, "kaarttaak voor de verjaardag");
    assert.match(card.details, /Testlaan 1/);
    assert.equal(card.href, "https://www.greetz.nl");
  });
  await db.close();
});

test("intakelink: eenmalig, daarna nakijken in het dashboard", async () => {
  const db = await createTestDb();
  await db.as(ADMIN_CLAIMS, async (q) => {
    const c = await createClient(q, { company: "Lead BV", first_name: "Piet", email: "piet@lead.example" }, "kennismaking", today);
    const email = await sendIntakeLink(q, c.id, "https://admin.gligor.ai", today);
    assert.equal(email.status, "verzonden");
    const token = email.body.match(/\/intake\/([\w-]+)/)?.[1];
    assert.ok(token);
    const link = await findIntakeLink(q, token);
    assert.equal(link?.prefill?.company, "Lead BV");
    const data = intakeSchema.parse({ first_name: "Piet", company: "Lead BV", email: "piet@lead.example", pain_points: "Offertes" });
    await submitIntakeLink(q, token, data, new Date());
    await assert.rejects(submitIntakeLink(q, token, data, new Date()), /al ingevuld/);
    const [task] = await q<{ href: string }>("select href from tasks where automation_key = $1", [`intake:${link!.id}`]);
    assert.equal(task.href, `/klanten/nieuw?intake=${link!.id}`);
    const saved = await saveIntake(q, data, { clientId: c.id, intakeLinkId: link!.id }, today);
    assert.equal(saved.stage, "intake");
    const [done] = await q<{ status: string }>("select status from tasks where automation_key = $1", [`intake:${link!.id}`]);
    assert.equal(done.status, "klaar");
  });
  await db.close();
});

test("websiteformulier en Cal.com maken een lead met taak; rate limit telt", async () => {
  const db = await createTestDb();
  await db.as(ADMIN_CLAIMS, async (q) => {
    const r = await createWebsiteLead(q, { naam: "Marieke de Vries", email: "marieke@bakkerij.example", bedrijf: "", bericht: "Hulp met mails" }, new Date());
    assert.ok(r.created);
    const [c] = await q<{ company: string; stage: string; lead_source: string; first_name: string }>("select * from clients where id = $1", [r.clientId]);
    assert.deepEqual([c.company, c.stage, c.lead_source, c.first_name], ["Bakkerij", "lead", "website", "Marieke"]);
    const [t] = await q<{ title: string; due_date: string }>("select title, due_date from tasks where client_id = $1 and source = 'lead'", [r.clientId]);
    assert.match(t.title, /Reageren op Marieke/);
    assert.equal(t.due_date, today, "staat meteen in Vandaag");

    const start = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const booked = await handleCalBooking(q, { event: "created", uid: "u1", previousUid: null, startTime: start, title: "Kennismaking", name: "Marieke de Vries", email: "marieke@bakkerij.example", phone: null, notes: "" });
    assert.equal(booked.clientId, r.clientId, "zelfde e-mail = zelfde lead");
    const [after] = await q<{ stage: string }>("select stage from clients where id = $1", [r.clientId]);
    assert.equal(after.stage, "kennismaking");
    await handleCalBooking(q, { event: "rescheduled", uid: "u2", previousUid: "u1", startTime: start, title: "Kennismaking", name: "Marieke de Vries", email: "marieke@bakkerij.example", phone: null, notes: "" });
    await handleCalBooking(q, { event: "cancelled", uid: "u2", previousUid: null, startTime: start, title: "Kennismaking", name: "", email: "marieke@bakkerij.example", phone: null, notes: "" });
    const cal = await q<{ automation_key: string; status: string }>("select automation_key, status from tasks where automation_key like 'cal:%' order by automation_key");
    assert.deepEqual(cal.map((x) => x.status), ["klaar", "klaar"]);

    assert.ok(await allowFormHit(q, "lead", "ip1", 2, 60));
    assert.ok(await allowFormHit(q, "lead", "ip1", 2, 60));
    assert.ok(!(await allowFormHit(q, "lead", "ip1", 2, 60)));
    assert.ok(await allowFormHit(q, "lead", "ip2", 2, 60));
  });
  await db.close();
});

test("bedankmail na 3 betalingen, referral met gratis maanden en ambassadeurs", async () => {
  const db = await createTestDb();
  await db.as(ADMIN_CLAIMS, async (q) => {
    const start = addMonths(today, -3);
    const ref = await createClient(q, { company: "Aanbrenger BV", first_name: "Henk", email: "henk@aanbrenger.example", start_date: start }, "lead", today);
    await moveStage(q, ref.id, "doorlopend", today);
    const nieuw = await createClient(q, { company: "Nieuw BV", first_name: "Daan", email: "daan@nieuw.example", start_date: start, referred_by: ref.id }, "lead", today);
    await moveStage(q, nieuw.id, "doorlopend", today);

    const months = (id: string) => q<PaymentRow>("select * from payments where client_id = $1 and kind = 'maand' order by period_start", [id]);
    // Aanbrenger betaalt 3 maanden: bedankmail staat klaar.
    for (const p of (await months(ref.id)).slice(0, 3)) await markPaid(q, p.id, today);
    const thanks = await q<{ status: string; from_email: string }>("select status, from_email from emails where client_id = $1 and template_key = 'bedankt_3'", [ref.id]);
    assert.deepEqual(thanks.map((t) => [t.status, t.from_email]), [["concept", "gligor@gligor.ai"]]);

    // Nieuwe klant betaalt 1 maand: nog lopend. Na de 2e: geslaagd.
    const nm = await months(nieuw.id);
    await markPaid(q, nm[0].id, today);
    assert.equal((await referralSummary(q, ref.id)).pending, 1);
    await markPaid(q, nm[1].id, today);
    const summary = await referralSummary(q, ref.id);
    assert.equal(summary.succeeded, 1);
    assert.ok(summary.value >= 200);

    const credited = await q<PaymentRow>("select * from payments where credit_reason is not null order by client_id");
    assert.equal(credited.length, 2, "beide krijgen een gratis maand");
    assert.ok(credited.every((p) => Number(p.amount) === 0 && p.paid_at && p.source === "tegoed"));
    const [mail] = await q<{ subject: string }>("select subject from emails where client_id = $1 and template_key = 'referral_bedankt'", [ref.id]);
    assert.match(mail.subject, /aanbeveling/);
    // Nogmaals controleren geeft geen extra tegoed.
    await markPaid(q, nm[2].id, today);
    assert.equal((await q("select 1 from payment_credits")).length, 2);
    assert.deepEqual((await topAmbassadors(q)).map((a) => [a.company, a.succeeded]), [["Aanbrenger BV", 1]]);
  });
  await db.close();
});

test("cadeaulog: in het logboek, CSV voor de boekhouder, blijft na AVG-verwijdering anoniem staan", async () => {
  const db = await createTestDb();
  await db.as(ADMIN_CLAIMS, async (q) => {
    const c = await createClient(q, { company: "Cadeau; BV", first_name: "Els", email: "els@cadeau.example" }, "lead", today);
    await logGift(q, { client_id: c.id, given_on: today, type: "cadeau", description: "Bonbons uit Zeist", amount: 24.5 });
    const [log] = await q<{ summary: string }>("select summary from log_entries where client_id = $1 and summary like 'Cadeau%'", [c.id]);
    assert.match(log.summary, /Bonbons uit Zeist/);
    const csv = giftsCsv(await listGifts(q, Number(today.slice(0, 4))));
    assert.match(csv, /"Cadeau; BV";Cadeau;Bonbons uit Zeist;24,50/);
    await q("select forget_client($1)", [c.id]);
    const [g] = await q<{ client_id: string | null; client_label: string; amount: number }>("select * from gifts");
    assert.deepEqual([g.client_id, g.client_label, Number(g.amount)], [null, "(verwijderde klant)", 24.5]);
  });
  await db.close();
});

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { addMonths, addWorkingDays, amsDate, easterSunday, endOfAmsDay, isWorkingDay } from "../../src/lib/domain/dates";
import { expectedPayments, paymentStatus } from "../../src/lib/domain/payments";
import { nextQuarterlyMoment, planStageChange } from "../../src/lib/domain/lifecycle";
import {
  deadlineState,
  extractTicketNumber,
  leadFromSender,
  matchInbound,
  parseAddress,
  replySubject,
  responseDeadline,
  stripQuoted,
  type MatchContext,
} from "../../src/lib/domain/tickets";
import { buildToday, type TodayInput } from "../../src/lib/domain/today";
import { renderTemplate } from "../../src/lib/domain/templates";

describe("datums en werkdagen", () => {
  test("Pasen en feestdagen", () => {
    assert.equal(easterSunday(2026), "2026-04-05");
    assert.equal(easterSunday(2027), "2027-03-28");
    assert.equal(isWorkingDay("2026-04-06"), false, "tweede paasdag");
    assert.equal(isWorkingDay("2026-04-27"), false, "Koningsdag");
    assert.equal(isWorkingDay("2026-12-25"), false);
    assert.equal(isWorkingDay("2026-11-23"), true, "gewone maandag");
    assert.equal(isWorkingDay("2026-11-22"), false, "zondag");
  });

  test("werkdagen optellen slaat weekend en feestdagen over", () => {
    assert.equal(addWorkingDays("2026-11-20", 1), "2026-11-23", "vrijdag + 1 = maandag");
    assert.equal(addWorkingDays("2026-11-21", 1), "2026-11-23", "zaterdag + 1 = maandag");
    assert.equal(addWorkingDays("2026-12-24", 1), "2026-12-28", "over kerst heen");
    assert.equal(addWorkingDays("2026-11-23", 2), "2026-11-25");
  });

  test("maanden optellen klemt op het einde van de maand", () => {
    assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
    assert.equal(addMonths("2026-11-15", 3), "2027-02-15");
  });

  test("Amsterdamse tijd en einde van de dag (winter- en zomertijd)", () => {
    assert.equal(amsDate(new Date("2026-11-22T23:30:00Z")), "2026-11-23");
    assert.equal(endOfAmsDay("2026-11-23").toISOString(), "2026-11-23T22:59:59.999Z");
    assert.equal(endOfAmsDay("2026-06-15").toISOString(), "2026-06-15T21:59:59.999Z");
  });
});

describe("betalingen", () => {
  const today = "2026-11-23";
  test("status: betaald, te laat, openstaand, op tijd, vervallen", () => {
    assert.equal(paymentStatus({ due_date: "2026-11-01", paid_at: "2026-11-02", cancelled: false }, today), "betaald");
    assert.equal(paymentStatus({ due_date: "2026-11-22", paid_at: null, cancelled: false }, today), "te_laat");
    assert.equal(paymentStatus({ due_date: "2026-11-23", paid_at: null, cancelled: false }, today), "openstaand");
    assert.equal(paymentStatus({ due_date: "2026-11-30", paid_at: null, cancelled: false }, today), "openstaand");
    assert.equal(paymentStatus({ due_date: "2026-12-01", paid_at: null, cancelled: false }, today), "op_tijd");
    assert.equal(paymentStatus({ due_date: "2026-11-01", paid_at: null, cancelled: true }, today), "geannuleerd");
  });

  test("verwachte betalingen: startbedrag + elke maand vanaf de startdatum", () => {
    const list = expectedPayments(
      { stage: "doorlopend", start_date: "2026-09-10", end_date: null, monthly_fee: 200, start_fee: 250 },
      "2026-11-23",
    );
    assert.deepEqual(
      list.map((p) => [p.kind, p.period_start, p.due_date, p.amount]),
      [
        ["startbedrag", "2026-09-10", "2026-09-24", 250],
        ["maand", "2026-09-10", "2026-09-24", 200],
        ["maand", "2026-10-10", "2026-10-24", 200],
        ["maand", "2026-11-10", "2026-11-24", 200],
      ],
    );
  });

  test("geen betalingen voor leads; na opzegging geen nieuwe maanden", () => {
    assert.equal(expectedPayments({ stage: "kennismaking", start_date: "2026-09-10", end_date: null, monthly_fee: 100, start_fee: 250 }, "2026-11-23").length, 0);
    const ended = expectedPayments(
      { stage: "opgezegd", start_date: "2026-09-10", end_date: "2026-10-20", monthly_fee: 100, start_fee: 250 },
      "2026-12-31",
    );
    assert.deepEqual(ended.filter((p) => p.kind === "maand").map((p) => p.period_start), ["2026-09-10", "2026-10-10"]);
  });
});

describe("levenscyclus", () => {
  const base = { id: "c1", package: "basis" as const, start_date: null, setup_type: "claude" as const };
  const today = "2026-11-23";

  test("inrichting zet de startdatum, maakt taken en het bevestigingsconcept", () => {
    const plan = planStageChange(base, "inrichting", today);
    assert.equal(plan.startDate, today);
    assert.deepEqual(plan.emails.map((e) => e.template), ["bevestiging_intake"]);
    assert.ok(plan.tasks.some((t) => t.title === "Claude inrichten" && t.due === "2026-11-30"));
  });

  test("training plant de check-in na 2 weken vanaf de startdatum", () => {
    const plan = planStageChange({ ...base, start_date: "2026-11-16" }, "training", today);
    const checkin = plan.emails.find((e) => e.template === "checkin_2w");
    assert.equal(checkin?.scheduledFor, "2026-11-30");
    assert.equal(plan.startDate, undefined, "bestaande startdatum blijft staan");
  });

  test("check-in = garantie-evaluatie op dag 28 (nooit in het verleden)", () => {
    const plan = planStageChange({ ...base, start_date: "2026-10-01" }, "checkin", today);
    assert.equal(plan.tasks[0].due, today);
    assert.match(plan.tasks[0].title, /minimaal 4 uur/);
  });

  test("doorlopend: alleen Plus krijgt een kwartaaltaak", () => {
    assert.equal(planStageChange({ ...base, start_date: "2026-09-10" }, "doorlopend", today).tasks.length, 0);
    const plus = planStageChange({ ...base, package: "plus", start_date: "2026-09-10" }, "doorlopend", today);
    assert.deepEqual(plus.tasks.map((t) => [t.title, t.due]), [["Volgend proces kiezen en verbeteren", "2026-12-10"]]);
    assert.equal(nextQuarterlyMoment("2026-08-23", today), "2026-11-23");
  });

  test("opzeggen zet einddatum en laat toekomstige zaken vervallen", () => {
    const plan = planStageChange({ ...base, start_date: "2026-09-10" }, "opgezegd", today);
    assert.equal(plan.endDate, today);
    assert.equal(plan.cancelFuture, true);
  });

  test("sleutels zijn stabiel, zodat terugschuiven niets dubbel maakt", () => {
    const a = planStageChange(base, "intake", today);
    const b = planStageChange(base, "intake", "2026-12-01");
    assert.deepEqual(a.tasks.map((t) => t.key), b.tasks.map((t) => t.key));
  });
});

describe("tickets", () => {
  const ctx: MatchContext = {
    ticketByMessageId: new Map([["<abc@gligor.ai>", "t1"]]),
    ticketByNumber: new Map([[1042, { id: "t2", clientEmail: "henk@bouw.example" }]]),
    clientByEmail: new Map([["henk@bouw.example", "c-henk"]]),
  };

  test("adres en ticketnummer uitlezen", () => {
    assert.deepEqual(parseAddress('"Henk Jansen" <Henk@Bouw.example>'), { name: "Henk Jansen", email: "henk@bouw.example" });
    assert.equal(extractTicketNumber("Re: Vraag over Copilot [T-1042]"), 1042);
    assert.equal(replySubject("RE: Re: Vraag [T-1042]", 1042), "Re: Vraag [T-1042]");
  });

  test("koppelen via headers gaat voor alles", () => {
    const r = matchInbound({ from: "iemand@elders.example", subject: "Re: hallo", inReplyTo: "<abc@gligor.ai>" }, ctx);
    assert.deepEqual(r, { kind: "existing-ticket", ticketId: "t1", via: "headers" });
  });

  test("ticketnummer in het onderwerp, alleen van de juiste afzender", () => {
    assert.deepEqual(matchInbound({ from: "Henk <henk@bouw.example>", subject: "Re: x [T-1042]" }, ctx), {
      kind: "existing-ticket",
      ticketId: "t2",
      via: "onderwerp",
    });
    const stranger = matchInbound({ from: "vreemd@spam.example", subject: "Re: x [T-1042]" }, ctx);
    assert.equal(stranger.kind, "new-lead");
  });

  test("bekende klant → nieuw ticket; onbekend → lead", () => {
    assert.deepEqual(matchInbound({ from: "henk@bouw.example", subject: "Nieuwe vraag" }, ctx), { kind: "new-ticket", clientId: "c-henk" });
    assert.equal(matchInbound({ from: "nieuw@bakker.example", subject: "Info" }, ctx).kind, "new-lead");
    assert.equal(leadFromSender({ name: "Piet", email: "piet@bakkerijpiet.nl" }).company, "Bakkerijpiet");
    assert.equal(leadFromSender({ name: "Piet Klaassen", email: "piet@gmail.com" }).company, "Piet Klaassen");
  });

  test("antwoordtermijn: Plus 1 werkdag, Basis 2 werkdagen", () => {
    // Vrijdagmiddag binnen: Plus uiterlijk maandag einde dag, Basis dinsdag.
    assert.equal(responseDeadline("2026-11-20T14:00:00Z", "plus").toISOString(), "2026-11-23T22:59:59.999Z");
    assert.equal(responseDeadline("2026-11-20T14:00:00Z", "basis").toISOString(), "2026-11-24T22:59:59.999Z");
    const d = responseDeadline("2026-11-20T14:00:00Z", "plus");
    assert.equal(deadlineState(d, new Date("2026-11-23T08:00:00Z")), "bijna");
    assert.equal(deadlineState(d, new Date("2026-11-24T08:00:00Z")), "te_laat");
    assert.equal(deadlineState(d, new Date("2026-11-21T08:00:00Z")), "op_tijd");
  });

  test("geciteerde tekst wordt weggelaten", () => {
    assert.equal(stripQuoted("Bedankt!\n\nOp 20 nov. 2026 schreef Gligor:\n> oude tekst"), "Bedankt!");
  });
});

describe("Vandaag", () => {
  const contact = (id: string, company: string) => ({
    clientId: id,
    company,
    ownerName: "Eigenaar",
    email: `${id}@voorbeeld.example`,
    phone: "0612345678",
    channel: "telefoon" as const,
  });
  const input: TodayInput = {
    today: "2026-11-23",
    now: new Date("2026-11-23T08:00:00Z"),
    clients: [
      { ...contact("a", "Plus BV"), stage: "doorlopend", package: "plus", lastContactAt: "2026-10-01T10:00:00Z", createdAt: "2026-08-01T00:00:00Z" },
      { ...contact("b", "Basis BV"), stage: "checkin", package: "basis", lastContactAt: "2026-11-20T10:00:00Z", createdAt: "2026-10-26T00:00:00Z" },
    ],
    tickets: [
      { id: "t-late", number: 1001, subject: "Help", status: "open", awaitingSince: "2026-11-19T09:00:00Z", clientId: "a" },
      { id: "t-fine", number: 1002, subject: "Later", status: "nieuw", awaitingSince: "2026-11-23T07:00:00Z", clientId: "b" },
    ],
    payments: [
      { id: "p1", clientId: "a", kind: "maand", periodStart: "2026-10-10", dueDate: "2026-10-24", amount: 200, paidAt: null, cancelled: false },
      { id: "p2", clientId: "a", kind: "maand", periodStart: "2026-11-10", dueDate: "2026-11-24", amount: 200, paidAt: null, cancelled: false },
    ],
    tasks: [
      { id: "k1", clientId: "b", title: "Garantie-evaluatie", dueDate: "2026-11-23", source: "levenscyclus" },
      { id: "k2", clientId: "a", title: "Kwartaalproces", dueDate: "2026-11-26", source: "levenscyclus" },
    ],
    followUps: [{ id: "f1", clientId: "b", summary: "Gesprek", agreedActions: "Spiekbriefje mailen", followUpDate: "2026-11-21" }],
    drafts: [{ id: "e1", clientId: "b", subject: "Hoe gaat het?", toEmail: "b@voorbeeld.example", templateName: "Check-in", createdAt: "2026-11-23T06:00:00Z" }],
    snoozes: new Map(),
  };

  test("volgorde: tickets, betalingen, opvolgen, concepten, levenscyclus, bijpraten", () => {
    const items = buildToday(input);
    assert.deepEqual(
      items.map((i) => i.key),
      ["ticket:t-late", "payment:p1", "followup:f1", "task:k1", "email:e1", "upcoming:k2", "contact:a"],
    );
    assert.equal(items[0].tone, "danger");
  });

  test("gesnoozede items verdwijnen tot de gekozen datum", () => {
    const snoozes = new Map([["payment:p1", "2026-11-24"], ["contact:a", "2026-11-23"]]);
    const keys = buildToday({ ...input, snoozes }).map((i) => i.key);
    assert.ok(!keys.includes("payment:p1"), "tot morgen weg");
    assert.ok(keys.includes("contact:a"), "snooze tot vandaag is verlopen");
  });
});

test("sjablonen: variabelen invullen, onbekende blijven zichtbaar", () => {
  assert.equal(renderTemplate("Hoi {{voornaam}}, {{ bedrijf }}! {{onbekend}}", { voornaam: "Henk", bedrijf: "Bouw BV" }), "Hoi Henk, Bouw BV! {{onbekend}}");
});

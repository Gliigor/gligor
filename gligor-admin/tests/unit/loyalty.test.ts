/** Mijlpalen, verjaardagen, referrals, leads en Cal.com: pure functies. */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  DEFAULT_MILESTONES,
  birthdayInYear,
  monthsAsClient,
  nextAnniversary,
  nextBirthday,
  parseMilestoneSettings,
  planMilestones,
  referralStatus,
  upcomingMilestones,
  type MilestoneClient,
} from "../../src/lib/domain/milestones";
import {
  HONEYPOT_FIELD,
  intakeBirthday,
  intakeLinkState,
  leadCompany,
  parseCalEvent,
  parseLeadForm,
  splitName,
  verifyCalSignature,
} from "../../src/lib/domain/leads";

const base: MilestoneClient = {
  id: "c1",
  stage: "doorlopend",
  start_date: "2026-01-15",
  first_name: "Henk",
  owner_name: "Henk Jansen",
  birthday_day: null,
  birthday_month: null,
  birthday_consent: false,
};
const s = DEFAULT_MILESTONES;

describe("verjaardagen en jubilea", () => {
  test("29 februari valt in een gewoon jaar op 28 februari", () => {
    assert.equal(birthdayInYear(29, 2, 2027), "2027-02-28");
    assert.equal(birthdayInYear(29, 2, 2028), "2028-02-29");
  });
  test("eerstvolgende verjaardag: vandaag telt nog mee", () => {
    assert.equal(nextBirthday(24, 11, "2026-11-24"), "2026-11-24");
    assert.equal(nextBirthday(23, 11, "2026-11-24"), "2027-11-23");
  });
  test("jubileum en maanden klant", () => {
    assert.deepEqual(nextAnniversary("2026-01-15", "2026-11-24"), { years: 1, date: "2027-01-15" });
    assert.deepEqual(nextAnniversary("2024-11-30", "2026-11-24"), { years: 2, date: "2026-11-30" });
    assert.equal(monthsAsClient("2026-01-15", "2026-11-24"), 10);
    assert.equal(monthsAsClient("2026-01-15", "2026-01-14"), 0);
  });
  test("instellingen: foute waarden vallen terug op de standaard", () => {
    const p = parseMilestoneSettings({ thanksAfterPayments: "4", giftWeeksBefore: -1, onzin: 3 });
    assert.equal(p.thanksAfterPayments, 4);
    assert.equal(p.giftWeeksBefore, DEFAULT_MILESTONES.giftWeeksBefore);
  });
});

describe("mijlpalen plannen", () => {
  test("bedankmail precies rond de 3e betaling, niet bij een oude klant", () => {
    const at = (paid: number) => planMilestones(base, { today: "2026-04-20", paidMonths: paid, settings: s }).emails.map((e) => e.template);
    assert.ok(!at(2).includes("bedankt_3"));
    assert.ok(at(3).includes("bedankt_3"));
    assert.ok(!at(10).includes("bedankt_3"));
  });

  test("eerste jaar: cadeau 4 weken vooraf, herinnering + concept 1 week vooraf", () => {
    const plan = planMilestones(base, { today: "2026-12-10", paidMonths: 11, settings: s });
    const gift = plan.tasks.find((t) => t.kind === "cadeau");
    const give = plan.tasks.find((t) => t.kind === "jubileum");
    assert.equal(gift?.due, "2026-12-18");
    assert.equal(give?.due, "2027-01-08");
    assert.deepEqual(plan.emails.map((e) => [e.template, e.scheduledFor]), [["jubileum", "2027-01-08"]]);
    // Te ver weg: nog niets klaarzetten.
    assert.equal(planMilestones(base, { today: "2026-06-01", paidMonths: 5, settings: s }).tasks.length, 0);
  });

  test("volgende jaren: kaart en mail met het aantal jaren", () => {
    const plan = planMilestones({ ...base, start_date: "2024-12-20" }, { today: "2026-12-01", paidMonths: 23, settings: s });
    assert.equal(plan.tasks[0].title, "Kaart sturen naar Henk: 2 jaar klant");
    assert.deepEqual(plan.emails[0].vars, { jaren: "2" });
  });

  test("verjaardag alleen met toestemming; kaart een week vooraf, mail op de dag", () => {
    const withBday = { ...base, birthday_day: 5, birthday_month: 12 };
    assert.ok(!planMilestones(withBday, { today: "2026-11-24", paidMonths: 5, settings: s }).tasks.some((t) => t.kind === "verjaardag-kaart"));
    const plan = planMilestones({ ...withBday, birthday_consent: true }, { today: "2026-11-24", paidMonths: 5, settings: s });
    assert.equal(plan.tasks.find((t) => t.kind === "verjaardag-kaart")?.due, "2026-11-28");
    const bdayMail = plan.emails.find((e) => e.template === "verjaardag");
    assert.equal(bdayMail?.scheduledFor, "2026-12-05");
    assert.match(bdayMail!.key, /verjaardag:2026:mail$/);
  });

  test("leads en opgezegde klanten krijgen geen mijlpalen", () => {
    for (const stage of ["lead", "opgezegd"] as const) {
      const plan = planMilestones({ ...base, stage, birthday_day: 25, birthday_month: 11, birthday_consent: true }, { today: "2026-11-24", paidMonths: 3, settings: s });
      assert.deepEqual(plan, { tasks: [], emails: [] });
    }
  });

  test("komende mijlpalen voor de klantpagina", () => {
    const list = upcomingMilestones({ ...base, birthday_day: 1, birthday_month: 3, birthday_consent: true }, { today: "2026-02-01", paidMonths: 1, settings: s });
    assert.deepEqual(list.map((m) => m.date), ["2026-03-01", "2026-03-15", "2027-01-15"]);
  });
});

describe("referrals", () => {
  test("geslaagd na 2 betaalde maanden, vervallen bij opzeggen", () => {
    assert.equal(referralStatus({ stage: "doorlopend", referral_succeeded_at: null }, 1, s), "lopend");
    assert.equal(referralStatus({ stage: "doorlopend", referral_succeeded_at: null }, 2, s), "geslaagd");
    assert.equal(referralStatus({ stage: "opgezegd", referral_succeeded_at: null }, 1, s), "vervallen");
    assert.equal(referralStatus({ stage: "opgezegd", referral_succeeded_at: "2026-05-01" }, 2, s), "geslaagd");
  });
});

describe("websiteleads", () => {
  test("honeypot, validatie en bedrijfsnaam", () => {
    assert.deepEqual(parseLeadForm({ naam: "Bot", email: "a@b.nl", bericht: "x", [HONEYPOT_FIELD]: "http://spam" }), { kind: "spam" });
    assert.equal(parseLeadForm({ naam: "Sanne", email: "geen-mail", bericht: "Hoi" }).kind, "invalid");
    const ok = parseLeadForm({ naam: " Sanne Bakker ", email: "Sanne@Kapsalon.NL ", bericht: "Hulp met WhatsApp" });
    assert.equal(ok.kind, "ok");
    if (ok.kind === "ok") assert.equal(ok.data.email, "sanne@kapsalon.nl");
    assert.equal(leadCompany({ naam: "Sanne", email: "sanne@kapsalon.nl" }), "Kapsalon");
    assert.equal(leadCompany({ naam: "Sanne", email: "sanne@gmail.com" }), "Sanne");
    assert.equal(leadCompany({ naam: "Sanne", bedrijf: "Knip & Zo", email: "sanne@gmail.com" }), "Knip & Zo");
    assert.deepEqual(splitName("  Jan  de Vries "), { first: "Jan", last: "de Vries" });
  });
});

describe("Cal.com", () => {
  const body = JSON.stringify({
    triggerEvent: "BOOKING_RESCHEDULED",
    payload: {
      uid: "new-uid",
      rescheduleUid: "old-uid",
      title: "Kennismaking",
      startTime: "2026-11-26T18:30:00Z",
      attendees: [{ name: "Marieke de Vries", email: "Marieke@Bakkerij.example" }],
      responses: { notes: { value: "Graag over Instagram" } },
    },
  });

  test("handtekening controleren", () => {
    const sig = createHmac("sha256", "geheim").update(body).digest("hex");
    assert.ok(verifyCalSignature(body, sig, "geheim"));
    assert.ok(!verifyCalSignature(body, sig, "ander-geheim"));
    assert.ok(!verifyCalSignature(body + " ", sig, "geheim"));
    assert.ok(!verifyCalSignature(body, null, "geheim"));
  });

  test("boeking uitlezen", () => {
    const b = parseCalEvent(JSON.parse(body));
    assert.equal(b?.event, "rescheduled");
    assert.equal(b?.previousUid, "old-uid");
    assert.equal(b?.email, "marieke@bakkerij.example");
    assert.equal(b?.notes, "Graag over Instagram");
    assert.equal(parseCalEvent({ triggerEvent: "MEETING_ENDED", payload: JSON.parse(body).payload }), null);
  });
});

describe("intake", () => {
  test("link: geldig, verlopen, gebruikt", () => {
    const now = new Date("2026-11-24T12:00:00Z");
    assert.equal(intakeLinkState({ expires_at: "2026-11-30T00:00:00Z", submitted_at: null }, now), "geldig");
    assert.equal(intakeLinkState({ expires_at: "2026-11-24T11:00:00Z", submitted_at: null }, now), "verlopen");
    assert.equal(intakeLinkState({ expires_at: "2026-11-30T00:00:00Z", submitted_at: "2026-11-24T10:00:00Z" }, now), "gebruikt");
  });
  test("verjaardag alleen compleet, geldig en met toestemming", () => {
    assert.deepEqual(intakeBirthday({ birthday_day: 12, birthday_month: 3, birthday_consent: true }), { day: 12, month: 3, consent: true });
    assert.deepEqual(intakeBirthday({ birthday_day: 12, birthday_month: 3, birthday_consent: false }), { day: null, month: null, consent: false });
    assert.deepEqual(intakeBirthday({ birthday_day: 31, birthday_month: 4, birthday_consent: true }), { day: null, month: null, consent: false });
  });
});

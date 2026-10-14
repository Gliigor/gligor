import { test } from "node:test";
import assert from "node:assert/strict";
import { ibAangifteSchema, jaarrekeningSchema, type IbAangifteExtraction } from "@/lib/extraction/ai/schema";
import { mapIbAangifte, mapJaarrekening } from "@/lib/extraction/ai/map";
import { planExtractionChanges } from "@/lib/extraction/apply";
import { EU_REGIONS, staysInEu } from "@/lib/extraction/ai/eu";
import { DEFAULT_PLAN_CONFIG, parsePlanInputs, type PlanConfig } from "@/lib/plan/types";

const a = (value: number | null, page: number | null = 2) => ({ value, page });

// What the model could return for a couple with a holding, two employers and box 3.
const ib: IbAangifteExtraction = {
  taxYear: 2025,
  taxpayer: {
    birthYear: a(1972, 1),
    employments: [
      { payer: "Holding de Vries B.V.", isOwnCompany: true, grossWage: a(62_000, 3) },
      { payer: "UWV", isOwnCompany: false, grossWage: a(4_000, 3) },
    ],
  },
  partner: {
    present: true,
    firstName: "Marieke",
    relationship: "married_or_registered",
    birthYear: a(1975, 1),
    employments: [
      { payer: "Ziekenhuis A", isOwnCompany: false, grossWage: a(48_250.4, 4) },
      { payer: "Ziekenhuis B", isOwnCompany: false, grossWage: a(9_000, 4) },
    ],
  },
  home: { present: true, wozValue: a(812_000, 5), owner: "joint" },
  mortgageParts: [
    { description: "ABN leningdeel 1", balance: a(300_000, 5), interestPaid: a(12_000, 5), interestRatePercent: a(null, null), repaymentType: "annuity" },
    { description: "ABN leningdeel 2", balance: a(100_000, 5), interestPaid: a(0), interestRatePercent: a(4.25, 5), repaymentType: "interest_only" },
  ],
  box3Items: [
    { category: "bank_savings", description: "Spaarrekening", value: a(80_000, 6), owner: "partner" },
    { category: "other_assets", description: "Lening aan zoon", value: a(15_000, 6), owner: "taxpayer" },
    { category: "debt", description: "Consumptief krediet", value: a(-5_000, 6), owner: "unknown" },
    { category: "investments", description: "Onleesbaar", value: a(null, null), owner: "joint" },
  ],
  substantialInterests: [
    { companyName: "Holding de Vries B.V.", sharePercentage: a(100, 7), dividendReceived: a(40_000, 7), holder: "taxpayer" },
    { companyName: "Werk B.V.", sharePercentage: a(50, 7), dividendReceived: a(null), holder: "taxpayer" },
  ],
  notes: ["  Box 3-verdeling   tussen partners is 50/50. "],
};

test("the AI output schemas parse the example", () => {
  assert.equal(ibAangifteSchema.safeParse(ib).success, true);
  assert.equal(
    jaarrekeningSchema.safeParse({
      financialYear: 2025,
      companyName: "X B.V.",
      equity: a(1),
      cash: a(1),
      netResult: a(1),
      pensionObligation: a(1),
      directorCurrentAccount: a(1),
      dividendPaid: a(1),
      directorSalary: a(1),
      notes: [],
    }).success,
    true,
  );
});

test("IB-aangifte: wages are summed per person in code, own-BV salary goes to the BV", () => {
  const d = mapIbAangifte(ib);
  assert.equal(d.method, "ai");
  assert.equal(d.year, 2025);
  assert.equal(d.prive.geboortejaar, 1972);
  assert.equal(d.prive.bruto_inkomen, 4_000, "only non-own-BV wages");
  assert.deepEqual(d.partner, { naam: "Marieke", relatie: "gehuwd", geboortejaar: 1975, bruto_inkomen: 57_250 });
  const bv = d.assets.find((x) => x.type === "bv_aandelen")!;
  assert.equal(bv.metadata?.salaris_dga, 62_000);
  assert.equal(bv.metadata?.bv_naam, "Holding de Vries B.V.");
  assert.equal(bv.metadata?.aandelen_percentage, 100);
  assert.equal(bv.metadata?.dividenduitkering, 40_000);
  assert.equal(bv.metadata?.eigenaar, "client");
  assert.ok(d.notes.some((n) => n.includes("Werk B.V.")), "second BV is mentioned, not silently dropped");
  assert.ok(d.notes.includes("Box 3-verdeling tussen partners is 50/50."));
});

test("IB-aangifte: mortgage rate is derived in code when not printed", () => {
  const d = mapIbAangifte(ib);
  const parts = d.assets.filter((x) => x.type === "hypotheek");
  assert.equal(parts.length, 2);
  assert.equal(parts[0].metadata?.rente, 4, "12.000 / 300.000");
  assert.equal(parts[0].metadata?.aflosvorm, "annuitair");
  assert.equal(parts[1].metadata?.rente, 4.25);
  assert.equal(parts[1].metadata?.aflosvorm, "aflossingsvrij");
  assert.ok(d.notes.some((n) => n.includes("afgeleid")));
});

test("IB-aangifte: box 3 items keep their owner, debts become positive, empty values are skipped", () => {
  const d = mapIbAangifte(ib);
  const box3 = d.assets.filter((x) => ["spaargeld", "beleggingen", "schulden_box3"].includes(x.type));
  assert.deepEqual(
    box3.map((x) => [x.type, x.value, x.metadata?.eigenaar]),
    [
      ["spaargeld", 80_000, "partner"],
      ["beleggingen", 15_000, "client"],
      ["schulden_box3", 5_000, undefined],
    ],
  );
  assert.ok(d.sources.every((s) => s.page === null || s.page > 0));
  assert.ok(d.sources.some((s) => s.label === "WOZ-waarde eigen woning" && s.page === 5));
});

test("IB-aangifte without partner or BV stays minimal", () => {
  const d = mapIbAangifte({
    ...ib,
    partner: { ...ib.partner, present: false },
    substantialInterests: [],
    taxpayer: { birthYear: a(null), employments: [] },
  });
  assert.deepEqual(d.partner, {});
  assert.deepEqual(d.prive, {});
  assert.equal(d.assets.some((x) => x.type === "bv_aandelen"), false);
});

test("jaarrekening: losses stay negative, current account becomes a note", () => {
  const d = mapJaarrekening({
    financialYear: 2025,
    companyName: "Holding B.V.",
    equity: a(900_000, 3),
    cash: a(310_000, 3),
    netResult: a(-12_000, 4),
    pensionObligation: a(null, null),
    directorCurrentAccount: a(25_000, 3),
    dividendPaid: a(null, null),
    directorSalary: a(null, null),
    notes: [],
  });
  const bv = d.assets[0];
  assert.equal(bv.type, "bv_aandelen");
  assert.equal(bv.metadata?.resultaat_na_belasting, -12_000);
  assert.equal(bv.metadata?.odv_waarde, undefined);
  assert.ok(d.notes[0].includes("vordering"));
});

test("applying AI data: partner fields and owners only when the partner section is on", () => {
  const data = mapIbAangifte(ib);
  const withPartner: PlanConfig = { ...DEFAULT_PLAN_CONFIG, sections: { ...DEFAULT_PLAN_CONFIG.sections, partner: true, box3: true } };
  const on = planExtractionChanges(data, withPartner, parsePlanInputs({}), []);
  assert.equal(on.inputs?.partner.naam, "Marieke");
  assert.equal(on.inputs?.partner.bruto_inkomen, 57_250);
  assert.ok(on.inputs?.fromDocument.includes("partner.bruto_inkomen"));
  assert.equal(on.inserts.find((i) => i.type === "spaargeld")?.metadata.eigenaar, "partner");

  const withoutPartner: PlanConfig = { ...withPartner, sections: { ...withPartner.sections, partner: false } };
  const off = planExtractionChanges(data, withoutPartner, parsePlanInputs({}), []);
  assert.equal(off.inputs?.partner.naam ?? null, null);
  assert.equal(off.inserts.find((i) => i.type === "spaargeld")?.metadata.eigenaar, undefined);
});

test("AI reader only runs in the EU", () => {
  assert.equal(staysInEu("eu.anthropic.claude-opus-5-5"), true);
  assert.equal(staysInEu("anthropic.claude-opus-4-8"), true);
  for (const id of ["global.anthropic.claude-opus-5-5", "us.anthropic.claude-opus-5-5", "apac.anthropic.claude-opus-5-5", "eu.amazon.nova-pro", ""]) {
    assert.equal(staysInEu(id), false, id);
  }
  assert.ok("eu-central-1" in EU_REGIONS);
  assert.ok(!("eu-west-2" in EU_REGIONS), "London is not in the EU");
  assert.ok(!("eu-central-2" in EU_REGIONS), "Zürich is not in the EU");
});

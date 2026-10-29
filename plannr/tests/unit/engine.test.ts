import { test } from "node:test";
import assert from "node:assert/strict";
import { calculatePlan } from "@/lib/engine";
import { box3Tax, progressiveTax } from "@/lib/engine/mock-engine";
import { toEngineInput } from "@/lib/plan/to-engine-input";
import { DEFAULT_PLAN_CONFIG, type AssetRow, type PlanConfig, type PlanInputs } from "@/lib/plan/types";

function asset(type: string, value: number | null, metadata: Record<string, unknown> = {}): AssetRow {
  return { id: type, firm_id: "f", plan_id: "p", side: type === "bv_aandelen" ? "zakelijk" : "prive", type, tax_box: null, label: "", value, metadata, source: "handmatig", sort_order: 0 };
}

const dgaConfig: PlanConfig = {
  ...DEFAULT_PLAN_CONFIG,
  sections: { eigen_woning: true, inkomen: true, box3: true, pensioen: true, partner: false, kinderen: false, bv: true, balans: true, resultaat: true, pensioen_eigen_beheer: true, dividend: true, eenmanszaak: false },
};

const dgaAssets = [
  asset("eigen_woning", 850_000),
  asset("hypotheek", 400_000, { rente: 3.5 }),
  asset("spaargeld", 120_000),
  asset("beleggingen", 300_000),
  asset("bv_aandelen", null, { bv_naam: "Holding B.V.", aandelen_percentage: 100, eigen_vermogen: 1_200_000, liquide_middelen: 400_000, resultaat_na_belasting: 180_000, odv_waarde: 250_000, salaris_dga: 60_000, dividenduitkering: 50_000 }),
];

const dgaInputs: PlanInputs = { uitgangspunten: { rendement: {}, uitgavenpatroon: { pensioenPct: null, laterLeeftijd: null, laterPct: null } }, uitgaven: {}, prive: { geboortejaar: 1972, pensioenleeftijd: 67, bruto_inkomen: 0, jaarlijkse_uitgaven: 70_000, pensioen_per_jaar: 20_000 }, partner: {}, kinderen: [], schenkingen: [], posten: [], fromDocument: [] };
const dgaInput = () => toEngineInput({ config: dgaConfig, inputs: dgaInputs, assets: dgaAssets, referenceYear: 2026 });

test("progressive tax applies brackets", () => {
  assert.equal(progressiveTax(0, [{ upTo: null, rate: 0.5 }]), 0);
  assert.equal(progressiveTax(100, [{ upTo: 50, rate: 0.1 }, { upTo: null, rate: 0.5 }]), 5 + 25);
});

test("box 3 below the exemption is untaxed", () => {
  assert.equal(box3Tax({ savings: 50_000, other: 0, debts: 0 }).tax, 0);
  assert.ok(box3Tax({ savings: 0, other: 500_000, debts: 0 }).tax > 0);
});

test("calculates a DGA plan deterministically", async () => {
  const a = await calculatePlan(dgaInput());
  const b = await calculatePlan(dgaInput());
  assert.deepEqual(a, b);
  assert.equal(a.wealth.prive.eigenWoningNet, 450_000);
  assert.equal(a.wealth.prive.box3Net, 420_000);
  assert.equal(a.wealth.zakelijk.shareValue, 1_200_000);
  assert.equal(a.wealth.total, 450_000 + 420_000 + 1_200_000);
  assert.equal(a.income.dividendReceived, 50_000);
  assert.equal(a.taxes.lines.length, 3);
  assert.equal(a.projection.points.length, 31);
  const last = a.projection.points.at(-1)!;
  assert.ok(last.optimistisch > last.neutraal && last.neutraal > last.pessimistisch);
  assert.ok(a.engine.isPrototype);
});

test("out-of-scope sections are ignored", async () => {
  const input = dgaInput();
  input.scope = { ...input.scope, bv: false, balans: false, resultaat: false, pensioenEigenBeheer: false, dividend: false };
  const r = await calculatePlan(input);
  assert.equal(r.wealth.zakelijk.total, 0);
  assert.equal(r.income.dividendReceived, 0);
  assert.equal(r.wealth.zakelijk.included, false);
});

test("inflation: plan overrides firm default, and expenses grow with it", async () => {
  const at = (inflatie: number | null, firm: number | null) =>
    toEngineInput({
      config: dgaConfig,
      inputs: { ...dgaInputs, uitgangspunten: { rendement: { inflatie }, uitgavenpatroon: { pensioenPct: null, laterLeeftijd: null, laterPct: null } } },
      assets: dgaAssets,
      referenceYear: 2026,
      firmReturns: { inflatie: firm },
    }).inflation;
  assert.equal(at(null, null), undefined, "engine default");
  assert.equal(at(null, 2.5), 0.025);
  assert.equal(at(3, 2.5), 0.03);

  const low = dgaInput();
  low.inflation = 0.01;
  const high = dgaInput();
  high.inflation = 0.04;
  const [a, b] = await Promise.all([calculatePlan(low), calculatePlan(high)]);
  assert.equal(a.projection.inflation, 0.01);
  // Year 10, both before retirement: expenses of 70.000 in today's money.
  const y = (r: typeof a) => r.projection.points[10].spending;
  assert.ok(Math.abs(y(a) - 70_000 * 1.01 ** 10) < 2, `spending ${y(a)}`);
  assert.ok(Math.abs(y(b) - 70_000 * 1.04 ** 10) < 2, `spending ${y(b)}`);
});

test("fiscal partners split box 2 and get two box 3 allowances", async () => {
  const { SAMPLE_INPUT } = await import("@/lib/pdf/sample");
  const married = await calculatePlan(SAMPLE_INPUT);
  const cohabiting = await calculatePlan({ ...SAMPLE_INPUT, household: { ...SAMPLE_INPUT.household, relation: "samenwonend" } });
  assert.equal(married.household.fiscalPartners, true);
  assert.equal(cohabiting.household.fiscalPartners, false);
  assert.equal(married.household.persons.length, 2);
  assert.equal(married.taxes.box3.exemption, 2 * 57_684);
  // Dividend owned by one partner: splitting it can only lower box 2.
  assert.ok(married.taxes.lines[1].tax <= cohabiting.taxes.lines[1].tax);
});

test("gifts above the exemption create gift tax for the child", async () => {
  const { SAMPLE_INPUT } = await import("@/lib/pdf/sample");
  const year = SAMPLE_INPUT.referenceYear;
  const input = structuredClone(SAMPLE_INPUT);
  input.household.gifts = [{ childName: "Sophie", childBirthYear: 2002, kind: "jaarlijks", amount: 20_000, startYear: year, years: 1 }];
  const r = await calculatePlan(input);
  const sophie = r.gifts!.perChild.find((c) => c.name === "Sophie")!;
  assert.equal(sophie.taxable, 20_000 - 6_633);
  assert.ok(Math.abs(sophie.giftTax - (20_000 - 6_633) * 0.1) < 0.01);
  assert.equal(r.projection.summary.giftsGiven, 0, "the reference-year gift falls before the projection starts");
});

test("retirement funding strategy changes where shortfalls come from", async () => {
  const { SAMPLE_INPUT } = await import("@/lib/pdf/sample");
  const box3First = await calculatePlan({ ...SAMPLE_INPUT, strategy: { retirementFunding: "box3_first" } });
  const bvFirst = await calculatePlan({ ...SAMPLE_INPUT, strategy: { retirementFunding: "bv_first" } });
  assert.ok(bvFirst.projection.summary.fundedFromBv > box3First.projection.summary.fundedFromBv);
  assert.ok(box3First.projection.summary.fundedFromBox3 > bvFirst.projection.summary.fundedFromBox3);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { calculatePlan } from "@/lib/engine";
import { deriveBv, applyBvDerivations, corporateTax } from "@/lib/plan/bv";
import { sanitizePlanInputs } from "@/lib/plan/sanitize";
import { findMissingFields } from "@/lib/plan/status";
import { toEngineInput } from "@/lib/plan/to-engine-input";
import { DEFAULT_PLAN_CONFIG, parsePlanInputs, type AssetRow, type CashItem, type PlanConfig } from "@/lib/plan/types";

let n = 0;
function asset(type: string, value: number | null, metadata: Record<string, unknown> = {}, label = ""): AssetRow {
  n += 1;
  return { id: `${type}-${n}`, firm_id: "f", plan_id: "p", side: type === "bv_aandelen" ? "zakelijk" : "prive", type, tax_box: null, label, value, metadata, source: "handmatig", sort_order: 0 };
}

const config: PlanConfig = {
  ...DEFAULT_PLAN_CONFIG,
  sections: { eigen_woning: true, inkomen: true, box3: true, pensioen: true, partner: false, kinderen: false, bv: true, balans: true, resultaat: true, pensioen_eigen_beheer: false, dividend: true, eenmanszaak: false },
};

const baseAssets = () => [
  asset("eigen_woning", 600_000),
  asset("hypotheek", 300_000, { rente: 4 }),
  asset("spaargeld", 150_000),
  asset("bv_aandelen", null, { bv_naam: "Holding", aandelen_percentage: 100, eigen_vermogen: 1_000_000, liquide_middelen: 300_000, resultaat_na_belasting: 120_000, salaris_dga: 60_000, dividenduitkering: 40_000 }),
];

function item(soort: string, bedrag: number, extra: Partial<CashItem> = {}): CashItem {
  n += 1;
  return { id: `post-${n}`, soort, persoon: "client", omschrijving: "", bedrag, startjaar: null, eindjaar: null, groei: null, ...extra };
}

async function run(posten: CashItem[] = [], assets: AssetRow[] = baseAssets(), cfg: PlanConfig = config) {
  const inputs = parsePlanInputs({ prive: { geboortejaar: 1970, pensioenleeftijd: 63, bruto_inkomen: 0, jaarlijkse_uitgaven: 60_000, pensioen_per_jaar: 10_000 }, posten });
  return calculatePlan(toEngineInput({ config: cfg, inputs, assets, referenceYear: 2026 }));
}

const point = (r: Awaited<ReturnType<typeof run>>, year: number) => r.projection.points.find((p) => p.year === year)!;

test("an income item counts only within its period", async () => {
  const base = await run();
  const r = await run([item("salaris", 30_000, { startjaar: 2026, eindjaar: 2028 })]);
  assert.equal(r.income.otherIncome, 30_000);
  assert.ok(r.taxes.total > base.taxes.total, "taxed in box 1");
  // Net income is higher during the period and back to the base afterwards.
  assert.ok(point(r, 2028).netIncome > point(base, 2028).netIncome + 15_000);
  assert.equal(point(r, 2029).netIncome, point(base, 2029).netIncome);
});

test("a pension item without start year starts at the retirement age", async () => {
  const base = await run();
  const r = await run([item("pensioen_uitkering", 12_000, { groei: 0 })]);
  assert.equal(r.income.otherIncome, 0, "not yet paid this year");
  assert.equal(point(r, 2032).netIncome, point(base, 2032).netIncome, "before retirement (1970 + 63)");
  assert.ok(point(r, 2033).netIncome > point(base, 2033).netIncome, "from the retirement year");
});

test("a one-off expense lowers wealth once, a period expense every year", async () => {
  const base = await run();
  const once = await run([item("eenmalige_uitgave", 50_000, { persoon: null, startjaar: 2027 })]);
  const diff = (y: number) => point(base, y).neutraal - point(once, y).neutraal;
  // Entered in today's money: €50.000 costs €51.150 in 2027 after 2,3% inflation.
  assert.ok(diff(2027) > 51_050 && diff(2027) < 51_250, `diff ${diff(2027)}`);
  assert.equal(point(once, 2027).spending - point(base, 2027).spending > 49_000, true);
  assert.equal(point(once, 2028).spending, point(base, 2028).spending);
});

test("deductible gifts reduce box 1 tax above the 1% threshold", async () => {
  const withSalary = [item("salaris", 100_000)];
  const a = await run(withSalary);
  const b = await run([...withSalary, item("aftrekbare_gift", 5_000)]);
  // Income incl. DGA salary and forfait ≈ 162.100: (5.000 − 1.621) × 37,48% ≈ 1.266
  const saved = a.taxes.lines[0].tax - b.taxes.lines[0].tax;
  assert.ok(saved > 1_200 && saved < 1_330, `saved ${saved}`);
  assert.equal(b.income.expenses - a.income.expenses, 5_000);
});

test("lijfrente: contributions are deductible, payouts are box 1 income, balance counts as wealth", async () => {
  const assets = [...baseAssets(), asset("lijfrente", 100_000, { start_uitkering: 2033, duur_jaren: 10, jaarlijkse_inleg: 5_000 }, "Lijfrente ABN")];
  const withSalary = [item("salaris", 80_000)];
  const base = await run(withSalary);
  const r = await run(withSalary, assets);
  assert.ok(r.taxes.lines[0].tax < base.taxes.lines[0].tax, "contribution lowers box 1");
  assert.ok(r.wealth.prive.otherAssets.some((o) => o.label === "Lijfrente ABN" && o.value === 100_000));
  assert.ok(r.wealth.prive.total - base.wealth.prive.total === 100_000);
  assert.ok(point(r, 2033).netIncome > point(base, 2033).netIncome + 5_000, "payout from 2033");
});

test("an exempt kapitaalverzekering pays out into savings without a wealth jump", async () => {
  const assets = [...baseAssets(), asset("kapitaalverzekering", 80_000, { uitkering_jaar: 2030, verwachte_uitkering: 90_000, fiscaal: "vrijgesteld" })];
  const r = await run([], assets);
  const base = await run();
  assert.equal(r.taxes.box3.base, base.taxes.box3.base, "outside box 3");
  const extra = (y: number) => point(r, y).neutraal - point(base, y).neutraal;
  assert.ok(Math.abs(extra(2030) - extra(2029)) < 6_000, "payout replaces the policy value");
  // A box 3 policy is simply a box 3 asset.
  const b3 = await run([], [...baseAssets(), asset("kapitaalverzekering", 80_000, { uitkering_jaar: 2030, fiscaal: "box3" })]);
  assert.equal(b3.taxes.box3.base - base.taxes.box3.base, 80_000);
});

test("loans from the own BV: box 3 debt, eigen woning, and the excessive-borrowing limit", async () => {
  const base = await run();
  const big = await run([], [...baseAssets(), asset("lening_dga", 650_000, { rente: 3, eigen_woning: "nee" })]);
  assert.equal(big.wealth.prive.bvLoans.total, 650_000);
  assert.equal(big.wealth.prive.bvLoans.excess, 150_000);
  assert.ok(big.warnings.some((w) => w.includes("excessief lenen")));
  assert.equal(big.wealth.prive.box3Debts - base.wealth.prive.box3Debts, 650_000);

  const home = await run([], [...baseAssets(), asset("lening_dga", 650_000, { rente: 3, eigen_woning: "ja" })]);
  assert.equal(home.wealth.prive.bvLoans.excess, 0, "home loans are outside the limit");
  assert.equal(home.wealth.prive.mortgageDebt - base.wealth.prive.mortgageDebt, 650_000);
  assert.ok(home.taxes.lines[0].tax < base.taxes.lines[0].tax, "interest is deductible");
});

test("a loan to the own BV earns box 1 interest (terbeschikkingstelling)", async () => {
  const r = await run([], [...baseAssets(), asset("vordering_bv", 200_000, { rente: 5 })]);
  assert.equal(r.income.otherIncome, 10_000);
  assert.ok(r.wealth.prive.otherAssets.some((o) => o.value === 200_000));
});

test("a werkmaatschappij under a holding is not counted in box 2 twice", async () => {
  const assets = [
    ...baseAssets(),
    asset("bv_aandelen", null, { bv_naam: "Werk BV", aandelen_percentage: 100, eigen_vermogen: 400_000, liquide_middelen: 100_000, resultaat_na_belasting: 80_000, salaris_dga: 0, dividenduitkering: 50_000, gehouden_door: "holding" }),
  ];
  const r = await run([], assets);
  const base = await run();
  assert.equal(r.wealth.zakelijk.shareValue, base.wealth.zakelijk.shareValue);
  assert.equal(r.income.dividendReceived, base.income.dividendReceived);
  assert.ok(r.wealth.zakelijk.companies.some((c) => c.name === "Werk BV" && c.heldByHolding));
  assert.ok(point(r, 2030).neutraal > point(base, 2030).neutraal, "its profit grows the group");
});

test("BV details: equity and result after Vpb are derived", () => {
  const meta = {
    uitgebreid: "ja",
    vaste_activa: 200_000,
    deelnemingen: 500_000,
    liquide_middelen: 300_000,
    bankleningen: 150_000,
    odv_waarde: 100_000,
    opbrengsten: 400_000,
    bedrijfskosten: 100_000,
    salaris_dga: 60_000,
    verlies_te_verrekenen: 40_000,
  };
  const d = deriveBv(meta);
  assert.equal(d.equity, 750_000);
  assert.equal(d.profitBeforeTax, 240_000);
  assert.equal(d.vpb, corporateTax(240_000, 40_000));
  assert.equal(d.vpb, 38_000, "19% over 200.000 after the loss");
  const stored: Record<string, unknown> = applyBvDerivations(meta);
  assert.equal(stored.eigen_vermogen, 750_000);
  assert.equal(stored.resultaat_na_belasting, 202_000);
  assert.equal(deriveBv({ ...meta, uitgebreid: undefined }).equity, null, "only when switched on");
});

test("items are validated and flagged when incomplete", () => {
  const inputs = sanitizePlanInputs({
    posten: [
      { id: "a1", soort: "studiekosten", persoon: "partner", omschrijving: " Studie ", bedrag: -5, startjaar: 2030, eindjaar: 2020, groei: 99 },
      { id: "a2", soort: "eenmalige_uitgave", bedrag: null, eindjaar: 2040 },
      { id: "a3", soort: "onbekend", bedrag: 5 },
    ],
  });
  assert.equal(inputs.posten.length, 2);
  const [a, b] = inputs.posten;
  assert.equal(a.persoon, null, "household item");
  assert.equal(a.omschrijving, "Studie");
  assert.equal(a.bedrag, 0);
  assert.equal(a.eindjaar, 2030, "end not before start");
  assert.equal(a.groei, 20);
  assert.equal(b.eindjaar, null, "one-off has no end");
  const missing = findMissingFields(config, inputs, []).map((m) => m.id);
  assert.ok(missing.includes("post.a2.bedrag") && missing.includes("post.a2.startjaar"));
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { calculatePlan } from "@/lib/engine";
import { aowAge, aowAgeLabel, taxableBusinessProfit } from "@/lib/engine/mock-engine";
import { effectiveReturns, toEngineInput } from "@/lib/plan/to-engine-input";
import { DEFAULT_PLAN_CONFIG, parsePlanInputs, type AssetRow, type PlanConfig } from "@/lib/plan/types";

let n = 0;
function asset(type: string, value: number | null, metadata: Record<string, unknown> = {}): AssetRow {
  n += 1;
  const side = type === "bv_aandelen" || type === "eenmanszaak" ? "zakelijk" : "prive";
  return { id: `${type}-${n}`, firm_id: "f", plan_id: "p", side, type, tax_box: null, label: "", value, metadata, source: "handmatig", sort_order: 0 };
}

const config: PlanConfig = {
  ...DEFAULT_PLAN_CONFIG,
  sections: { ...DEFAULT_PLAN_CONFIG.sections, partner: true, bv: true, balans: true, resultaat: true, dividend: true },
};
const baseAssets = () => [
  asset("eigen_woning", 700_000),
  asset("hypotheek", 300_000, { rente: 4 }),
  asset("spaargeld", 100_000),
  asset("beleggingen", 400_000),
  asset("overig_vastgoed_nl", 300_000),
  asset("bv_aandelen", null, { aandelen_percentage: 100, eigen_vermogen: 800_000, liquide_middelen: 300_000, resultaat_na_belasting: 90_000, salaris_dga: 60_000, dividenduitkering: 30_000 }),
];

async function run(opts: { inputs?: Record<string, unknown>; assets?: AssetRow[]; cfg?: PlanConfig; firm?: Record<string, number> } = {}) {
  const inputs = parsePlanInputs({
    prive: { geboortejaar: 1966, pensioenleeftijd: 64, bruto_inkomen: 0, jaarlijkse_uitgaven: 80_000, pensioen_per_jaar: 15_000 },
    partner: { naam: "Eva", relatie: "gehuwd", geboortejaar: 1972, pensioenleeftijd: 68, bruto_inkomen: 40_000 },
    ...opts.inputs,
  });
  return calculatePlan(toEngineInput({ config: opts.cfg ?? config, inputs, assets: opts.assets ?? baseAssets(), referenceYear: 2026, firmReturns: opts.firm }));
}
const point = (r: Awaited<ReturnType<typeof run>>, year: number) => r.projection.points.find((p) => p.year === year)!;

test("AOW age by birth year, with the partial first year", () => {
  assert.deepEqual(aowAge(1958), { years: 67, months: 0 });
  assert.deepEqual(aowAge(1962), { years: 67, months: 3 });
  assert.deepEqual(aowAge(1980), { years: 68, months: 0 });
  assert.equal(aowAgeLabel(1962), "67 jaar en 3 maanden");
  assert.equal(aowAgeLabel(1980), "68 jaar");
});

test("life events: retirement and AOW for client and partner, with ages on every point", async () => {
  const r = await run();
  const labels = r.projection.events.map((e) => `${e.year} ${e.label}`);
  assert.ok(labels.includes("2030 Pensioen Cliënt (64)"), labels.join(" | "));
  assert.ok(labels.includes("2040 Pensioen Eva (68)"));
  assert.ok(labels.some((l) => l.startsWith("2033 AOW Cliënt")), "born 1966: 67 years and 6 months → AOW starts in 2033");
  assert.equal(point(r, 2030).age, 64);
  assert.equal(point(r, 2030).partnerAge, 58);
  assert.equal(r.household.persons[1].aowAgeLabel, "67 jaar en 9 maanden");
});

test("wealth components add up to the neutral total every year", async () => {
  const r = await run();
  for (const p of r.projection.points) {
    const c = p.components;
    const sum = c.woning + c.box3 + c.polissen + c.bv + c.onderneming;
    assert.ok(Math.abs(sum - p.neutraal) < 1, `${p.year}: ${sum} vs ${p.neutraal}`);
  }
});

test("spending pattern: less spending after retirement and later in life", async () => {
  const flat = await run();
  const pattern = await run({ inputs: { uitgangspunten: { uitgavenpatroon: { pensioenPct: 90, laterLeeftijd: 75, laterPct: 70 } } } });
  assert.equal(point(pattern, 2029).spending, point(flat, 2029).spending, "unchanged while working");
  const ratio = (y: number) => point(pattern, y).spending / point(flat, y).spending;
  assert.ok(Math.abs(ratio(2031) - 0.9) < 0.001, `retired: ${ratio(2031)}`);
  assert.ok(Math.abs(ratio(2042) - 0.7) < 0.001, `from 75 (2041): ${ratio(2042)}`);
  assert.ok(point(pattern, 2056).neutraal > point(flat, 2056).neutraal);
});

test("RVR: plan overrides the firm default, which overrides Plannr's default", async () => {
  assert.deepEqual(effectiveReturns({ beleggingen: 5, sparen: 1 }, { beleggingen: 6 }), { investments: 0.06, savings: 0.01 });
  const base = await run();
  assert.equal(base.projection.returns.investments, 0.04);
  assert.equal(base.projection.scenarios.neutraal.returnRate, 0.04);
  const firm = await run({ firm: { beleggingen: 6 } });
  assert.equal(firm.projection.returns.investments, 0.06);
  assert.ok(Math.abs(firm.projection.scenarios.optimistisch.returnRate - 0.08) < 1e-9, "spread on top of RVR");
  assert.ok(point(firm, 2040).components.box3 > point(base, 2040).components.box3);
  const plan = await run({ firm: { beleggingen: 6 }, inputs: { uitgangspunten: { rendement: { beleggingen: 3, vastgoed: 1 } } } });
  assert.equal(plan.projection.returns.investments, 0.03);
  assert.ok(point(plan, 2040).components.box3 < point(base, 2040).components.box3);
});

test("eenmanszaak: entrepreneur deductions, box 1 profit and business equity", async () => {
  // 60.000 − 2.470 zelfstandigenaftrek − 2.123 startersaftrek, then 12,7% MKB-winstvrijstelling
  assert.ok(Math.abs(taxableBusinessProfit(60_000, { hoursCriterion: true, starter: true, yearIndex: 0 }) - 48_370.31) < 0.01);
  assert.ok(Math.abs(taxableBusinessProfit(60_000, { hoursCriterion: true, starter: true, yearIndex: 3 }) - 50_223.69) < 0.01, "no startersaftrek after 3 years");
  assert.ok(Math.abs(taxableBusinessProfit(60_000, { hoursCriterion: false, starter: true, yearIndex: 0 }) - 52_380) < 0.01);

  const cfg: PlanConfig = { ...config, sections: { ...config.sections, eenmanszaak: true } };
  const base = await run({ cfg });
  const withShop = await run({
    cfg,
    assets: [...baseAssets(), asset("eenmanszaak", 120_000, { naam: "Atelier Eva", eigenaar: "partner", winst: 50_000, urencriterium: "ja", starter: "nee" })],
  });
  assert.equal(withShop.income.businessProfit, 50_000);
  assert.equal(withShop.household.persons[1].businessProfit, 50_000);
  assert.ok(withShop.taxes.lines[0].tax > base.taxes.lines[0].tax);
  assert.equal(withShop.wealth.zakelijk.total - base.wealth.zakelijk.total, 120_000);
  assert.equal(withShop.wealth.zakelijk.soleTraders[0].name, "Atelier Eva");
  // Runs until the partner retires (2040), then stops.
  const gap = (y: number) => point(withShop, y).netIncome - point(base, y).netIncome;
  assert.ok(gap(2039) > 20_000);
  assert.ok(Math.abs(gap(2040)) < 1);
  // Section off: ignored.
  const off = await run({ assets: [...baseAssets(), asset("eenmanszaak", 120_000, { winst: 50_000 })] });
  assert.equal(off.income.businessProfit, 0);
});

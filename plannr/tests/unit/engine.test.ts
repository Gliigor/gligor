import { test } from "node:test";
import assert from "node:assert/strict";
import { calculatePlan } from "@/lib/engine";
import { box3Tax, progressiveTax } from "@/lib/engine/mock-engine";
import { toEngineInput } from "@/lib/plan/to-engine-input";
import { DEFAULT_PLAN_CONFIG, type AssetRow, type PlanConfig } from "@/lib/plan/types";

function asset(type: string, value: number | null, metadata: Record<string, unknown> = {}): AssetRow {
  return { id: type, firm_id: "f", plan_id: "p", side: type === "bv_aandelen" ? "zakelijk" : "prive", type, tax_box: null, label: "", value, metadata, source: "handmatig", sort_order: 0 };
}

const dgaConfig: PlanConfig = {
  ...DEFAULT_PLAN_CONFIG,
  sections: { eigen_woning: true, inkomen: true, box3: true, pensioen: true, bv: true, balans: true, resultaat: true, pensioen_eigen_beheer: true, dividend: true },
};

const dgaAssets = [
  asset("eigen_woning", 850_000),
  asset("hypotheek", 400_000, { rente: 3.5 }),
  asset("spaargeld", 120_000),
  asset("beleggingen", 300_000),
  asset("bv_aandelen", null, { bv_naam: "Holding B.V.", aandelen_percentage: 100, eigen_vermogen: 1_200_000, liquide_middelen: 400_000, resultaat_na_belasting: 180_000, odv_waarde: 250_000, salaris_dga: 60_000, dividenduitkering: 50_000 }),
];

const dgaInput = () =>
  toEngineInput({
    config: dgaConfig,
    inputs: { prive: { geboortejaar: 1972, pensioenleeftijd: 67, bruto_inkomen: 0, jaarlijkse_uitgaven: 70_000, pensioen_per_jaar: 20_000, aow_situatie: "samenwonend" }, fromDocument: [] },
    assets: dgaAssets,
    referenceYear: 2026,
  });

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
});

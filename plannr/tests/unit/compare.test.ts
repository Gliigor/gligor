import { test } from "node:test";
import assert from "node:assert/strict";
import { calculatePlan } from "@/lib/engine";
import { buildVariants, defaultParams, summarize, toOutcome, type ComparisonKind } from "@/lib/compare";
import { SAMPLE_INPUT } from "@/lib/pdf/sample";

async function run(kind: ComparisonKind, input = SAMPLE_INPUT) {
  const params = defaultParams(kind, input);
  const built = buildVariants(kind, input, params);
  if ("reason" in built) return { reason: built.reason };
  const outcomes = [];
  for (const v of built.variants) outcomes.push(toOutcome(v, await calculatePlan(v.input)));
  return summarize(kind, params, outcomes);
}

test("all four comparisons run on the sample household", async () => {
  for (const kind of ["pensioen_financiering", "aflossen", "salaris_dividend", "schenken"] as const) {
    const out = await run(kind);
    assert.ok(!("reason" in out), `${kind} should be available`);
    if (!("reason" in out)) {
      assert.ok(out.variants.length >= 2, kind);
      assert.ok(out.conclusion.length > 20, kind);
    }
  }
});

test("repaying a 3.6% mortgage from 1.5% savings leaves more wealth", async () => {
  const out = await run("aflossen");
  if ("reason" in out) throw new Error(out.reason);
  const [none, repay] = out.variants;
  assert.ok(repay.endWealth > none.endWealth);
  assert.ok(repay.taxNow < none.taxNow + 1_000, "box 3 now drops; box 1 rises a little");
});

test("gifting the yearly exemption moves money to the children and lowers parents' tax", async () => {
  const out = await run("schenken");
  if ("reason" in out) throw new Error(out.reason);
  const none = out.variants.find((v) => v.key === "geen")!;
  const max = out.variants.find((v) => v.key === "max")!;
  assert.equal(none.giftsGiven, 0);
  assert.ok(max.giftsGiven > 0);
  assert.ok(max.endWealth < none.endWealth, "parents keep less");
});

test("comparisons explain why they do not apply", async () => {
  const input = structuredClone(SAMPLE_INPUT);
  input.scope = { ...input.scope, kinderen: false };
  const out = await run("schenken", input);
  assert.ok("reason" in out);
});

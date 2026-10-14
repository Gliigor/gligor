import { test } from "node:test";
import assert from "node:assert/strict";
import { calculatePlan } from "@/lib/engine";
import { deriveInsights } from "@/lib/insights";
import { SAMPLE_INPUT } from "@/lib/pdf/sample";

test("sample DGA case produces expected insights", async () => {
  const result = await calculatePlan(SAMPLE_INPUT);
  const ids = deriveInsights(SAMPLE_INPUT, result).map((i) => i.id);
  assert.ok(ids.includes("aow-gat"), "retiring at 65 leaves an AOW gap");
  assert.ok(ids.includes("bv-ruime-liquiditeit"), "BV with € 520k cash");
  assert.ok(!ids.includes("dga-salaris-onder-gebruikelijk-loon"), "salary above gebruikelijk loon");
});

test("low DGA salary and high dividend are flagged", async () => {
  const input = structuredClone(SAMPLE_INPUT);
  input.zakelijk.companies[0].dgaSalary = 30_000;
  input.zakelijk.companies[0].dividend = 150_000;
  const insights = deriveInsights(input, await calculatePlan(input));
  const low = insights.find((i) => i.id === "dga-salaris-onder-gebruikelijk-loon");
  assert.ok(low && low.amount && low.amount.value > 0);
  assert.ok(insights.some((i) => i.id === "box2-hoog-tarief"));
  assert.equal(insights[0].tone, "aandacht", "attention points come first");
});

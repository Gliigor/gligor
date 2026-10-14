import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStepStatuses, findMissingFields } from "@/lib/plan/status";
import { DEFAULT_PLAN_CONFIG, parsePlanConfig, parsePlanInputs } from "@/lib/plan/types";

test("parses unknown config defensively", () => {
  const c = parsePlanConfig({ sections: { bv: true, onzin: true }, reportSections: ["samenvatting", "x"], visitedSteps: ["prive", "y"] });
  assert.equal(c.sections.bv, true);
  assert.equal(c.sections.box3, DEFAULT_PLAN_CONFIG.sections.box3);
  assert.deepEqual(c.reportSections, ["samenvatting"]);
  assert.deepEqual(c.visitedSteps, ["prive"]);
});

test("missing fields follow the configuration", () => {
  const inputs = parsePlanInputs({});
  const all = findMissingFields(DEFAULT_PLAN_CONFIG, inputs, []);
  assert.ok(all.some((m) => m.id === "input.geboortejaar"));
  assert.ok(all.some((m) => m.id === "type.eigen_woning"));
  assert.ok(!all.some((m) => m.side === "zakelijk"));

  const noHouse = { ...DEFAULT_PLAN_CONFIG, sections: { ...DEFAULT_PLAN_CONFIG.sections, eigen_woning: false } };
  assert.ok(!findMissingFields(noHouse, inputs, []).some((m) => m.id === "type.eigen_woning"));
});

test("zakelijk step is n/a without zakelijk sections", () => {
  const statuses = computeStepStatuses({ config: DEFAULT_PLAN_CONFIG, inputs: parsePlanInputs({}), assets: [], documentCount: 0, exportCount: 0 });
  assert.equal(statuses.find((s) => s.key === "zakelijk")!.state, "not_applicable");
  assert.equal(statuses.find((s) => s.key === "configuratie")!.state, "complete");
});

test("extraction fills an empty placeholder row instead of duplicating it", async () => {
  const { planExtractionChanges } = await import("@/lib/extraction/apply");
  const placeholder = { id: "p1", firm_id: "f", plan_id: "p", side: "prive" as const, type: "spaargeld", tax_box: 3, label: "", value: null, metadata: {}, source: "handmatig" as const, sort_order: 0 };
  const changes = planExtractionChanges(
    { documentType: "ib_aangifte", year: 2025, method: "ai", partner: {}, sources: [], prive: { geboortejaar: 1974 }, assets: [{ type: "spaargeld", label: "Spaarrekening", value: 1000 }, { type: "bv_aandelen", metadata: { eigen_vermogen: 5 } }], notes: [] },
    DEFAULT_PLAN_CONFIG,
    parsePlanInputs({}),
    [placeholder],
  );
  assert.equal(changes.inserts.length, 0, "zakelijk data ignored when zakelijk is off; spaargeld reuses placeholder");
  assert.equal(changes.updates[0].id, "p1");
  assert.deepEqual(changes.updates[0].metadata._fromDocument, ["value"]);
  assert.deepEqual(changes.inputs?.fromDocument, ["geboortejaar"]);
});

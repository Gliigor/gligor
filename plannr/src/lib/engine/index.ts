// The ONLY entry point for plan calculations.
//
// The UI, the results step and the PDF report call calculatePlan() and nothing
// else. To switch to a licensed calculation API (rekenkern, e.g. Bokkz or
// FINACT), replace the body of this function with a call to that API and map
// its response onto PlanResult — no other file needs to change.
//
// It is async on purpose: an external API call will be.

import { mockCalculate } from "./mock-engine";
import type { PlanInput, PlanResult } from "./types";

export type { PlanInput, PlanResult } from "./types";

export async function calculatePlan(input: PlanInput): Promise<PlanResult> {
  return mockCalculate(input);
}

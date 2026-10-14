"use client";

import { useEffect } from "react";
import { markStepVisited } from "@/lib/actions/plan";

/** Records that the planner opened this step (drives the progress bar). */
export function StepVisit({ planId, step }: { planId: string; step: string }) {
  useEffect(() => {
    void markStepVisited(planId, step);
  }, [planId, step]);
  return null;
}

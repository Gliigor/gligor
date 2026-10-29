import { notFound, redirect } from "next/navigation";
import { loadPlan } from "@/lib/plan/load";
import { isStepKey, LEGACY_STEPS } from "@/lib/plan/definitions";

export default async function PlanIndex({ params }: PageProps<"/clienten/[clientId]/plannen/[planId]">) {
  const { clientId, planId } = await params;
  const bundle = await loadPlan(planId);
  if (!bundle) notFound();
  const current = bundle.plan.current_step;
  const step = isStepKey(current) ? current : (LEGACY_STEPS[current] ?? "documenten");
  redirect(`/clienten/${clientId}/plannen/${planId}/${step}`);
}

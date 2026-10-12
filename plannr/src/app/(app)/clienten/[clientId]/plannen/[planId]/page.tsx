import { notFound, redirect } from "next/navigation";
import { loadPlan } from "@/lib/plan/load";
import { isStepKey } from "@/lib/plan/definitions";

export default async function PlanIndex({ params }: PageProps<"/clienten/[clientId]/plannen/[planId]">) {
  const { clientId, planId } = await params;
  const bundle = await loadPlan(planId);
  if (!bundle) notFound();
  const step = isStepKey(bundle.plan.current_step) ? bundle.plan.current_step : "configuratie";
  redirect(`/clienten/${clientId}/plannen/${planId}/${step}`);
}

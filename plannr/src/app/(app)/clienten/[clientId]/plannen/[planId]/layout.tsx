import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { loadPlan } from "@/lib/plan/load";
import { computeStepStatuses } from "@/lib/plan/status";
import { fullName } from "@/lib/format";
import { ArrowLeft } from "@/components/ui/icons";
import { ProgressBar } from "@/components/plan/progress-bar";
import { PlanHeader } from "@/components/plan/plan-header";

export default async function PlanLayout({ children, params }: LayoutProps<"/clienten/[clientId]/plannen/[planId]">) {
  const { clientId, planId } = await params;
  await requireMember();
  const bundle = await loadPlan(planId);
  if (!bundle || bundle.client.id !== clientId) notFound();

  const steps = computeStepStatuses({
    config: bundle.config,
    inputs: bundle.inputs,
    assets: bundle.assets,
    documentCount: bundle.documents.length,
    exportCount: bundle.exports.length,
  });
  const baseHref = `/clienten/${clientId}/plannen/${planId}`;

  return (
    <div className="space-y-5">
      <Link href={`/clienten/${clientId}`} className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" /> {fullName(bundle.client)}
        {bundle.client.company_name ? <span className="hidden sm:inline"> · {bundle.client.company_name}</span> : null}
      </Link>
      <PlanHeader planId={planId} clientId={clientId} title={bundle.plan.title} status={bundle.plan.status} />
      <ProgressBar baseHref={baseHref} steps={steps} />
      <div>{children}</div>
    </div>
  );
}

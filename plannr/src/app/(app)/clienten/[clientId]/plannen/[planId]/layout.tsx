import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadPlan } from "@/lib/plan/load";
import { computeStepStatuses } from "@/lib/plan/status";
import { fullName } from "@/lib/format";
import { ArrowLeft } from "@/components/ui/icons";
import { ProgressBar } from "@/components/plan/progress-bar";
import { PlanHeader } from "@/components/plan/plan-header";

async function plansOf(clientId: string) {
  const supabase = await createClient();
  // "*": optional columns may not exist before their migration.
  const { data } = await supabase.from("plans").select("*").eq("client_id", clientId).order("updated_at", { ascending: false });
  return (data ?? []).map((p) => ({
    id: p.id as string,
    title: p.title as string,
    isScenario: Boolean(p.scenario_van),
    archived: Boolean(p.gearchiveerd_op),
  }));
}

async function baseOf(id: string | null | undefined) {
  if (!id) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("plans").select("id, title").eq("id", id).maybeSingle();
  return data ? { id: data.id as string, title: data.title as string } : null;
}

export default async function PlanLayout({ children, params }: LayoutProps<"/clienten/[clientId]/plannen/[planId]">) {
  const { clientId, planId } = await params;
  // Both start at once; RLS keeps loadPlan empty for anyone not allowed to see it.
  const [, bundle] = await Promise.all([requireMember(), loadPlan(planId)]);
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
    <div className="space-y-6">
      <Link href={`/clienten/${clientId}`} className="eyebrow inline-flex items-center gap-1.5 hover:text-ink-900">
        <ArrowLeft className="h-3.5 w-3.5" /> {fullName(bundle.client)}
        {bundle.client.company_name ? <span className="hidden sm:inline"> · {bundle.client.company_name}</span> : null}
      </Link>
      <PlanHeader
        planId={planId}
        clientId={clientId}
        title={bundle.plan.title}
        status={bundle.plan.status}
        scenarioOf={await baseOf(bundle.plan.scenario_van)}
        archivedAt={bundle.plan.gearchiveerd_op}
        clientPlans={await plansOf(clientId)}
      />
      <ProgressBar baseHref={baseHref} steps={steps} />
      <div>{children}</div>
    </div>
  );
}

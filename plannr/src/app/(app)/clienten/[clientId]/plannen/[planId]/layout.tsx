import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadPlan } from "@/lib/plan/load";
import { clientHasCompany, computeStepStatuses } from "@/lib/plan/status";
import { fullName } from "@/lib/format";
import { StepPlan } from "@/components/plan/step-plan";
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
    hasCompany: clientHasCompany(bundle.client),
  });
  const baseHref = `/clienten/${clientId}/plannen/${planId}`;

  return (
    <div className="space-y-8">
      <PlanHeader
        planId={planId}
        clientId={clientId}
        clientName={fullName(bundle.client)}
        title={bundle.plan.title}
        status={bundle.plan.status}
        scenarioOf={await baseOf(bundle.plan.scenario_van)}
        archivedAt={bundle.plan.gearchiveerd_op}
        clientPlans={await plansOf(clientId)}
      />
      <div className="lg:grid lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-14">
        <StepPlan baseHref={baseHref} steps={steps} />
        <div className="mt-8 min-w-0 lg:mt-0">{children}</div>
      </div>
    </div>
  );
}

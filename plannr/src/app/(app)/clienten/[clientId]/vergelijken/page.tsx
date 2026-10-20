import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { calculatePlan } from "@/lib/engine";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { loadPlan } from "@/lib/plan/load";
import { toEngineInput } from "@/lib/plan/to-engine-input";
import { fullName } from "@/lib/format";
import { MAX_COMPARE, toColumn, type ScenarioColumn } from "@/lib/scenarios";
import type { ClientRow } from "@/lib/plan/types";
import { CompareView } from "./compare-view";

export const metadata = { title: "Plannen vergelijken" };

export default async function ComparePage({ params, searchParams }: PageProps<"/clienten/[clientId]/vergelijken">) {
  const { clientId } = await params;
  const sp = await searchParams;
  const member = await requireMember();
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle<ClientRow>();
  if (!client) notFound();

  // select("*"): scenario_van may not exist before the scenarios migration.
  const { data: plans } = await supabase.from("plans").select("*").eq("client_id", clientId).order("created_at");
  const all = (plans ?? []) as { id: string; title: string; scenario_van?: string | null; gearchiveerd_op?: string | null }[];

  // Selection: ?plannen=a,b,c, or ?plan=x (that plan with its base and sibling scenarios), or the first plans.
  const pick = (v: string | string[] | undefined) => (typeof v === "string" ? v.split(",") : Array.isArray(v) ? v : []);
  const raw = [...pick(sp.plannen), ...pick(sp.kies)];
  let selected = all.filter((p) => raw.includes(p.id));
  if (selected.length === 0 && typeof sp.plan === "string") {
    const start = all.find((p) => p.id === sp.plan);
    const root = start?.scenario_van ?? start?.id;
    selected = all.filter((p) => p.id === root || p.scenario_van === root);
  }
  // Nothing chosen: show the choice, don't guess.
  selected = selected.slice(0, MAX_COMPARE);

  const columns: ScenarioColumn[] = [];
  for (const p of selected) {
    const bundle = await loadPlan(p.id);
    if (!bundle) continue;
    const input = toEngineInput({
      config: bundle.config,
      inputs: bundle.inputs,
      assets: bundle.assets,
      referenceYear: new Date().getFullYear(),
      clientName: client.first_name,
      firmReturns: member.firm.rendement_standaard,
    });
    columns.push(toColumn(p, input, await calculatePlan(input)));
  }

  return (
    <div className="space-y-7">
      <PageHeader back={{ href: `/clienten/${clientId}`, label: fullName(client) }} eyebrow="Scenario's" title="Plannen vergelijken" />

      <Card>
        <CardHeader title="Kies plannen" description={`Maximaal ${MAX_COMPARE} plannen naast elkaar.`} />
        <form className="flex flex-wrap items-center gap-x-5 gap-y-2 p-4 sm:p-5" action={`/clienten/${clientId}/vergelijken`}>
          {all.filter((p) => !p.gearchiveerd_op || selected.some((x) => x.id === p.id)).map((p) => (
            <label key={p.id} className="inline-flex items-center gap-2 text-sm text-ink-800">
              <input
                type="checkbox"
                name="kies"
                value={p.id}
                defaultChecked={selected.some((s) => s.id === p.id)}
                className="h-4 w-4 accent-gold-500"
              />
              {p.title}
              {p.scenario_van ? <span className="text-xs text-ink-400">scenario</span> : null}
              {p.gearchiveerd_op ? <span className="text-xs text-ink-400">gearchiveerd</span> : null}
            </label>
          ))}
          <SelectionSubmit />
        </form>
      </Card>

      {columns.length < 2 ? (
        <Card className="p-6 text-sm text-ink-600">
          Vink minstens twee plannen aan en klik op <strong>Vergelijken</strong>. Een scenario maakt u in een plan met de knop{" "}
          <strong>Maak scenario</strong>.{" "}
          <Link href={`/clienten/${clientId}`} className="underline decoration-gold-500 underline-offset-4">
            Terug naar de cliënt
          </Link>
        </Card>
      ) : (
        <CompareView clientId={clientId} columns={columns} />
      )}
    </div>
  );
}

/** Turns the checked boxes into ?plannen=a,b,c (works without JavaScript too via "kies"). */
function SelectionSubmit() {
  return (
    <button type="submit" className="ml-auto h-9 rounded-sm bg-night px-4 text-[13px] font-semibold text-white hover:bg-ink-800">
      Vergelijken
    </button>
  );
}

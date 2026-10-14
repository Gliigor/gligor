import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { fullName } from "@/lib/format";
import { NewPlanForm } from "./new-plan-form";

export const metadata = { title: "Nieuw plan" };

export default async function NewPlanPage({ params }: PageProps<"/clienten/[clientId]/plannen/nieuw">) {
  const { clientId } = await params;
  await requireMember();
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("first_name, last_name").eq("id", clientId).maybeSingle();
  if (!client) notFound();
  const { count } = await supabase.from("plans").select("id", { count: "exact", head: true }).eq("client_id", clientId);
  const year = new Date().getFullYear();
  const suggestion = (count ?? 0) === 0 ? `Plan ${year}` : `Plan ${year} (${(count ?? 0) + 1})`;

  return (
    <div className="mx-auto max-w-xl space-y-7">
      <PageHeader back={{ href: `/clienten/${clientId}`, label: fullName(client) }} eyebrow="Toevoegen" title="Nieuw plan" />
      <Card className="p-6">
        <NewPlanForm clientId={clientId} suggestion={suggestion} />
      </Card>
    </div>
  );
}

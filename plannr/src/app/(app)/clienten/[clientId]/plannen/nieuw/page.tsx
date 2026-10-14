import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "@/components/ui/icons";
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
    <div className="mx-auto max-w-lg space-y-4">
      <Link href={`/clienten/${clientId}`} className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" /> {fullName(client)}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Nieuw plan</h1>
      <Card className="p-5">
        <NewPlanForm clientId={clientId} suggestion={suggestion} />
      </Card>
    </div>
  );
}

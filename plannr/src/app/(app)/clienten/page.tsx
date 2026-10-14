import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PlusLink } from "@/components/ui/button";
import { FormSuccess } from "@/components/ui/form";
import type { ClientRow } from "@/lib/plan/types";
import { ClientList } from "./client-list";

export const metadata = { title: "Cliënten" };

const NOTICES: Record<string, string> = {
  "alleen-eigenaar": "Alleen de eigenaar van het kantoor kan instellingen wijzigen.",
  "client-verwijderd": "De cliënt en alle bijbehorende gegevens zijn verwijderd.",
};

export default async function ClientsPage({ searchParams }: PageProps<"/clienten">) {
  await requireMember();
  const params = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, first_name, last_name, company_name, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1000);
  const clients = (data ?? []) as Pick<ClientRow, "id" | "first_name" | "last_name" | "company_name" | "updated_at">[];
  const notice = typeof params.melding === "string" ? NOTICES[params.melding] : undefined;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cliënten</h1>
          <p className="text-sm text-ink-500">Gesorteerd op laatste wijziging</p>
        </div>
        <PlusLink href="/clienten/nieuw" label="Nieuwe cliënt" />
      </div>
      {notice ? <FormSuccess message={notice} /> : null}
      {error ? <p className="text-sm text-danger-600">Cliënten konden niet worden geladen.</p> : <ClientList clients={clients} />}
    </div>
  );
}

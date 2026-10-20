import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { PlusLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { ArrowRight, Download, FileText } from "@/components/ui/icons";
import { formatDateTime, fullName } from "@/lib/format";
import { PLAN_STATUS_LABELS, type ClientRow, type PlanStatus } from "@/lib/plan/types";
import { Notes, type NoteItem } from "./notes";
import { ClientSettings } from "./client-settings";

const STATUS_TONE: Record<PlanStatus, "neutral" | "brand" | "ok"> = {
  concept: "neutral",
  in_bewerking: "brand",
  afgerond: "ok",
};

export async function generateMetadata({ params }: PageProps<"/clienten/[clientId]">) {
  const { clientId } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("first_name, last_name").eq("id", clientId).maybeSingle();
  return { title: data ? fullName(data) : "Cliënt" };
}

export default async function ClientPage({ params }: PageProps<"/clienten/[clientId]">) {
  const { clientId } = await params;
  const member = await requireMember();
  const supabase = await createClient();

  const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle<ClientRow>();
  if (!client) notFound();

  const [{ data: notes }, { data: plans }, { data: users }] = await Promise.all([
    supabase
      .from("client_notes")
      .select("id, content, created_at, updated_at, author_id")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("plans")
      // "*": scenario_van may not exist before the scenarios migration.
      .select("*, exports(id, created_at, sections_included)")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false }),
    supabase.from("users").select("id, name, email"),
  ]);

  const nameOf = new Map((users ?? []).map((u) => [u.id as string, (u.name as string) || (u.email as string)]));
  const noteItems: NoteItem[] = (notes ?? []).map((n) => ({
    id: n.id,
    content: n.content,
    createdAt: n.created_at,
    edited: n.updated_at !== n.created_at,
    authorName: n.author_id ? (nameOf.get(n.author_id) ?? "Onbekend") : "Onbekend",
    canEdit: n.author_id === member.userId || member.isOwner,
  }));

  type HistoryItem = { at: string; kind: "plan" | "export"; title: string; planId: string; exportId?: string };
  const history: HistoryItem[] = [];
  for (const p of plans ?? []) {
    history.push({ at: p.created_at, kind: "plan", title: p.title, planId: p.id });
    for (const e of (p.exports as { id: string; created_at: string }[]) ?? []) {
      history.push({ at: e.created_at, kind: "export", title: p.title, planId: p.id, exportId: e.id });
    }
  }
  history.sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="space-y-8">
      <PageHeader
        back={{ href: "/clienten", label: "Cliënten" }}
        eyebrow={client.company_name ?? "Cliënt"}
        title={fullName(client)}
        actions={<ClientSettings client={client} canDelete={member.isOwner} />}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Plannen"
              description="Elk plan blijft altijd bewerkbaar."
              action={
                <div className="flex items-center gap-3">
                  {plans && plans.length > 1 ? (
                    <Link href={`/clienten/${clientId}/vergelijken`} className="text-[13px] font-semibold text-ink-800 underline decoration-gold-500 underline-offset-4">
                      Vergelijken
                    </Link>
                  ) : null}
                  <PlusLink href={`/clienten/${clientId}/plannen/nieuw`} label="Nieuw plan" compact />
                </div>
              }
            />
            {plans && plans.length > 0 ? (
              <ul className="divide-y divide-ink-100">
                {plans.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/clienten/${clientId}/plannen/${p.id}`}
                      className="flex items-center gap-4 px-4 py-3.5 hover:bg-ink-50 sm:px-5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{p.title}</span>
                          {p.scenario_van ? <Badge>scenario</Badge> : null}
                        </div>
                        <div className="text-xs text-ink-500 tabular">Gewijzigd {formatDateTime(p.updated_at)}</div>
                      </div>
                      <Badge tone={STATUS_TONE[p.status as PlanStatus]}>{PLAN_STATUS_LABELS[p.status as PlanStatus]}</Badge>
                      <ArrowRight className="h-5 w-5 shrink-0 text-ink-400" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Nog geen plannen">Maak een plan aan met de +.</EmptyState>
            )}
          </Card>

          <Card>
            <CardHeader title="Historie" description="Plannen en geëxporteerde rapporten, nieuwste eerst." />
            {history.length > 0 ? (
              <ol className="divide-y divide-ink-100">
                {history.map((h) => (
                  <li key={`${h.kind}-${h.exportId ?? h.planId}`} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        h.kind === "export" ? "bg-brand-50 text-brand-600" : "bg-ink-100 text-ink-500"
                      }`}
                    >
                      <FileText className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {h.kind === "export" ? `PDF-rapport geëxporteerd — ${h.title}` : `Plan aangemaakt — ${h.title}`}
                      </div>
                      <div className="text-xs text-ink-500 tabular">{formatDateTime(h.at)}</div>
                    </div>
                    {h.exportId ? (
                      <a
                        href={`/api/exports/${h.exportId}`}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-brand-600 hover:bg-brand-50"
                      >
                        <Download className="h-4 w-4" /> <span className="hidden sm:inline">Download</span>
                      </a>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="Nog geen historie" />
            )}
          </Card>
        </div>

        <Notes clientId={clientId} notes={noteItems} />
      </div>
    </div>
  );
}

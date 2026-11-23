import Link from "next/link";
import { redirect } from "next/navigation";
import { asAdmin } from "@/lib/auth";
import { deadlineState, responseDeadline } from "@/lib/domain/tickets";
import { TICKET_STATUS_LABEL, PACKAGES, type PackageKey, type TicketStatus } from "@/lib/config";
import { formatDateTime } from "@/lib/format";
import type { TicketRow } from "@/lib/types";
import { Empty, PageHeader } from "@/components/ui";
import { DeadlinePill, TicketPill } from "@/components/status";
import { KeyTable } from "@/components/KeyTable";

export const metadata = { title: "Tickets" };

type Row = TicketRow & { company: string | null; package: PackageKey | null; last_from: string | null; messages: number };

export default async function TicketsPage({ searchParams }: { searchParams: Promise<{ status?: string; nummer?: string }> }) {
  const sp = await searchParams;
  if (sp.nummer) {
    const [t] = await asAdmin((q) => q<{ id: string }>("select id from tickets where number = $1", [Number(sp.nummer)]));
    if (t) redirect(`/tickets/${t.id}`);
  }
  const filter = (sp.status ?? "actief") as TicketStatus | "actief" | "alle";
  const rows = await asAdmin((q) =>
    q<Row>(
      `select t.*, c.company, c.package,
         (select m.from_email from ticket_messages m where m.ticket_id = t.id and m.direction = 'in' order by m.created_at desc limit 1) as last_from,
         (select count(*)::int from ticket_messages m where m.ticket_id = t.id) as messages
       from tickets t left join clients c on c.id = t.client_id
       order by t.awaiting_since asc nulls last, t.updated_at desc`,
    ),
  );
  const now = new Date();
  const visible = rows.filter((r) => (filter === "alle" ? true : filter === "actief" ? r.status !== "opgelost" : r.status === filter));
  const counts = Object.fromEntries((Object.keys(TICKET_STATUS_LABEL) as TicketStatus[]).map((s) => [s, rows.filter((r) => r.status === s).length]));

  const filters: { key: string; label: string; count?: number }[] = [
    { key: "actief", label: "Openstaand", count: rows.filter((r) => r.status !== "opgelost").length },
    ...(Object.keys(TICKET_STATUS_LABEL) as TicketStatus[]).map((s) => ({ key: s, label: TICKET_STATUS_LABEL[s], count: counts[s] })),
    { key: "alle", label: "Alle" },
  ];

  return (
    <>
      <PageHeader
        title="Tickets"
        subtitle={`Alle mail aan hello@gligor.ai komt hier binnen. Antwoordtermijn: Basis ${PACKAGES.basis.responseWorkingDays} werkdagen, Plus ${PACKAGES.plus.responseWorkingDays} werkdag.`}
      />
      <nav className="mb-4 flex flex-wrap gap-1" aria-label="Filter op status">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={`/tickets?status=${f.key}`}
            className={`btn btn-sm ${filter === f.key ? "" : "btn-ghost"}`}
            aria-current={filter === f.key ? "page" : undefined}
          >
            {f.label}
            {f.count !== undefined && <span className="num text-muted">{f.count}</span>}
          </Link>
        ))}
      </nav>
      {visible.length === 0 ? (
        <Empty>Geen tickets in deze lijst. Inbox zero!</Empty>
      ) : (
        <KeyTable label="Tickets">
          <table className="table-dense">
            <thead>
              <tr>
                <th>#</th>
                <th>Onderwerp</th>
                <th>Klant</th>
                <th>Status</th>
                <th>Antwoorden vóór</th>
                <th>Laatst bijgewerkt</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => {
                const d = t.awaiting_since && t.status !== "opgelost" && t.status !== "wacht_op_klant" ? responseDeadline(t.awaiting_since, t.package) : null;
                return (
                  <tr key={t.id} data-href={`/tickets/${t.id}`} tabIndex={-1} className="cursor-pointer">
                    <td className="num text-muted">T-{t.number}</td>
                    <td>
                      <Link href={`/tickets/${t.id}`} className="font-medium hover:underline">
                        {t.subject}
                      </Link>
                      <div className="text-xs text-muted">
                        {t.last_from} · {t.messages} bericht{t.messages === 1 ? "" : "en"}
                      </div>
                    </td>
                    <td>{t.company ?? <span className="text-muted">Onbekend</span>}</td>
                    <td>
                      <TicketPill status={t.status} />
                    </td>
                    <td>{d ? <DeadlinePill state={deadlineState(d, now)} label={formatDateTime(d)} /> : <span className="text-muted">–</span>}</td>
                    <td className="num text-muted">{formatDateTime(t.updated_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </KeyTable>
      )}
    </>
  );
}

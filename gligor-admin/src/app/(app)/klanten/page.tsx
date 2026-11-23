import Link from "next/link";
import { asAdmin } from "@/lib/auth";
import { listClients, needsAttention } from "@/lib/services/clients";
import { amsDate } from "@/lib/domain/dates";
import { ACTIVE_STAGES, PACKAGES, STAGES, type Stage } from "@/lib/config";
import { formatDate, formatEuro } from "@/lib/format";
import { Empty, PageHeader, Pill } from "@/components/ui";
import { StagePill } from "@/components/status";
import { KeyTable } from "@/components/KeyTable";

export const metadata = { title: "Klanten" };

export default async function KlantenPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const today = amsDate();
  const all = await asAdmin((q) => listClients(q, today));
  const search = (sp.q ?? "").trim().toLowerCase();

  const rows = all.filter((c) => {
    if (search && !`${c.company} ${c.owner_name} ${c.email ?? ""} ${c.city ?? ""} ${c.sector ?? ""} ${c.tags.join(" ")}`.toLowerCase().includes(search)) return false;
    if (sp.fase && c.stage !== sp.fase) return false;
    if (sp.pakket && c.package !== sp.pakket) return false;
    if (sp.betaling === "te_laat" && c.overdue_payments === 0) return false;
    if (sp.betaling === "op_orde" && c.overdue_payments > 0) return false;
    if (sp.filter === "aandacht" && !needsAttention(c)) return false;
    if (sp.filter === "actief" && !ACTIVE_STAGES.includes(c.stage)) return false;
    return true;
  });

  return (
    <>
      <PageHeader
        title="Klanten"
        subtitle={`${rows.length} van ${all.length}`}
        actions={
          <Link href="/klanten/nieuw" className="btn btn-primary">
            Nieuwe klant
          </Link>
        }
      />
      {sp.melding === "verwijderd" && (
        <p className="mb-4 rounded-md border border-line bg-tile px-3 py-2 text-accent">De klant en alle bijbehorende gegevens zijn verwijderd.</p>
      )}

      <form className="mb-4 flex flex-wrap items-end gap-2" role="search">
        <input name="q" defaultValue={sp.q} placeholder="Zoeken op naam, plaats, tag…" className="w-64" aria-label="Zoeken" />
        <select name="fase" defaultValue={sp.fase ?? ""} aria-label="Fase">
          <option value="">Alle fases</option>
          {STAGES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <select name="pakket" defaultValue={sp.pakket ?? ""} aria-label="Pakket">
          <option value="">Alle pakketten</option>
          {Object.entries(PACKAGES).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <select name="betaling" defaultValue={sp.betaling ?? ""} aria-label="Betaalstatus">
          <option value="">Alle betaalstatussen</option>
          <option value="te_laat">Te late betaling</option>
          <option value="op_orde">Op orde</option>
        </select>
        <select name="filter" defaultValue={sp.filter ?? ""} aria-label="Overig">
          <option value="">Iedereen</option>
          <option value="aandacht">Heeft aandacht nodig</option>
          <option value="actief">Alleen actieve klanten</option>
        </select>
        <button className="btn" type="submit">
          Filter
        </button>
        {Object.values(sp).some(Boolean) && (
          <Link href="/klanten" className="btn btn-ghost">
            Wissen
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <Empty>Geen klanten gevonden.</Empty>
      ) : (
        <KeyTable label="Klanten">
          <table className="table-dense">
            <thead>
              <tr>
                <th>Bedrijf</th>
                <th>Eigenaar</th>
                <th>Fase</th>
                <th>Pakket</th>
                <th className="text-right">Per maand</th>
                <th>Start</th>
                <th>Laatste contact</th>
                <th>Aandacht</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} data-href={`/klanten/${c.id}`} tabIndex={-1} className="cursor-pointer">
                  <td>
                    <Link href={`/klanten/${c.id}`} className="font-medium hover:underline">
                      {c.company}
                    </Link>
                    <div className="text-xs text-muted">{[c.sector, c.city].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td>{c.owner_name || <span className="text-muted">–</span>}</td>
                  <td>
                    <StagePill stage={c.stage as Stage} />
                  </td>
                  <td>{PACKAGES[c.package].label}</td>
                  <td className="num text-right">{formatEuro(c.monthly_fee)}</td>
                  <td className="num text-muted">{formatDate(c.start_date)}</td>
                  <td className="num text-muted">{formatDate(c.last_contact_at)}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {c.overdue_payments > 0 && <Pill tone="red">{c.overdue_payments} te laat</Pill>}
                      {c.open_tickets > 0 && <Pill tone="amber">{c.open_tickets} ticket{c.open_tickets > 1 ? "s" : ""}</Pill>}
                      {c.open_tasks_due > 0 && <Pill tone="grey">{c.open_tasks_due} taken</Pill>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </KeyTable>
      )}
    </>
  );
}

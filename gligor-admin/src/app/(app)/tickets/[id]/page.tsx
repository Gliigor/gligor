import Link from "next/link";
import { notFound } from "next/navigation";
import { Paperclip } from "lucide-react";
import { asAdmin } from "@/lib/auth";
import { deadlineState, responseDeadline, stripQuoted } from "@/lib/domain/tickets";
import { PACKAGES, TICKET_STATUS_LABEL, type PackageKey, type TicketStatus } from "@/lib/config";
import { formatDateTime } from "@/lib/format";
import type { AttachmentRow, TicketMessageRow, TicketRow } from "@/lib/types";
import { PageHeader, Pill, Tile } from "@/components/ui";
import { DeadlinePill, StagePill, TicketPill } from "@/components/status";
import { ActionForm, Submit } from "@/components/forms";
import { linkTicketAction, replyTicketAction, ticketStatusAction } from "@/app/actions";
import type { Stage } from "@/lib/config";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await asAdmin(async (q) => {
    const [ticket] = await q<TicketRow & { company: string | null; owner_name: string | null; package: PackageKey | null; stage: Stage | null }>(
      `select t.*, c.company, c.owner_name, c.package, c.stage from tickets t left join clients c on c.id = t.client_id where t.id = $1`,
      [id],
    );
    if (!ticket) return null;
    const messages = await q<TicketMessageRow>("select * from ticket_messages where ticket_id = $1 order by created_at", [id]);
    const attachments = await q<AttachmentRow>(
      "select a.* from ticket_attachments a join ticket_messages m on m.id = a.message_id where m.ticket_id = $1",
      [id],
    );
    const clients = ticket.client_id ? [] : await q<{ id: string; company: string }>("select id, company from clients order by lower(company)");
    return { ticket, messages, attachments, clients };
  });
  if (!data) notFound();
  const { ticket: t, messages, attachments, clients } = data;
  const deadline = t.awaiting_since && t.status !== "opgelost" && t.status !== "wacht_op_klant" ? responseDeadline(t.awaiting_since, t.package) : null;

  return (
    <>
      <PageHeader
        title={t.subject}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="num">T-{t.number}</span>
            <TicketPill status={t.status} />
            {deadline && <DeadlinePill state={deadlineState(deadline, new Date())} label={`antwoorden vóór ${formatDateTime(deadline)}`} />}
            {t.client_id && (
              <Link href={`/klanten/${t.client_id}`} className="link">
                {t.company}
              </Link>
            )}
          </span>
        }
        actions={
          <form key={t.status} action={ticketStatusAction} className="flex gap-2">
            <input type="hidden" name="ticket_id" value={t.id} />
            <select name="status" defaultValue={t.status} aria-label="Status">
              {(Object.keys(TICKET_STATUS_LABEL) as TicketStatus[]).map((s) => (
                <option key={s} value={s}>
                  {TICKET_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <Submit className="btn">Status opslaan</Submit>
          </form>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {messages.map((m) => {
            const files = attachments.filter((a) => a.message_id === m.id);
            const body = m.direction === "in" ? stripQuoted(m.body_text) || m.body_text : m.body_text;
            return (
              <article key={m.id} className={`tile p-4 ${m.direction === "uit" ? "ml-6 border-[color-mix(in_srgb,var(--accent)_30%,var(--line))]" : "mr-6"}`}>
                <header className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                  <span>
                    <Pill tone={m.direction === "in" ? "blue" : "green"}>{m.direction === "in" ? "Ontvangen" : "Verstuurd"}</Pill>{" "}
                    {m.direction === "in" ? m.from_email : `aan ${m.to_email}`}
                  </span>
                  <span className="num">{formatDateTime(m.created_at)}</span>
                </header>
                <div className="whitespace-pre-line leading-relaxed">{body}</div>
                {files.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {files.map((f) => (
                      <li key={f.id}>
                        <a href={`/api/attachments/${f.id}`} className="btn btn-sm" target="_blank" rel="noreferrer">
                          <Paperclip className="size-3.5" /> {f.filename}
                          <span className="num text-muted">{Math.max(1, Math.round(f.size_bytes / 1024))} kB</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}

          <Tile label="Antwoorden">
            <ActionForm action={replyTicketAction} className="space-y-3">
              <input type="hidden" name="ticket_id" value={t.id} />
              <textarea
                name="body"
                rows={8}
                className="w-full"
                required
                defaultValue={`Hoi ${(t.owner_name ?? "").split(" ")[0] || ""},\n\n\n\nGroet,\nGligor`}
                aria-label="Antwoord"
              />
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-xs">
                  Daarna:
                  <select name="status_after" defaultValue="wacht_op_klant">
                    <option value="wacht_op_klant">Wacht op klant</option>
                    <option value="opgelost">Opgelost</option>
                    <option value="open">Open laten</option>
                  </select>
                </label>
                <Submit className="btn btn-primary" pendingLabel="Versturen…">
                  Versturen
                </Submit>
              </div>
            </ActionForm>
          </Tile>
        </div>

        <aside className="space-y-4">
          <Tile label="Klant">
            {t.client_id ? (
              <div className="space-y-1">
                <Link href={`/klanten/${t.client_id}`} className="font-medium hover:underline">
                  {t.company}
                </Link>
                <div className="flex items-center gap-2 text-xs text-muted">
                  {t.stage && <StagePill stage={t.stage} />}
                  {t.package && <span>{PACKAGES[t.package].label}: antwoord binnen {PACKAGES[t.package].responseWorkingDays} werkdag(en)</span>}
                </div>
              </div>
            ) : (
              <form action={linkTicketAction} className="space-y-2">
                <input type="hidden" name="ticket_id" value={t.id} />
                <p className="text-xs text-muted">Nog niet gekoppeld aan een klant.</p>
                <select name="client_id" className="w-full" aria-label="Klant">
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company}
                    </option>
                  ))}
                </select>
                <Submit className="btn w-full">Koppelen</Submit>
              </form>
            )}
          </Tile>
          <Tile label="Tijdlijn">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
              <dt className="text-muted">Aangemaakt</dt>
              <dd className="num">{formatDateTime(t.created_at)}</dd>
              <dt className="text-muted">Eerste antwoord</dt>
              <dd className="num">{formatDateTime(t.first_response_at)}</dd>
              <dt className="text-muted">Wacht sinds</dt>
              <dd className="num">{formatDateTime(t.awaiting_since)}</dd>
            </dl>
          </Tile>
        </aside>
      </div>
    </>
  );
}

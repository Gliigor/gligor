import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ListChecks, Send, UserPlus } from "lucide-react";
import { getMilestoneSettings, paidMonths, referralSummary } from "@/lib/services/loyalty";
import { upcomingMilestones } from "@/lib/domain/milestones";
import { asAdmin } from "@/lib/auth";
import { clientBundle } from "@/lib/services/clients";
import { amsDate, diffDays } from "@/lib/domain/dates";
import { paymentStatus } from "@/lib/domain/payments";
import { deadlineState, responseDeadline } from "@/lib/domain/tickets";
import { CHANNEL_LABEL, MONTHS, GIFT_TYPE_LABEL, LEAD_SOURCE_LABEL, LOG_TYPE_LABEL, PACKAGES, SETUP_LABEL, STAGES, STAGE_LABEL, type LogType } from "@/lib/config";
import { formatDate, formatDateTime, formatEuro, relativeDays } from "@/lib/format";
import type { GiftRow, TemplateRow } from "@/lib/types";
import { Empty, Field, PageHeader, Pill, Tabs, Tile } from "@/components/ui";
import { DeadlinePill, StagePill, TicketPill } from "@/components/status";
import { ContactLinks } from "@/components/ContactLinks";
import { NoteButton } from "@/components/Shell";
import { ClientForm } from "@/components/ClientForm";
import { ActionForm, Submit } from "@/components/forms";
import { PaymentsTable } from "@/components/PaymentsTable";
import {
  actionsToTasksAction,
  addNoteAction,
  composeEmailAction,
  createTaskAction,
  forgetClientAction,
  logGiftAction,
  sendIntakeLinkAction,
  moveStageFormAction,
  toggleTaskAction,
  updateClientAction,
} from "@/app/actions";

const TABS = ["overzicht", "logboek", "tickets", "betalingen", "taken"] as const;
type Tab = (typeof TABS)[number];

export default async function KlantPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(rawTab ?? "") ? (rawTab as Tab) : "overzicht";
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const data = await asAdmin(async (q) => {
    const bundle = await clientBundle(q, id);
    if (!bundle) return null;
    const [templates, settings, paid, referrals, gifts, others, referrer] = await Promise.all([
      q<TemplateRow>("select * from email_templates order by sort"),
      getMilestoneSettings(q),
      paidMonths(q, id),
      referralSummary(q, id),
      q<GiftRow>("select * from gifts where client_id = $1 order by given_on desc", [id]),
      q<{ id: string; company: string }>("select id, company from clients where id <> $1 and stage <> 'lead' order by lower(company)", [id]),
      bundle.client.referred_by
        ? q<{ id: string; company: string }>("select id, company from clients where id = $1", [bundle.client.referred_by])
        : Promise.resolve([]),
    ]);
    return { ...bundle, templates, settings, paid, referrals, gifts, others, referrer: referrer[0] ?? null };
  });
  if (!data) notFound();
  const { client: c, log, tasks, tickets, payments, history, emails, templates, settings, paid, referrals, gifts, others, referrer } = data;
  const milestones = upcomingMilestones(c, { today: amsDate(), paidMonths: paid, settings });
  const isLead = c.stage === "lead" || c.stage === "kennismaking";
  const today = amsDate();
  const now = new Date();
  const openTasks = tasks.filter((t) => t.status === "open");
  const overdue = payments.filter((p) => paymentStatus(p, today) === "te_laat");
  const base = `/klanten/${c.id}`;

  return (
    <>
      <PageHeader
        title={c.company}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StagePill stage={c.stage} />
            <span>{PACKAGES[c.package].label}</span>
            <span className="text-line">·</span>
            <span>{c.owner_name || "Eigenaar onbekend"}</span>
            {c.birthday_consent && c.birthday_day && c.birthday_month && (
              <>
                <span className="text-line">·</span>
                <span>jarig {c.birthday_day} {MONTHS[c.birthday_month - 1]}</span>
              </>
            )}
            {c.city && (
              <>
                <span className="text-line">·</span>
                <span>{c.city}</span>
              </>
            )}
          </span>
        }
        actions={
          <>
            <ContactLinks phone={c.phone} email={c.email} channel={c.preferred_channel} size="md" />
            <NoteButton clientId={c.id} className="btn btn-primary">
              Notitie
            </NoteButton>
          </>
        }
      />

      <Tabs
        active={tab}
        tabs={[
          { key: "overzicht", label: "Overzicht", href: base },
          { key: "logboek", label: "Logboek", href: `${base}?tab=logboek`, count: log.length },
          { key: "tickets", label: "Tickets", href: `${base}?tab=tickets`, count: tickets.filter((t) => t.status !== "opgelost").length },
          { key: "betalingen", label: "Betalingen", href: `${base}?tab=betalingen`, count: overdue.length },
          { key: "taken", label: "Taken", href: `${base}?tab=taken`, count: openTasks.length },
        ]}
      />

      {tab === "overzicht" && (
        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <Tile label="Gegevens">
              <ClientForm action={updateClientAction} client={c} submitLabel="Opslaan" clients={others} />
            </Tile>
          </div>
          <div className="space-y-4">
            {isLead && (
              <Tile label={`Lead · via ${LEAD_SOURCE_LABEL[c.lead_source]}`}>
                <Link href={`/klanten/nieuw?van=${c.id}`} className="btn btn-primary w-full">
                  <UserPlus className="size-4" /> Omzetten naar klant (intake)
                </Link>
                <ActionForm action={sendIntakeLinkAction} className="mt-2">
                  <input type="hidden" name="client_id" value={c.id} />
                  <Submit className="btn w-full" pendingLabel="Versturen…">
                    <Send className="size-4" /> Stuur intakelink
                  </Submit>
                  <p className="mt-1.5 text-xs text-muted">De klant vult het formulier zelf in (eenmalige link, 7 dagen geldig). Je kijkt het daarna na.</p>
                </ActionForm>
              </Tile>
            )}
            <Tile label="Fase">
              <form action={moveStageFormAction} className="flex gap-2">
                <input type="hidden" name="client_id" value={c.id} />
                <select name="stage" defaultValue={c.stage} className="flex-1" aria-label="Nieuwe fase">
                  {STAGES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <Submit className="btn">Zet in fase</Submit>
              </form>
              <ol className="mt-4 space-y-1.5 border-l border-line pl-3 text-[13px]">
                {history.map((h, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span>{STAGE_LABEL[h.to_stage]}</span>
                    <span className="num text-muted">{formatDate(h.changed_at)}</span>
                  </li>
                ))}
              </ol>
            </Tile>

            <Tile label="In het kort">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
                <dt className="text-muted">Per maand</dt>
                <dd className="num">{formatEuro(c.monthly_fee)}</dd>
                <dt className="text-muted">Startbedrag</dt>
                <dd className="num">{formatEuro(c.start_fee)}</dd>
                <dt className="text-muted">Startdatum</dt>
                <dd className="num">{formatDate(c.start_date)}</dd>
                <dt className="text-muted">Omgeving</dt>
                <dd>{c.setup_type ? SETUP_LABEL[c.setup_type] : "–"}</dd>
                <dt className="text-muted">Gebruikers</dt>
                <dd className="num">{c.users_count}</dd>
                <dt className="text-muted">Voorkeur</dt>
                <dd>{CHANNEL_LABEL[c.preferred_channel]}</dd>
                <dt className="text-muted">Laatste contact</dt>
                <dd className="num">{formatDate(c.last_contact_at)}</dd>
              </dl>
              {c.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {c.tags.map((t) => (
                    <Pill key={t}>{t}</Pill>
                  ))}
                </div>
              )}
            </Tile>

            <Tile label="Mijlpalen">
              {milestones.length === 0 ? (
                <p className="text-[13px] text-muted">Mijlpalen starten zodra de klant een startdatum heeft{c.birthday_consent ? "" : " (verjaardag: alleen met toestemming)"}.</p>
              ) : (
                <ul className="space-y-2 text-[13px]">
                  {milestones.map((m) => (
                    <li key={m.label}>
                      <div>{m.label}</div>
                      <div className="num text-xs text-muted">
                        {m.date && m.inDays !== null ? `${formatDate(m.date)} · ${relativeDays(m.inDays)}` : "bij de volgende betaling"}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {c.gift_ideas && (
                <div className="mt-3 rounded-md border border-line bg-bg px-3 py-2 text-[13px]">
                  <div className="label mb-1">Cadeau-ideeën</div>
                  <p className="whitespace-pre-line">{c.gift_ideas}</p>
                </div>
              )}
            </Tile>

            <Tile label="Referrals">
              {referrer && (
                <p className="mb-2 text-[13px]">
                  Aangebracht door{" "}
                  <Link href={`/klanten/${referrer.id}`} className="link">
                    {referrer.company}
                  </Link>
                  {c.referral_succeeded_at ? ` · geslaagd op ${formatDate(c.referral_succeeded_at)}` : " · nog lopend"}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                <Pill tone="green">{referrals.succeeded} geslaagd</Pill>
                <Pill tone="grey">{referrals.pending} lopend</Pill>
                <Pill tone="blue">{formatEuro(referrals.value)} binnengebracht</Pill>
              </div>
              {referrals.referrals.length > 0 && (
                <ul className="mt-3 space-y-1 text-[13px]">
                  {referrals.referrals.map((r) => (
                    <li key={r.id} className="flex justify-between gap-2">
                      <Link href={`/klanten/${r.id}`} className="truncate hover:underline">
                        {r.company}
                      </Link>
                      <Pill tone={r.status === "geslaagd" ? "green" : r.status === "vervallen" ? "red" : "grey"}>{r.status}</Pill>
                    </li>
                  ))}
                </ul>
              )}
            </Tile>

            <Tile label="Cadeaus en kaarten">
              {gifts.length > 0 && (
                <ul className="mb-3 space-y-1 text-[13px]">
                  {gifts.map((g) => (
                    <li key={g.id} className="flex justify-between gap-2">
                      <span className="truncate">
                        <span className="num text-muted">{formatDate(g.given_on)}</span> {GIFT_TYPE_LABEL[g.type]}
                        {g.description ? `: ${g.description}` : ""}
                      </span>
                      <span className="num shrink-0">{formatEuro(g.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <ActionForm action={logGiftAction} className="grid grid-cols-2 gap-2">
                <input type="hidden" name="client_id" value={c.id} />
                <input type="date" name="given_on" defaultValue={today} aria-label="Datum" />
                <select name="type" defaultValue="kaart" aria-label="Soort">
                  {Object.entries(GIFT_TYPE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <input name="description" placeholder="Wat (bijv. bonbons uit Zeist)" className="col-span-2" aria-label="Omschrijving" />
                <input name="amount" inputMode="decimal" placeholder="Bedrag €" aria-label="Bedrag" />
                <Submit className="btn" pendingLabel="Opslaan…">
                  Vastleggen
                </Submit>
              </ActionForm>
            </Tile>

            <Tile label="E-mail schrijven">
              <form action={composeEmailAction} className="flex gap-2">
                <input type="hidden" name="client_id" value={c.id} />
                <select name="template_key" className="min-w-0 flex-1" aria-label="Sjabloon">
                  <option value="">Lege e-mail</option>
                  {templates.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <Submit className="btn">Opstellen</Submit>
              </form>
              {emails.filter((e) => e.status === "concept" || e.status === "gepland").length > 0 && (
                <ul className="mt-3 space-y-1 text-[13px]">
                  {emails
                    .filter((e) => e.status === "concept" || e.status === "gepland")
                    .map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-2">
                        <Link href={`/emails/${e.id}?terug=${base}`} className="truncate hover:underline">
                          {e.subject}
                        </Link>
                        <Pill tone={e.status === "gepland" ? "blue" : "grey"}>
                          {e.status === "gepland" ? formatDate(e.scheduled_for) : "concept"}
                        </Pill>
                      </li>
                    ))}
                </ul>
              )}
            </Tile>

            <Tile label="Privacy (AVG)">
              <a href={`${base}/export`} className="btn w-full">
                <Download className="size-4" /> Alle gegevens exporteren (JSON)
              </a>
              <details className="mt-3">
                <summary className="cursor-pointer text-[13px] text-danger">Klant en alle gegevens verwijderen…</summary>
                <ActionForm action={forgetClientAction} className="mt-2 space-y-2">
                  <input type="hidden" name="id" value={c.id} />
                  <p className="text-xs text-muted">
                    Verwijdert de klant met logboek, tickets, bijlagen, e-mails, taken en betalingen. Het auditlog houdt alleen vast dát er iets verwijderd is. Typ ter bevestiging:{" "}
                    <strong className="text-fg">{c.company}</strong>
                  </p>
                  <input name="confirm" className="w-full" autoComplete="off" aria-label="Bedrijfsnaam ter bevestiging" />
                  <Submit className="btn btn-danger w-full" pendingLabel="Verwijderen…">
                    Definitief verwijderen
                  </Submit>
                </ActionForm>
              </details>
            </Tile>
          </div>
        </div>
      )}

      {tab === "logboek" && (
        <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <Tile label={`Logboek · ${log.length} items, oudste eerst`}>
            {log.length === 0 ? (
              <Empty>Nog niets vastgelegd.</Empty>
            ) : (
              <ol className="relative space-y-0 border-l border-line pl-5">
                {[...log].reverse().map((e) => {
                  const day = diffDays(amsDate(c.created_at), amsDate(e.occurred_at)) + 1;
                  const system = e.source === "systeem";
                  return (
                    <li key={e.id} className={`relative pb-5 ${system ? "opacity-70" : ""}`}>
                      <span className={`absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-bg ${system ? "bg-line" : "bg-accent"}`} />
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span className="num">Dag {day}</span>
                        <span className="num">{formatDateTime(e.occurred_at)}</span>
                        <Pill tone={e.source.startsWith("email") ? "blue" : system ? "grey" : "green"}>{LOG_TYPE_LABEL[e.type]}</Pill>
                        {e.source === "email_in" && <span>ontvangen</span>}
                        {e.source === "email_uit" && <span>verstuurd</span>}
                        {e.ticket_id && (
                          <Link href={`/tickets/${e.ticket_id}`} className="link">
                            ticket
                          </Link>
                        )}
                      </div>
                      <p className="mt-1 whitespace-pre-line">{e.summary}</p>
                      {e.agreed_actions && (
                        <div className="mt-2 rounded-md border border-line bg-bg px-3 py-2 text-[13px]">
                          <div className="label mb-1">Afgesproken</div>
                          <p className="whitespace-pre-line">{e.agreed_actions}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {e.follow_up_date && (
                              <Pill tone={e.follow_up_done ? "green" : e.follow_up_date <= today ? "amber" : "grey"}>
                                opvolgen {e.follow_up_done ? "gedaan" : relativeDays(diffDays(today, e.follow_up_date))}
                              </Pill>
                            )}
                            {!e.follow_up_done && (
                              <form action={actionsToTasksAction}>
                                <input type="hidden" name="log_entry_id" value={e.id} />
                                <Submit className="btn btn-sm">
                                  <ListChecks className="size-3.5" /> Maak taken
                                </Submit>
                              </form>
                            )}
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </Tile>
          <Tile label="Nieuw in het logboek">
            <ActionForm action={addNoteAction} className="space-y-3">
              <input type="hidden" name="client_id" value={c.id} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Type">
                  <select name="type" defaultValue="gesprek">
                    {(Object.keys(LOG_TYPE_LABEL) as LogType[]).map((t) => (
                      <option key={t} value={t}>
                        {LOG_TYPE_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Wanneer">
                  <input type="datetime-local" name="occurred_at" />
                </Field>
              </div>
              <Field label="Samenvatting">
                <textarea name="summary" rows={4} required />
              </Field>
              <Field label="Afgesproken acties" hint="Eén per regel; worden met één klik taken">
                <textarea name="agreed_actions" rows={3} />
              </Field>
              <Field label="Opvolgen op">
                <input type="date" name="follow_up_date" />
              </Field>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" name="make_tasks" /> Acties direct als taken aanmaken
              </label>
              <Submit className="btn btn-primary" pendingLabel="Opslaan…">
                Toevoegen
              </Submit>
            </ActionForm>
          </Tile>
        </div>
      )}

      {tab === "tickets" && (
        <Tile label="Tickets">
          {tickets.length === 0 ? (
            <Empty>Geen tickets van deze klant.</Empty>
          ) : (
            <table className="table-dense">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Onderwerp</th>
                  <th>Status</th>
                  <th>Termijn</th>
                  <th>Ontvangen</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => {
                  const d = t.awaiting_since ? responseDeadline(t.awaiting_since, c.package) : null;
                  return (
                    <tr key={t.id}>
                      <td className="num text-muted">T-{t.number}</td>
                      <td>
                        <Link href={`/tickets/${t.id}`} className="hover:underline">
                          {t.subject}
                        </Link>
                      </td>
                      <td>
                        <TicketPill status={t.status} />
                      </td>
                      <td>{d ? <DeadlinePill state={deadlineState(d, now)} label={formatDateTime(d)} /> : <span className="text-muted">–</span>}</td>
                      <td className="num text-muted">{formatDateTime(t.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Tile>
      )}

      {tab === "betalingen" && (
        <Tile label="Betalingen">
          {payments.length === 0 ? (
            <Empty>Nog geen betalingen. Die worden aangemaakt vanaf de startdatum (fase Inrichting).</Empty>
          ) : (
            <PaymentsTable payments={payments} today={today} />
          )}
        </Tile>
      )}

      {tab === "taken" && (
        <Tile label="Taken">
          <form action={createTaskAction} className="mb-4 flex flex-wrap gap-2">
            <input type="hidden" name="client_id" value={c.id} />
            <input name="title" placeholder="Nieuwe taak…" className="min-w-60 flex-1" required aria-label="Taak" />
            <input type="date" name="due_date" aria-label="Deadline" />
            <Submit className="btn">Toevoegen</Submit>
          </form>
          {tasks.length === 0 ? (
            <Empty>Geen taken.</Empty>
          ) : (
            <ul className="divide-y divide-line/70">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2">
                  <form action={toggleTaskAction}>
                    <input type="hidden" name="task_id" value={t.id} />
                    <input type="hidden" name="done" value={t.status === "open" ? "1" : "0"} />
                    <button
                      type="submit"
                      className={`flex size-4 items-center justify-center rounded border ${t.status === "klaar" ? "border-accent bg-accent text-bg" : "border-line"}`}
                      aria-label={t.status === "open" ? "Markeer als klaar" : "Heropenen"}
                    >
                      {t.status === "klaar" && "✓"}
                    </button>
                  </form>
                  <span className={`flex-1 ${t.status === "klaar" ? "text-muted line-through" : ""}`}>{t.title}</span>
                  {t.source !== "handmatig" && <Pill>{t.source}</Pill>}
                  {t.due_date && (
                    <span className={`num text-xs ${t.status === "open" && t.due_date < today ? "text-danger" : "text-muted"}`}>{formatDate(t.due_date)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Tile>
      )}
    </>
  );
}

import Link from "next/link";
import { Check, Clock } from "lucide-react";
import { asAdmin } from "@/lib/auth";
import { loadToday } from "@/lib/services/today";
import { CATEGORY_LABEL, type TodayCategory, type TodayItem } from "@/lib/domain/today";
import { formatDateLong, formatEuro } from "@/lib/format";
import { KpiTile, PageHeader, Pill, Empty } from "@/components/ui";
import { ContactLinks } from "@/components/ContactLinks";
import { NoteButton } from "@/components/Shell";
import { Submit } from "@/components/forms";
import {
  completeFollowUpAction,
  markPaidAction,
  sendEmailAction,
  sendReminderAction,
  snoozeAction,
  toggleTaskAction,
} from "@/app/actions";

export const metadata = { title: "Vandaag" };

const TONE = { danger: "red", warning: "amber", neutral: "grey", accent: "green" } as const;

function Actions({ item }: { item: TodayItem }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {item.actions.map((a, i) => {
        switch (a.type) {
          case "open":
            return (
              <Link key={i} href={a.href} className="btn btn-sm">
                {a.label ?? "Openen"}
              </Link>
            );
          case "send-email":
            return (
              <form key={i} action={sendEmailAction}>
                <input type="hidden" name="email_id" value={a.emailId} />
                <Submit className="btn btn-primary btn-sm" pendingLabel="Versturen…">
                  Versturen
                </Submit>
              </form>
            );
          case "edit-email":
            return (
              <Link key={i} href={`/emails/${a.emailId}?terug=/vandaag`} className="btn btn-sm">
                Bekijken
              </Link>
            );
          case "complete-task":
            return (
              <form key={i} action={toggleTaskAction}>
                <input type="hidden" name="task_id" value={a.taskId} />
                <input type="hidden" name="done" value="1" />
                <Submit className="btn btn-sm" title="Markeer als klaar">
                  <Check className="size-3.5" /> Klaar
                </Submit>
              </form>
            );
          case "complete-followup":
            return (
              <form key={i} action={completeFollowUpAction}>
                <input type="hidden" name="log_entry_id" value={a.logEntryId} />
                <Submit className="btn btn-sm" title="Opvolging gedaan">
                  <Check className="size-3.5" /> Klaar
                </Submit>
              </form>
            );
          case "mark-paid":
            return (
              <form key={i} action={markPaidAction}>
                <input type="hidden" name="payment_id" value={a.paymentId} />
                <Submit className="btn btn-sm">Betaald</Submit>
              </form>
            );
          case "send-reminder":
            return (
              <form key={i} action={sendReminderAction}>
                <input type="hidden" name="payment_id" value={a.paymentId} />
                <Submit className="btn btn-primary btn-sm" pendingLabel="Versturen…">
                  Herinnering sturen
                </Submit>
              </form>
            );
          case "contact":
            return item.contact ? (
              <ContactLinks key={i} phone={item.contact.phone} email={item.contact.email} channel={item.contact.channel} />
            ) : null;
          case "note":
            return item.contact ? <NoteButton key={i} clientId={item.contact.clientId} /> : null;
        }
      })}
      <form action={snoozeAction} className="flex">
        <input type="hidden" name="key" value={item.key} />
        <Submit className="btn btn-ghost btn-sm" name="when" value="morgen" title="Morgen weer tonen">
          <Clock className="size-3.5" /> Morgen
        </Submit>
        <Submit className="btn btn-ghost btn-sm" name="when" value="week" title="Volgende week weer tonen">
          Week
        </Submit>
      </form>
    </div>
  );
}

export default async function VandaagPage() {
  const { items, summary, today } = await asAdmin((q) => loadToday(q, new Date()));
  const groups = new Map<TodayCategory, TodayItem[]>();
  for (const item of items) groups.set(item.category, [...(groups.get(item.category) ?? []), item]);

  return (
    <>
      <PageHeader title="Vandaag" subtitle={`${formatDateLong(today)} · ${items.length} ${items.length === 1 ? "punt" : "punten"}, belangrijkste eerst`} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Actieve klanten" value={String(summary.activeClients)} href="/klanten?filter=actief" />
        <KpiTile label="MRR" value={formatEuro(summary.mrr)} hint="per maand, excl. btw" tone="green" />
        <KpiTile label="Open tickets" value={String(summary.openTickets)} href="/tickets" />
        <KpiTile
          label="Te late betalingen"
          value={String(summary.overduePayments)}
          hint={summary.overduePayments ? formatEuro(summary.overdueAmount) : "alles op tijd"}
          tone={summary.overduePayments ? "red" : undefined}
          href="/betalingen?status=te_laat"
        />
      </div>

      {items.length === 0 && <Empty>Niets dringends vandaag. Tijd voor een kop koffie.</Empty>}

      <div className="space-y-4">
        {[...groups.entries()].map(([cat, list]) => (
          <section key={cat} className="tile">
            <h2 className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="label">
                {cat}. {CATEGORY_LABEL[cat]}
              </span>
              <span className="num text-xs text-muted">{list.length}</span>
            </h2>
            <ul>
              {list.map((item) => (
                <li key={item.key} className="flex flex-col gap-2 border-b border-line/70 px-4 py-3 transition-colors last:border-b-0 hover:bg-tile-hover lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Pill tone={TONE[item.tone]}>{item.badge}</Pill>
                      <span className="truncate font-medium">{item.title}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[13px] text-muted">
                      {item.contact ? (
                        <Link href={`/klanten/${item.contact.clientId}`} className="hover:text-fg">
                          {item.detail}
                        </Link>
                      ) : (
                        item.detail
                      )}
                    </div>
                  </div>
                  <Actions item={item} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

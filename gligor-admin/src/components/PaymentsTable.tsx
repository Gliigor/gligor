import Link from "next/link";
import { paymentDescription, paymentStatus } from "@/lib/domain/payments";
import { formatDate, formatEuro } from "@/lib/format";
import type { PaymentRow } from "@/lib/types";
import { PaymentPill } from "./status";
import { ConfirmSubmit, Submit } from "./forms";
import { markPaidAction, markUnpaidAction, sendReminderAction } from "@/app/actions";

export function PaymentsTable({
  payments,
  today,
  showClient,
}: {
  payments: (PaymentRow & { company?: string })[];
  today: string;
  showClient?: boolean;
}) {
  return (
    <table className="table-dense">
      <thead>
        <tr>
          {showClient && <th>Klant</th>}
          <th>Omschrijving</th>
          <th className="text-right">Bedrag</th>
          <th>Vervaldatum</th>
          <th>Status</th>
          <th>Betaald op</th>
          <th className="text-right">Acties</th>
        </tr>
      </thead>
      <tbody>
        {payments.map((p) => {
          const status = paymentStatus(p, today);
          return (
            <tr key={p.id}>
              {showClient && (
                <td>
                  <Link href={`/klanten/${p.client_id}?tab=betalingen`} className="hover:underline">
                    {p.company}
                  </Link>
                </td>
              )}
              <td>
                {paymentDescription(p)}
                {p.credit_reason && <span className="ml-2 text-xs text-accent">{p.credit_reason}</span>}
              </td>
              <td className="num text-right">{formatEuro(p.amount)}</td>
              <td className="num">{formatDate(p.due_date)}</td>
              <td>
                <PaymentPill status={status} />
              </td>
              <td className="num text-muted">
                {formatDate(p.paid_at)}
                {p.source === "stripe" && <span className="ml-1 text-xs">(Stripe)</span>}
              </td>
              <td>
                <div className="flex justify-end gap-1">
                  {status === "betaald" ? (
                    <form action={markUnpaidAction}>
                      <input type="hidden" name="payment_id" value={p.id} />
                      <ConfirmSubmit className="btn btn-ghost btn-sm" message="Deze betaling weer op onbetaald zetten?">
                        Ongedaan
                      </ConfirmSubmit>
                    </form>
                  ) : status !== "geannuleerd" ? (
                    <>
                      {status === "te_laat" && (
                        <form action={sendReminderAction}>
                          <input type="hidden" name="payment_id" value={p.id} />
                          <Submit className="btn btn-sm" pendingLabel="…">
                            Herinnering
                          </Submit>
                        </form>
                      )}
                      <form action={markPaidAction}>
                        <input type="hidden" name="payment_id" value={p.id} />
                        <Submit className="btn btn-primary btn-sm">Betaald</Submit>
                      </form>
                    </>
                  ) : null}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

import Link from "next/link";
import { asAdmin } from "@/lib/auth";
import { amsDate } from "@/lib/domain/dates";
import { PAYMENT_STATUS_LABEL, paymentStatus, type PaymentStatus } from "@/lib/domain/payments";
import { formatEuro } from "@/lib/format";
import type { PaymentRow } from "@/lib/types";
import { Empty, KpiTile, PageHeader } from "@/components/ui";
import { PaymentsTable } from "@/components/PaymentsTable";

export const metadata = { title: "Betalingen" };

export default async function BetalingenPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const today = amsDate();
  const rows = await asAdmin((q) =>
    q<PaymentRow & { company: string }>(
      "select p.*, c.company from payments p join clients c on c.id = p.client_id order by p.due_date desc, c.company",
    ),
  );
  const withStatus = rows.map((p) => ({ ...p, status: paymentStatus(p, today) }));
  const filter = (sp.status ?? "") as PaymentStatus | "";
  const visible = withStatus.filter((p) => (filter ? p.status === filter : p.status !== "geannuleerd"));
  const sum = (s: PaymentStatus) => withStatus.filter((p) => p.status === s).reduce((a, p) => a + p.amount, 0);
  const month = today.slice(0, 7);
  const paidThisMonth = withStatus.filter((p) => p.paid_at?.startsWith(month)).reduce((a, p) => a + p.amount, 0);

  return (
    <>
      <PageHeader
        title="Betalingen"
        subtitle="Verwachte betalingen worden automatisch aangemaakt uit pakket en startdatum. Markeer ze hier als betaald."
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Te laat" value={formatEuro(sum("te_laat"))} tone={sum("te_laat") ? "red" : undefined} href="/betalingen?status=te_laat" />
        <KpiTile label="Openstaand (≤ 7 dagen)" value={formatEuro(sum("openstaand"))} href="/betalingen?status=openstaand" />
        <KpiTile label="Nog niet vervallen" value={formatEuro(sum("op_tijd"))} href="/betalingen?status=op_tijd" />
        <KpiTile label="Ontvangen deze maand" value={formatEuro(paidThisMonth)} tone="green" href="/betalingen?status=betaald" />
      </div>
      <nav className="mb-4 flex flex-wrap gap-1" aria-label="Filter op status">
        {(["", "te_laat", "openstaand", "op_tijd", "betaald", "geannuleerd"] as const).map((s) => (
          <Link key={s} href={s ? `/betalingen?status=${s}` : "/betalingen"} className={`btn btn-sm ${filter === s ? "" : "btn-ghost"}`}>
            {s ? PAYMENT_STATUS_LABEL[s] : "Alle"}
          </Link>
        ))}
      </nav>
      {visible.length === 0 ? (
        <Empty>Geen betalingen in deze lijst.</Empty>
      ) : (
        <div className="tile overflow-x-auto">
          <PaymentsTable payments={visible} today={today} showClient />
        </div>
      )}
      <p className="mt-4 text-xs text-muted">
        Stripe is nog niet gekoppeld. Zodra dat gebeurt, zet de webhook betalingen automatisch op betaald (zie README, &quot;Stripe later koppelen&quot;).
      </p>
    </>
  );
}

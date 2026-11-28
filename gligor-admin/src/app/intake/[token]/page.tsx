import { notFound } from "next/navigation";
import { withSystem } from "@/lib/db";
import { intakeLinkState } from "@/lib/domain/leads";
import { findIntakeLink } from "@/lib/services/leads";
import { IntakeForm } from "@/components/IntakeForm";
import { submitPublicIntakeAction } from "../actions";

export const metadata = { title: "Intakeformulier", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Publieke, eenmalige intakelink (7 dagen geldig). Licht thema, want dit ziet de klant. */
export default async function PublicIntakePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[\w-]{20,64}$/.test(token)) notFound();
  const link = await withSystem((q) => findIntakeLink(q, token));
  if (!link) notFound();
  const state = intakeLinkState(link, new Date());

  return (
    <main data-theme="light" className="min-h-screen bg-bg px-4 py-10 text-fg">
      <div className="mx-auto max-w-2xl">
        <p className="text-[22px] font-bold tracking-[-0.03em] italic">
          gligor<span className="text-accent">.ai</span>
        </p>
        {state === "gebruikt" && (
          <div className="tile mt-6 p-6">
            <h1 className="text-xl font-semibold">Dank je wel!</h1>
            <p className="mt-2 text-muted">Je intakeformulier is binnen. Ik bereid de intake voor en neem snel contact met je op.</p>
          </div>
        )}
        {state === "verlopen" && (
          <div className="tile mt-6 p-6">
            <h1 className="text-xl font-semibold">Deze link is verlopen</h1>
            <p className="mt-2 text-muted">Een intakelink is 7 dagen geldig. Stuur Gligor even een berichtje, dan krijg je een nieuwe.</p>
          </div>
        )}
        {state === "geldig" && (
          <>
            <h1 className="mt-6 text-2xl font-semibold tracking-tight">Intakeformulier</h1>
            <p className="mt-2 mb-6 text-muted">
              Dit kost een paar minuten. Met deze gegevens bereid ik de intake voor. Ik gebruik ze alleen voor onze samenwerking; zie de{" "}
              <a href="https://gligor.ai/privacyverklaring" className="link">
                privacyverklaring
              </a>
              .
            </p>
            <div className="tile p-6">
              <IntakeForm
                action={submitPublicIntakeAction}
                defaults={{ ...link.prefill, email: link.prefill?.email ?? link.email }}
                hidden={{ token }}
                mode="public"
                submitLabel="Versturen"
              />
            </div>
          </>
        )}
      </div>
    </main>
  );
}

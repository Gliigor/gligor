import Link from "next/link";
import { asAdmin } from "@/lib/auth";
import { amsDate } from "@/lib/domain/dates";
import { intakeSubmission } from "@/lib/services/leads";
import type { ClientRow } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import { ClientForm } from "@/components/ClientForm";
import { IntakeForm, type IntakeDefaults } from "@/components/IntakeForm";
import { createClientAction, saveIntakeAction } from "@/app/actions";

export const metadata = { title: "Nieuwe klant" };

const uuid = (v?: string) => (v && /^[0-9a-f-]{36}$/.test(v) ? v : null);

/**
 * "Nieuwe klant" = het intakeformulier. Met ?van=<id> wordt een lead omgezet
 * (vooraf ingevuld), met ?intake=<id> een ingevulde intakelink nagekeken.
 * ?uitgebreid=1 toont het volledige klantformulier met een vrije fasekeuze.
 */
export default async function NieuweKlantPage({ searchParams }: { searchParams: Promise<{ van?: string; intake?: string; uitgebreid?: string }> }) {
  const sp = await searchParams;
  const van = uuid(sp.van);
  const intakeId = uuid(sp.intake);

  const { clients, lead, submission } = await asAdmin(async (q) => {
    const clients = await q<{ id: string; company: string }>("select id, company from clients where stage <> 'lead' order by lower(company)");
    const submission = intakeId ? await intakeSubmission(q, intakeId) : null;
    const leadId = van ?? submission?.client_id ?? null;
    const [lead] = leadId ? await q<ClientRow>("select * from clients where id = $1", [leadId]) : [];
    return { clients, lead: lead ?? null, submission };
  });

  if (sp.uitgebreid) {
    return (
      <>
        <PageHeader title="Nieuwe klant (uitgebreid)" subtitle="Kies een fase: de automatische taken en e-mailconcepten van die fase worden direct aangemaakt." />
        <div className="tile p-5">
          <ClientForm action={createClientAction} submitLabel="Klant aanmaken" showStage clients={clients} />
        </div>
      </>
    );
  }

  const fromLead: IntakeDefaults = lead
    ? {
        first_name: lead.first_name || lead.owner_name.split(" ")[0],
        last_name: lead.last_name || lead.owner_name.split(" ").slice(1).join(" "),
        company: lead.company,
        email: lead.email,
        phone: lead.phone,
        address: lead.address,
        sector: lead.sector,
        package: lead.package,
        users_count: lead.users_count,
        setup_type: lead.setup_type,
        referred_by: lead.referred_by,
        start_date: lead.start_date,
      }
    : {};
  const defaults: IntakeDefaults = { ...fromLead, ...(submission?.data ?? {}) };
  defaults.start_date ||= amsDate();
  const hidden: Record<string, string> = {};
  if (lead) hidden.client_id = lead.id;
  if (submission) hidden.intake_link_id = submission.id;

  return (
    <>
      <PageHeader
        title={submission ? "Intake nakijken" : lead ? `Intake: ${lead.company}` : "Nieuwe klant"}
        subtitle={
          submission
            ? "De klant heeft dit zelf ingevuld via de intakelink. Controleer het en sla op."
            : "Vul dit samen met de klant in. Bij opslaan: fase Intake, welkomstmail als concept, betalingen en herinneringen klaar."
        }
        actions={
          <Link href="/klanten/nieuw?uitgebreid=1" className="btn">
            Uitgebreid formulier
          </Link>
        }
      />
      <div className="tile mx-auto max-w-3xl p-6">
        <IntakeForm action={saveIntakeAction} defaults={defaults} hidden={hidden} clients={clients.filter((c) => c.id !== lead?.id)} submitLabel="Opslaan en starten" />
      </div>
    </>
  );
}

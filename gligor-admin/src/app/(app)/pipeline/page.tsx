import { asAdmin } from "@/lib/auth";
import { listClients, needsAttention } from "@/lib/services/clients";
import { amsDate, diffDays } from "@/lib/domain/dates";
import { PageHeader } from "@/components/ui";
import { Kanban } from "@/components/Kanban";

export const metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const today = amsDate();
  const clients = await asAdmin((q) => listClients(q, today));
  return (
    <>
      <PageHeader
        title="Pipeline"
        subtitle="Sleep een klant naar een nieuwe fase. De datum wordt vastgelegd en de taken en e-mails van die fase worden klaargezet."
      />
      <Kanban
        cards={clients.map((c) => ({
          id: c.id,
          company: c.company,
          owner: c.owner_name,
          stage: c.stage,
          package: c.package,
          days: Math.max(0, diffDays(amsDate(c.stage_changed_at), today)),
          attention: needsAttention(c),
        }))}
      />
    </>
  );
}

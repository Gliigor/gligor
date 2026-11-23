import { Shell } from "@/components/Shell";
import { asAdmin } from "@/lib/auth";
import { ensureDailyRun, loadToday } from "@/lib/services/today";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const data = await asAdmin(async (q, session) => {
    await ensureDailyRun(q, new Date());
    const clients = await q<{ id: string; company: string; owner_name: string; stage: string }>(
      "select id, company, owner_name, stage from clients order by lower(company)",
    );
    const { items, summary } = await loadToday(q, new Date());
    return { clients, todayCount: items.length, summary, demo: session.demo };
  });

  return (
    <Shell
      demo={data.demo}
      clients={data.clients.map((c) => ({ id: c.id, company: c.company, owner: c.owner_name, stage: c.stage }))}
      counts={{ tickets: data.summary.openTickets, today: data.todayCount, overdue: data.summary.overduePayments }}
    >
      {children}
    </Shell>
  );
}

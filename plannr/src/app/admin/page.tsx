import { redirect } from "next/navigation";
import { getAuthUserId, isSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/layout/logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { LogOut } from "@/components/ui/icons";
import { formatDate, formatDateTime, formatMonth, formatNumber } from "@/lib/format";
import { adminSignOut } from "./actions";
import { MonthlyChart } from "./monthly-chart";

export const metadata = { title: "Dashboard" };

interface FirmStat {
  firm_id: string;
  firm_name: string;
  signed_up_at: string;
  seats: number;
  clients: number;
  plans: number;
  exports: number;
  last_login_at: string | null;
  last_activity_at: string | null;
}

const DAY = 24 * 60 * 60 * 1000;

function activity(lastActivity: string | null): { label: string; tone: "ok" | "warn" | "danger" } {
  if (!lastActivity) return { label: "Nooit actief", tone: "danger" };
  const days = (Date.now() - new Date(lastActivity).getTime()) / DAY;
  if (days <= 14) return { label: "Actief", tone: "ok" };
  if (days <= 60) return { label: "Stil", tone: "warn" };
  return { label: "Inactief", tone: "danger" };
}

/**
 * Super admin dashboard. Privacy (AVG): only counts and dates are shown. The
 * data comes from SECURITY DEFINER functions that return aggregates only and
 * refuse anyone who is not in public.super_admins; the super admin has no
 * firm membership, so RLS hides every client row from this account.
 */
export default async function AdminDashboard() {
  if (!(await getAuthUserId()) || !(await isSuperAdmin())) redirect("/admin/inloggen");
  const supabase = await createClient();
  const [{ data: totals }, { data: firms }, { data: monthly }] = await Promise.all([
    supabase.rpc("admin_totals").single<{ firms: number; planners: number; clients: number; plans: number; exports: number }>(),
    supabase.rpc("admin_firm_stats"),
    supabase.rpc("admin_monthly_stats", { p_months: 12 }),
  ]);
  const firmStats = (firms ?? []) as FirmStat[];
  const months = ((monthly ?? []) as { month: string; new_firms: number; active_firms: number; exports: number }[]).map((m) => ({
    label: formatMonth(m.month),
    newFirms: Number(m.new_firms),
    activeFirms: Number(m.active_firms),
  }));
  const activeCount = firmStats.filter((f) => activity(f.last_activity_at).tone === "ok").length;

  const tiles = [
    ["Kantoren", totals?.firms],
    ["Planners", totals?.planners],
    ["Cliënten", totals?.clients],
    ["Plannen", totals?.plans],
    ["Exports", totals?.exports],
    ["Actief (14 dagen)", activeCount],
  ] as const;

  return (
    <>
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Logo />
          <span className="rounded bg-ink-800 px-1.5 py-0.5 text-xs font-medium text-white">beheer</span>
          <form action={adminSignOut} className="ml-auto">
            <button className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100" aria-label="Uitloggen" title="Uitloggen">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gebruik</h1>
          <p className="text-sm text-ink-500">
            Alleen aantallen en datums. Plannr is verwerker: persoonsgegevens en financiële gegevens van cliënten zijn hier
            nooit zichtbaar.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {tiles.map(([label, value]) => (
            <div key={label} className="rounded-xl border border-ink-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-xs text-ink-500">{label}</div>
              <div className="text-2xl font-semibold">{formatNumber(value ?? 0)}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <MonthlyChart title="Nieuwe kantoren per maand" data={months} dataKey="newFirms" />
          <MonthlyChart title="Actieve kantoren per maand" data={months} dataKey="activeFirms" />
        </div>

        <Card>
          <CardHeader title="Kantoren" description="Gesorteerd op aanmelddatum, nieuwste eerst" />
          {firmStats.length === 0 ? (
            <EmptyState title="Nog geen kantoren" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-ink-50 text-left text-xs text-ink-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Kantoor</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 text-right font-medium">Planners</th>
                    <th className="px-4 py-2 text-right font-medium">Cliënten</th>
                    <th className="px-4 py-2 text-right font-medium">Plannen</th>
                    <th className="px-4 py-2 text-right font-medium">Exports</th>
                    <th className="px-4 py-2 font-medium">Laatste login</th>
                    <th className="px-4 py-2 font-medium">Laatste activiteit</th>
                    <th className="px-4 py-2 font-medium">Aangemeld</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 tabular">
                  {firmStats.map((f) => {
                    const a = activity(f.last_activity_at);
                    return (
                      <tr key={f.firm_id}>
                        <td className="px-4 py-2.5 font-medium">{f.firm_name}</td>
                        <td className="px-4 py-2.5">
                          <Badge tone={a.tone}>{a.label}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right">{f.seats}</td>
                        <td className="px-4 py-2.5 text-right">{f.clients}</td>
                        <td className="px-4 py-2.5 text-right">{f.plans}</td>
                        <td className="px-4 py-2.5 text-right">{f.exports}</td>
                        <td className="px-4 py-2.5">{f.last_login_at ? formatDateTime(f.last_login_at) : "—"}</td>
                        <td className="px-4 py-2.5">{f.last_activity_at ? formatDateTime(f.last_activity_at) : "—"}</td>
                        <td className="px-4 py-2.5">{formatDate(f.signed_up_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </>
  );
}

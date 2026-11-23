import { asAdmin } from "@/lib/auth";
import { adminEmail, emailFrom, isDemo } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { PageHeader, Pill, Tile } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { runDailyNowAction, setThemeAction, signOutAction } from "@/app/actions";
import { cookies } from "next/headers";

export const metadata = { title: "Instellingen" };

export default async function InstellingenPage() {
  const theme = (await cookies()).get("theme")?.value === "light" ? "light" : "dark";
  const { audit, lastRun } = await asAdmin(async (q) => ({
    audit: await q<{ id: number; table_name: string; action: string; changed_at: string; company: string | null; client_id: string | null }>(
      `select a.id, a.table_name, a.action, a.changed_at, c.company, a.client_id
       from audit_log a left join clients c on c.id = a.client_id order by a.id desc limit 25`,
    ),
    lastRun: (await q<{ value: string }>("select value #>> '{}' as value from settings where key = 'last_daily_run'"))[0]?.value,
  }));

  const checks: [string, boolean, string][] = [
    ["Database (DATABASE_URL)", Boolean(process.env.DATABASE_URL), "Supabase Postgres, EU-regio"],
    ["Login (Supabase Auth)", Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY), "Magic link + 2FA"],
    ["Bijlagen (SUPABASE_SECRET_KEY)", Boolean(process.env.SUPABASE_SECRET_KEY), "Privé-bucket ticket-bijlagen"],
    ["E-mail versturen (RESEND_API_KEY)", Boolean(process.env.RESEND_API_KEY), emailFrom()],
    ["Inkomende mail (RESEND_WEBHOOK_SECRET)", Boolean(process.env.RESEND_WEBHOOK_SECRET || process.env.INBOUND_TOKEN), "Webhook /api/inbound/…"],
    ["Dagelijkse job (CRON_SECRET)", Boolean(process.env.CRON_SECRET), "07:00 Europe/Amsterdam"],
  ];

  return (
    <>
      <PageHeader title="Instellingen" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Tile label="Weergave">
          <form action={setThemeAction} className="flex gap-2">
            <Submit className={`btn ${theme === "dark" ? "" : "btn-ghost"}`} name="theme" value="dark">
              Donker
            </Submit>
            <Submit className={`btn ${theme === "light" ? "" : "btn-ghost"}`} name="theme" value="light">
              Licht
            </Submit>
          </form>
        </Tile>

        <Tile label="Account">
          <p className="text-[13px]">
            Ingelogd als <strong>{adminEmail()}</strong> {isDemo() && <Pill tone="amber">demo</Pill>}
          </p>
          <p className="mt-1 text-xs text-muted">Alleen dit adres kan inloggen (ADMIN_EMAIL), altijd met tweestapsverificatie.</p>
          {!isDemo() && (
            <form action={signOutAction} className="mt-3">
              <Submit className="btn">Uitloggen</Submit>
            </form>
          )}
        </Tile>

        <Tile label="Koppelingen">
          <ul className="space-y-1.5 text-[13px]">
            {checks.map(([name, ok, hint]) => (
              <li key={name} className="flex items-center justify-between gap-3">
                <span>
                  {name} <span className="text-xs text-muted">· {hint}</span>
                </span>
                <Pill tone={ok ? "green" : isDemo() ? "grey" : "red"}>{ok ? "ingesteld" : "ontbreekt"}</Pill>
              </li>
            ))}
          </ul>
        </Tile>

        <Tile label="Dagelijkse job">
          <p className="text-[13px] text-muted">
            Draait elke ochtend om 07:00: betalingen aanvullen, geplande e-mails klaarzetten en jou de Vandaag-lijst mailen. Laatst
            gedraaid: <span className="num text-fg">{lastRun ?? "nog niet"}</span>
          </p>
          <ActionForm action={runDailyNowAction} className="mt-3">
            <Submit className="btn" pendingLabel="Bezig…">
              Nu draaien (zonder digest)
            </Submit>
          </ActionForm>
        </Tile>

        <Tile label="Auditlog (laatste 25 wijzigingen)" className="lg:col-span-2">
          <table className="table-dense">
            <thead>
              <tr>
                <th>Tijd</th>
                <th>Tabel</th>
                <th>Actie</th>
                <th>Klant</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id}>
                  <td className="num text-muted">{formatDateTime(a.changed_at)}</td>
                  <td>{a.table_name}</td>
                  <td>{a.action}</td>
                  <td>{a.company ?? <span className="text-muted">{a.client_id ? "verwijderd" : "–"}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tile>
      </div>
    </>
  );
}

import Link from "next/link";
import { asAdmin } from "@/lib/auth";
import { STAGE_LABEL } from "@/lib/config";
import { formatDate } from "@/lib/format";
import type { TemplateRow } from "@/lib/types";
import { PageHeader, Pill, Tile } from "@/components/ui";
import { Submit } from "@/components/forms";
import { toggleAutoSendAction } from "@/app/actions";
import { TEMPLATE_VARIABLES } from "@/lib/domain/templates";

export const metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const { templates, newsletters } = await asAdmin(async (q) => ({
    templates: await q<TemplateRow>("select * from email_templates order by sort"),
    newsletters: await q<{ id: string; subject: string; recipients: number; sent_at: string }>(
      "select id, subject, recipients, sent_at from newsletters order by sent_at desc limit 10",
    ),
  }));
  return (
    <>
      <PageHeader
        title="Templates"
        subtitle="Standaard maakt het systeem een concept dat je met één klik verstuurt. Zet een sjabloon op automatisch om het zonder controle te laten versturen."
        actions={
          <Link href="/templates/nieuwsbrief" className="btn btn-primary">
            Nieuwsbrief schrijven
          </Link>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="tile overflow-x-auto">
          <table className="table-dense">
            <thead>
              <tr>
                <th>Sjabloon</th>
                <th>Fase</th>
                <th>Onderwerp</th>
                <th>Versturen</th>
                <th>Gewijzigd</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.key}>
                  <td>
                    <Link href={`/templates/${t.key}`} className="font-medium hover:underline">
                      {t.name}
                    </Link>
                  </td>
                  <td>{t.stage ? <Pill>{STAGE_LABEL[t.stage]}</Pill> : <span className="text-muted">–</span>}</td>
                  <td className="max-w-80 truncate text-muted">{t.subject}</td>
                  <td>
                    <form action={toggleAutoSendAction}>
                      <input type="hidden" name="key" value={t.key} />
                      <Submit className="btn btn-ghost btn-sm" title="Klik om te wisselen">
                        <Pill tone={t.auto_send ? "green" : "grey"}>{t.auto_send ? "Automatisch" : "Concept ter controle"}</Pill>
                      </Submit>
                    </form>
                  </td>
                  <td className="num text-muted">{formatDate(t.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-4">
          <Tile label="Variabelen">
            <ul className="space-y-1 text-[13px]">
              {TEMPLATE_VARIABLES.map((v) => (
                <li key={v.name} className="flex justify-between gap-2">
                  <code className="num text-accent">{`{{${v.name}}}`}</code>
                  <span className="text-right text-muted">{v.desc}</span>
                </li>
              ))}
            </ul>
          </Tile>
          <Tile label="Verstuurde nieuwsbrieven">
            {newsletters.length === 0 ? (
              <p className="text-muted">Nog geen.</p>
            ) : (
              <ul className="space-y-1 text-[13px]">
                {newsletters.map((n) => (
                  <li key={n.id} className="flex justify-between gap-2">
                    <span className="truncate">{n.subject}</span>
                    <span className="num shrink-0 text-muted">
                      {formatDate(n.sent_at)} · {n.recipients}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Tile>
        </div>
      </div>
    </>
  );
}

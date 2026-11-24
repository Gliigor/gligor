import Link from "next/link";
import { notFound } from "next/navigation";
import { asAdmin } from "@/lib/auth";
import { STAGE_LABEL } from "@/lib/config";
import type { TemplateRow } from "@/lib/types";
import { Field, PageHeader, Tile } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { saveTemplateAction } from "@/app/actions";
import { TEMPLATE_VARIABLES } from "@/lib/domain/templates";

export default async function TemplatePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const [t] = await asAdmin((q) => q<TemplateRow>("select * from email_templates where key = $1", [key]));
  if (!t) notFound();
  return (
    <>
      <PageHeader
        title={t.name}
        subtitle={t.stage ? `Wordt klaargezet bij fase ${STAGE_LABEL[t.stage]}` : "Wordt gebruikt vanuit Betalingen en Vandaag"}
        actions={
          <Link href="/templates" className="btn btn-ghost">
            Terug
          </Link>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <Tile>
          <ActionForm action={saveTemplateAction} className="space-y-3">
            <input type="hidden" name="key" value={t.key} />
            <Field label="Naam">
              <input name="name" defaultValue={t.name} required />
            </Field>
            <Field label="Onderwerp">
              <input name="subject" defaultValue={t.subject} required />
            </Field>
            <Field label="Afzender" hint="Leeg = het standaardadres (EMAIL_FROM). Alleen adressen op @gligor.ai.">
              <input name="from_email" type="email" defaultValue={t.from_email ?? ""} placeholder="hello@gligor.ai" />
            </Field>
            <Field label="Tekst">
              <textarea name="body" rows={18} defaultValue={t.body} className="leading-relaxed" />
            </Field>
            {t.key === "verjaardag" && (
              <p className="rounded-md border border-line bg-bg px-3 py-2 text-[13px] text-muted">
                Deze mail gaat opgemaakt de deur uit (logo, confetti en handtekening), met deze tekst erin. Een platte-tekstversie gaat automatisch mee. De
                vormgeving staat in <code className="num">src/lib/email/BirthdayEmail.tsx</code>.
              </p>
            )}
            <label className="flex items-center gap-2 text-[13px] text-fg">
              <input type="checkbox" name="auto_send" defaultChecked={t.auto_send} />
              Automatisch versturen (zonder controle vooraf)
            </label>
            <Submit className="btn btn-primary" pendingLabel="Opslaan…">
              Opslaan
            </Submit>
          </ActionForm>
        </Tile>
        <Tile label="Variabelen">
          <ul className="space-y-1 text-[13px]">
            {TEMPLATE_VARIABLES.map((v) => (
              <li key={v.name}>
                <code className="num text-accent">{`{{${v.name}}}`}</code> <span className="text-muted">{v.desc}</span>
              </li>
            ))}
          </ul>
        </Tile>
      </div>
    </>
  );
}

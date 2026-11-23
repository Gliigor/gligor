import Link from "next/link";
import { notFound } from "next/navigation";
import { asAdmin } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import type { EmailRow } from "@/lib/types";
import { PageHeader, Pill, Tile, Field } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { discardEmailAction, saveEmailAction } from "@/app/actions";

export const metadata = { title: "E-mail" };

export default async function EmailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ terug?: string }> }) {
  const { id } = await params;
  const { terug } = await searchParams;
  const back = terug?.startsWith("/") ? terug : "/vandaag";
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const email = await asAdmin(async (q) => {
    const [e] = await q<EmailRow & { company: string | null; template_name: string | null }>(
      `select e.*, c.company, t.name as template_name from emails e
       left join clients c on c.id = e.client_id left join email_templates t on t.key = e.template_key where e.id = $1`,
      [id],
    );
    return e;
  });
  if (!email) notFound();
  const editable = email.status === "concept" || email.status === "gepland" || email.status === "mislukt";

  return (
    <>
      <PageHeader
        title={editable ? "E-mail nakijken" : "E-mail"}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Pill tone={email.status === "verzonden" ? "green" : email.status === "mislukt" ? "red" : email.status === "gepland" ? "blue" : "grey"}>
              {email.status}
              {email.status === "gepland" && ` · ${formatDate(email.scheduled_for)}`}
            </Pill>
            {email.template_name && <span>{email.template_name}</span>}
            {email.client_id && (
              <Link href={`/klanten/${email.client_id}`} className="link">
                {email.company}
              </Link>
            )}
          </span>
        }
        actions={
          <Link href={back} className="btn btn-ghost">
            Terug
          </Link>
        }
      />
      <Tile>
        {editable ? (
          <ActionForm action={saveEmailAction} className="space-y-3">
            <input type="hidden" name="email_id" value={email.id} />
            <input type="hidden" name="return_to" value={back} />
            {email.error && <p className="text-sm text-danger">Vorige poging mislukt: {email.error}</p>}
            <Field label="Aan">
              <input name="to_email" type="email" defaultValue={email.to_email} required />
            </Field>
            <Field label="Onderwerp">
              <input name="subject" defaultValue={email.subject} required />
            </Field>
            <Field label="Tekst">
              <textarea name="body" rows={16} defaultValue={email.body} className="font-sans leading-relaxed" />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Submit className="btn btn-primary" name="intent" value="send" pendingLabel="Versturen…">
                Versturen
              </Submit>
              <Submit className="btn" name="intent" value="save">
                Opslaan als concept
              </Submit>
            </div>
          </ActionForm>
        ) : (
          <div className="space-y-2">
            <div className="text-[13px] text-muted">
              Aan {email.to_email} · verstuurd {formatDateTime(email.sent_at)}
            </div>
            <div className="font-medium">{email.subject}</div>
            <div className="whitespace-pre-line leading-relaxed">{email.body}</div>
          </div>
        )}
        {editable && (
          <form action={discardEmailAction} className="mt-4 border-t border-line pt-4">
            <input type="hidden" name="email_id" value={email.id} />
            <input type="hidden" name="return_to" value={back} />
            <Submit className="btn btn-ghost btn-sm">Concept weggooien</Submit>
          </form>
        )}
      </Tile>
    </>
  );
}

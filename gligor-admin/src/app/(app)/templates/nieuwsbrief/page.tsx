import Link from "next/link";
import { asAdmin } from "@/lib/auth";
import { Field, PageHeader, Tile } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { sendNewsletterAction } from "@/app/actions";

export const metadata = { title: "Nieuwsbrief" };

export default async function NieuwsbriefPage() {
  const [{ n }] = await asAdmin((q) =>
    q<{ n: number }>(
      "select count(*)::int as n from clients where stage in ('inrichting','training','checkin','doorlopend') and coalesce(email,'') <> ''",
    ),
  );
  return (
    <>
      <PageHeader
        title="Nieuwsbrief"
        subtitle={`Gaat naar alle ${n} actieve klanten, persoonlijk met hun eigen naam. Komt in ieders logboek.`}
        actions={
          <Link href="/templates" className="btn btn-ghost">
            Terug
          </Link>
        }
      />
      <Tile>
        <ActionForm action={sendNewsletterAction} className="space-y-3">
          <Field label="Onderwerp">
            <input name="subject" required placeholder="Nieuw in AI deze maand" />
          </Field>
          <Field label="Tekst" hint="Je kunt {{voornaam}} en {{bedrijf}} gebruiken.">
            <textarea
              name="body"
              rows={16}
              required
              defaultValue={"Hoi {{voornaam}},\n\nDeze maand drie dingen die jou tijd kunnen besparen:\n\n1. \n2. \n3. \n\nVragen? Antwoord gewoon op deze mail.\n\nGroet,\nGligor"}
            />
          </Field>
          <label className="flex items-center gap-2 text-[13px] text-fg">
            <input type="checkbox" name="confirm" value="ja" /> Ja, verstuur naar alle {n} actieve klanten
          </label>
          <Submit className="btn btn-primary" pendingLabel="Versturen…">
            Nieuwsbrief versturen
          </Submit>
        </ActionForm>
      </Tile>
    </>
  );
}

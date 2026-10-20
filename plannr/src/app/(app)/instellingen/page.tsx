import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { ChevronRight } from "@/components/ui/icons";
import { formatDateTime } from "@/lib/format";
import { EU_REGIONS, getAiReaderStatus } from "@/lib/extraction/ai/config";
import { AiReaderSwitch, FirmForm, FirmReturnsForm, InviteForm, RevokeButton } from "./settings-forms";
import { parseReturns } from "@/lib/plan/types";

export const metadata = { title: "Instellingen" };

export default async function SettingsPage() {
  const member = await requireOwner();
  const supabase = await createClient();
  const reader = getAiReaderStatus();
  const regionName = EU_REGIONS[reader.configured ? reader.config.region : "eu-central-1"];
  const [{ data: users }, { data: invitations }] = await Promise.all([
    supabase.from("users").select("id, name, email, role, last_login_at").order("created_at"),
    supabase.from("invitations").select("id, email, created_at").is("accepted_at", null).order("created_at", { ascending: false }),
  ]);

  return (
    <div className="space-y-7">
      <PageHeader eyebrow={member.firm.name} title="Instellingen" />

      <Link href="/instellingen/huisstijl" className="block">
        <Card className="flex items-center gap-4 px-5 py-4 hover:bg-ink-50">
          <div className="flex-1">
            <div className="font-semibold">Huisstijl</div>
            <div className="text-sm text-ink-500">Logo, kleuren, lettertypen en lay-out van de rapporten</div>
          </div>
          <ChevronRight className="h-5 w-5 text-ink-400" />
        </Card>
      </Link>

      <Card>
        <CardHeader title="Kantoor" />
        <div className="p-4 sm:p-5">
          <FirmForm name={member.firm.name} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Verwacht rendement (RVR)"
          description="Realistisch verwacht rendement per soort vermogen, per jaar. Dit is de startwaarde voor alle plannen van het kantoor; per plan aan te passen. Leeg laten: de waarde die grijs staat."
        />
        <div className="p-4 sm:p-5">
          <FirmReturnsForm initial={parseReturns(member.firm.rendement_standaard)} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Documenten uitlezen"
          description="Laat een geüploade IB-aangifte of jaarrekening automatisch overnemen in het plan."
        />
        <div className="space-y-4 p-4 sm:p-5">
          <AiReaderSwitch
            enabled={member.firm.ai_extraction_enabled}
            available={reader.configured}
            unavailableReason={reader.configured ? undefined : reader.reason}
          />
          <ul className="space-y-1.5 border-t border-ink-100 pt-4 text-sm text-ink-600">
            <li>Het document wordt gelezen door Claude (Anthropic) via Amazon Bedrock, binnenkomend in {regionName} en verwerkt binnen het EU-profiel van AWS. Het gaat niet naar de VS of naar Anthropic.</li>
            <li>Alleen het bestand wordt verstuurd, zonder naam of andere gegevens uit Plannr. Er wordt niet om een BSN of adres gevraagd.</li>
            <li>Volgens de voorwaarden van Amazon Bedrock wordt de inhoud niet bewaard en niet gebruikt om modellen te trainen.</li>
            <li>De AI neemt alleen bedragen over, met het paginanummer erbij. Alle berekeningen doet Plannr zelf. Controleer de ingevulde waarden altijd.</li>
            <li>Zet je dit aan, vermeld AWS dan als subverwerker in je verwerkersovereenkomst en privacyverklaring.</li>
          </ul>
          {member.firm.ai_extraction_changed_at ? (
            <p className="text-xs text-ink-400">Laatst gewijzigd op {formatDateTime(member.firm.ai_extraction_changed_at)}</p>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Team"
          description="Uitgenodigde planners komen automatisch bij je kantoor en gebruiken dezelfde huisstijl."
        />
        <ul className="divide-y divide-ink-100">
          {(users ?? []).map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{u.name || u.email}</div>
                <div className="truncate text-sm text-ink-500">{u.email}</div>
              </div>
              <span className="text-xs text-ink-500">
                {u.last_login_at ? `Laatst ingelogd ${formatDateTime(u.last_login_at)}` : "Nog niet ingelogd"}
              </span>
              <Badge tone={u.role === "owner" ? "brand" : "neutral"}>{u.role === "owner" ? "Eigenaar" : "Planner"}</Badge>
            </li>
          ))}
          {(invitations ?? []).map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{i.email}</div>
                <div className="text-sm text-ink-500">Uitgenodigd op {formatDateTime(i.created_at)}</div>
              </div>
              <Badge tone="warn">Uitgenodigd</Badge>
              <RevokeButton invitationId={i.id} />
            </li>
          ))}
        </ul>
        <div className="border-t border-ink-100 p-4 sm:p-5">
          <InviteForm />
        </div>
      </Card>
    </div>
  );
}

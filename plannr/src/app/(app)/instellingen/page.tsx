import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { ChevronRight } from "@/components/ui/icons";
import { formatDateTime } from "@/lib/format";
import { FirmForm, InviteForm, RevokeButton } from "./settings-forms";

export const metadata = { title: "Instellingen" };

export default async function SettingsPage() {
  const member = await requireOwner();
  const supabase = await createClient();
  const [{ data: users }, { data: invitations }] = await Promise.all([
    supabase.from("users").select("id, name, email, role, last_login_at").order("created_at"),
    supabase.from("invitations").select("id, email, created_at").is("accepted_at", null).order("created_at", { ascending: false }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Instellingen</h1>

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

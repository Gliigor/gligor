import { PageHeader } from "@/components/ui/page-header";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toHouseStyle } from "@/lib/house-style/types";
import { HouseStyleEditor } from "./house-style-editor";

export const metadata = { title: "Huisstijl" };

export default async function HouseStylePage() {
  const member = await requireOwner();
  const supabase = await createClient();
  const { data: row } = await supabase.from("house_styles").select("*").eq("is_active", true).maybeSingle();
  const style = toHouseStyle(row);
  let logoUrl: string | null = null;
  if (style.logoPath) {
    const { data } = await supabase.storage.from("logos").createSignedUrl(style.logoPath, 3600);
    logoUrl = data?.signedUrl ?? null;
  }

  return (
    <div className="space-y-7">
      <PageHeader
        back={{ href: "/instellingen", label: "Instellingen" }}
        eyebrow="Rapporten"
        title="Huisstijl"
        subtitle={`Geldt automatisch voor elk rapport dat iemand van ${member.firm.name} exporteert. Eerder geëxporteerde rapporten blijven ongewijzigd.`}
      />
      <HouseStyleEditor firmId={member.firm.id} firmName={member.firm.name} initial={style} logoUrl={logoUrl} website={member.firm.website_url ?? ""} />
    </div>
  );
}

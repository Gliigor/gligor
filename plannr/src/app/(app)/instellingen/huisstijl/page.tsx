import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toHouseStyle } from "@/lib/house-style/types";
import { ArrowLeft } from "@/components/ui/icons";
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
    <div className="space-y-5">
      <Link href="/instellingen" className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" /> Instellingen
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Huisstijl</h1>
        <p className="text-sm text-ink-500">
          Geldt automatisch voor elk rapport dat iemand van {member.firm.name} exporteert. Eerder geëxporteerde rapporten
          blijven ongewijzigd.
        </p>
      </div>
      <HouseStyleEditor firmId={member.firm.id} firmName={member.firm.name} initial={style} logoUrl={logoUrl} website={member.firm.website_url ?? ""} />
    </div>
  );
}
